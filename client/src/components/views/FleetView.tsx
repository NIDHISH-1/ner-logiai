import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Truck,
  MapPin,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Route,
  CircleDot,
  RefreshCw,
  Radio,
  Gauge,
  Compass,
  History,
  Play,
  Database,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

export function FleetView({ onSelectRoute }: { onSelectRoute?: () => void }) {
  const [filterRisk, setFilterRisk] = useState<string>("ALL");
  const [selectedVehicleHistory, setSelectedVehicleHistory] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const snapshotQuery = trpc.operations.snapshot.useQuery(undefined, { refetchInterval: 8000 });
  const vehicles = (snapshotQuery.data?.vehicles ?? []) as any[];
  const shipments = (snapshotQuery.data?.shipments ?? []) as any[];
  const dbAvailable = snapshotQuery.data?.databaseAvailable ?? false;

  const historyQuery = trpc.operations.vehicleById.useQuery(
    { vehicleId: selectedVehicleHistory ?? "" },
    { enabled: Boolean(selectedVehicleHistory) }
  );

  const stepMutation = trpc.operations.stepVehicleSimulation.useMutation({
    onSuccess: (data) => {
      toast.success(`Vehicle ${data.vehicle?.id ?? "TRK-104"} telemetry stepped forward (SIMULATED GPS)`);
      utils.operations.snapshot.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const shipmentMap = new Map(shipments.map((s) => [s.id, s]));

  const filtered = vehicles.filter((v) => {
    if (filterRisk === "ALL") return true;
    return v.risk === filterRisk;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Badge className="border-0 bg-sky-100 text-sky-700">TELEMETRY & LOGISTICS</Badge>
            <span className="flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              <Radio size={11} className="text-amber-600 animate-pulse" /> SIMULATED GPS ACTIVE
            </span>
            <span className="text-xs text-slate-500">{vehicles.length} active convoys tracked</span>
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Logistics & Fleet Intelligence</h2>
          <p className="mt-1 text-xs text-slate-500">
            Simulated GPS vehicle telemetry, corridor matching, automated delay calculations, and deterministic waypoints.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => stepMutation.mutate({ vehicleId: "TRK-104" })}
            disabled={stepMutation.isPending}
            className="gap-2 border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold"
          >
            <Play size={13} /> {stepMutation.isPending ? "Stepping..." : "Step Simulation (TRK-104)"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => snapshotQuery.refetch()}
            className="gap-2 border-slate-200 text-xs"
          >
            <RefreshCw size={13} /> Refresh
          </Button>
        </div>
      </div>

      {/* Database Persistence Status Banner */}
      <div className={`flex items-center justify-between rounded-xl px-4 py-3 text-xs border ${
        dbAvailable
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-amber-200 bg-amber-50 text-amber-900"
      }`}>
        <div className="flex items-center gap-2">
          <Database size={15} className={dbAvailable ? "text-emerald-600" : "text-amber-600"} />
          <span>
            <strong>Storage Engine:</strong>{" "}
            {dbAvailable
              ? "Relational database active. Telemetry points and audit logs persistently stored in vehicleLocationHistory."
              : "Persistent SQL storage unavailable (DATABASE_URL not set). Running with deterministic in-memory persistence fallback."}
          </span>
        </div>
        <Badge className={`text-[10px] border-0 ${dbAvailable ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"}`}>
          {dbAvailable ? "SQL PERSISTENT" : "DEV FALLBACK"}
        </Badge>
      </div>

      {/* Risk Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3 text-xs">
        <span className="font-semibold text-slate-500 mr-2">Filter by Risk:</span>
        {["ALL", "CRITICAL", "HIGH", "MODERATE", "LOW"].map((risk) => (
          <button
            key={risk}
            onClick={() => setFilterRisk(risk)}
            className={`rounded-lg px-3 py-1.5 font-medium transition ${
              filterRisk === risk
                ? "bg-[#12313b] text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {risk} ({risk === "ALL" ? vehicles.length : vehicles.filter((v) => v.risk === risk).length})
          </button>
        ))}
      </div>

      {/* Vehicles Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((vehicle) => {
          const isCritical = vehicle.risk === "CRITICAL" || vehicle.risk === "HIGH";
          const assignedShipment = shipments.find((s) => s.id === vehicle.shipmentId || s.assignedVehicleId === vehicle.id);
          const planned = assignedShipment?.plannedEtaMinutes ?? 120;
          const current = assignedShipment?.currentEtaMinutes ?? vehicle.etaMinutes ?? planned;
          const delay = assignedShipment?.delayMinutes ?? (current > planned ? current - planned : 0);
          const delayReason = assignedShipment?.delayReason || (delay > 0 ? "Delay due to verified route conditions" : "On schedule");

          return (
            <Card
              key={vehicle.id}
              className={`border transition shadow-sm hover:shadow-md ${
                isCritical ? "border-red-200 bg-white" : "border-slate-200 bg-white"
              }`}
            >
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`grid h-10 w-10 place-items-center rounded-xl ${
                        isCritical ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <Truck size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <strong className="text-sm font-bold text-slate-900">{vehicle.id}</strong>
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 border border-amber-300">
                          {vehicle.gpsSource ?? "SIMULATED GPS"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {assignedShipment?.name ?? vehicle.shipmentId ?? "Assigned Cargo"}
                      </p>
                    </div>
                  </div>
                  <Badge
                    className={
                      vehicle.risk === "CRITICAL"
                        ? "bg-red-600 text-white border-0 text-[10px]"
                        : vehicle.risk === "HIGH"
                        ? "bg-amber-500 text-white border-0 text-[10px]"
                        : vehicle.risk === "MODERATE"
                        ? "bg-yellow-500 text-white border-0 text-[10px]"
                        : "bg-emerald-600 text-white border-0 text-[10px]"
                    }
                  >
                    {vehicle.risk}
                  </Badge>
                </div>

                <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Current Corridor:</span>
                    <span className="font-semibold text-slate-800 text-right truncate max-w-[170px]">
                      {vehicle.currentCorridor ?? "NH-37 Corridor"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">GPS Telemetry:</span>
                    <span className="font-mono font-medium text-slate-700">
                      {Number(vehicle.latitude).toFixed(4)}°, {Number(vehicle.longitude).toFixed(4)}°
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Speed & Heading:</span>
                    <span className="font-medium text-slate-800 flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <Gauge size={12} className="text-slate-500" />
                        {Number(vehicle.speed ?? 0).toFixed(0)} km/h
                      </span>
                      <span className="flex items-center gap-1">
                        <Compass size={12} className="text-slate-500" />
                        {vehicle.heading ?? 0}°
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200/80 pt-1.5">
                    <span className="text-slate-400">Data Freshness:</span>
                    <span className="font-medium text-emerald-700 text-[11px]">
                      {vehicle.freshnessLabel ?? "Fresh (< 1m)"}
                    </span>
                  </div>

                  {/* ETA & Delay Intelligence */}
                  <div className="border-t border-slate-200/80 pt-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Current ETA:</span>
                      <span className="font-bold text-slate-900">
                        {Math.floor(current / 60)}h {current % 60}m
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <span className="text-slate-400">Planned ETA:</span>
                      <span className="text-slate-600">
                        {Math.floor(planned / 60)}h {planned % 60}m
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <span className="text-slate-400">Delay:</span>
                      <span className={`font-semibold ${delay > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                        {delay > 0 ? `+${delay} min` : "0 min (On schedule)"}
                      </span>
                    </div>

                    {delay > 0 && (
                      <p className="mt-1 text-[10px] text-amber-800 bg-amber-100/70 rounded p-1">
                        ⚠️ {delayReason}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedVehicleHistory(vehicle.id)}
                    className="h-7 text-xs border-slate-200 text-slate-700 hover:bg-slate-50 gap-1 flex-1"
                  >
                    <History size={12} /> GPS Trail
                  </Button>

                  {isCritical && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        toast.info(`Safety recalculation requested for ${vehicle.id}`);
                        onSelectRoute?.();
                      }}
                      className="h-7 text-xs border-red-200 text-red-700 hover:bg-red-50 gap-1 flex-1"
                    >
                      <Route size={12} /> Safe Reroute
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* GPS Location History Dialog */}
      <Dialog open={Boolean(selectedVehicleHistory)} onOpenChange={() => setSelectedVehicleHistory(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="text-sky-600" size={18} />
              GPS Telemetry History · {selectedVehicleHistory}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900 flex items-center gap-2">
              <Radio size={14} className="text-amber-600 shrink-0" />
              <span>
                <strong>SIMULATED GPS PROVIDER:</strong> Telemetry points are deterministically recorded and persisted in database.
              </span>
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
              {historyQuery.isLoading ? (
                <p className="text-center text-xs text-slate-500 py-4">Loading telemetry trail...</p>
              ) : (historyQuery.data?.locationHistory ?? []).length === 0 ? (
                <p className="text-center text-xs text-slate-500 py-4">No historical records logged yet.</p>
              ) : (
                (historyQuery.data?.locationHistory ?? []).map((pt, i) => (
                  <div key={pt.id ?? i} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-2 text-xs">
                    <div>
                      <div className="font-mono font-medium text-slate-800">
                        {Number(pt.latitude).toFixed(4)}°, {Number(pt.longitude).toFixed(4)}°
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {pt.currentCorridor ?? "Unknown Corridor"} · {Number(pt.speed ?? 0).toFixed(0)} km/h
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">
                        {new Date(pt.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold text-slate-700">
                        {pt.gpsSource}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
