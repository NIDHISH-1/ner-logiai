import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Role, roleNavigation, roleSummary, roles, roleKeyByLabel } from "./roleConfig";
import { RoleMap, RoleMapIcon } from "./RoleMap";
import { IncidentReportForm } from "./IncidentReportForm";
import { RiskPanel } from "./RiskPanel";
import { RouteRecommendationPanel } from "./RouteRecommendationPanel";
import { OfflineSyncStatus } from "./OfflineSyncStatus";
import { AuthDialog } from "./AuthDialog";
import { CreateShipmentDialog } from "./CreateShipmentDialog";
import { BroadcastAlertDialog } from "./BroadcastAlertDialog";
import { BlockagesDialog } from "./BlockagesDialog";
import { CriticalShipmentsDialog } from "./CriticalShipmentsDialog";
import { DriverNavigationDialog } from "./DriverNavigationDialog";
import { DriverAcceptRouteDialog } from "./DriverAcceptRouteDialog";
import { UpdateRoadStatusDialog } from "./UpdateRoadStatusDialog";
import { readOfflineQueue, OFFLINE_QUEUE_EVENT } from "@/lib/offlineIncidentQueue";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, ArrowRight, BatteryMedium, Bell, Boxes, CheckCircle2, ChevronDown, CircleDot, CloudRain, FilePlus2, Flag, Gauge, MapPin, Menu, PackageCheck, Radio, RefreshCw, Route, ShieldAlert, Siren, Truck, UploadCloud, UserCircle2, WifiOff, X } from "lucide-react";

type Snapshot = {
  metrics: { activeVehicles: number; activeDeliveries: number; highRiskCorridors: number; openIncidents: number; delayedShipments: number; blockedRoads: number; criticalIncidents: number; criticalShipments: number; affectedVehicles: number; emergencyCorridors: number };
  vehicles: { id: string; shipment: string; position: string; status: string; eta: string; risk: string }[];
  incidents: { id: string; type: string; location: string; severity: string; age: string; status: string }[];
};

function Header({ role, onRoleChange, mobileOpen, setMobileOpen, onOpenAuth }: { role: Role; onRoleChange: (role: Role) => void; mobileOpen: boolean; setMobileOpen: (open: boolean) => void; onOpenAuth: () => void }) {
  const summary = roleSummary[role];
  const { user } = useAuth();
  return <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-slate-200/80 bg-[#f4f7f9]/90 px-4 backdrop-blur-md sm:px-7"><div className="flex items-center gap-3"><button className="rounded-lg p-2 hover:bg-white lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={20} /></button><div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-600">{summary.eyebrow}</p><h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">{summary.title}</h1></div></div><div className="flex items-center gap-2"><Badge className="hidden border-0 bg-orange-100 text-orange-700 hover:bg-orange-100 sm:inline-flex">{user?.name ?? "DEMO ROLE"}</Badge><div className="relative"><select value={role} onChange={(event) => onRoleChange(event.target.value as Role)} className="h-10 max-w-[175px] appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-8 text-xs font-semibold text-slate-700 shadow-sm"><option value={roles[0]}>Government Admin</option>{roles.slice(1).map((item) => <option value={item} key={item}>{item}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2 top-3 text-slate-400" size={14} /></div><button onClick={onOpenAuth} title="Switch Identity / Personas" className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm hover:bg-slate-50"><UserCircle2 size={17} /></button><button onClick={() => toast("No new alerts in this demo snapshot")} className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm"><Bell size={17} /><span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">4</span></button></div></header>;
}

function Sidebar({ role, mobileOpen, setMobileOpen, onNavigate }: { role: Role; mobileOpen: boolean; setMobileOpen: (open: boolean) => void; onNavigate: (label: string) => void }) {
  const summary = roleSummary[role];
  return <aside className={cn("fixed inset-y-0 left-0 z-40 w-[250px] border-r border-slate-200/80 bg-[#0d2530] px-4 py-5 text-slate-300 transition-transform duration-200 lg:translate-x-0", mobileOpen ? "translate-x-0" : "-translate-x-full")}><div className="flex items-center justify-between px-2"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-orange-400 text-[#102b35]"><RoleMapIcon role={role} /></div><div><p className="text-[15px] font-bold tracking-tight text-white">NER-LogiAI</p><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-teal-300">{summary.eyebrow}</p></div></div><button className="lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18} /></button></div><div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-3"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-teal-300">Demo role</p><p className="mt-2 text-sm font-semibold text-white">{role}</p><p className="mt-1 text-[11px] text-slate-400">Role-scoped view and actions</p></div><nav className="mt-7 space-y-1">{roleNavigation[role].map((item, index) => <button key={item} onClick={() => { onNavigate(item); setMobileOpen(false); }} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition-colors", index === 0 ? "bg-orange-400 text-[#102b35]" : "text-slate-400 hover:bg-white/8 hover:text-white")}><span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />{item}</button>)}</nav><div className="absolute bottom-5 left-4 right-4 rounded-2xl border border-white/10 bg-[#153743] p-3"><div className="flex items-center gap-2"><WifiOff size={15} className="text-orange-300" /><span className="text-[11px] font-semibold text-orange-200">Scoped demo data</span></div><p className="mt-2 text-[11px] leading-relaxed text-slate-400">This role only sees the information needed for its operational workflow.</p></div></aside>;
}

function Kpi({ label, value, icon: Icon, tone = "text-slate-900" }: { label: string; value: string | number; icon: typeof Gauge; tone?: string }) {
  return <Card className="border-0 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]"><CardContent className="flex items-start justify-between p-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">{label}</p><p className={cn("mt-2 text-3xl font-semibold tracking-tight", tone)}>{value}</p></div><div className="rounded-2xl bg-slate-100 p-3 text-slate-600"><Icon size={18} /></div></CardContent></Card>;
}

function DriverDashboard({ snapshot }: { snapshot: Snapshot }) {
  const [navOpen, setNavOpen] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [acceptedRouteLabel, setAcceptedRouteLabel] = useState<string | null>(null);

  const snapshotQuery = trpc.operations.snapshot.useQuery(undefined, { refetchInterval: 8000 });
  const driverVehicle = snapshotQuery.data?.vehicles?.find(v => v.id === "TRK-104") as any;
  const driverShipment = snapshotQuery.data?.shipments?.find(s => s.assignedVehicleId === "TRK-104" || s.id === "SHP-001") as any;

  const planned = driverShipment?.plannedEtaMinutes ?? 120;
  const current = driverShipment?.currentEtaMinutes ?? driverVehicle?.etaMinutes ?? (acceptedRouteLabel ? 253 : 222);
  const delay = driverShipment?.delayMinutes ?? (current > planned ? current - planned : 0);
  const delayReason = driverShipment?.delayReason || "Delay due to verified road blockage on NH-37 Jorhat";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-7">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <Badge className="border-0 bg-sky-100 text-sky-700 hover:bg-sky-100">ASSIGNED VEHICLE</Badge>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">TRUCK #TRK-104</h2>
          <p className="mt-1 text-sm text-slate-500">Safe execution of your assigned delivery</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 flex items-center gap-1.5">
            <Radio size={13} className="text-amber-600 animate-pulse" />
            SIMULATED GPS
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hidden sm:block">
            {driverVehicle?.freshnessLabel ?? "Fresh (< 1m)"}
          </div>
        </div>
      </div>

      {acceptedRouteLabel && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>
              <strong>Route Accepted (Human-in-the-Loop Confirmed):</strong> Navigating via {acceptedRouteLabel}.
              Central dispatch registry & ETA synchronized. <em>Automatic vehicle redirect is disabled.</em>
            </span>
          </div>
          <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 text-[10px] shrink-0 ml-2">LOGGED</Badge>
        </div>
      )}

      {incidentOpen && (
        <div className="mb-5">
          <IncidentReportForm offline={false} onClose={() => setIncidentOpen(false)} />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
        <Card className="border-0 bg-[#12313b] text-white shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-300">Emergency shipment</p>
                <h3 className="mt-2 text-xl font-semibold">{driverShipment?.name ?? snapshot.vehicles[0]?.shipment ?? "Emergency Medicine"}</h3>
                <p className="mt-2 text-sm text-slate-300">Guwahati → Imphal · Remote district</p>
              </div>
              <Truck className="text-sky-300" />
            </div>
            <div className="mt-6 grid grid-cols-4 gap-2 border-y border-white/10 py-4 text-xs">
              <div>
                <p className="text-[10px] uppercase text-slate-400">Status</p>
                <p className="mt-1 font-semibold text-emerald-300">
                  {acceptedRouteLabel ? "ALT ACCEPTED" : "IN TRANSIT"}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-400">Current ETA</p>
                <p className="mt-1 font-semibold">{Math.floor(current / 60)}h {current % 60}m</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-400">Corridor</p>
                <p className="mt-1 font-semibold truncate text-[11px]">{driverVehicle?.currentCorridor ?? "NH-37 Jorhat"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-400">Telemetry</p>
                <p className="mt-1 font-mono text-[11px]">
                  {Number(driverVehicle?.latitude ?? 26.1445).toFixed(2)}, {Number(driverVehicle?.longitude ?? 91.7362).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Delay Explanation */}
            {delay > 0 && (
              <div className="mt-3 rounded-lg bg-white/10 p-2.5 text-xs text-amber-200">
                <span className="font-bold">⚠️ Delay Intelligence: </span>
                <span>+{delay} min ({delayReason})</span>
              </div>
            )}

            <div className="mt-4 rounded-xl border border-red-300/20 bg-red-400/10 p-4">
              <div className="flex items-center gap-2 text-red-200">
                <ShieldAlert size={17} />
                <span className="text-sm font-bold">ROAD DISRUPTION AHEAD</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                Bridge damage reported on NH-37 Jorhat. Safety validation recommends alternate Route B.
              </p>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <p className="text-[10px] uppercase text-slate-400">Current route risk</p>
                  <p className="mt-1 text-2xl font-bold text-red-300">HIGH</p>
                  <p className="text-xs text-slate-400">Probability 82% · Confidence 91%</p>
                </div>
                <ArrowRight className="text-orange-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="border-0 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
            <CardHeader className="border-b border-slate-100 px-5 py-4">
              <CardTitle className="text-[15px]">Recommended alternate</CardTitle>
              <p className="mt-1 text-xs text-slate-500">Longer route selected because it is safer</p>
            </CardHeader>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold">Route B (NH-6 / NH-27)</p>
                  <p className="mt-1 text-xs text-slate-500">+23 km · +31 min</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">LOW RISK</span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Button
                  onClick={() => setNavOpen(true)}
                  className="gap-2 bg-[#12313b] text-white hover:bg-[#1d4853] text-xs"
                >
                  <Route size={15} /> View navigation
                </Button>
                <Button
                  onClick={() => setAcceptOpen(true)}
                  variant="outline"
                  className={`gap-2 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 ${
                    acceptedRouteLabel ? "bg-emerald-50 font-bold" : ""
                  }`}
                >
                  <CheckCircle2 size={15} /> {acceptedRouteLabel ? "Alternate Accepted ✓" : "Accept alternate"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <RouteRecommendationPanel compact />
          <RoleMap role="Truck Driver" compact />
          <RiskPanel compact scope="driver" />

          <Button
            onClick={() => setIncidentOpen(true)}
            variant="outline"
            className="w-full gap-2 border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 text-xs"
          >
            <Flag size={15} /> Report incident (Field / Road)
          </Button>
        </div>
      </div>

      <DriverNavigationDialog
        open={navOpen}
        onOpenChange={setNavOpen}
        onShowOnMap={() => document.querySelector("[data-route-recommendation]")?.scrollIntoView({ behavior: "smooth", block: "center" })}
      />
      <DriverAcceptRouteDialog
        open={acceptOpen}
        onOpenChange={setAcceptOpen}
        onAccepted={(label) => setAcceptedRouteLabel(label)}
      />
    </div>
  );
}

function FieldDashboard({ snapshot }: { snapshot: Snapshot }) {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [roadStatusOpen, setRoadStatusOpen] = useState(false);
  const offline = !online;

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

  const handleSyncData = () => {
    const queue = readOfflineQueue();
    const pending = queue.filter(item => item.status === "PENDING" || item.status === "FAILED");
    if (pending.length === 0) {
      toast.success("Offline sync queue verified · 0 pending items. All local records synchronized.");
    } else {
      window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_EVENT));
      toast.info(`Triggering synchronization for ${pending.length} pending report(s)...`);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-7">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <Badge className="border-0 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">FIELD MODE</Badge>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">Ground truth, captured quickly.</h2>
          <p className="mt-1 text-sm text-slate-500">Collect evidence that improves regional accessibility decisions.</p>
        </div>
        <OfflineSyncStatus />
      </div>
      {offline && (
        <div className="mb-5 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          <strong>OFFLINE MODE</strong> — reports and photos will be stored locally and synchronized when connection returns.
        </div>
      )}
      {showIncidentForm && (
        <div className="mb-5">
          <IncidentReportForm offline={offline} onClose={() => setShowIncidentForm(false)} />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Button onClick={() => setShowIncidentForm(true)} className="h-auto justify-start gap-3 bg-[#12313b] p-5 text-left hover:bg-[#1d4853]">
          <FilePlus2 />
          <span>
            <strong className="block text-sm">Report incident</strong>
            <small className="mt-1 block text-xs text-slate-300">GPS + photo + evidence</small>
          </span>
        </Button>
        <Button onClick={() => setRoadStatusOpen(true)} variant="outline" className="h-auto justify-start gap-3 bg-white p-5 text-left hover:bg-slate-50">
          <Route className="text-emerald-600" />
          <span>
            <strong className="block text-sm">Update road status</strong>
            <small className="mt-1 block text-xs text-slate-500">Accessible / restricted / blocked</small>
          </span>
        </Button>
        <Button onClick={() => toast("Nearby incident list opened")} variant="outline" className="h-auto justify-start gap-3 bg-white p-5 text-left hover:bg-slate-50">
          <MapPin className="text-sky-600" />
          <span>
            <strong className="block text-sm">Nearby incidents</strong>
            <small className="mt-1 block text-xs text-slate-500">{snapshot.incidents.length} in cached area</small>
          </span>
        </Button>
        <Button onClick={handleSyncData} variant="outline" className="h-auto justify-start gap-3 bg-white p-5 text-left hover:bg-slate-50">
          <UploadCloud className="text-orange-600" />
          <span>
            <strong className="block text-sm">Sync data</strong>
            <small className="mt-1 block text-xs text-slate-500">Trigger offline queue sync</small>
          </span>
        </Button>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Card className="border-0 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <CardHeader className="border-b border-slate-100 px-5 py-4">
            <CardTitle className="text-[15px]">Quick incident capture</CardTitle>
            <p className="mt-1 text-xs text-slate-500">New reports start as UNVERIFIED</p>
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Incident type</p>
                <p className="mt-1 text-sm font-semibold">Bridge damage</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Severity</p>
                <p className="mt-1 text-sm font-semibold text-red-600">Critical</p>
              </div>
            </div>
            <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center">
              <MapPin size={18} className="mx-auto text-emerald-600" />
              <p className="mt-2 text-sm font-semibold">GPS location captured</p>
              <p className="mt-1 text-xs text-slate-500">26.75° N, 94.20° E · just now</p>
            </div>
            <Button onClick={() => setShowIncidentForm(true)} className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700">
              <FilePlus2 size={15} /> {offline ? "Save pending sync" : "Submit field report"}
            </Button>
          </CardContent>
        </Card>
        <RoleMap role="Field Officer" compact />
        <RiskPanel compact />
        <div className="rounded-2xl border-0 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Field officer queue</p>
              <h3 className="mt-1 text-[15px] font-semibold">My recent reports</h3>
            </div>
            <span className="text-[11px] text-slate-400">Persisted demo records</span>
          </div>
          <div className="mt-3 space-y-2">
            {snapshot.incidents.slice(0, 5).map(incident => (
              <div key={incident.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-700">{incident.id} · {incident.type}</p>
                  <p className="text-[10px] text-slate-500">{incident.severity} · {incident.location}</p>
                </div>
                <span className="ml-3 shrink-0 rounded-full bg-orange-50 px-2 py-1 text-[10px] font-bold text-orange-700">{incident.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <UpdateRoadStatusDialog open={roadStatusOpen} onOpenChange={setRoadStatusOpen} />
    </div>
  );
}

function ManagerDashboard({ snapshot }: { snapshot: Snapshot }) {
  const [createOpen, setCreateOpen] = useState(false);
  const snapshotQuery = trpc.operations.snapshot.useQuery();
  const rawShipments = snapshotQuery.data?.shipments;
  const shipmentsList = rawShipments && rawShipments.length > 0 ? rawShipments : [
    { id: "SHP-001", name: "Emergency Medicine", origin: "Guwahati", destination: "Imphal", priority: "CRITICAL" as const, etaMinutes: 222, status: "in_transit" },
    { id: "SHP-002", name: "Flood Relief Kits", origin: "Dimapur", destination: "Kohima", priority: "HIGH" as const, etaMinutes: 78, status: "in_transit" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-7">
      <div className="mb-5">
        <Badge className="border-0 bg-violet-100 text-violet-700 hover:bg-violet-100">OPERATIONS CONTROL</Badge>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">Keep priority shipments moving.</h2>
        <p className="mt-1 text-sm text-slate-500">Manage delivery flow, fleet capacity and route risk from one workspace.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Active shipments" value={shipmentsList.length} icon={PackageCheck} tone="text-violet-700" />
        <Kpi label="Vehicles in transit" value={snapshot.metrics.activeVehicles} icon={Truck} tone="text-sky-700" />
        <Kpi label="Delayed shipments" value={snapshot.metrics.delayedShipments} icon={CloudRain} tone="text-orange-700" />
        <Kpi label="Critical shipments" value={shipmentsList.filter(s => s.priority === "CRITICAL").length} icon={Siren} tone="text-red-700" />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <Card className="border-0 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <CardTitle className="text-[15px]">Shipment operations</CardTitle>
              <p className="mt-1 text-xs text-slate-500">Priority-aware delivery queue ({shipmentsList.length} active)</p>
            </div>
            <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
              <Boxes size={14} /> Create shipment
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[700px] text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  <th className="px-4 py-3">Shipment & Cargo</th>
                  <th className="px-3 py-3">Priority</th>
                  <th className="px-3 py-3">Assigned Truck</th>
                  <th className="px-3 py-3">Route</th>
                  <th className="px-3 py-3">ETA & Delay Intelligence</th>
                  <th className="px-4 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {shipmentsList.map((shp: any) => {
                  const planned = shp.plannedEtaMinutes ?? 120;
                  const current = shp.currentEtaMinutes ?? shp.etaMinutes ?? planned;
                  const delay = shp.delayMinutes ?? (current > planned ? current - planned : 0);
                  const delayReason = shp.delayReason || (delay > 0 ? "Route conditions" : "On schedule");
                  const vehId = shp.assignedVehicleId || (shp.id === "SHP-001" ? "TRK-104" : "TRK-219");

                  return (
                    <tr key={shp.id} className="border-b border-slate-50 text-xs">
                      <td className="px-4 py-3">
                        <strong className="block text-slate-800">{shp.name}</strong>
                        <span className="text-[11px] text-slate-500 font-mono">{shp.id}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          shp.priority === "CRITICAL" ? "bg-red-50 text-red-700" :
                          shp.priority === "HIGH" ? "bg-orange-50 text-orange-700" : "bg-slate-100 text-slate-700"
                        }`}>
                          {shp.priority}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-semibold text-slate-700 flex items-center gap-1">
                          <Truck size={12} className="text-slate-400" />
                          {vehId}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">SIMULATED GPS</span>
                      </td>
                      <td className="px-3 py-3 font-medium text-slate-700">
                        {shp.origin} → {shp.destination}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-semibold text-slate-800">
                          {Math.floor(current / 60)}h {current % 60}m
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Planned: {Math.floor(planned / 60)}h {planned % 60}m
                        </div>
                        {delay > 0 ? (
                          <div className="text-[10px] text-amber-700 font-medium">
                            +{delay}m · {delayReason}
                          </div>
                        ) : (
                          <div className="text-[10px] text-emerald-600 font-medium">
                            On schedule
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600 uppercase text-[11px]">
                        {shp.status}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <div className="space-y-5">
          <RoleMap role="Logistics Manager" compact />
          <RouteRecommendationPanel compact />
          <RiskPanel compact />
          <Card className="border-0 bg-[#12313b] text-white shadow-lg">
            <CardContent className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-violet-300">Critical shipment</p>
              <h3 className="mt-2 text-lg font-semibold">Emergency Medicine · TRK-104</h3>
              <p className="mt-2 text-sm text-slate-300">ETA delayed by 42 min · route risk HIGH</p>
              <Button onClick={() => document.querySelector("[data-route-recommendation]")?.scrollIntoView({ behavior: "smooth", block: "center" })} className="mt-4 w-full gap-2 bg-violet-400 text-[#102b35] hover:bg-violet-300">
                <Route size={14} /> Optimize route
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
      <CreateShipmentDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function EmergencyDashboard({ snapshot }: { snapshot: Snapshot }) {
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [blockagesOpen, setBlockagesOpen] = useState(false);
  const [criticalLoadsOpen, setCriticalLoadsOpen] = useState(false);

  const utils = trpc.useUtils();
  const alertsQuery = trpc.operations.alerts.useQuery({ limit: 10 });
  const activeAlerts = (alertsQuery.data ?? []).filter((a) => (a.status ?? "ACTIVE") === "ACTIVE");

  const ackMutation = trpc.operations.acknowledgeAlert.useMutation({
    onSuccess: (res) => {
      toast.success(`Alert ${res.alert?.id} acknowledged by Emergency Response`);
      utils.operations.alerts.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to acknowledge alert"),
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-7 space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2">
            <Badge className="border-0 bg-red-100 text-red-700 font-bold">EMERGENCY MODE</Badge>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">IN-APP ALERT SYSTEM</span>
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Rapid Accessibility & Hazard Intelligence</h2>
          <p className="mt-1 text-sm text-slate-500">
            Real-time incident response, corridor blockages, affected convoys, and mission-critical shipments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setBroadcastOpen(true)} className="gap-2 bg-red-600 hover:bg-red-700 text-white text-xs">
            <Radio size={14} /> Broadcast Alert
          </Button>
        </div>
      </div>

      {/* Active High-Consequence Alerts Banner */}
      {activeAlerts.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Siren size={18} className="text-red-600 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-red-800">
                Active Emergency Alerts ({activeAlerts.length})
              </span>
            </div>
            <span className="text-[11px] text-red-700 font-medium">Requires immediate acknowledgement</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {activeAlerts.slice(0, 4).map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-2 rounded-lg bg-white p-3 shadow-xs border border-red-100">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-slate-900 truncate">{a.title}</span>
                    <Badge className={a.severity === "CRITICAL" ? "bg-red-600 text-white text-[9px] px-1.5 py-0" : "bg-amber-500 text-white text-[9px] px-1.5 py-0"}>
                      {a.severity}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-600 line-clamp-2">{a.message}</p>
                  <span className="mt-1 block text-[10px] text-slate-400 font-medium">📍 {a.corridor}</span>
                </div>
                <Button
                  size="sm"
                  onClick={() => ackMutation.mutate({ alertId: a.id })}
                  disabled={ackMutation.isPending}
                  className="h-7 shrink-0 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <CheckCircle2 size={11} className="mr-1" /> Acknowledge
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Critical incidents" value={snapshot.metrics.criticalIncidents} icon={Siren} tone="text-red-700" />
        <Kpi label="Blocked roads" value={snapshot.metrics.blockedRoads} icon={ShieldAlert} tone="text-red-700" />
        <Kpi label="Emergency corridors" value={snapshot.metrics.emergencyCorridors} icon={Route} tone="text-orange-700" />
        <Kpi label="Affected vehicles" value={snapshot.metrics.affectedVehicles} icon={Truck} tone="text-orange-700" />
        <Kpi label="Critical shipments" value="6" icon={PackageCheck} tone="text-red-700" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <RoleMap role="Emergency Response Team" />
        <div className="space-y-5">
          <RouteRecommendationPanel compact />
          <RiskPanel compact scope="emergency" />
        </div>

        <Card className="border-0 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <CardHeader className="border-b border-slate-100 px-5 py-4">
            <CardTitle className="text-[15px]">Emergency Operations Control</CardTitle>
            <p className="mt-1 text-xs text-slate-500">Rapid access to high-consequence workflows</p>
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            <Button onClick={() => document.querySelector("[data-route-recommendation]")?.scrollIntoView({ behavior: "smooth", block: "center" })} className="h-auto w-full justify-start gap-3 bg-red-600 p-4 text-left hover:bg-red-700">
              <Route />
              <span>
                <strong className="block text-sm">Find Emergency Alternate Route</strong>
                <small className="mt-1 block text-xs text-red-100">Deterministic A* bypassing blocked edges</small>
              </span>
            </Button>
            <Button onClick={() => setBlockagesOpen(true)} variant="outline" className="h-auto w-full justify-start gap-3 p-4 text-left hover:bg-slate-50">
              <ShieldAlert className="text-red-600" />
              <span>
                <strong className="block text-sm">View Corridor Blockages</strong>
                <small className="mt-1 block text-xs text-slate-500">Verified physical road obstructions</small>
              </span>
            </Button>
            <Button onClick={() => setCriticalLoadsOpen(true)} variant="outline" className="h-auto w-full justify-start gap-3 p-4 text-left hover:bg-slate-50">
              <PackageCheck className="text-orange-600" />
              <span>
                <strong className="block text-sm">Monitor Critical Shipments</strong>
                <small className="mt-1 block text-xs text-slate-500">Categorized: CRITICALLY AFFECTED / AFFECTED</small>
              </span>
            </Button>
            <div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-600">
              <AlertTriangle size={14} className="mr-1 inline text-orange-500" />
              Human-in-the-loop: Emergency routes require manual driver acceptance. Never autonomously redirects convoys.
            </div>
          </CardContent>
        </Card>
      </div>

      <BroadcastAlertDialog open={broadcastOpen} onOpenChange={setBroadcastOpen} />
      <BlockagesDialog open={blockagesOpen} onOpenChange={setBlockagesOpen} />
      <CriticalShipmentsDialog open={criticalLoadsOpen} onOpenChange={setCriticalLoadsOpen} onOptimizeRoute={() => document.querySelector("[data-route-recommendation]")?.scrollIntoView({ behavior: "smooth", block: "center" })} />
    </div>
  );
}

export function RoleWorkspace({ role, snapshot, onRoleChange }: { role: Role; snapshot: Snapshot; onRoleChange: (role: Role) => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [active, setActive] = useState(roleNavigation[role][0]);
  const [authOpen, setAuthOpen] = useState(false);
  const { login } = useAuth();

  const handleRoleChange = async (nextRole: Role) => {
    setActive(roleNavigation[nextRole][0]);
    const key = roleKeyByLabel[nextRole] as any;
    if (key) {
      try {
        await login({ role: key });
      } catch {}
    }
    onRoleChange(nextRole);
  };
  const notifyPlaceholder = (label: string) => toast(`${label} workspace is ready for this role`);
  return (
    <div className="min-h-screen bg-[#f4f7f9] text-slate-900">
      <Sidebar role={role} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} onNavigate={notifyPlaceholder} />
      <main className="lg:pl-[250px]">
        <Header role={role} onRoleChange={handleRoleChange} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} onOpenAuth={() => setAuthOpen(true)} />
        {active === roleNavigation[role][0] ? (role === "Truck Driver" ? <DriverDashboard snapshot={snapshot} /> : role === "Field Officer" ? <FieldDashboard snapshot={snapshot} /> : role === "Logistics Manager" ? <ManagerDashboard snapshot={snapshot} /> : <EmergencyDashboard snapshot={snapshot} />) : <div className="mx-auto max-w-4xl px-4 py-10 sm:px-7"><Card className="border-0 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]"><CardContent className="p-8 text-center"><Gauge className="mx-auto text-slate-400" size={28} /><h2 className="mt-4 text-xl font-semibold">{active}</h2><p className="mt-2 text-sm text-slate-500">This role-scoped workspace is staged from the same shared components and permissions layer.</p><Button onClick={() => setActive(roleNavigation[role][0])} className="mt-5 gap-2 bg-[#12313b]">Back to {roleSummary[role].title} <ArrowRight size={14} /></Button></CardContent></Card></div>}
      </main>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}
