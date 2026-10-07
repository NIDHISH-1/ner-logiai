import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, CloudOff, Database, MapPin, Navigation, Route, ShieldAlert } from "lucide-react";
import { formatCacheAge, getPersistedCache, setPersistedCache } from "@/lib/persistentCache";

export function DriverNavigationDialog({
  open,
  onOpenChange,
  onShowOnMap,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShowOnMap?: () => void;
}) {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);

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

  const routeQuery = trpc.operations.route.useQuery(
    { origin: "GUWAHATI", destination: "IMPHAL" },
    { retry: false }
  );

  useEffect(() => {
    if (routeQuery.data?.recommendation) {
      setPersistedCache("route.GUWAHATI-IMPHAL", routeQuery.data.recommendation);
    }
  }, [routeQuery.data]);

  const cachedEntry = getPersistedCache<any>("route.GUWAHATI-IMPHAL");
  const recommendation = routeQuery.data?.recommendation || cachedEntry?.data;
  const isFromCache = !routeQuery.data?.recommendation && Boolean(cachedEntry?.data);

  const handleFocusMap = () => {
    window.dispatchEvent(
      new CustomEvent("ner-route-selection", {
        detail: { origin: "GUWAHATI", destination: "IMPHAL" },
      })
    );
    onOpenChange(false);
    onShowOnMap?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-0 bg-sky-100 text-sky-800">DRIVER ACTIVE NAVIGATION</Badge>
            {!online && (
              <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-900 text-[10px] font-bold flex items-center gap-1">
                <CloudOff size={11} /> OFFLINE NAVIGATION
              </Badge>
            )}
            {isFromCache && cachedEntry && (
              <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-700 text-[10px] font-semibold flex items-center gap-1">
                <Database size={11} /> CACHED ROUTE · {formatCacheAge(cachedEntry.cachedAt)}
              </Badge>
            )}
            <Badge variant="outline" className="text-[11px] border-emerald-300 text-emerald-700">
              {recommendation?.status === "RECOMMENDED" ? "VALIDATED BY SAFETY ENGINE" : "SAFETY CHECK REQUIRED"}
            </Badge>
          </div>
          <DialogTitle className="text-xl font-bold text-slate-900 mt-2 flex items-center gap-2">
            <Navigation className="text-sky-600" size={20} />
            Guwahati → Imphal Recommended Corridor
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {!online
              ? "Displaying previously synchronized route intelligence. Live road telemetry disabled while offline."
              : "Real-time multi-criteria route optimization powered by A* and the 3-tier Safety Validator."}
          </DialogDescription>
        </DialogHeader>

        {recommendation ? (
          <div className="space-y-4 mt-3">
            {/* Primary Safety Alert */}
            {recommendation.shortestRouteRejected && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 flex items-start gap-3">
                <ShieldAlert className="text-red-600 shrink-0 mt-0.5" size={18} />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-red-900">
                    Direct Highway (NH-37 via Jorhat) REJECTED by Safety Validator
                  </p>
                  <p className="text-red-700 leading-relaxed">
                    Severe bridge undermine at km 284 poses structural collapse hazard. The shortest route cannot be dispatched safely.
                  </p>
                </div>
              </div>
            )}

            {/* Active Route Details */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned Route</span>
                  <h4 className="text-base font-bold text-slate-900">{recommendation.routeLabel}</h4>
                </div>
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 text-xs px-2.5 py-1">
                  SAFETY: {recommendation.safetyStatus}
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 text-center">
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Total Distance</p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">{recommendation.distanceKm} km</p>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Estimated Travel</p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">
                    {Math.floor((recommendation.etaMinutes ?? 0) / 60)}h {(recommendation.etaMinutes ?? 0) % 60}m
                  </p>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Corridor Risk</p>
                  <p className="text-sm font-bold text-emerald-600 mt-0.5">{recommendation.riskProbability ?? 14}%</p>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Confidence</p>
                  <p className="text-sm font-bold text-slate-700 mt-0.5">{recommendation.confidence ?? 91}%</p>
                </div>
              </div>

              {/* Waypoints sequence */}
              <div className="pt-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">Route Waypoint Path</span>
                <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono text-slate-700">
                  {recommendation.route?.map((node: string, index: number) => (
                    <span key={node} className="flex items-center gap-1">
                      <span className="bg-white px-2 py-1 rounded border border-slate-200 font-semibold text-slate-800">
                        {node}
                      </span>
                      {index < recommendation.route.length - 1 && <span className="text-slate-400">→</span>}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Offline Advisory Notice */}
            {!online && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <CloudOff size={14} className="text-amber-700" />
                  Offline Navigation Advisory
                </p>
                <p className="text-amber-800 leading-relaxed">
                  Navigating using pre-cached road geometry and risk assessments. If conditions on the ground diverge, report hazards locally for automatic synchronization once connectivity is restored.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs"
              >
                Close
              </Button>
              <Button
                size="sm"
                onClick={handleFocusMap}
                className="gap-2 bg-sky-600 text-white hover:bg-sky-700 text-xs"
              >
                <MapPin size={14} />
                View On Operational Map
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading route guidance...
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
