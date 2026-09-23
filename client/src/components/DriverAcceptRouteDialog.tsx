import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, ShieldCheck, Truck } from "lucide-react";

export function DriverAcceptRouteDialog({
  open,
  onOpenChange,
  onAccepted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccepted?: (routeLabel: string) => void;
}) {
  const [driverNotes, setDriverNotes] = useState("");
  const trpcUtils = trpc.useUtils();
  const routeQuery = trpc.operations.route.useQuery();
  const rec = routeQuery.data?.recommendation;

  const mutation = trpc.operations.acceptRoute.useMutation({
    onSuccess: async (data) => {
      await Promise.all([
        trpcUtils.operations.snapshot.invalidate(),
        trpcUtils.demo.snapshot.invalidate(),
        trpcUtils.operations.route.invalidate(),
      ]);
      toast.success("Alternate route decision recorded in system registry!");
      onAccepted?.(data.routeLabel);
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(`Route acceptance error: ${err.message}`);
    },
  });

  const handleConfirm = () => {
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
              className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700 text-xs"
            >
              <ShieldCheck size={14} />
              {mutation.isPending ? "Recording Acceptance..." : "Confirm & Accept Route"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
