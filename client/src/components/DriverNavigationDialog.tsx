import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, MapPin, Navigation, Route, ShieldAlert } from "lucide-react";

export function DriverNavigationDialog({
  open,
  onOpenChange,
  onShowOnMap,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShowOnMap?: () => void;
}) {
  const routeQuery = trpc.operations.route.useQuery({
    origin: "GUWAHATI",
    destination: "IMPHAL",
  });
  const recommendation = routeQuery.data?.recommendation;

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
          <div className="flex items-center gap-2">
            <Badge className="border-0 bg-sky-100 text-sky-800">DRIVER ACTIVE NAVIGATION</Badge>
            <Badge variant="outline" className="text-[11px] border-emerald-300 text-emerald-700">
              {recommendation?.status === "RECOMMENDED" ? "VALIDATED BY SAFETY ENGINE" : "SAFETY CHECK REQUIRED"}
            </Badge>
          </div>
          <DialogTitle className="text-xl font-bold text-slate-900 mt-2 flex items-center gap-2">
            <Navigation className="text-sky-600" size={20} />
            Guwahati → Imphal Recommended Corridor
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Real-time multi-criteria route optimization powered by A* and the 3-tier Safety Validator.
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
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Route Checkpoints</p>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-700">
                  {recommendation.route.map((node, idx) => (
                    <span key={node} className="inline-flex items-center gap-1">
                      <span className="font-semibold bg-white px-2 py-0.5 rounded border border-slate-200">
                        {node}
                      </span>
                      {idx < recommendation.route.length - 1 && (
                        <span className="text-slate-400">→</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-slate-500 pt-1 leading-relaxed">
                {recommendation.reason}
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs border-slate-200"
              >
                Close Navigation Details
              </Button>
              <Button
                size="sm"
                onClick={handleFocusMap}
                className="gap-2 bg-[#12313b] text-white hover:bg-[#1d4853] text-xs"
              >
                <MapPin size={14} /> Focus on Map & Waypoints
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-slate-500">
            Calculating safe route recommendations from engine...
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
