import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PackageCheck, Truck, AlertTriangle, ArrowRight, Route, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";

export type CriticalShipment = {
  id: string;
  name: string;
  vehicleId: string;
  origin: string;
  destination: string;
  eta: string;
  risk: "CRITICAL" | "HIGH" | "MODERATE";
  status: "Delayed" | "En Route" | "Rerouted" | "in_transit" | "delivered";
  cargoDetails: string;
};

const criticalLoads: CriticalShipment[] = [
  {
    id: "SHP-001",
    name: "Emergency Medicine (ICU Infusions & Antibiotics)",
    vehicleId: "TRK-104",
    origin: "Guwahati",
    destination: "Imphal",
    eta: "3h 42m (Delayed +42m)",
    risk: "HIGH",
    status: "Rerouted",
    cargoDetails: "Temperature controlled (2-8°C). Rerouted via Kohima NH-2 due to NH-37 bridge compromise.",
  },
  {
    id: "SHP-003",
    name: "Cold Chain Vaccines (Maternal & Infant)",
    vehicleId: "TRK-088",
    origin: "Agartala",
    destination: "Aizawl",
    eta: "5h 06m",
    risk: "MODERATE",
    status: "En Route",
    cargoDetails: "High priority cold transport. Battery backup running at 94% on generator.",
  },
  {
    id: "SHP-007",
    name: "Infant Nutrition & Ready-to-Use Therapeutic Food",
    vehicleId: "TRK-302",
    origin: "Imphal",
    destination: "Ukhrul",
    eta: "2h 18m",
    risk: "CRITICAL",
    status: "Delayed",
    cargoDetails: "Flood-isolated relief center delivery. Convoy awaiting hill clearance.",
  },
  {
    id: "SHP-010",
    name: "Surgical Trauma Supplies & Blood Bags",
    vehicleId: "TRK-219",
    origin: "Guwahati",
    destination: "Tura",
    eta: "3h 05m",
    risk: "MODERATE",
    status: "En Route",
    cargoDetails: "Dispatched under priority emergency transport status.",
  },
  {
    id: "SHP-002",
    name: "Flood Relief Survival Kits & Water Tablets",
    vehicleId: "TRK-112",
    origin: "Dimapur",
    destination: "Kohima",
    eta: "1h 18m",
    risk: "HIGH",
    status: "En Route",
    cargoDetails: "High clearance 4x4 navigating landslide bypass zone with escort.",
  },
  {
    id: "SHP-008",
    name: "Hospital Emergency Generator Diesel Fuel",
    vehicleId: "TRK-405",
    origin: "Dibrugarh",
    destination: "Pasighat",
    eta: "6h 00m (Delayed +90m)",
    risk: "HIGH",
    status: "Delayed",
    cargoDetails: "Fuel bowser convoy delayed at ferry crossing due to high river currents.",
  },
];

export function CriticalShipmentsDialog({
  open,
  onOpenChange,
  onOptimizeRoute,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOptimizeRoute?: () => void;
}) {
  const snapshotQuery = trpc.operations.snapshot.useQuery(undefined, { enabled: open });
  const rawShipments = snapshotQuery.data?.shipments ?? [];

  const dynamicLoads: CriticalShipment[] = rawShipments
    .filter(s => s.priority === "CRITICAL" || s.priority === "HIGH")
    .map(s => {
      const planned = s.plannedEtaMinutes ?? 120;
      const current = s.currentEtaMinutes ?? s.etaMinutes ?? planned;
      const delay = s.delayMinutes ?? (current > planned ? current - planned : 0);
      const delayText = delay > 0 ? ` (+${delay}m delay: ${s.delayReason || "disruption"})` : " (On schedule)";
      return {
        id: s.id,
        name: s.name,
        vehicleId: s.assignedVehicleId ?? "TRK-104",
        origin: s.origin,
        destination: s.destination,
        eta: `${Math.floor(current / 60)}h ${current % 60}m${delayText}`,
        risk: (s.priority === "CRITICAL" ? "CRITICAL" : "HIGH") as any,
        status: s.status === "in_transit" ? "En Route" : "Delayed",
        cargoDetails: s.delayReason ? `Active operational alert: ${s.delayReason}` : `Priority logistics delivery dispatch: ${s.origin} to ${s.destination}.`,
      };
    });

  const allLoads = [
    ...dynamicLoads,
    ...criticalLoads.filter(c => !dynamicLoads.some(d => d.id === c.id)),
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-orange-600">
            <PackageCheck size={18} />
            <span className="text-[11px] font-bold uppercase tracking-wider">Priority Cargo Surveillance</span>
          </div>
          <DialogTitle className="text-lg font-bold text-slate-900">Critical Emergency Shipments (6 Active)</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Real-time telemetry and risk monitoring for life-saving medical, vaccine, and disaster relief supplies.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {allLoads.map((load) => (
            <div
              key={load.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2.5 transition hover:border-slate-300"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <strong className="text-sm text-slate-900">{load.name}</strong>
                    {(() => {
                      const impactStatus: "CRITICALLY AFFECTED" | "AFFECTED" | "NOT AFFECTED" =
                        load.risk === "CRITICAL" || (load.status === "Delayed" && load.risk === "HIGH")
                          ? "CRITICALLY AFFECTED"
                          : load.risk === "HIGH" || load.status === "Delayed" || load.status === "Rerouted"
                          ? "AFFECTED"
                          : "NOT AFFECTED";
                      return (
                        <Badge
                          className={
                            impactStatus === "CRITICALLY AFFECTED"
                              ? "bg-red-600 text-white border-0 text-[10px] font-bold"
                              : impactStatus === "AFFECTED"
                              ? "bg-amber-500 text-white border-0 text-[10px] font-bold"
                              : "bg-slate-100 text-slate-700 border-slate-200 text-[10px]"
                          }
                        >
                          {impactStatus}
                        </Badge>
                      );
                    })()}
                    <Badge
                      className={
                        load.risk === "CRITICAL"
                          ? "bg-red-50 text-red-700 border-red-200 text-[10px]"
                          : load.risk === "HIGH"
                          ? "bg-orange-50 text-orange-700 border-orange-200 text-[10px]"
                          : "bg-yellow-50 text-yellow-700 border-yellow-200 text-[10px]"
                      }
                    >
                      {load.risk} RISK
                    </Badge>
                    <Badge variant="outline" className="border-slate-200 text-slate-600 text-[10px]">
                      {load.status}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1 font-semibold text-slate-700">
                      <Truck size={13} className="text-slate-400" /> {load.vehicleId}
                    </span>
                    <span>{load.origin} &rarr; {load.destination}</span>
                    <span className="flex items-center gap-1 text-slate-600 font-medium">
                      <Clock size={12} className="text-slate-400" /> {load.eta}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600">
                <p>{load.cargoDetails}</p>
              </div>

              {load.risk === "HIGH" || load.risk === "CRITICAL" ? (
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onOpenChange(false);
                      onOptimizeRoute?.();
                    }}
                    className="h-7 text-xs gap-1 text-violet-700 border-violet-200 hover:bg-violet-50"
                  >
                    <Route size={12} /> Optimize A* Reroute
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
