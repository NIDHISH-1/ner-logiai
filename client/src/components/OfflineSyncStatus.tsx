import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { CheckCircle2, CloudOff, Loader2, RefreshCw, Wifi } from "lucide-react";
import { dataUrlToUpload, OFFLINE_QUEUE_EVENT, pendingOfflineCount, readOfflineQueue, type OfflineIncident, writeOfflineQueue } from "@/lib/offlineIncidentQueue";

type SyncState = "IDLE" | "SYNCING" | "OFFLINE" | "ERROR";

async function uploadQueuedPhoto(item: OfflineIncident) {
  if (!item.photoDataUrl || item.photoUrl) return item.photoUrl;
  const { mimeType, dataBase64 } = dataUrlToUpload(item.photoDataUrl);
  const response = await fetch("/api/uploads/incident-photo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: item.photoName ?? "offline-incident-photo", mimeType, sizeBytes: Math.ceil(dataBase64.length * 0.75), dataBase64 }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload.url !== "string") throw new Error(payload.error ?? "Queued photo upload failed.");
  return payload.url as string;
}

export function OfflineSyncStatus({ onSynced }: { onSynced?: () => void }) {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [items, setItems] = useState<OfflineIncident[]>(() => readOfflineQueue());
  const [state, setState] = useState<SyncState>(() => typeof navigator !== "undefined" && !navigator.onLine ? "OFFLINE" : "IDLE");
  const [lastSync, setLastSync] = useState<string | null>(() => readOfflineQueue().filter(item => item.syncedAt).sort((a, b) => (b.syncedAt ?? "").localeCompare(a.syncedAt ?? ""))[0]?.syncedAt ?? null);
  const syncing = useRef(false);
  const syncIncident = trpc.demo.syncIncident.useMutation();
  const utils = trpc.useUtils();

  const refresh = useCallback(() => setItems(readOfflineQueue()), []);

  const sync = useCallback(async () => {
    if (!navigator.onLine || syncing.current) return;
    const queued = readOfflineQueue();
    const candidates = queued.filter(item => item.status === "PENDING" || item.status === "FAILED");
    if (!candidates.length) { setState("IDLE"); refresh(); return; }
    syncing.current = true;
    setState("SYNCING");
    let hadFailure = false;
    for (const item of candidates) {
      let current = readOfflineQueue();
      current = current.map(entry => entry.id === item.id ? { ...entry, status: "SYNCING" as const, attempts: entry.attempts + 1, lastError: undefined } : entry);
      writeOfflineQueue(current);
      try {
        const photoUrl = await uploadQueuedPhoto(item);
        const result = await syncIncident.mutateAsync({ id: item.id, type: item.type, severity: item.severity, description: item.description, latitude: item.latitude, longitude: item.longitude, roadAccessibility: item.roadAccessibility, occurredAt: new Date(item.occurredAt), photoUrl });
        current = readOfflineQueue();
        if (result.status === "CONFLICT") {
          hadFailure = true;
          current = current.map(entry => entry.id === item.id ? { ...entry, status: "CONFLICT" as const, lastError: "Server data differs; review required.", conflictReason: "The same offline ID exists remotely with different content." } : entry);
          toast.error(`Conflict detected for ${item.id}; server data preserved.`);
        } else {
          const now = new Date().toISOString();
          current = current.map(entry => entry.id === item.id ? { ...entry, status: "SYNCED" as const, photoUrl: photoUrl ?? entry.photoUrl, syncedAt: now, lastError: undefined } : entry);
          setLastSync(now);
        }
        writeOfflineQueue(current);
      } catch (error) {
        hadFailure = true;
        const message = error instanceof Error ? error.message : "Synchronization failed.";
        current = readOfflineQueue().map(entry => entry.id === item.id ? { ...entry, status: "FAILED" as const, lastError: message } : entry);
        writeOfflineQueue(current);
      }
    }
    await Promise.all([utils.demo.snapshot.invalidate(), utils.demo.incidents.invalidate()]);
    onSynced?.();
    syncing.current = false;
    setState(hadFailure ? "ERROR" : "IDLE");
    if (!hadFailure) toast.success("Offline reports synchronized.");
  }, [onSynced, refresh, syncIncident, utils.demo.incidents, utils.demo.snapshot]);

  useEffect(() => {
    const goOnline = () => { setOnline(true); void sync(); };
    const goOffline = () => { setOnline(false); setState("OFFLINE"); };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    window.addEventListener(OFFLINE_QUEUE_EVENT, refresh);
    refresh();
    if (navigator.onLine) void sync();
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); window.removeEventListener(OFFLINE_QUEUE_EVENT, refresh); };
  }, [refresh, sync]);

  const pending = pendingOfflineCount(items);
  const conflicts = items.filter(item => item.status === "CONFLICT").length;
  const statusLabel = !online ? "OFFLINE MODE" : state === "SYNCING" ? "SYNCING" : state === "ERROR" ? "SYNC ERROR" : "ONLINE";
  const statusClass = !online || state === "ERROR" ? "border-orange-200 bg-orange-50 text-orange-700" : state === "SYNCING" ? "border-sky-200 bg-sky-50 text-sky-700" : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return <div className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-semibold ${statusClass}`} aria-live="polite"><span className="inline-flex items-center gap-1.5">{!online ? <CloudOff size={13} /> : state === "SYNCING" ? <Loader2 size={13} className="animate-spin" /> : state === "ERROR" ? <RefreshCw size={13} /> : <Wifi size={13} />}{statusLabel}</span><span className="text-slate-500">Pending {pending}</span>{conflicts > 0 && <span className="text-red-700">CONFLICT {conflicts}</span>}{lastSync && <span className="hidden text-slate-500 sm:inline">Last sync {new Date(lastSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}{(pending > 0 || conflicts > 0) && <Button type="button" disabled={!online || state === "SYNCING"} onClick={() => void sync()} variant="ghost" size="sm" className="h-6 gap-1 px-2 text-[11px] text-slate-700"><RefreshCw size={12} /> Retry</Button>}{pending === 0 && conflicts === 0 && state === "IDLE" && <CheckCircle2 size={13} />}</div>;
}
