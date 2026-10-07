import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, CloudOff, ShieldCheck } from "lucide-react";
import { generateStableActionId, saveOfflineAction } from "@/lib/offlineStore";
import { getPersistedCache, setPersistedCache } from "@/lib/persistentCache";

export function DriverAcceptRouteDialog({
  open,
  onOpenChange,
  onAccepted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccepted?: (routeLabel: string, isOffline?: boolean) => void;
}) {
  const [driverNotes, setDriverNotes] = useState("");
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const trpcUtils = trpc.useUtils();
  const routeQuery = trpc.operations.route.useQuery(undefined, {
    retry: false,
  });

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Cache route recommendation when online, or retrieve cached if offline
  useEffect(() => {
    if (routeQuery.data?.recommendation) {
      setPersistedCache("route.TRK-104", routeQuery.data.recommendation);
    }
  }, [routeQuery.data]);

  const cachedRec = getPersistedCache<any>("route.TRK-104")?.data;
  const rec = routeQuery.data?.recommendation || cachedRec;

  const mutation = trpc.operations.acceptRoute.useMutation({
    onSuccess: async (data) => {
      await Promise.all([
        trpcUtils.operations.snapshot.invalidate(),
        trpcUtils.demo.snapshot.invalidate(),
        trpcUtils.operations.route.invalidate(),
      ]);
      toast.success("Alternate route decision recorded in system registry!");
      onAccepted?.(data.routeLabel, false);
      onOpenChange(false);
    },
    onError: (err: any) => {
      // If error was due to network disconnect, queue offline
      if (!navigator.onLine || err.message?.includes("fetch") || err.message?.includes("network")) {
        queueOfflineRouteAcceptance();
      } else {
        toast.error(`Route acceptance error: ${err.message}`);
      }
    },
  });

  const queueOfflineRouteAcceptance = () => {
    const actionId = generateStableActionId("ROUTE_ACCEPTANCE", "TRK-104");
    const routeLabel = rec?.routeLabel || "Route B (NH-6 / NH-27 Corridor)";
    const alternateRoute = rec?.route?.join("-") || "Guwahati-Shillong-Imphal";
    const acceptedAt = new Date().toISOString();

    saveOfflineAction({
      actionId,
      actionType: "ROUTE_ACCEPTANCE",
      createdAt: acceptedAt,
      payload: {
        routeId: alternateRoute,
        vehicleId: "TRK-104",
        routeLabel,
        alternateRoute,
        distanceKm: rec?.distanceKm ?? 440,
        etaMinutes: rec?.etaMinutes ?? 253,
        delayMinutes: 31,
        delayReason: "Delay due to route change (+23 km safe detour avoiding blocked NH-37)",
        humanInTheLoopConfirmed: true,
        automaticVehicleRedirect: false,
        acceptedAt,
        driverNotes: driverNotes.trim() || undefined,
      },
      status: "PENDING",
      retryCount: 0,
    });

    toast.info("Route confirmed locally. Queued as PENDING SYNC.");
    onAccepted?.(routeLabel, true);
    onOpenChange(false);
  };

  const handleConfirm = () => {
    if (!online) {
      queueOfflineRouteAcceptance();
      return;
    }

    mutation.mutate({
      vehicleId: "TRK-104",
      routeLabel: rec?.routeLabel || "Route B (NH-6 / NH-27 Corridor)",
      alternateRoute: rec?.route?.join("-") || "Guwahati-Shillong-Imphal",
      distanceKm: rec?.distanceKm ?? 440,
      etaMinutes: rec?.etaMinutes ?? 253,
      delayMinutes: 31,
      delayReason: "Delay due to route change (+23 km safe detour avoiding blocked NH-37)",
      driverNotes: driverNotes.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge className="border-0 bg-emerald-100 text-emerald-800">HUMAN-IN-THE-LOOP ACTION</Badge>
            {!online && (
              <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-900 text-[10px] font-bold flex items-center gap-1">
                <CloudOff size={11} /> OFFLINE MODE
              </Badge>
            )}
            <Badge variant="outline" className="text-[11px] border-slate-200 text-slate-600">
              TRUCK #TRK-104
            </Badge>
          </div>
          <DialogTitle className="text-xl font-bold text-slate-900 mt-2 flex items-center gap-2">
            <CheckCircle2 className="text-emerald-600" size={20} />
            Accept Alternate Recommended Route
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Confirm decision to proceed along Route B (NH-6 / NH-27 bypass) instead of high-risk direct path.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-3">
          {/* Critical Human-in-the-Loop Disclosure */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 flex items-start gap-3">
            <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={17} />
            <div className="text-xs space-y-1">
              <p className="font-bold text-amber-950">
                Safety Engine Protocol: Human Authorization Required
              </p>
              <p className="text-amber-800 leading-relaxed">
                Accepting this route logs your confirmation in the operational audit log.
                <strong> The system will NOT automatically redirect or steer your vehicle.</strong> You maintain full manual control.
              </p>
              {!online && (
                <p className="text-[11px] text-amber-900 font-semibold pt-1 border-t border-amber-200">
                  ⚡ Network disconnected: Confirmation will be stored as LOCAL CONFIRMATION (PENDING SYNC) and synchronized upon reconnect.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">Selected Route:</span>
              <span className="font-bold text-emerald-700">{rec?.routeLabel || "Route B (NH-6 / NH-27 Bypass)"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Distance & Duration:</span>
              <span className="text-slate-800 font-mono text-[11px]">
                {rec?.distanceKm ?? 440} km · {Math.floor((rec?.etaMinutes ?? 442) / 60)}h {(rec?.etaMinutes ?? 442) % 60}m
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Safety Status:</span>
              <span className="text-emerald-600 font-bold">{rec?.safetyStatus ?? "SAFE"} ({rec?.riskProbability ?? 18}% risk score)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Hazard Avoided:</span>
              <span className="text-red-600 font-medium">
                {rec?.rejectedAlternatives?.[0]?.label || "NH-37 Jorhat Bridge Compromise"}
              </span>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Driver Operational Notes (Optional)
            </label>
            <input
              type="text"
              value={driverNotes}
              onChange={(e) => setDriverNotes(e.target.value)}
              placeholder="e.g. Departing via Shillong bypass with convoy escort"
              className="w-full text-xs h-9 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs border-slate-200"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={mutation.isPending}
              onClick={handleConfirm}
              className={`gap-2 text-white text-xs ${!online ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
            >
              <ShieldCheck size={14} />
              {mutation.isPending
                ? "Recording Acceptance..."
                : !online
                ? "Confirm Offline (Queue Sync)"
                : "Confirm & Accept Route"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
