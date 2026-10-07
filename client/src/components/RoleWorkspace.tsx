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
import { readOfflineQueue, OFFLINE_QUEUE_EVENT, pendingOfflineCount, type OfflineIncident } from "@/lib/offlineIncidentQueue";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { localizeAlert, formatActionableDriverAlert, FIELD_UI_LABELS } from "@shared/i18n";
import { AlertsView } from "./views/AlertsView";
import { FleetView } from "./views/FleetView";
import { CorridorsView } from "./views/CorridorsView";
import { IncidentsView } from "./views/IncidentsView";
import { AnalyticsView } from "./views/AnalyticsView";
import { SettingsView } from "./views/SettingsView";
import { WeatherView } from "./views/WeatherView";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { formatCacheAge, getPersistedCache, setPersistedCache } from "@/lib/persistentCache";
import {
  AlertTriangle, ArrowRight, BatteryMedium, Bell, Boxes, CheckCircle2, ChevronDown,
  CircleDot, CloudRain, FilePlus2, Flag, Gauge, MapPin, Menu, PackageCheck, Radio,
  RefreshCw, Route, ShieldAlert, Siren, Truck, UploadCloud, UserCircle2, Wifi, WifiOff,
  X, Globe, BarChart3, Database, FileText, FileWarning, Map as MapIcon, Navigation,
  Sparkles, Search, SlidersHorizontal, Lock, Check, Clock, ShieldCheck, CloudOff,
  LogIn, UserPlus, LogOut, ChevronLeft, ChevronRight
} from "lucide-react";

type Snapshot = {
  metrics: { activeVehicles: number; activeDeliveries: number; highRiskCorridors: number; openIncidents: number; delayedShipments: number; blockedRoads: number; criticalIncidents: number; criticalShipments: number; affectedVehicles: number; emergencyCorridors: number };
  vehicles: { id: string; shipment: string; position: string; status: string; eta: string; risk: string }[];
  incidents: { id: string; type: string; location: string; severity: string; age: string; status: string }[];
};

function Header({
  role,
  active,
  onRoleChange,
  mobileOpen,
  setMobileOpen,
  onOpenAuth,
}: {
  role: Role;
  active: string;
  onRoleChange: (role: Role) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  onOpenAuth: () => void;
}) {
  const summary = roleSummary[role];
  const { user, isAuthenticated, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [, setLocation] = useLocation();

  return (
    <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-slate-200/80 bg-[#f4f7f9]/90 px-4 backdrop-blur-md sm:px-7">
      <div className="flex items-center gap-3">
        <button
          className="rounded-lg p-2 hover:bg-white lg:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-600">
            {summary.eyebrow} · {role}
          </p>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-slate-950 flex items-center gap-2">
            {active}
          </h1>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Multilingual Selector */}
        <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 text-xs font-bold shadow-sm">
          <button
            onClick={() => setLanguage("en")}
            className={cn("rounded-lg px-2.5 py-1 transition", language === "en" ? "bg-[#12313b] text-white" : "text-slate-600 hover:text-slate-900")}
          >
            EN
          </button>
          <button
            onClick={() => setLanguage("hi")}
            className={cn("rounded-lg px-2.5 py-1 transition", language === "hi" ? "bg-[#12313b] text-white" : "text-slate-600 hover:text-slate-900")}
          >
            हिन्दी
          </button>
          <button
            onClick={() => setLanguage("as")}
            className={cn("rounded-lg px-2.5 py-1 transition", language === "as" ? "bg-[#12313b] text-white" : "text-slate-600 hover:text-slate-900")}
          >
            অসমীয়া
          </button>
        </div>

        {/* User / Persona Badge */}
        <Badge className="hidden border-0 bg-orange-100 text-orange-700 hover:bg-orange-100 md:inline-flex">
          {user?.name ?? "DEMO PERSONA"}
        </Badge>

        {/* Role Selector */}
        <div className="relative">
          <select
            value={role}
            onChange={(event) => onRoleChange(event.target.value as Role)}
            className="h-10 max-w-[175px] appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-8 text-xs font-semibold text-slate-700 shadow-sm cursor-pointer"
          >
            <option value={roles[0]}>Government Admin</option>
            {roles.slice(1).map((item) => <option value={item} key={item}>{item}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-3 text-slate-400" size={14} />
        </div>

        {/* Auth / Account Buttons */}
        {!isAuthenticated ? (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/login")}
              className="text-xs h-9 border-slate-300 hidden sm:inline-flex"
            >
              <LogIn size={13} className="mr-1.5" /> Sign In
            </Button>
            <Button
              size="sm"
              onClick={() => setLocation("/signup")}
              className="text-xs h-9 bg-orange-500 hover:bg-orange-600 text-white font-semibold hidden sm:inline-flex"
            >
              <UserPlus size={13} className="mr-1.5" /> Sign Up
            </Button>
          </div>
        ) : null}

        <button
          onClick={onOpenAuth}
          title="Switch Identity / Personas"
          className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm hover:bg-slate-50 cursor-pointer"
        >
          <UserCircle2 size={17} />
        </button>

        {isAuthenticated && (
          <button
            onClick={async () => {
              await logout();
              toast.info("Signed out");
            }}
            title="Sign out"
            className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm hover:bg-red-50 hover:text-red-600 cursor-pointer"
          >
            <LogOut size={16} />
          </button>
        )}

        <button
          onClick={() => toast("All regional alert feeds synchronized")}
          className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm cursor-pointer"
        >
          <Bell size={17} />
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">4</span>
        </button>
      </div>
    </header>
  );
}

const navIconMap: Record<string, typeof Gauge> = {
  // Truck Driver
  "My Trip": Gauge,
  "Navigation": Navigation,
  "Vehicle / GPS": Radio,
  "My Shipment": PackageCheck,
  "Alerts": Bell,
  "Report Incident": FilePlus2,
  "Offline Data": CloudOff,
  "Offline Sync": RefreshCw,

  // Field Officer
  "Field Dashboard": Gauge,
  "Road Status": ShieldAlert,
  "Field Reports": FileText,
  "Nearby Incidents": FileWarning,
  "Map": MapIcon,
  "My Reports": FileText,
  "Sync": RefreshCw,

  // Logistics Manager
  "Dashboard": Gauge,
  "Operations": Gauge,
  "Shipments": Boxes,
  "Vehicles": Truck,
  "Fleet": Truck,
  "Delays": Clock,
  "Critical Shipments": Siren,
  "Routes": Route,
  "Corridors": Route,
  "Analytics": BarChart3,

  // Emergency Response Team
  "Emergency Dashboard": Gauge,
  "Emergency Map": MapIcon,
  "Active Incidents": ShieldAlert,
  "Critical Incidents": ShieldAlert,
  "Emergency Routes": Route,
  "Affected Shipments": PackageCheck,
  "Affected Vehicles": Truck,

  // Admin / General
  "Live Map": MapIcon,
  "Risk Intelligence": AlertTriangle,
  "Incidents": FileWarning,
  "Weather": CloudRain,
  "Settings": SlidersHorizontal,
  "Audit Logs": Database,
};

function Sidebar({
  role,
  active,
  mobileOpen,
  setMobileOpen,
  onNavigate,
  collapsed,
  setCollapsed,
}: {
  role: Role;
  active: string;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  onNavigate: (label: string) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}) {
  const summary = roleSummary[role];
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  const navKeyMap: Record<string, keyof typeof FIELD_UI_LABELS.en> = {
    "My Trip": "myTrip",
    "Navigation": "navigation",
    "Vehicle / GPS": "vehicleGps",
    "Shipments": "shipments",
    "Alerts": "alerts",
    "Report Incident": "reportIncident",
    "Offline Sync": "offlineSync",
    "Settings": "settings",
  };

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 border-r border-slate-200/80 bg-[#0d2530] px-3 py-5 text-slate-300 transition-all duration-200 lg:translate-x-0 flex flex-col justify-between",
        collapsed ? "w-[72px]" : "w-[250px]",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}
    >
      <div className="overflow-y-auto overflow-x-hidden">
        <div className={cn("flex items-center justify-between px-1", collapsed && "flex-col gap-3 items-center")}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-orange-400 text-[#102b35] font-bold">
              <RoleMapIcon role={role} />
            </div>
            {!collapsed && (
              <div className="truncate">
                <p className="text-[15px] font-bold tracking-tight text-white">NER-LogiAI</p>
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-teal-300 truncate">
                  {summary.eyebrow}
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              className="hidden lg:flex p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white cursor-pointer transition"
              onClick={() => setCollapsed(!collapsed)}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
            <button
              className="lg:hidden p-1 hover:bg-white/10 rounded-lg text-slate-400 cursor-pointer"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {!collapsed && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-teal-300">Active role</p>
            <p className="mt-1 text-sm font-semibold text-white">{role}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">Scoped operational workspace</p>
          </div>
        )}

        <nav className={cn("mt-6 space-y-1", collapsed && "space-y-1.5")}>
          {roleNavigation[role].map((item) => {
            const Icon = navIconMap[item] || CircleDot;
            const isActive = active === item;
            const translatedLabel = navKeyMap[item] ? t(navKeyMap[item] as any) : item;
            return (
              <button
                key={item}
                onClick={() => {
                  onNavigate(item);
                  setMobileOpen(false);
                }}
                title={collapsed ? translatedLabel : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition-all duration-150 cursor-pointer",
                  collapsed && "justify-center px-0",
                  isActive
                    ? "bg-orange-400 text-[#102b35] font-bold shadow-md shadow-orange-400/20"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                )}
              >
                <Icon
                  size={16}
                  strokeWidth={isActive ? 2.2 : 1.8}
                  className={cn("shrink-0", isActive ? "text-[#102b35]" : "text-slate-400")}
                />
                {!collapsed && <span className="truncate">{translatedLabel}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="pt-4 border-t border-white/10 space-y-2">
        {!collapsed ? (
          <div className="rounded-xl border border-white/10 bg-[#153743] p-3 text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
              <span className="text-[11px] font-semibold text-emerald-200 truncate">{t("rbacVerified")}</span>
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
              {t("safetyValidatorActive")}
            </p>
          </div>
        ) : (
          <div className="flex justify-center p-2" title="RBAC & Safety Validator Active">
            <ShieldCheck size={18} className="text-emerald-400" />
          </div>
        )}
      </div>
    </aside>
  );
}

function Kpi({ label, value, icon: Icon, tone = "text-slate-900" }: { label: string; value: string | number; icon: typeof Gauge; tone?: string }) {
  return <Card className="border-0 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]"><CardContent className="flex items-start justify-between p-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">{label}</p><p className={cn("mt-2 text-3xl font-semibold tracking-tight", tone)}>{value}</p></div><div className="rounded-2xl bg-slate-100 p-3 text-slate-600"><Icon size={18} /></div></CardContent></Card>;
}

function DriverDashboard({ snapshot }: { snapshot: Snapshot }) {
  const [navOpen, setNavOpen] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [acceptedRouteLabel, setAcceptedRouteLabel] = useState<string | null>(null);
  const { language, t } = useLanguage();

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
          <Badge className="border-0 bg-sky-100 text-sky-700 hover:bg-sky-100">
            {t("assignedVehicle")}
          </Badge>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">TRUCK #TRK-104</h2>
          <p className="mt-1 text-sm text-slate-500">
            {t("safeExecution")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <OfflineSyncStatus />
          {driverVehicle?.isStale ? (
            <div className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-bold text-red-800 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-600" />
              STALE GPS ({driverVehicle.freshnessLabel ?? ">5m old"})
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 flex items-center gap-1.5">
                <Radio size={13} className="text-amber-600 animate-pulse" />
                SIMULATED GPS
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hidden sm:block">
                {driverVehicle?.freshnessLabel ?? "Fresh (< 1m)"}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Phase 5 Actionable Driver Alert Box */}
      <div className="mb-5 rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs shadow-md">
        <div className="mb-2 flex items-center justify-between font-sans border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {t("driverAdvisory")}
            </span>
            <Badge variant="outline" className="text-[9px] font-mono border-slate-700 text-slate-300">
              {language.toUpperCase()}
            </Badge>
          </div>
          <Badge className="bg-amber-500 text-slate-950 text-[10px] font-bold">
            {t("humanConfirmationRequired")}
          </Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 text-slate-200">
          <div className="space-y-1.5 bg-slate-900/90 p-3 rounded-lg border border-slate-800">
            <p><strong className="text-slate-400">{t("incident")}:</strong> NH-37 BLOCKED</p>
            <p><strong className="text-slate-400">{t("status")}:</strong> <span className="text-red-400 font-bold">CRITICAL</span></p>
            <p><strong className="text-slate-400">{t("action")}:</strong> <span className="text-emerald-400">{t("alternateRouteRequired")}</span></p>
            <p><strong className="text-slate-400">ETA:</strong> <span className="text-amber-400 font-bold">+31 minutes</span></p>
          </div>
          <div className="flex flex-col justify-between bg-slate-900/90 p-3 rounded-lg border border-slate-800 text-[11px] font-sans">
            <p className="text-slate-300 leading-relaxed">
              {t("safetyConstraintNotice")}
            </p>
            <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] text-slate-400 font-mono flex items-center justify-between">
              <span>humanInTheLoopConfirmed = <strong>{acceptedRouteLabel ? "true" : "false"}</strong></span>
              <span>automaticVehicleRedirect = <strong>false</strong></span>
            </div>
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
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-300">{t("emergencyShipment")}</p>
                <h3 className="mt-2 text-xl font-semibold">{driverShipment?.name ?? snapshot.vehicles[0]?.shipment ?? "Emergency Medicine"}</h3>
                <p className="mt-2 text-sm text-slate-300">Guwahati → Imphal · Remote district</p>
              </div>
              <Truck className="text-sky-300" />
            </div>
            <div className="mt-6 grid grid-cols-4 gap-2 border-y border-white/10 py-4 text-xs">
              <div>
                <p className="text-[10px] uppercase text-slate-400">{t("status")}</p>
                <p className="mt-1 font-semibold text-emerald-300">
                  {acceptedRouteLabel ? "ALT ACCEPTED" : t("inTransit")}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-400">{t("currentEta")}</p>
                <p className="mt-1 font-semibold">{Math.floor(current / 60)}h {current % 60}m</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-400">{t("corridor")}</p>
                <p className="mt-1 font-semibold truncate text-[11px]">{driverVehicle?.currentCorridor ?? "NH-37 Jorhat"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-400">{t("telemetry")}</p>
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
                <span className="text-sm font-bold">{t("roadDisruptionAhead")}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                {t("bridgeDamageReport")}
              </p>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <p className="text-[10px] uppercase text-slate-400">{t("currentRouteRisk")}</p>
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
              <CardTitle className="text-[15px]">{t("recommendedAlternate")}</CardTitle>
              <p className="mt-1 text-xs text-slate-500">{t("longerRouteSafer")}</p>
            </CardHeader>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold">Route B (NH-6 / NH-27)</p>
                  <p className="mt-1 text-xs text-slate-500">+23 km · +31 min</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{t("lowRisk")}</span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Button
                  onClick={() => setNavOpen(true)}
                  className="gap-2 bg-[#12313b] text-white hover:bg-[#1d4853] text-xs"
                >
                  <Route size={15} /> {t("viewNavigation")}
                </Button>
                <Button
                  onClick={() => setAcceptOpen(true)}
                  variant="outline"
                  className={`gap-2 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 ${
                    acceptedRouteLabel ? "bg-emerald-50 font-bold" : ""
                  }`}
                >
                  <CheckCircle2 size={15} /> {acceptedRouteLabel ? t("alternateAccepted") : t("acceptAlternate")}
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
            <Flag size={15} /> {t("reportIncidentField")}
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
  const { language, t } = useLanguage();
  const offline = !online;

  const [offlineItems, setOfflineItems] = useState<OfflineIncident[]>(() => readOfflineQueue());

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    const refreshQueue = () => setOfflineItems(readOfflineQueue());
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener(OFFLINE_QUEUE_EVENT, refreshQueue);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(OFFLINE_QUEUE_EVENT, refreshQueue);
    };
  }, []);

  const pendingCount = pendingOfflineCount();

  const handleSyncData = () => {
    const queue = readOfflineQueue();
    const pending = queue.filter(item => item.status === "PENDING" || item.status === "FAILED");
    if (pending.length === 0) {
      toast.success(language === "hi" ? "ऑफ़लाइन सिंक कतार सत्यापित · कोई लंबित आइटम नहीं" : "Offline sync queue verified · 0 pending items. All local records synchronized.");
    } else {
      window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_EVENT));
      toast.info(language === "hi" ? `${pending.length} लंबित रिपोर्ट का सिंक्रोनाइज़ेशन शुरू किया जा रहा है...` : `Triggering synchronization for ${pending.length} pending report(s)...`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-700 text-[10px] font-mono font-bold">DRAFT</Badge>;
      case "PENDING":
      case "PENDING SYNC":
        return <Badge className="bg-amber-500 text-white border-0 text-[10px] font-mono font-bold">PENDING SYNC</Badge>;
      case "SYNCING":
        return <Badge className="bg-sky-500 text-white border-0 text-[10px] font-mono font-bold animate-pulse">SYNCING</Badge>;
      case "SYNCED":
        return <Badge className="bg-emerald-600 text-white border-0 text-[10px] font-mono font-bold">SYNCED</Badge>;
      case "FAILED":
        return <Badge className="bg-rose-600 text-white border-0 text-[10px] font-mono font-bold">FAILED</Badge>;
      case "CONFLICT":
        return <Badge className="bg-purple-600 text-white border-0 text-[10px] font-mono font-bold">CONFLICT</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px] font-mono font-bold">{status}</Badge>;
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-7">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <Badge className="border-0 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
            {language === "hi" ? "फ़ील्ड मोड" : "FIELD MODE"}
          </Badge>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">
            {language === "hi" ? "जमीनी हकीकत, त्वरित संकलन" : "Ground truth, captured quickly."}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {language === "hi" ? "क्षेत्रीय सुगम्यता और आपातकालीन प्रतिक्रिया निर्णयों के लिए साक्ष्य।" : "Collect evidence that improves regional accessibility decisions."}
          </p>
        </div>
        <OfflineSyncStatus />
      </div>

      {/* Requirement 8: Low-connectivity Mode Banner */}
      {offline ? (
        <div className="mb-5 rounded-xl border border-orange-300 bg-orange-50/95 p-4 text-xs text-orange-950 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-orange-200 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-orange-600 animate-pulse" />
              <strong className="tracking-wide uppercase font-mono font-bold text-orange-900">
                OFFLINE
              </strong>
              <span className="text-orange-400">·</span>
              <span className="font-mono text-[11px] font-bold text-orange-800">
                LAST SYNC: 2 MIN AGO
              </span>
              <span className="text-orange-400">·</span>
              <Badge variant="outline" className="border-orange-400 bg-white font-mono text-[10px] font-bold text-orange-900">
                {pendingCount} ACTIONS PENDING
              </Badge>
            </div>
            <Badge className="bg-orange-700 text-white border-0 text-[9px] uppercase font-bold tracking-wider">
              STALE CACHED INFORMATION
            </Badge>
          </div>
          <p className="mt-2 text-orange-900 leading-relaxed font-medium">
            {language === "hi"
              ? "ऑफ़लाइन मोड सक्रिय है। स्क्रीन पर प्रदर्शित डेटा अंतिम सफल सिंक का स्थानीय कैश है। नई घटना रिपोर्ट और बदलाव स्थानीय डिवाइस में सुरक्षित संग्रहीत हैं और नेटवर्क पुनः जुड़ने पर सिंक होंगे।"
              : "Offline mode active. Data displayed represents the last successful cached snapshot. Newly generated reports and actions are securely queued on this local device and will automatically synchronize once connectivity is restored."}
          </p>
        </div>
      ) : (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-2.5 text-xs text-emerald-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
            <span className="font-mono font-bold">ONLINE</span>
            <span className="text-emerald-400">·</span>
            <span className="text-[11px] font-medium">LAST SYNC: JUST NOW</span>
            <span className="text-emerald-400">·</span>
            <span className="text-[11px] font-mono">{pendingCount} ACTIONS PENDING</span>
          </div>
          <Badge variant="outline" className="border-emerald-300 text-[10px] text-emerald-800 bg-white font-mono">
            LIVE DISPATCH SYNC
          </Badge>
        </div>
      )}

      {showIncidentForm && (
        <div className="mb-5">
          <IncidentReportForm offline={offline} onClose={() => { setShowIncidentForm(false); setOfflineItems(readOfflineQueue()); }} />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Button onClick={() => setShowIncidentForm(true)} className="h-auto justify-start gap-3 bg-[#12313b] p-5 text-left hover:bg-[#1d4853]">
          <FilePlus2 />
          <span>
            <strong className="block text-sm">{language === "hi" ? "घटना दर्ज करें" : "Report incident"}</strong>
            <small className="mt-1 block text-xs text-slate-300">GPS + photo + evidence</small>
          </span>
        </Button>
        <Button onClick={() => setRoadStatusOpen(true)} variant="outline" className="h-auto justify-start gap-3 bg-white p-5 text-left hover:bg-slate-50">
          <Route className="text-emerald-600" />
          <span>
            <strong className="block text-sm">{language === "hi" ? "सड़क स्थिति अपडेट" : "Update road status"}</strong>
            <small className="mt-1 block text-xs text-slate-500">Accessible / restricted / blocked</small>
          </span>
        </Button>
        <Button onClick={() => toast("Nearby incident list opened")} variant="outline" className="h-auto justify-start gap-3 bg-white p-5 text-left hover:bg-slate-50">
          <MapPin className="text-sky-600" />
          <span>
            <strong className="block text-sm">{language === "hi" ? "निकटवर्ती घटनाएं" : "Nearby incidents"}</strong>
            <small className="mt-1 block text-xs text-slate-500">{snapshot.incidents.length} in cached area</small>
          </span>
        </Button>
        <Button onClick={handleSyncData} variant="outline" className="h-auto justify-start gap-3 bg-white p-5 text-left hover:bg-slate-50">
          <UploadCloud className="text-orange-600" />
          <span>
            <strong className="block text-sm">{language === "hi" ? "डेटा सिंक करें" : "Sync data"}</strong>
            <small className="mt-1 block text-xs text-slate-500">Trigger offline queue sync</small>
          </span>
        </Button>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Card className="border-0 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <CardHeader className="border-b border-slate-100 px-5 py-4">
            <CardTitle className="text-[15px]">
              {language === "hi" ? "त्वरित घटना संकलन" : "Quick incident capture"}
            </CardTitle>
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

        {/* Requirement 7: Field Report Status - DRAFT, PENDING SYNC, SYNCING, SYNCED, FAILED, CONFLICT */}
        <div className="rounded-2xl border-0 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                {language === "hi" ? "फ़ील्ड रिपोर्ट स्थिति एवं कतार" : "Field officer queue"}
              </p>
              <h3 className="mt-1 text-[15px] font-semibold">
                {language === "hi" ? "मेरी ग्राउंड रिपोर्ट" : "My recent reports & sync states"}
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              {offlineItems.length} queued
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {/* Show local offline queued reports first */}
            {offlineItems.map(item => (
              <div key={item.id} className="flex items-center justify-between rounded-lg bg-amber-50/60 border border-amber-100 px-3 py-2">
                <div className="min-w-0 pr-2">
                  <p className="truncate text-xs font-semibold text-slate-800">
                    <span className="font-mono text-[10px] text-amber-700 mr-1.5">{item.id}</span>
                    {item.type}
                  </p>
                  <p className="truncate text-[10px] text-slate-500">
                    {item.severity} · {item.description}
                  </p>
                </div>
                <div className="shrink-0">
                  {getStatusBadge(item.status)}
                </div>
              </div>
            ))}

            {/* Snapshot demo reports */}
            {snapshot.incidents.slice(0, 4).map(incident => (
              <div key={incident.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <div className="min-w-0 pr-2">
                  <p className="truncate text-xs font-semibold text-slate-700">
                    <span className="font-mono text-[10px] text-slate-400 mr-1.5">{incident.id}</span>
                    {incident.type}
                  </p>
                  <p className="text-[10px] text-slate-500">{incident.severity} · {incident.location}</p>
                </div>
                <div className="shrink-0 flex items-center gap-1.5">
                  <Badge variant="outline" className="border-slate-300 text-slate-600 text-[10px] font-mono">
                    UNVERIFIED
                  </Badge>
                  {getStatusBadge("SYNCED")}
                </div>
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
  const { language, t } = useLanguage();

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
            <Badge className="border-0 bg-red-100 text-red-700 font-bold">
              {language === "hi" ? "आपातकालीन प्रतिक्रिया" : "EMERGENCY MODE"}
            </Badge>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">IN-APP ALERT SYSTEM</span>
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {language === "hi" ? "त्वरित सुगम्यता एवं आपदा परिचालन केंद्र" : "Rapid Accessibility & Hazard Intelligence"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {language === "hi"
              ? "वास्तविक समय घटना प्रतिक्रिया, अवरुद्ध मार्ग, प्रभावित वाहन और आवश्यक राहत सामग्री आपूर्ति।"
              : "Real-time incident response, corridor blockages, affected convoys, and mission-critical shipments."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setBroadcastOpen(true)} className="gap-2 bg-red-600 hover:bg-red-700 text-white text-xs">
            <Radio size={14} /> {language === "hi" ? "अलर्ट प्रसारित करें" : "Broadcast Alert"}
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
                {language === "hi" ? `सक्रिय आपातकालीन चेतावनी (${activeAlerts.length})` : `Active Emergency Alerts (${activeAlerts.length})`}
              </span>
            </div>
            <span className="text-[11px] text-red-700 font-medium">
              {language === "hi" ? "तत्काल पावती एवं कार्रवाई आवश्यक" : "Requires immediate acknowledgement"}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {activeAlerts.slice(0, 4).map((a) => {
              let localized: { title: string; message: string; language: string };
              try {
                localized = localizeAlert(a as any, language);
              } catch {
                localized = {
                  title: a.title || "Alert",
                  message: a.message || "",
                  language: language,
                };
              }
              return (
                <div key={a.id} className="flex items-start justify-between gap-2 rounded-lg bg-white p-3 shadow-xs border border-red-100">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 truncate">{localized.title}</span>
                      <Badge className={a.severity === "CRITICAL" ? "bg-red-600 text-white text-[9px] px-1.5 py-0" : "bg-amber-500 text-white text-[9px] px-1.5 py-0"}>
                        {a.severity}
                      </Badge>
                      <Badge variant="outline" className="text-[9px] font-mono border-slate-300 text-slate-500 py-0">
                        {localized.language.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-600 line-clamp-2">{localized.message}</p>
                    <span className="mt-1 block text-[10px] text-slate-400 font-medium">📍 {a.corridor}</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => ackMutation.mutate({ alertId: a.id })}
                    disabled={ackMutation.isPending}
                    className="h-7 shrink-0 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  >
                    <CheckCircle2 size={11} className="mr-1" /> {language === "hi" ? "पुष्टि करें" : "Acknowledge"}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label={language === "hi" ? "गंभीर घटनाएं" : "Critical incidents"} value={snapshot.metrics.criticalIncidents} icon={Siren} tone="text-red-700" />
        <Kpi label={language === "hi" ? "अवरुद्ध मार्ग" : "Blocked roads"} value={snapshot.metrics.blockedRoads} icon={ShieldAlert} tone="text-red-700" />
        <Kpi label={language === "hi" ? "आपातकालीन कॉरिडोर" : "Emergency corridors"} value={snapshot.metrics.emergencyCorridors} icon={Route} tone="text-orange-700" />
        <Kpi label={language === "hi" ? "प्रभावित वाहन" : "Affected vehicles"} value={snapshot.metrics.affectedVehicles} icon={Truck} tone="text-orange-700" />
        <Kpi label={language === "hi" ? "आवश्यक आपूर्ति खेप" : "Critical shipments"} value="6" icon={PackageCheck} tone="text-red-700" />
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

function DriverNavigationView({
  snapshot,
  onOpenAcceptDialog,
  onOpenNavModal,
  acceptedRouteLabel,
  onNavigate,
}: {
  snapshot: Snapshot;
  onOpenAcceptDialog: () => void;
  onOpenNavModal: () => void;
  acceptedRouteLabel: string | null;
  onNavigate?: (label: string) => void;
}) {
  const { language } = useLanguage();
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

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

  const snapshotQuery = trpc.operations.snapshot.useQuery(undefined, { refetchInterval: 8000 });
  const driverVehicle = snapshotQuery.data?.vehicles?.find((v) => v.id === "TRK-104") as any;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-7 space-y-5">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-0 bg-sky-100 text-sky-800 font-bold">
              {language === "hi" ? "चालक लाइव नेविगेशन" : "TRUCK DRIVER NAVIGATION"}
            </Badge>
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
            <Badge variant="outline" className="text-[11px] border-emerald-300 text-emerald-700 bg-emerald-50">
              {recommendation?.status === "RECOMMENDED" ? "VALIDATED BY SAFETY ENGINE (TIER-1)" : "SAFETY CHECK REQUIRED"}
            </Badge>
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Navigation className="text-sky-600" size={24} />
            Guwahati → Imphal Alternate Corridor (Route B Bypass)
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {language === "hi"
              ? "सुरक्षित वैकल्पिक मार्ग: एनएच-37 पर पुल क्षति के कारण एनएच-6/एनएच-27 बाईपास निर्धारित किया गया।"
              : "Deterministic A* multi-criteria optimization bypassing blocked NH-37 Jorhat sector."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={onOpenNavModal} variant="outline" size="sm" className="gap-2 border-slate-300 text-xs">
            <Navigation size={13} /> Guidance Window
          </Button>
          <Button
            onClick={onOpenAcceptDialog}
            size="sm"
            className={cn(
              "gap-2 text-xs",
              acceptedRouteLabel ? "bg-emerald-600 hover:bg-emerald-700 text-white font-bold" : "bg-[#12313b] hover:bg-[#1a4452] text-white"
            )}
          >
            <CheckCircle2 size={13} /> {acceptedRouteLabel ? "Route Confirmed ✓" : "Accept Alternate Route"}
          </Button>
        </div>
      </div>

      {/* Primary Safety Alert */}
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="text-red-600 shrink-0 mt-0.5" size={20} />
          <div className="text-xs space-y-1">
            <p className="font-bold text-red-900 text-sm">
              Direct Highway (NH-37 via Jorhat) REJECTED by Safety Validator
            </p>
            <p className="text-red-700 leading-relaxed">
              Severe bridge undermine at km 284 poses structural collapse hazard. The shortest route cannot be dispatched safely.
              Automatic rerouting via Route B (NH-6 Shillong / NH-27 Lumding) provides 100% verified bridge integrity.
            </p>
            <div className="mt-2 pt-2 border-t border-red-200/60 font-mono text-[11px] text-red-800 flex items-center gap-4">
              <span>humanInTheLoopConfirmed = <strong>{acceptedRouteLabel ? "true" : "false"}</strong></span>
              <span>automaticVehicleRedirect = <strong>false</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Route & GPS Telemetry KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 bg-white shadow-xs">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Distance</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">584 km</p>
            <p className="mt-1 text-[11px] text-amber-600 font-medium">+23 km detour vs blocked corridor</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white shadow-xs">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Estimated Transit Time</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">11h 45m</p>
            <p className="mt-1 text-[11px] text-amber-600 font-medium">+31 min due to mountain bypass</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white shadow-xs">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Route Risk Level</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">LOW (18%)</p>
            <p className="mt-1 text-[11px] text-slate-500">Confidence: 94% · Weather clear</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white shadow-xs">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Vehicle Telemetry (TRK-104)</p>
            <p className="mt-1 text-base font-mono font-bold text-slate-800">
              {Number(driverVehicle?.latitude ?? 26.1445).toFixed(4)}, {Number(driverVehicle?.longitude ?? 91.7362).toFixed(4)}
            </p>
            <p className="mt-1 text-[11px] text-emerald-600 font-medium">GPS Fresh (&lt;1m) · Speed 42 km/h</p>
          </CardContent>
        </Card>
      </div>

      {/* Map & Turn-by-Turn Waypoints */}
      <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <RoleMap role="Truck Driver" />
        <Card className="border-0 bg-white shadow-xs">
          <CardHeader className="border-b border-slate-100 px-5 py-4">
            <CardTitle className="text-[15px] flex items-center justify-between">
              <span>Turn-by-Turn Corridor Waypoints</span>
              <Badge variant="outline" className="text-[10px] font-mono">5 STAGES</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {[
              { km: "km 0", title: "Guwahati Logistics Hub", desc: "Departed Bay 4 · Cargo verified (Emergency Medicine)", status: "COMPLETED", tone: "bg-emerald-500" },
              { km: "km 98", title: "Shillong Expressway (NH-6)", desc: "Current sector · Wet road advisory, reduce speed to 40 km/h", status: "IN PROGRESS", tone: "bg-sky-500" },
              { km: "km 270", title: "Lumding - Silchar Link (NH-27)", desc: "Active bypass avoiding blocked NH-37 bridge", status: "SCHEDULED", tone: "bg-slate-300" },
              { km: "km 430", title: "Jiribam Border Checkpoint", desc: "Document pre-cleared · Priority health corridor transit", status: "SCHEDULED", tone: "bg-slate-300" },
              { km: "km 584", title: "Imphal Regional Hospital Depot", desc: "Destination · Cold storage receiving bay", status: "SCHEDULED", tone: "bg-slate-300" },
            ].map((wp, idx) => (
              <div key={idx} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-50 border border-slate-100">
                <span className={cn("mt-1 h-3 w-3 rounded-full shrink-0", wp.tone)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">{wp.title}</span>
                    <span className="text-[10px] font-mono text-slate-400">{wp.km}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">{wp.desc}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DriverShipmentView({ snapshot }: { snapshot: Snapshot }) {
  const { language } = useLanguage();
  const snapshotQuery = trpc.operations.snapshot.useQuery(undefined, { refetchInterval: 8000 });
  const shipment = snapshotQuery.data?.shipments?.find((s) => s.assignedVehicleId === "TRK-104" || s.id === "SHP-001") as any;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-7 space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <Badge className="border-0 bg-red-100 text-red-700 font-bold">
            {shipment?.priority ?? "CRITICAL"} PRIORITY CONVOY
          </Badge>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {shipment?.name ?? "Emergency Medicine & Specialized Cold Chain Vaccines"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Waybill #SHP-001 · Assam Health Logistics Mission · Cold-Chain Regulated
          </p>
        </div>
        <Badge variant="outline" className="font-mono text-xs border-emerald-300 bg-emerald-50 text-emerald-800">
          STATUS: IN TRANSIT
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 bg-white shadow-xs">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Origin</p>
            <p className="mt-1 text-base font-bold text-slate-800">{shipment?.origin ?? "Guwahati"}</p>
            <p className="text-[11px] text-slate-500">Central Hub Bay 4</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white shadow-xs">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Destination</p>
            <p className="mt-1 text-base font-bold text-slate-800">{shipment?.destination ?? "Imphal"}</p>
            <p className="text-[11px] text-slate-500">Regional Health Directorate</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white shadow-xs">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cold Chain Monitor</p>
            <p className="mt-1 text-base font-bold text-emerald-600">4.2°C (Optimal)</p>
            <p className="text-[11px] text-slate-500">Safe Range: 2°C - 8°C</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-white shadow-xs">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned Vehicle</p>
            <p className="mt-1 text-base font-bold text-slate-800">TRK-104</p>
            <p className="text-[11px] text-slate-500">Driver: Biren Gogoi</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 bg-white shadow-xs">
        <CardHeader className="border-b border-slate-100 px-5 py-4">
          <CardTitle className="text-[15px]">Bill of Lading & Cargo Manifest</CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
            <div className="bg-slate-50 p-3 rounded-lg">
              <span className="text-slate-400 block text-[10px] uppercase">Cargo Net Weight</span>
              <strong className="text-slate-800 text-sm">420 kg (8 Pallets)</strong>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg">
              <span className="text-slate-400 block text-[10px] uppercase">Special Handling</span>
              <strong className="text-slate-800 text-sm">Keep Refrigerated</strong>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg">
              <span className="text-slate-400 block text-[10px] uppercase">Dispatch Timestamp</span>
              <strong className="text-slate-800 text-sm">Today, 08:30 IST</strong>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg">
              <span className="text-slate-400 block text-[10px] uppercase">Receiving Medical Officer</span>
              <strong className="text-slate-800 text-sm">Dr. M. Singh</strong>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <strong>⚠️ Route Detour Notice: </strong>
            Transit ETA is adjusted by +31 minutes due to bridge hazard avoidance on NH-37. Alternate corridor (NH-6 / NH-27) is actively maintained with clear road clearance.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DriverOfflineView() {
  const [offlineItems, setOfflineItems] = useState<OfflineIncident[]>(() => readOfflineQueue());

  useEffect(() => {
    const refreshQueue = () => setOfflineItems(readOfflineQueue());
    window.addEventListener(OFFLINE_QUEUE_EVENT, refreshQueue);
    return () => window.removeEventListener(OFFLINE_QUEUE_EVENT, refreshQueue);
  }, []);

  const cachedRoute = getPersistedCache<any>("route.GUWAHATI-IMPHAL");

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-7 space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <Badge className="border-0 bg-slate-200 text-slate-800 font-bold">LOCAL PERSISTENCE</Badge>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Offline Route & Telemetry Cache</h2>
          <p className="mt-1 text-sm text-slate-500">
            Local browser IndexedDB / localStorage data retained for zero-connectivity mountain corridors.
          </p>
        </div>
        <OfflineSyncStatus />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-0 bg-white shadow-xs">
          <CardHeader className="border-b border-slate-100 px-5 py-4">
            <CardTitle className="text-[15px] flex items-center gap-2">
              <Database size={16} className="text-sky-600" /> Cached Alternate Route
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 text-xs space-y-2">
            <p><strong>Corridor:</strong> Guwahati → Imphal (Route B Bypass)</p>
            <p><strong>Status:</strong> {cachedRoute ? "CACHED & READY" : "NOT CACHED YET"}</p>
            {cachedRoute && (
              <p className="text-slate-500">
                Cached at: {new Date(cachedRoute.cachedAt).toLocaleString()} ({formatCacheAge(cachedRoute.cachedAt)})
              </p>
            )}
            <p className="text-slate-500">
              When network connection drops, this route remains visible in turn-by-turn navigation without interruption.
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 bg-white shadow-xs">
          <CardHeader className="border-b border-slate-100 px-5 py-4">
            <CardTitle className="text-[15px] flex items-center gap-2">
              <CloudOff size={16} className="text-amber-600" /> Pending Offline Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 text-xs space-y-2">
            <p><strong>Queued Reports:</strong> {offlineItems.length} items</p>
            <p className="text-slate-500">
              Any incidents or road updates recorded while disconnected are safely queued and sync automatically upon reconnection.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FieldReportsView({
  snapshot,
  onNewReport,
}: {
  snapshot: Snapshot;
  onNewReport: () => void;
}) {
  const [offlineItems, setOfflineItems] = useState<OfflineIncident[]>(() => readOfflineQueue());

  useEffect(() => {
    const refreshQueue = () => setOfflineItems(readOfflineQueue());
    window.addEventListener(OFFLINE_QUEUE_EVENT, refreshQueue);
    return () => window.removeEventListener(OFFLINE_QUEUE_EVENT, refreshQueue);
  }, []);

  const handleSyncData = () => {
    window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_EVENT));
    toast.info("Triggered offline reports synchronization...");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-7 space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <Badge className="border-0 bg-emerald-100 text-emerald-800 font-bold">FIELD AUDIT LOG</Badge>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">My Field Reports & Sync State</h2>
          <p className="mt-1 text-sm text-slate-500">
            Ground truth evidence records with GPS coordinates, photos, and sync lifecycle statuses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleSyncData} variant="outline" size="sm" className="gap-2 text-xs">
            <UploadCloud size={13} /> Sync All Queued
          </Button>
          <Button onClick={onNewReport} size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
            <FilePlus2 size={13} /> New Report
          </Button>
        </div>
      </div>

      {offlineItems.length > 0 && (
        <Card className="border border-amber-200 bg-amber-50/50 shadow-xs">
          <CardHeader className="border-b border-amber-200 px-5 py-3.5">
            <CardTitle className="text-sm font-bold text-amber-900 flex items-center justify-between">
              <span>Local Offline Queue ({offlineItems.length} items)</span>
              <span className="text-[11px] font-mono text-amber-700">STORED IN BROWSER STORAGE</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-2">
            {offlineItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-amber-100 shadow-xs text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-amber-800">{item.id}</span>
                    <Badge variant="outline" className="text-[10px]">{item.type}</Badge>
                    <span className="text-slate-400 font-mono text-[11px]">📍 {item.latitude}, {item.longitude}</span>
                  </div>
                  <p className="mt-1 text-slate-600">{item.description}</p>
                </div>
                <Badge className="bg-amber-600 text-white">{item.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="border-0 bg-white shadow-xs">
        <CardHeader className="border-b border-slate-100 px-5 py-4">
          <CardTitle className="text-[15px]">Synchronized Field Incident Submissions</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3">Incident ID & Type</th>
                <th className="px-4 py-3">Location / GPS</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-5 py-3 text-right">Verification Status</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.incidents.map((inc) => (
                <tr key={inc.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-5 py-3.5">
                    <strong className="block text-slate-800">{inc.type}</strong>
                    <span className="text-[11px] text-slate-400 font-mono">{inc.id}</span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-600 font-mono text-[11px]">{inc.location}</td>
                  <td className="px-4 py-3.5">
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold",
                      inc.severity === "Critical" ? "bg-red-50 text-red-700" :
                      inc.severity === "High" ? "bg-orange-50 text-orange-700" : "bg-yellow-50 text-yellow-700"
                    )}>
                      {inc.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-400">{inc.age}</td>
                  <td className="px-5 py-3.5 text-right">
                    <Badge variant="outline" className="text-[10px] font-mono text-emerald-700 border-emerald-300 bg-emerald-50">
                      {inc.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function FieldSyncView() {
  const [offlineItems, setOfflineItems] = useState<OfflineIncident[]>(() => readOfflineQueue());

  useEffect(() => {
    const refreshQueue = () => setOfflineItems(readOfflineQueue());
    window.addEventListener(OFFLINE_QUEUE_EVENT, refreshQueue);
    return () => window.removeEventListener(OFFLINE_QUEUE_EVENT, refreshQueue);
  }, []);

  const handleSyncData = () => {
    window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_EVENT));
    toast.info("Offline sync engine executed.");
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-7 space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <Badge className="border-0 bg-emerald-100 text-emerald-800 font-bold">SYNCHRONIZATION HUB</Badge>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Offline Synchronization Engine</h2>
          <p className="mt-1 text-sm text-slate-500">
            Monitor background uploads, conflict resolution policies, and local offline cache health.
          </p>
        </div>
        <Button onClick={handleSyncData} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
          <UploadCloud size={14} /> Trigger Full Sync Now
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <OfflineSyncStatus />
        <Card className="border-0 bg-white shadow-xs">
          <CardHeader className="border-b border-slate-100 px-5 py-4">
            <CardTitle className="text-[15px] flex items-center gap-2">
              <RefreshCw size={16} className="text-emerald-600" /> Sync Policy & Conflict Rules
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 text-xs text-slate-600 space-y-2">
            <p><strong>Conflict Policy:</strong> Server Authority with Local Fork Preservation</p>
            <p><strong>Auto-Retry:</strong> Exponential backoff up to 5 attempts on network reconnect.</p>
            <p><strong>Queued Items:</strong> {offlineItems.length} records awaiting acknowledgment.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ManagerShipmentsView({ onOptimizeRoute }: { onOptimizeRoute?: () => void }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [filterPriority, setFilterPriority] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const snapshotQuery = trpc.operations.snapshot.useQuery();
  const rawShipments = snapshotQuery.data?.shipments ?? [];

  const filtered = rawShipments.filter((s: any) => {
    const matchPriority = filterPriority === "ALL" || s.priority === filterPriority;
    const matchSearch = !searchTerm || s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.id.toLowerCase().includes(searchTerm.toLowerCase()) || s.destination.toLowerCase().includes(searchTerm.toLowerCase());
    return matchPriority && matchSearch;
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-7 space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <Badge className="border-0 bg-violet-100 text-violet-800 font-bold">SUPPLY CHAIN OPERATIONS</Badge>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Priority Shipments & Deliveries</h2>
          <p className="mt-1 text-sm text-slate-500">
            Real-time tracking of critical life-saving cargo, planned vs actual ETA, and corridor delays.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2 bg-violet-600 hover:bg-violet-700 text-white text-xs">
          <Boxes size={14} /> Create Shipment
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-xs text-xs font-semibold">
          {["ALL", "CRITICAL", "HIGH", "NORMAL", "LOW"].map((p) => (
            <button
              key={p}
              onClick={() => setFilterPriority(p)}
              className={cn(
                "px-3 py-1.5 rounded-lg transition-colors cursor-pointer",
                filterPriority === p ? "bg-violet-600 text-white" : "text-slate-600 hover:text-slate-900"
              )}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="w-full sm:w-64">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search cargo, ID, city..."
            className="text-xs h-9 bg-white"
          />
        </div>
      </div>

      <Card className="border-0 bg-white shadow-xs">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3">Shipment & ID</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Assigned Truck</th>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">ETA & Delay Intelligence</th>
                <th className="px-5 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((shp: any) => {
                const planned = shp.plannedEtaMinutes ?? 120;
                const current = shp.currentEtaMinutes ?? shp.etaMinutes ?? planned;
                const delay = shp.delayMinutes ?? (current > planned ? current - planned : 0);
                const delayReason = shp.delayReason || (delay > 0 ? "Route conditions" : "On schedule");
                const vehId = shp.assignedVehicleId || "TRK-104";

                return (
                  <tr key={shp.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-5 py-3.5">
                      <strong className="block text-slate-800">{shp.name}</strong>
                      <span className="text-[11px] text-slate-400 font-mono">{shp.id}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold",
                        shp.priority === "CRITICAL" ? "bg-red-50 text-red-700" :
                        shp.priority === "HIGH" ? "bg-orange-50 text-orange-700" : "bg-slate-100 text-slate-700"
                      )}>
                        {shp.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-semibold text-slate-700 flex items-center gap-1">
                        <Truck size={12} className="text-slate-400" /> {vehId}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-700">
                      {shp.origin} → {shp.destination}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-800">
                        {Math.floor(current / 60)}h {current % 60}m
                      </div>
                      {delay > 0 ? (
                        <div className="text-[10px] text-amber-700 font-medium">+{delay}m · {delayReason}</div>
                      ) : (
                        <div className="text-[10px] text-emerald-600 font-medium">On schedule</div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-emerald-600 uppercase text-[11px]">
                      {shp.status}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <CreateShipmentDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function EmergencyRoutesView() {
  const [blockagesOpen, setBlockagesOpen] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-7 space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <Badge className="border-0 bg-red-100 text-red-700 font-bold">EMERGENCY BYPASS ENGINE</Badge>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Corridor Bypass & Evacuation Routes</h2>
          <p className="mt-1 text-sm text-slate-500">
            Deterministic A* search with hard-constraint physical road obstruction avoidance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setBroadcastOpen(true)} className="gap-2 bg-red-600 hover:bg-red-700 text-white text-xs">
            <Radio size={14} /> Broadcast Advisory
          </Button>
          <Button onClick={() => setBlockagesOpen(true)} variant="outline" className="gap-2 text-xs">
            <ShieldAlert size={14} className="text-red-600" /> View Blockages
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-900">
        <AlertTriangle size={15} className="mr-1.5 inline text-red-600" />
        <strong>Zero-Tolerance Constraint: </strong> Blocked road edges (physical damage, flash flood, landslide) receive infinite edge cost. If no alternate path exists, the system safely raises a NO SAFE ROUTE AVAILABLE state.
      </div>

      <RouteRecommendationPanel showComparison />
      <BlockagesDialog open={blockagesOpen} onOpenChange={setBlockagesOpen} />
      <BroadcastAlertDialog open={broadcastOpen} onOpenChange={setBroadcastOpen} />
    </div>
  );
}

function EmergencyCriticalShipmentsView() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const snapshotQuery = trpc.operations.snapshot.useQuery();
  const rawShipments = snapshotQuery.data?.shipments ?? [];
  const criticalList = rawShipments.filter((s: any) => s.priority === "CRITICAL" || s.priority === "HIGH");

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-7 space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <Badge className="border-0 bg-red-100 text-red-700 font-bold">CRITICAL SUPPLY TRACKING</Badge>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Emergency & High-Priority Convoys</h2>
          <p className="mt-1 text-sm text-slate-500">
            Categorized risk status for life-saving medicine, flood relief, and medical oxygen.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} variant="outline" className="gap-2 text-xs">
          <PackageCheck size={14} className="text-orange-600" /> Open Priority Monitor
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-0 bg-red-50 text-red-900 shadow-xs">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-700">Critically Affected (&gt;30m Delay)</p>
            <p className="mt-1 text-2xl font-bold">1</p>
            <p className="mt-1 text-[11px] text-red-600 font-medium">SHP-001 (Emergency Medicine via TRK-104)</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-orange-50 text-orange-900 shadow-xs">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-orange-700">Affected (Minor Detour)</p>
            <p className="mt-1 text-2xl font-bold">2</p>
            <p className="mt-1 text-[11px] text-orange-600 font-medium">Flood Relief Kits (SHP-002, SHP-004)</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-emerald-50 text-emerald-900 shadow-xs">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Monitoring (Normal Transit)</p>
            <p className="mt-1 text-2xl font-bold">3</p>
            <p className="mt-1 text-[11px] text-emerald-600 font-medium">Vaccines & Supplies on safe corridors</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 bg-white shadow-xs">
        <CardHeader className="border-b border-slate-100 px-5 py-4">
          <CardTitle className="text-[15px]">Active Critical Shipments List</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3">Shipment</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Assigned Truck</th>
                <th className="px-4 py-3">Corridor</th>
                <th className="px-4 py-3">Delay & Impact</th>
                <th className="px-5 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {criticalList.map((shp: any) => (
                <tr key={shp.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-5 py-3.5">
                    <strong className="block text-slate-800">{shp.name}</strong>
                    <span className="text-[11px] text-slate-400 font-mono">{shp.id}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge className={shp.priority === "CRITICAL" ? "bg-red-600 text-white text-[10px]" : "bg-orange-500 text-white text-[10px]"}>
                      {shp.priority}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-[11px] text-slate-700">{shp.assignedVehicleId || "TRK-104"}</td>
                  <td className="px-4 py-3.5 font-medium text-slate-700">{shp.origin} → {shp.destination}</td>
                  <td className="px-4 py-3.5">
                    <span className="text-amber-700 font-medium">+{shp.delayMinutes ?? 31}m delay</span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-emerald-600 uppercase text-[11px]">
                    {shp.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <CriticalShipmentsDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

function DriverGpsView({ snapshot }: { snapshot: Snapshot }) {
  const [simulatedMode, setSimulatedMode] = useState(true);
  const snapshotQuery = trpc.operations.snapshot.useQuery();
  const driverVehicle = snapshotQuery.data?.vehicles?.find((v) => v.id === "TRK-104") as any;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-7 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Badge className="border-0 bg-sky-100 text-sky-800 font-bold">VEHICLE TELEMETRY & GPS</Badge>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Vehicle TRK-104 Live Telemetry</h2>
          <p className="mt-1 text-xs text-slate-500">Real-time GPS sensor readouts and tracking diagnostics</p>
        </div>
        <Button
          onClick={() => setSimulatedMode(!simulatedMode)}
          variant="outline"
          size="sm"
          className="text-xs"
        >
          <Radio size={13} className="mr-1.5 text-orange-500" />
          {simulatedMode ? "Simulated GPS: ON" : "Live GPS: ON"}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Speed" value="48 km/h" icon={Truck} tone="text-slate-900" />
        <Kpi label="Fuel Level" value="76%" icon={BatteryMedium} tone="text-emerald-700" />
        <Kpi label="Cargo Temp" value="4.2°C" icon={PackageCheck} tone="text-sky-700" />
        <Kpi label="GPS Freshness" value="< 1 min" icon={Radio} tone="text-emerald-700" />
      </div>

      <Card className="border-0 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
        <CardHeader className="border-b border-slate-100 px-5 py-4">
          <CardTitle className="text-[15px]">GPS Sensor Telemetry Diagnostics</CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-4 text-xs">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="p-4 rounded-xl bg-slate-50 space-y-2">
              <span className="text-[11px] font-bold uppercase text-slate-400">Position Coordinates</span>
              <p className="text-lg font-mono font-bold text-slate-900">
                {Number(driverVehicle?.latitude ?? 26.1445).toFixed(4)}° N, {Number(driverVehicle?.longitude ?? 91.7362).toFixed(4)}° E
              </p>
              <p className="text-slate-500">Sector: NH-27 (Kamrup Metropolitan, Assam)</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 space-y-2">
              <span className="text-[11px] font-bold uppercase text-slate-400">Heading & Elevation</span>
              <p className="text-lg font-mono font-bold text-slate-900">68° ENE · 54m ASL</p>
              <p className="text-slate-500">Accuracy: ±3.2m · 12 Satellites Locked</p>
            </div>
          </div>
          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <span className="font-semibold text-emerald-900">GPS Ping Synchronized with Regional Lifeline Operations</span>
            </div>
            <Badge className="bg-emerald-600 text-white text-[10px]">HEALTHY</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FieldRoadStatusView({ onNavigateReport }: { onNavigateReport: () => void }) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const roadSegments = [
    { corridor: "NH-37", segment: "Guwahati – Jorhat (Km 142)", status: "BLOCKED", condition: "Bridge Damage / Submerged", verified: true },
    { corridor: "NH-29", segment: "Dimapur – Kohima (Km 38)", status: "RESTRICTED", condition: "Mudslide clearing in progress", verified: true },
    { corridor: "NH-2", segment: "Kohima – Imphal (Km 84)", status: "OPEN", condition: "Paved, normal flow", verified: true },
    { corridor: "NH-6", segment: "Shillong – Silchar (Km 110)", status: "OPEN", condition: "Heavy rainfall caution", verified: false },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-7 space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <Badge className="border-0 bg-emerald-100 text-emerald-800 font-bold">ROAD ACCESSIBILITY</Badge>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Corridor Accessibility Status</h2>
          <p className="mt-1 text-xs text-slate-500">Live ground accessibility updates and physical road constraints</p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
        >
          <ShieldAlert size={14} /> Update Road Status
        </Button>
      </div>

      <Card className="border-0 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                <th className="px-5 py-3">Corridor</th>
                <th className="px-3 py-3">Segment Location</th>
                <th className="px-3 py-3">Accessibility</th>
                <th className="px-3 py-3">Condition & Field Notes</th>
                <th className="px-5 py-3 text-right">Verification</th>
              </tr>
            </thead>
            <tbody>
              {roadSegments.map((seg, idx) => (
                <tr key={idx} className="border-b border-slate-50">
                  <td className="px-5 py-3 font-bold text-slate-900">{seg.corridor}</td>
                  <td className="px-3 py-3 text-slate-600">{seg.segment}</td>
                  <td className="px-3 py-3">
                    <Badge
                      className={
                        seg.status === "BLOCKED"
                          ? "bg-red-600 text-white"
                          : seg.status === "RESTRICTED"
                          ? "bg-amber-500 text-white"
                          : "bg-emerald-600 text-white"
                      }
                    >
                      {seg.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{seg.condition}</td>
                  <td className="px-5 py-3 text-right">
                    <Badge variant="outline" className={seg.verified ? "border-emerald-300 text-emerald-700" : "border-slate-300 text-slate-500"}>
                      {seg.verified ? "VERIFIED GROUND TRUTH" : "UNVERIFIED REPORT"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <UpdateRoadStatusDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

function LogisticsDelaysView({ snapshot }: { snapshot: Snapshot }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-7 space-y-6">
      <div>
        <Badge className="border-0 bg-orange-100 text-orange-800 font-bold">DELAY INTELLIGENCE</Badge>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Corridor Delay & Bottleneck Analysis</h2>
        <p className="mt-1 text-xs text-slate-500">Root-cause attribution and turnaround delay distribution</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Delayed Shipments" value={snapshot.metrics.delayedShipments} icon={Clock} tone="text-orange-700" />
        <Kpi label="Avg Delay Duration" value="42 min" icon={Route} tone="text-orange-700" />
        <Kpi label="Critical Shipments Impacted" value="1" icon={Siren} tone="text-red-700" />
      </div>

      <Card className="border-0 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
        <CardHeader className="border-b border-slate-100 px-5 py-4">
          <CardTitle className="text-[15px]">Active Bottleneck Attribution</CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-3 text-xs">
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <div>
              <strong className="text-red-900">NH-37 Jorhat Sector</strong>
              <p className="text-red-700">Bridge damage obstruction · +102m delay for westbound convoys</p>
            </div>
            <Badge className="bg-red-600 text-white">HIGH SEVERITY</Badge>
          </div>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
            <div>
              <strong className="text-amber-900">NH-29 Dimapur – Kohima Pass</strong>
              <p className="text-amber-700">Mudslide debris clearance · +18m delay</p>
            </div>
            <Badge className="bg-amber-500 text-white">MODERATE</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EmergencyAffectedVehiclesView({ snapshot }: { snapshot: Snapshot }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-7 space-y-6">
      <div>
        <Badge className="border-0 bg-red-100 text-red-800 font-bold">CONVOY IMPACT</Badge>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Affected Vehicles & Convoys</h2>
        <p className="mt-1 text-xs text-slate-500">Vehicles operating inside or near high-hazard perimeters</p>
      </div>

      <Card className="border-0 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                <th className="px-5 py-3">Vehicle ID</th>
                <th className="px-3 py-3">Driver</th>
                <th className="px-3 py-3">Hazard Exposure</th>
                <th className="px-3 py-3">Current Coordinates</th>
                <th className="px-5 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-50">
                <td className="px-5 py-3 font-mono font-bold text-slate-900">TRK-104</td>
                <td className="px-3 py-3 text-slate-600">Biren Gogoi</td>
                <td className="px-3 py-3 text-red-600 font-semibold">NH-37 Bridge Damage (8.2 km ahead)</td>
                <td className="px-3 py-3 font-mono text-slate-500">26.1445° N, 91.7362° E</td>
                <td className="px-5 py-3 text-right">
                  <Badge className="bg-red-600 text-white">HIGH RISK</Badge>
                </td>
              </tr>
              <tr className="border-b border-slate-50">
                <td className="px-5 py-3 font-mono font-bold text-slate-900">TRK-219</td>
                <td className="px-3 py-3 text-slate-600">Manas Kalita</td>
                <td className="px-3 py-3 text-amber-600 font-semibold">NH-29 Mudslide sector</td>
                <td className="px-3 py-3 font-mono text-slate-500">25.6747° N, 94.1086° E</td>
                <td className="px-5 py-3 text-right">
                  <Badge className="bg-amber-500 text-white">MODERATE RISK</Badge>
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

export function RoleWorkspace({
  role,
  snapshot,
  onRoleChange,
}: {
  role: Role;
  snapshot: Snapshot;
  onRoleChange: (role: Role) => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [active, setActive] = useState(roleNavigation[role][0]);
  const [authOpen, setAuthOpen] = useState(false);
  const [driverNavOpen, setDriverNavOpen] = useState(false);
  const [driverAcceptOpen, setDriverAcceptOpen] = useState(false);
  const [acceptedRouteLabel, setAcceptedRouteLabel] = useState<string | null>(null);
  const { login } = useAuth();

  // Keep active navigation in sync when role changes
  useEffect(() => {
    if (!roleNavigation[role]?.includes(active)) {
      setActive(roleNavigation[role][0]);
    }
  }, [role, active]);

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

  // Render role-specific views deterministically
  const renderView = () => {
    if (role === "Truck Driver") {
      switch (active) {
        case "My Trip":
          return <DriverDashboard snapshot={snapshot} />;
        case "Navigation":
          return (
            <DriverNavigationView
              snapshot={snapshot}
              onOpenAcceptDialog={() => setDriverAcceptOpen(true)}
              onOpenNavModal={() => setDriverNavOpen(true)}
              acceptedRouteLabel={acceptedRouteLabel}
              onNavigate={setActive}
            />
          );
        case "Vehicle / GPS":
          return <DriverGpsView snapshot={snapshot} />;
        case "My Shipment":
        case "Shipments":
          return <DriverShipmentView snapshot={snapshot} />;
        case "Alerts":
          return (
            <div className="mx-auto max-w-6xl px-4 py-6 sm:px-7 space-y-4">
              <AlertsView />
            </div>
          );
        case "Report Incident":
          return (
            <div className="mx-auto max-w-2xl px-4 py-6 sm:px-7 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Badge className="border-0 bg-orange-100 text-orange-800 font-bold">DRIVER GROUND REPORT</Badge>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Report Road Incident</h2>
                </div>
                <Button variant="outline" size="sm" onClick={() => setActive("My Trip")}>Back to Trip</Button>
              </div>
              <IncidentReportForm offline={!navigator.onLine} onClose={() => setActive("My Trip")} />
            </div>
          );
        case "Offline Data":
        case "Offline Sync":
          return <DriverOfflineView />;
        case "Settings":
          return (
            <div className="mx-auto max-w-6xl px-4 py-6 sm:px-7 space-y-4">
              <SettingsView />
            </div>
          );
        default:
          return <DriverDashboard snapshot={snapshot} />;
      }
    }

    if (role === "Field Officer") {
      switch (active) {
        case "Field Dashboard":
          return <FieldDashboard snapshot={snapshot} />;
        case "Report Incident":
          return (
            <div className="mx-auto max-w-2xl px-4 py-6 sm:px-7 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Badge className="border-0 bg-emerald-100 text-emerald-800 font-bold">FIELD GROUND TRUTH</Badge>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Submit Incident Report</h2>
                </div>
                <Button variant="outline" size="sm" onClick={() => setActive("Field Dashboard")}>Back to Dashboard</Button>
              </div>
              <IncidentReportForm offline={!navigator.onLine} onClose={() => setActive("Field Dashboard")} />
            </div>
          );
        case "Road Status":
          return <FieldRoadStatusView onNavigateReport={() => setActive("Report Incident")} />;
        case "Nearby Incidents":
        case "Alerts":
          return (
            <div className="mx-auto max-w-6xl px-4 py-6 sm:px-7 space-y-4">
              <AlertsView />
            </div>
          );
        case "Map":
          return (
            <div className="mx-auto max-w-6xl px-4 py-6 sm:px-7 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Badge className="border-0 bg-emerald-100 text-emerald-800 font-bold">FIELD GIS OVERLAYS</Badge>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Ground Accessibility Map</h2>
                </div>
              </div>
              <RoleMap role="Field Officer" />
            </div>
          );
        case "My Reports":
        case "Field Reports":
          return <FieldReportsView snapshot={snapshot} onNewReport={() => setActive("Report Incident")} />;
        case "Sync":
        case "Offline Sync":
          return <FieldSyncView />;
        case "Settings":
          return (
            <div className="mx-auto max-w-6xl px-4 py-6 sm:px-7 space-y-4">
              <SettingsView />
            </div>
          );
        default:
          return <FieldDashboard snapshot={snapshot} />;
      }
    }

    if (role === "Logistics Manager") {
      switch (active) {
        case "Dashboard":
        case "Operations":
          return <ManagerDashboard snapshot={snapshot} />;
        case "Shipments":
          return <ManagerShipmentsView />;
        case "Vehicles":
        case "Fleet":
          return (
            <div className="mx-auto max-w-6xl px-4 py-6 sm:px-7 space-y-4">
              <FleetView onSelectRoute={() => setActive("Corridors")} />
            </div>
          );
        case "Delays":
          return <LogisticsDelaysView snapshot={snapshot} />;
        case "Critical Shipments":
          return <EmergencyCriticalShipmentsView />;
        case "Routes":
        case "Corridors":
          return (
            <div className="mx-auto max-w-6xl px-4 py-6 sm:px-7 space-y-5">
              <CorridorsView onSelectRoute={() => {}} />
              <RouteRecommendationPanel showComparison />
            </div>
          );
        case "Alerts":
          return (
            <div className="mx-auto max-w-6xl px-4 py-6 sm:px-7 space-y-4">
              <AlertsView />
            </div>
          );
        case "Analytics":
          return (
            <div className="mx-auto max-w-6xl px-4 py-6 sm:px-7 space-y-4">
              <AnalyticsView />
            </div>
          );
        case "Settings":
          return (
            <div className="mx-auto max-w-6xl px-4 py-6 sm:px-7 space-y-4">
              <SettingsView />
            </div>
          );
        default:
          return <ManagerDashboard snapshot={snapshot} />;
      }
    }

    if (role === "Emergency Response Team") {
      switch (active) {
        case "Emergency Dashboard":
          return <EmergencyDashboard snapshot={snapshot} />;
        case "Emergency Map":
        case "Map":
          return (
            <div className="mx-auto max-w-6xl px-4 py-6 sm:px-7 space-y-4">
              <RoleMap role="Emergency Response Team" />
            </div>
          );
        case "Active Incidents":
        case "Critical Incidents":
          return (
            <div className="mx-auto max-w-6xl px-4 py-6 sm:px-7 space-y-4">
              <IncidentsView />
            </div>
          );
        case "Emergency Routes":
          return <EmergencyRoutesView />;
        case "Affected Shipments":
        case "Critical Shipments":
          return <EmergencyCriticalShipmentsView />;
        case "Affected Vehicles":
          return <EmergencyAffectedVehiclesView snapshot={snapshot} />;
        case "Alerts":
          return (
            <div className="mx-auto max-w-6xl px-4 py-6 sm:px-7 space-y-4">
              <AlertsView />
            </div>
          );
        case "Analytics":
          return (
            <div className="mx-auto max-w-6xl px-4 py-6 sm:px-7 space-y-4">
              <AnalyticsView />
            </div>
          );
        case "Settings":
          return (
            <div className="mx-auto max-w-6xl px-4 py-6 sm:px-7 space-y-4">
              <SettingsView />
            </div>
          );
        default:
          return <EmergencyDashboard snapshot={snapshot} />;
      }
    }

    return <DriverDashboard snapshot={snapshot} />;
  };

  return (
    <div className="min-h-screen bg-[#f4f7f9] text-slate-900">
      <Sidebar
        role={role}
        active={active}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        onNavigate={(label) => setActive(label)}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />
      <main className={cn("transition-all duration-200", collapsed ? "lg:pl-[72px]" : "lg:pl-[250px]")}>
        <Header
          role={role}
          active={active}
          onRoleChange={handleRoleChange}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
          onOpenAuth={() => setAuthOpen(true)}
        />
        {renderView()}
      </main>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      <DriverNavigationDialog
        open={driverNavOpen}
        onOpenChange={setDriverNavOpen}
        onShowOnMap={() => document.querySelector("[data-route-recommendation]")?.scrollIntoView({ behavior: "smooth", block: "center" })}
      />
      <DriverAcceptRouteDialog
        open={driverAcceptOpen}
        onOpenChange={setDriverAcceptOpen}
        onAccepted={(label) => setAcceptedRouteLabel(label)}
      />
    </div>
  );
}
