import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { RoleWorkspace } from "@/components/RoleWorkspace";
import { Role, roles, roleKeyByLabel } from "@/components/roleConfig";
import { IncidentReviewPanel } from "@/components/IncidentReviewPanel";
import { RiskPanel } from "@/components/RiskPanel";
import { RouteRecommendationPanel } from "@/components/RouteRecommendationPanel";
import { AuthDialog } from "@/components/AuthDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AlertTriangle, ArrowUpRight, Bell, Boxes, CheckCircle2, ChevronDown, CircleDot, CloudRain,
  Compass, FileWarning, Gauge, Layers3, LocateFixed, LogOut, MapPin, Menu, Navigation,
  PackageCheck, Radio, RefreshCw, Route, ShieldCheck, Truck, UserCircle2, WifiOff, X,
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ValidationLogicDialog } from "@/components/ValidationLogicDialog";
import { AlertsView } from "@/components/views/AlertsView";
import { IncidentsView } from "@/components/views/IncidentsView";
import { FleetView } from "@/components/views/FleetView";
import { CorridorsView } from "@/components/views/CorridorsView";
import { WeatherView } from "@/components/views/WeatherView";
import { AnalyticsView } from "@/components/views/AnalyticsView";
import { SettingsView } from "@/components/views/SettingsView";

const navItems = [
  { label: "Dashboard", icon: Gauge },
  { label: "Live Map", icon: Navigation },
  { label: "Alerts", icon: Bell },
  { label: "Incidents", icon: FileWarning },
  { label: "Fleet", icon: Truck },
  { label: "Corridors", icon: Route },
  { label: "Weather", icon: CloudRain },
  { label: "Analytics", icon: Layers3 },
  { label: "Settings", icon: ShieldCheck },
];

const mapMarkers: Array<{ label: string; point: [number, number]; color: string; type: string; popup?: string }> = [
  { label: "TRK-104 · Emergency Medicine", point: [26.1445, 91.7362] as [number, number], color: "#f97316", type: "vehicle" },
  { label: "TRK-219 · Flood Relief Kits", point: [25.6747, 94.1086] as [number, number], color: "#38bdf8", type: "vehicle" },
  { label: "Verified bridge damage · NH-37", point: [26.75, 94.2] as [number, number], color: "#ef4444", type: "incident" },
  { label: "Moderate rainfall · Shillong bypass", point: [25.5788, 91.8933] as [number, number], color: "#eab308", type: "risk" },
];
type RouteNodeId = "GUWAHATI" | "JORHAT" | "KOHIMA" | "SHILLONG" | "IMPHAL" | "REMOTE_BLOCKED";

function LeafletMap() {
  const [routeSelection, setRouteSelection] = useState<{ origin: RouteNodeId; destination: RouteNodeId }>({ origin: "GUWAHATI", destination: "IMPHAL" });
  const incidentsQuery = trpc.demo.incidents.useQuery();
  const riskQuery = trpc.demo.risk.useQuery();
  const routeQuery = trpc.demo.routes.useQuery(routeSelection);
  useEffect(() => { const handler = (event: Event) => { const detail = (event as CustomEvent<{ origin: RouteNodeId; destination: RouteNodeId }>).detail; if (detail?.origin && detail?.destination) setRouteSelection(prev => (prev.origin === detail.origin && prev.destination === detail.destination ? prev : { origin: detail.origin, destination: detail.destination })); }; window.addEventListener("ner-route-selection", handler); return () => window.removeEventListener("ner-route-selection", handler); }, []);
  const persistedMarkers = useMemo(() => (incidentsQuery.data ?? []).map(incident => ({ label: `${incident.id} · ${incident.type}`, point: [Number(incident.latitude), Number(incident.longitude)] as [number, number], color: incident.severity === "CRITICAL" ? "#ef4444" : incident.severity === "HIGH" ? "#f97316" : "#eab308", type: incident.roadAccessibility === "blocked" ? "incident" : "risk", popup: `<strong>${incident.id} · ${incident.type}</strong><br/><span>Severity: ${incident.severity}<br/>Location: ${incident.latitude}, ${incident.longitude}<br/>Reporter: ${incident.reporterRole}<br/>Timestamp: ${new Date(incident.occurredAt).toLocaleString()}<br/>Status: ${incident.status}<br/>Last updated: ${new Date(incident.updatedAt).toLocaleString()}</span>` })), [incidentsQuery.data]);
  const riskMarkers = useMemo(() => (riskQuery.data?.predictions ?? []).map((item, index) => ({ label: item.label, point: [[26.75, 94.2], [25.6747, 94.1086], [25.5788, 91.8933]][index] as [number, number], color: item.prediction.riskLevel === "CRITICAL" ? "#dc2626" : item.prediction.riskLevel === "HIGH" ? "#f97316" : item.prediction.riskLevel === "MEDIUM" ? "#eab308" : "#16a34a", type: "risk", popup: `<strong>${item.prediction.riskLevel} risk · ${item.label}</strong><br/><span>Probability: ${item.prediction.probability}%<br/>Confidence: ${item.prediction.confidence}%<br/>Freshness: ${item.prediction.freshness}<br/>Factors: ${item.prediction.contributingFactors.join(" · ")}<br/><em>AI prediction — requires route safety validation.</em></span>` })), [riskQuery.data]);
  useEffect(() => {
    const map = L.map("ner-map", { zoomControl: false, attributionControl: true }).setView([25.8, 92.7], 6);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap contributors" }).addTo(map);

    const route = L.polyline([[26.1445, 91.7362], [26.75, 94.2], [25.6747, 94.1086]], { color: "#fb923c", weight: 5, opacity: 0.9, dashArray: "8 8" }).addTo(map);
    route.bindTooltip("Recommended corridor · safety-validated demo route");
    const routePoints: Record<string, [number, number]> = { GUWAHATI: [26.1445, 91.7362], JORHAT: [26.75, 94.2], KOHIMA: [25.6747, 94.1086], SHILLONG: [25.5788, 91.8933], IMPHAL: [24.817, 93.9368] };
    const selectedRoute = routeQuery.data?.recommendation.route.map(node => routePoints[node]).filter(Boolean) as [number, number][] | undefined;
    if (selectedRoute && selectedRoute.length > 1) L.polyline(selectedRoute, { color: "#16a34a", weight: 6, opacity: 0.9 }).addTo(map).bindTooltip("Recommended route · safety-aware A* prototype");
    L.polyline([[26.1445, 91.7362], [25.5788, 91.8933], [25.6747, 94.1086]], { color: "#64748b", weight: 3, opacity: 0.75, dashArray: "3 8" }).addTo(map).bindTooltip("Alternate route · monitoring");

    const visibleMarkers = [...mapMarkers.filter(marker => marker.type === "vehicle"), ...persistedMarkers, ...riskMarkers];
    visibleMarkers.forEach((marker) => {
      const icon = L.divIcon({ className: "custom-pin", html: `<span style="--pin:${marker.color}" class="map-pin ${marker.type}"></span>`, iconSize: [22, 22], iconAnchor: [11, 11] });
      L.marker(marker.point, { icon }).addTo(map).bindPopup(marker.popup ?? `<strong>${marker.label}</strong><br/><span>Simulated demo layer · last sync 7 min ago</span>`);
    });
    const riskZone = L.circle([25.58, 91.89], { radius: 36000, color: "#eab308", fillColor: "#eab308", fillOpacity: 0.12, weight: 1 }).addTo(map);
    riskZone.bindTooltip("Moderate risk zone · rainfall exposure");
    return () => { map.remove(); };
  }, [persistedMarkers, riskMarkers, routeQuery.data]);
  return <div id="ner-map" className="h-full min-h-[430px] w-full" aria-label="Interactive simulated map of Northeast India" />;
}

function MetricCard({ label, value, delta, icon: Icon, tone }: { label: string; value: number; delta: string; icon: typeof Gauge; tone: string }) {
  return <Card className="border-0 bg-white/80 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur-sm">
    <CardContent className="flex items-start justify-between p-5">
      <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p><p className={cn("mt-2 text-xs font-semibold", tone)}>{delta}</p></div>
      <div className="rounded-2xl bg-slate-100 p-3 text-slate-600"><Icon size={19} strokeWidth={1.8} /></div>
    </CardContent>
  </Card>;
}

export default function Home() {
  const { user, isAuthenticated, login, logout } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const { data, isLoading, refetch } = trpc.demo.snapshot.useQuery();
  const seedMutation = trpc.demo.ensureSeeded.useMutation();
  const trpcUtils = trpc.useUtils();
  const accessQuery = trpc.access.current.useQuery(undefined, { enabled: isAuthenticated, retry: false, refetchOnWindowFocus: false });
  const [role, setRole] = useState<Role>("Government / District Administrator");
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [offline, setOffline] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const snapshot = data;
  const lastSync = useMemo(() => new Date(snapshot?.generatedAt ?? Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), [snapshot?.generatedAt]);
  useEffect(() => {
    if (!sessionStorage.getItem("ner-logiai.demo-seeded")) {
      seedMutation.mutate(undefined, {
        onSuccess: async () => {
          sessionStorage.setItem("ner-logiai.demo-seeded", "1");
          await Promise.all([trpcUtils.demo.snapshot.invalidate(), trpcUtils.demo.incidents.invalidate()]);
        },
        onError: () => toast.error("Demo data could not be seeded; showing fallback snapshot"),
      });
    }
  }, []);
  useEffect(() => {
    const roleLabels: Record<string, Role> = { admin: "Government / District Administrator", field_officer: "Field Officer", truck_driver: "Truck Driver", logistics_manager: "Logistics Manager", emergency_team: "Emergency Response Team", viewer: "Government / District Administrator" };
    const authenticatedRole = accessQuery.data?.operationalRole;
    if (authenticatedRole && roleLabels[authenticatedRole]) {
      const nextRole = roleLabels[authenticatedRole];
      setRole(current => (current !== nextRole ? nextRole : current));
    }
  }, [accessQuery.data?.operationalRole]);

  const [validationLogicOpen, setValidationLogicOpen] = useState(false);

  if (role !== "Government / District Administrator" && snapshot) {
    return <RoleWorkspace role={role} snapshot={snapshot} onRoleChange={setRole} />;
  }

  const chooseNav = (label: string) => {
    setActiveNav(label);
    setMobileOpen(false);
  };
  const toggleOffline = () => {
    setOffline((value) => !value);
    toast(!offline ? "Offline simulation enabled · cached demo data retained" : "Connection restored · sync queue clear");
  };

  return <div className="min-h-screen bg-[#f4f7f9] text-slate-900">
    <aside className={cn("fixed inset-y-0 left-0 z-40 w-[250px] border-r border-slate-200/80 bg-[#0d2530] px-4 py-5 text-slate-300 transition-transform duration-200 lg:translate-x-0", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
      <div className="flex items-center justify-between px-2"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-orange-400 text-[#102b35] shadow-lg shadow-orange-400/20"><Compass size={20} strokeWidth={2.3} /></div><div><p className="text-[15px] font-bold tracking-tight text-white">NER-LogiAI</p><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-teal-300">Operations intelligence</p></div></div><button className="lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18} /></button></div>
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-3"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-teal-300">Current region</p><div className="mt-2 flex items-center justify-between"><span className="text-sm font-medium text-white">Northeast India</span><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.12)]" /></div><p className="mt-1 text-[11px] text-slate-400">8 states · 68 corridors</p></div>
      <nav className="mt-7 space-y-1">
        {navItems.map(({ label, icon: Icon }) => (
          <button
            key={label}
            onClick={() => chooseNav(label)}
            className={cn(
              "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition-colors",
              activeNav === label
                ? "bg-orange-400 text-[#102b35] shadow-lg shadow-orange-400/10 font-bold"
                : "text-slate-400 hover:bg-white/8 hover:text-white"
            )}
          >
            <Icon size={17} strokeWidth={activeNav === label ? 2.2 : 1.8} />
            <span>{label}</span>
            {["Alerts", "Incidents"].includes(label) && (
              <span className="ml-auto rounded-full bg-red-400/15 px-2 py-0.5 text-[10px] font-bold text-red-300">
                {label === "Alerts" ? 4 : snapshot?.incidents?.length ?? 7}
              </span>
            )}
          </button>
        ))}
      </nav>
      <div className="absolute bottom-5 left-4 right-4"><div className="rounded-2xl border border-white/10 bg-[#153743] p-3"><div className="flex items-center gap-2"><WifiOff size={15} className="text-orange-300" /><span className="text-[11px] font-semibold text-orange-200">Demo environment</span></div><p className="mt-2 text-[11px] leading-relaxed text-slate-400">All map, vehicle and incident data is simulated for demonstration.</p></div></div>
    </aside>

    <main className="lg:pl-[250px]"><header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-slate-200/80 bg-[#f4f7f9]/90 px-4 backdrop-blur-md sm:px-7"><div className="flex items-center gap-3"><button className="rounded-lg p-2 hover:bg-white lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={20} /></button><div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-600">Regional command center</p><h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">{activeNav}</h1></div></div><div className="flex items-center gap-2 sm:gap-4"><button onClick={toggleOffline} className={cn("hidden items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold sm:flex", offline ? "border-orange-200 bg-orange-50 text-orange-700" : "border-slate-200 bg-white text-slate-600")}><span className={cn("h-2 w-2 rounded-full", offline ? "bg-orange-400" : "bg-emerald-400")} />{offline ? "Offline mode" : "Connected"}</button><button onClick={() => chooseNav("Alerts")} className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm hover:bg-slate-50"><Bell size={17} /><span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">4</span></button><div className="relative"><button onClick={() => setRoleOpen((v) => !v)} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 shadow-sm hover:border-slate-300"><div className="grid h-8 w-8 place-items-center rounded-lg bg-[#d7ebe6] text-xs font-bold text-[#0d4b4c]">{user?.name ? user.name.slice(0, 2).toUpperCase() : "AG"}</div><div className="hidden text-left sm:block"><p className="text-[11px] font-bold text-slate-800">{user?.name ?? "Aditi Sharma"}</p><p className="text-[10px] text-slate-500">{role}</p></div><ChevronDown size={14} className="text-slate-400" /></button>{roleOpen && <div className="absolute right-0 top-12 z-50 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"><div className="px-3 py-1.5 border-b border-slate-100 mb-1"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Switch RBAC Persona</p></div>{roles.map((item) => <button key={item} onClick={async () => { setRole(item); setRoleOpen(false); const key = roleKeyByLabel[item] as any; if (key) { await login({ role: key }); } toast(`Activated persona: ${item}`); }} className={cn("w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-slate-50 flex items-center justify-between", role === item ? "bg-orange-50 font-bold text-orange-700" : "text-slate-600")}><span>{item}</span>{role === item && <CheckCircle2 size={13} className="text-orange-600" />}</button>)}<div className="mt-1 pt-1 border-t border-slate-100 flex flex-col gap-1"><button onClick={() => { setRoleOpen(false); setAuthOpen(true); }} className="w-full text-left px-3 py-1.5 text-xs text-orange-600 font-medium hover:bg-orange-50 rounded-lg flex items-center gap-1.5"><UserCircle2 size={13} /> Persona details & accounts...</button>{isAuthenticated && <button onClick={async () => { setRoleOpen(false); await logout(); toast.info("Signed out"); }} className="w-full text-left px-3 py-1.5 text-xs text-red-600 font-medium hover:bg-red-50 rounded-lg flex items-center gap-1.5"><LogOut size={13} /> Sign out</button>}</div></div>}</div></div></header>

      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-7 lg:py-8">
        {activeNav === "Dashboard" && (
          <>
            <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><div className="flex items-center gap-2"><Badge className="border-0 bg-orange-100 text-orange-700 hover:bg-orange-100">PROTOTYPE / SIMULATED DATA</Badge><span className="text-xs text-slate-500">Last sync {lastSync}</span></div><h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Good afternoon, operator.</h2><p className="mt-1 max-w-2xl text-sm text-slate-500">Monitor accessibility, risk and essential-supply movement across the Northeast Region from one operational view.</p></div><Button onClick={() => refetch()} variant="outline" className="w-fit gap-2 border-slate-200 bg-white text-xs shadow-sm"><RefreshCw size={14} /> Refresh snapshot</Button></div>
            {offline && <div className="mb-5 flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800"><WifiOff size={17} /><span><strong>OFFLINE MODE</strong> — showing cached dashboard data. New cloud or weather data is not available.</span></div>}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">{snapshot && <><MetricCard label="Active vehicles" value={snapshot.metrics.activeVehicles} delta="+3 since 06:00" icon={Truck} tone="text-emerald-600" /><MetricCard label="Active deliveries" value={snapshot.metrics.activeDeliveries} delta="92% on schedule" icon={PackageCheck} tone="text-emerald-600" /><MetricCard label="High-risk corridors" value={snapshot.metrics.highRiskCorridors} delta="+1 needs review" icon={AlertTriangle} tone="text-orange-600" /><MetricCard label="Open incidents" value={snapshot.metrics.openIncidents} delta="2 critical" icon={FileWarning} tone="text-red-600" /><MetricCard label="Delayed shipments" value={snapshot.metrics.delayedShipments} delta="-2 vs yesterday" icon={Radio} tone="text-orange-600" /><MetricCard label="Blocked roads" value={snapshot.metrics.blockedRoads} delta="Safety constraints active" icon={ShieldCheck} tone="text-red-600" /></>}</div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(340px,0.8fr)]"><Card className="overflow-hidden border-0 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.06)]"><CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 px-5 py-4"><div><CardTitle className="flex items-center gap-2 text-[15px]">Regional accessibility map <span className="h-2 w-2 rounded-full bg-emerald-500" /></CardTitle><p className="mt-1 text-xs text-slate-500">Live map layers · simulated OSM + operational overlays</p></div><Button onClick={() => chooseNav("Live Map")} variant="outline" size="sm" className="gap-2 border-slate-200 bg-white text-xs"><LocateFixed size={14} /> Focus map</Button></CardHeader><CardContent className="relative p-0"><LeafletMap /><div className="absolute bottom-4 left-4 z-[500] rounded-xl border border-white/80 bg-white/95 p-3 shadow-lg backdrop-blur"><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Legend</p><div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] font-medium text-slate-700"><span><i className="legend-dot bg-emerald-500" />Low</span><span><i className="legend-dot bg-yellow-400" />Moderate</span><span><i className="legend-dot bg-orange-500" />High</span><span><i className="legend-dot bg-red-500" />Critical / blocked</span></div></div><div className="absolute right-4 top-4 z-[500] rounded-lg bg-[#0d2530]/90 px-3 py-2 text-[10px] font-semibold text-white shadow-lg"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-orange-400" />3 corridors need attention</div></CardContent></Card>

              <Card className="border-0 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.06)]"><CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 px-5 py-4"><div><CardTitle className="text-[15px]">Priority incidents</CardTitle><p className="mt-1 text-xs text-slate-500">Field intelligence requiring review</p></div><Button onClick={() => chooseNav("Incidents")} variant="ghost" size="sm" className="gap-1 text-xs text-orange-600 hover:text-orange-700">View all <ArrowUpRight size={14} /></Button></CardHeader><CardContent className="p-0">{snapshot?.incidents.map((incident, index) => <button key={incident.id} onClick={() => toast(`${incident.id}: ${incident.status}`)} className="flex w-full items-start gap-3 border-b border-slate-100 px-5 py-4 text-left transition-colors hover:bg-slate-50"><span className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", incident.severity === "Critical" ? "bg-red-500" : incident.severity === "High" ? "bg-orange-500" : "bg-yellow-400")} /><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><strong className="truncate text-[13px] font-semibold text-slate-800">{incident.type}</strong><span className="shrink-0 text-[10px] text-slate-400">{incident.age}</span></span><span className="mt-1 block truncate text-[11px] text-slate-500"><MapPin size={11} className="mr-1 inline" />{incident.location}</span><span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{incident.status}</span></span></button>)}<div className="bg-slate-50/70 px-5 py-3 text-[10px] text-slate-500"><ShieldCheck size={12} className="mr-1 inline text-emerald-600" /> Reports use GPS, timestamp and verification status.</div></CardContent></Card></div>

            <div className="mt-6"><IncidentReviewPanel /></div>
            <div className="mt-6 space-y-6"><RiskPanel /><RouteRecommendationPanel showComparison /></div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]"><Card className="border-0 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.06)]"><CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 px-5 py-4"><div><CardTitle className="text-[15px]">Fleet movement</CardTitle><p className="mt-1 text-xs text-slate-500">Simulated vehicle telemetry · privacy-minimized IDs</p></div><Badge variant="outline" className="gap-1 border-slate-200 text-[10px] text-slate-500"><CircleDot size={10} className="text-emerald-500" /> Updated 7 min ago</Badge></CardHeader><CardContent className="overflow-x-auto p-0"><table className="w-full min-w-[600px] text-left"><thead><tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400"><th className="px-5 py-3">Vehicle / shipment</th><th className="px-3 py-3">Position</th><th className="px-3 py-3">ETA</th><th className="px-3 py-3">Risk</th><th className="px-5 py-3 text-right">Status</th></tr></thead><tbody>{snapshot?.vehicles.map((vehicle) => <tr key={vehicle.id} className="border-b border-slate-50 text-xs"><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-600"><Truck size={15} /></div><div><p className="font-bold text-slate-800">{vehicle.id}</p><p className="mt-0.5 text-[11px] text-slate-500">{vehicle.shipment}</p></div></div></td><td className="px-3 py-4 text-slate-600">{vehicle.position}</td><td className="px-3 py-4 font-semibold text-slate-700">{vehicle.eta}</td><td className="px-3 py-4"><span className={cn("rounded-full px-2 py-1 text-[10px] font-bold", vehicle.risk === "HIGH" ? "bg-red-50 text-red-700" : vehicle.risk === "MODERATE" ? "bg-yellow-50 text-yellow-700" : "bg-emerald-50 text-emerald-700")}>{vehicle.risk}</span></td><td className="px-5 py-4 text-right text-slate-500">{vehicle.status}</td></tr>)}</tbody></table></CardContent></Card><Card className="border-0 bg-[#12313b] text-white shadow-[0_10px_35px_rgba(15,23,42,0.12)]"><CardContent className="p-6"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-orange-300">Safety engine</p><h3 className="mt-2 text-lg font-semibold">Route decision integrity</h3></div><div className="rounded-xl bg-white/10 p-2.5"><ShieldCheck size={20} className="text-emerald-300" /></div></div><p className="mt-4 text-sm leading-relaxed text-slate-300">AI recommendations are not final decisions. Hard constraints, data freshness and human verification stay in the loop.</p><div className="mt-5 space-y-3 text-xs"><div className="flex items-center gap-3"><span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">1</span><span className="text-slate-300">Predict risk with explainable factors</span></div><div className="flex items-center gap-3"><span className="grid h-6 w-6 place-items-center rounded-full bg-orange-400/15 text-orange-300">2</span><span className="text-slate-300">Validate against field constraints</span></div><div className="flex items-center gap-3"><span className="grid h-6 w-6 place-items-center rounded-full bg-sky-400/15 text-sky-300">3</span><span className="text-slate-300">Recommend only when confidence allows</span></div></div><Button onClick={() => setValidationLogicOpen(true)} className="mt-6 w-full gap-2 bg-orange-400 text-[#102b35] hover:bg-orange-300 font-semibold">View validation logic <ArrowUpRight size={14} /></Button></CardContent></Card></div>
          </>
        )}

        {activeNav === "Live Map" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Regional Accessibility & Lifeline GIS Map</h2>
                <p className="text-xs text-slate-500">Live spatial tracking of road blockages, high-risk mountain sectors, and active delivery convoys.</p>
              </div>
              <Button onClick={() => chooseNav("Dashboard")} variant="outline" size="sm" className="text-xs">
                Back to Dashboard
              </Button>
            </div>
            <Card className="overflow-hidden border-0 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.06)]">
              <CardContent className="relative p-0">
                <LeafletMap />
                <div className="absolute bottom-4 left-4 z-[500] rounded-xl border border-white/80 bg-white/95 p-3 shadow-lg backdrop-blur">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Legend</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] font-medium text-slate-700">
                    <span><i className="legend-dot bg-emerald-500" />Low</span>
                    <span><i className="legend-dot bg-yellow-400" />Moderate</span>
                    <span><i className="legend-dot bg-orange-500" />High</span>
                    <span><i className="legend-dot bg-red-500" />Critical / blocked</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeNav === "Alerts" && <AlertsView />}
        {activeNav === "Incidents" && <IncidentsView />}
        {activeNav === "Fleet" && <FleetView onSelectRoute={() => chooseNav("Dashboard")} />}
        {activeNav === "Corridors" && <CorridorsView onSelectRoute={() => chooseNav("Dashboard")} />}
        {activeNav === "Weather" && <WeatherView />}
        {activeNav === "Analytics" && <AnalyticsView />}
        {activeNav === "Settings" && <SettingsView />}
      </div>
    </main>
    <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    <ValidationLogicDialog open={validationLogicOpen} onOpenChange={setValidationLogicOpen} />
  </div>;
}
