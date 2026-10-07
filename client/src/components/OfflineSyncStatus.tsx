import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { CheckCircle2, CloudOff, Loader2, RefreshCw, Wifi, AlertTriangle } from "lucide-react";
import { dataUrlToUpload, OFFLINE_QUEUE_EVENT, pendingOfflineCount, readOfflineQueue, type OfflineIncident, writeOfflineQueue } from "@/lib/offlineIncidentQueue";
import {
  getAllOfflineActions,
  getPendingActionsCount,
  OFFLINE_ACTIONS_EVENT,
  updateActionStatus,
  type OfflineAction,
} from "@/lib/offlineStore";
import { ConflictResolutionModal } from "./ConflictResolutionModal";

type SyncState = "IDLE" | "SYNCING" | "OFFLINE" | "ERROR";

async function uploadQueuedPhoto(item: OfflineIncident) {
  if (!item.photoDataUrl || item.photoUrl) return item.photoUrl;
  const { mimeType, dataBase64 } = dataUrlToUpload(item.photoDataUrl);
  const response = await fetch("/api/uploads/incident-photo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: item.photoName ?? "offline-incident-photo",
      mimeType,
      sizeBytes: Math.ceil(dataBase64.length * 0.75),
      dataBase64,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload.url !== "string") throw new Error(payload.error ?? "Queued photo upload failed.");
  return payload.url as string;
}

export function OfflineSyncStatus({ onSynced }: { onSynced?: () => void }) {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [incidents, setIncidents] = useState<OfflineIncident[]>(() => readOfflineQueue());
  const [actions, setActions] = useState<OfflineAction[]>(() => getAllOfflineActions());
  const [state, setState] = useState<SyncState>(() => typeof navigator !== "undefined" && !navigator.onLine ? "OFFLINE" : "IDLE");
  const [lastSync, setLastSync] = useState<string | null>(() => {
    const fromIncidents = readOfflineQueue().filter(item => item.syncedAt).map(i => i.syncedAt!);
    const fromActions = getAllOfflineActions().filter(item => item.syncedAt).map(a => a.syncedAt!);
    const all = [...fromIncidents, ...fromActions].sort().reverse();
    return all[0] ?? null;
  });

  const [activeConflict, setActiveConflict] = useState<OfflineIncident | null>(null);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);

  const syncing = useRef(false);
  const syncIncident = trpc.demo.syncIncident.useMutation();
  const syncRouteAcceptance = trpc.operations.syncRouteAcceptance.useMutation();
  const syncAlertAcknowledge = trpc.operations.syncAlertAcknowledge.useMutation();
  const syncRoadStatus = trpc.operations.syncRoadStatus.useMutation();
  const utils = trpc.useUtils();

  const syncIncidentRef = useRef(syncIncident.mutateAsync);
  syncIncidentRef.current = syncIncident.mutateAsync;
  const syncRouteRef = useRef(syncRouteAcceptance.mutateAsync);
  syncRouteRef.current = syncRouteAcceptance.mutateAsync;
  const syncAlertRef = useRef(syncAlertAcknowledge.mutateAsync);
  syncAlertRef.current = syncAlertAcknowledge.mutateAsync;
  const syncRoadRef = useRef(syncRoadStatus.mutateAsync);
  syncRoadRef.current = syncRoadStatus.mutateAsync;
  const utilsRef = useRef(utils);
  utilsRef.current = utils;
  const onSyncedRef = useRef(onSynced);
  onSyncedRef.current = onSynced;

  const refresh = useCallback(() => {
    const queue = readOfflineQueue();
    const acts = getAllOfflineActions();
    setIncidents(queue);
    setActions(acts);
  }, []);

  const sync = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    if (syncing.current) return;

    const queuedIncidents = readOfflineQueue().filter(item => item.status === "PENDING" || item.status === "FAILED");
    const queuedActions = getAllOfflineActions().filter(item => item.status === "PENDING" || item.status === "FAILED");

    if (queuedIncidents.length === 0 && queuedActions.length === 0) {
      setState(prev => (prev !== "IDLE" ? "IDLE" : prev));
      refresh();
      return;
    }

    syncing.current = true;
    setState("SYNCING");
    let hadFailure = false;
    let syncedCount = 0;

    // 1. Synchronize Incident Reports
    for (const item of queuedIncidents) {
      if (item.attempts >= 5) {
        // Bounded retry backoff
        continue;
      }
      let current = readOfflineQueue();
      current = current.map(entry =>
        entry.id === item.id ? { ...entry, status: "SYNCING" as const, attempts: entry.attempts + 1, lastError: undefined } : entry
      );
      writeOfflineQueue(current);
      try {
        const photoUrl = await uploadQueuedPhoto(item);
        const result = await syncIncidentRef.current({
          id: item.id,
          type: item.type,
          severity: item.severity,
          description: item.description,
          latitude: item.latitude,
          longitude: item.longitude,
          roadAccessibility: item.roadAccessibility,
          occurredAt: new Date(item.occurredAt),
          photoUrl,
        });

        current = readOfflineQueue();
        if (result.status === "CONFLICT") {
          hadFailure = true;
          current = current.map(entry =>
            entry.id === item.id
              ? { ...entry, status: "CONFLICT" as const, lastError: "Server data differs; review required.", conflictReason: "The same offline ID exists remotely with different content." }
              : entry
          );
          toast.error(`Conflict detected for ${item.id}; server data preserved.`);
        } else {
          const now = new Date().toISOString();
          current = current.map(entry =>
            entry.id === item.id ? { ...entry, status: "SYNCED" as const, photoUrl: photoUrl ?? entry.photoUrl, syncedAt: now, lastError: undefined } : entry
          );
          setLastSync(now);
          syncedCount++;
        }
        writeOfflineQueue(current);
      } catch (error) {
        hadFailure = true;
        const message = error instanceof Error ? error.message : "Synchronization failed.";
        current = readOfflineQueue().map(entry => entry.id === item.id ? { ...entry, status: "FAILED" as const, lastError: message } : entry);
        writeOfflineQueue(current);
      }
    }

    // 2. Synchronize Unified Actions (Route Acceptance, Alert Acks, Road Status)
    for (const act of queuedActions) {
      if (act.retryCount >= 5) continue;
      updateActionStatus(act.actionId, "SYNCING", { incrementRetry: true });
      try {
        if (act.actionType === "ROUTE_ACCEPTANCE") {
          const p = act.payload;
          await syncRouteRef.current({
            actionId: act.actionId,
            vehicleId: p.vehicleId,
            routeLabel: p.routeLabel,
            alternateRoute: p.alternateRoute ?? p.routeLabel,
            distanceKm: p.distanceKm,
            etaMinutes: p.etaMinutes,
            delayMinutes: p.delayMinutes,
            delayReason: p.delayReason,
            humanInTheLoopConfirmed: true,
            automaticVehicleRedirect: false,
            acceptedAt: p.acceptedAt ?? act.createdAt,
          });
          const now = new Date().toISOString();
          updateActionStatus(act.actionId, "SYNCED", { syncedAt: now });
          syncedCount++;
          setLastSync(now);
        } else if (act.actionType === "ALERT_ACKNOWLEDGE") {
          const p = act.payload;
          await syncAlertRef.current({
            actionId: act.actionId,
            alertId: p.alertId,
            acknowledgedAt: p.acknowledgedAt ?? act.createdAt,
          });
          const now = new Date().toISOString();
          updateActionStatus(act.actionId, "SYNCED", { syncedAt: now });
          syncedCount++;
          setLastSync(now);
        } else if (act.actionType === "ROAD_STATUS_UPDATE") {
          const p = act.payload;
          await syncRoadRef.current({
            actionId: act.actionId,
            incidentId: p.incidentId,
            corridor: p.corridorId ?? p.corridor,
            roadAccessibility: p.accessibility ?? p.roadAccessibility,
            severity: p.severity ?? "MODERATE",
            description: p.reason ?? p.description ?? "Road status updated from field offline",
            latitude: p.latitude ?? 26.1445,
            longitude: p.longitude ?? 91.7362,
            updatedAt: p.updatedAt ?? act.createdAt,
          });
          const now = new Date().toISOString();
          updateActionStatus(act.actionId, "SYNCED", { syncedAt: now });
          syncedCount++;
          setLastSync(now);
        }
      } catch (err: any) {
        hadFailure = true;
        updateActionStatus(act.actionId, "FAILED", { lastError: err?.message ?? "Sync error" });
      }
    }

    await Promise.all([
      utilsRef.current.demo.snapshot.invalidate(),
      utilsRef.current.demo.incidents.invalidate(),
      utilsRef.current.operations.snapshot.invalidate(),
      utilsRef.current.operations.corridors.invalidate(),
      utilsRef.current.operations.route.invalidate(),
      utilsRef.current.operations.alerts.invalidate(),
    ]);

    onSyncedRef.current?.();
    syncing.current = false;
    setState(hadFailure ? "ERROR" : "IDLE");
    refresh();

    if (syncedCount > 0 && !hadFailure) {
      toast.success(syncedCount === 1 ? "1 offline action synchronized." : `${syncedCount} offline actions synchronized.`);
    }
  }, [refresh]);

  const syncRef = useRef(sync);
  syncRef.current = sync;

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      void syncRef.current();
    };
    const goOffline = () => {
      setOnline(false);
      setState("OFFLINE");
    };

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    window.addEventListener(OFFLINE_QUEUE_EVENT, refresh);
    window.addEventListener(OFFLINE_ACTIONS_EVENT, refresh);

    refresh();
    if (typeof navigator !== "undefined" && navigator.onLine) {
      void syncRef.current();
    }

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener(OFFLINE_QUEUE_EVENT, refresh);
      window.removeEventListener(OFFLINE_ACTIONS_EVENT, refresh);
    };
  }, [refresh]);

  const pendingIncidents = pendingOfflineCount(incidents);
  const pendingActions = getPendingActionsCount();
  const totalPending = pendingIncidents + pendingActions;

  const conflicts = incidents.filter(item => item.status === "CONFLICT");
  const conflictCount = conflicts.length;

  const statusLabel = !online
    ? "OFFLINE MODE"
    : state === "SYNCING"
    ? `SYNCING ${totalPending > 0 ? totalPending : ""} ACTION${totalPending === 1 ? "" : "S"}`
    : state === "ERROR"
    ? "SYNC ERROR"
    : "ONLINE";

  const statusClass = !online || state === "ERROR"
    ? "border-orange-200 bg-orange-50 text-orange-700"
    : state === "SYNCING"
    ? "border-sky-200 bg-sky-50 text-sky-700"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <>
      <div className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-semibold ${statusClass}`} aria-live="polite">
        <span className="inline-flex items-center gap-1.5">
          {!online ? (
            <CloudOff size={13} />
          ) : state === "SYNCING" ? (
            <Loader2 size={13} className="animate-spin" />
          ) : state === "ERROR" ? (
            <RefreshCw size={13} />
          ) : (
            <Wifi size={13} />
          )}
          {statusLabel}
        </span>

        {totalPending > 0 ? (
          <span className="text-slate-600 font-bold">{totalPending} Pending</span>
        ) : (
          <span className="text-slate-500">All Synced</span>
        )}

        {conflictCount > 0 && (
          <button
            type="button"
            onClick={() => {
              setActiveConflict(conflicts[0]);
              setConflictModalOpen(true);
            }}
            className="flex items-center gap-1 text-red-700 font-bold underline hover:text-red-800"
          >
            <AlertTriangle size={12} />
            CONFLICT ({conflictCount})
          </button>
        )}

        {lastSync && (
          <span className="hidden text-slate-500 sm:inline">
            Last sync {new Date(lastSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}

        {(totalPending > 0 || conflictCount > 0) && (
          <Button
            type="button"
            disabled={!online || state === "SYNCING"}
            onClick={() => void sync()}
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-[11px] text-slate-700 hover:bg-white/60"
          >
            <RefreshCw size={12} className={state === "SYNCING" ? "animate-spin" : ""} />
            Retry
          </Button>
        )}

        {totalPending === 0 && conflictCount === 0 && state === "IDLE" && (
          <CheckCircle2 size={13} className="text-emerald-600" />
        )}
      </div>

      {activeConflict && (
        <ConflictResolutionModal
          open={conflictModalOpen}
          onOpenChange={setConflictModalOpen}
          incident={activeConflict}
          onResolved={() => {
            refresh();
            void sync();
          }}
        />
      )}
    </>
  );
}
