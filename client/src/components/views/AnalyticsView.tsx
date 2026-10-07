import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  PackageCheck,
  Route,
  ShieldAlert,
  Truck,
  CloudRain,
  RefreshCw,
  FileWarning,
  Activity,
  Layers3,
  Flame,
  Radio,
  Building2,
  ChevronRight,
  Database,
  Info,
  CheckCheck,
} from "lucide-react";

export function AnalyticsView() {
  const [selectedTab, setSelectedTab] = useState<
    "regional" | "corridors" | "logistics" | "fleet" | "emergency" | "field" | "audit"
  >("regional");
  const [corridorFilter, setCorridorFilter] = useState<string>("ALL");
  const [timeRangeFilter, setTimeRangeFilter] = useState<string>("ALL");

  const utils = trpc.useUtils();
  const reportQuery = trpc.analytics.fullReport.useQuery(
    {
      corridor: corridorFilter !== "ALL" ? corridorFilter : undefined,
      timeRange: timeRangeFilter !== "ALL" ? timeRangeFilter : undefined,
    },
    { refetchInterval: 12000 }
  );

  const auditQuery = trpc.operations.audit.useQuery({ limit: 50 });
  const auditEvents = auditQuery.data ?? [];

  const data = reportQuery.data;
  const isLoading = reportQuery.isLoading;

  const handleRefresh = () => {
    utils.analytics.invalidate();
    utils.operations.audit.invalidate();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-0 bg-violet-100 text-violet-800 font-bold">
              PHASE 7 ANALYTICS & INTELLIGENCE
            </Badge>
            <Badge className="border-0 bg-amber-100 text-amber-900 font-mono text-[10px]">
              DEMO / SYNTHETIC DATA
            </Badge>
            <span className="text-xs text-slate-500">SIH26002 Decision Support</span>
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            Operational Intelligence & Accessibility Analytics
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Deterministic decision-support metrics computed strictly from verified field reports, road accessibility states, GPS telemetry, and safety constraints.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={reportQuery.isFetching}
            className="gap-2 border-slate-200 text-xs shadow-xs"
          >
            <RefreshCw size={13} className={reportQuery.isFetching ? "animate-spin" : ""} />
            {reportQuery.isFetching ? "Aggregating..." : "Refresh Intelligence"}
          </Button>
        </div>
      </div>

      {/* Synthetic Data & Metadata Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-950">
        <div className="flex items-start gap-2.5">
          <Info size={16} className="mt-0.5 text-amber-700 shrink-0" />
          <div>
            <p className="font-semibold text-amber-900">
              Authority & Provenance Disclosure · DEMO / SYNTHETIC OPERATIONAL RECORDS
            </p>
            <p className="text-amber-800/90 text-[11px] mt-0.5">
              All metrics are calculated deterministically from active Northeast corridor models and verified field inputs. Zero random charts. Safety Validator remains authoritative; analytics are advisory decision support.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-amber-900/80">
          <span>Records: {data?.regionalOverview.metadata.recordCount.corridors ?? 6} corridors · {data?.incidentAnalytics.total ?? 0} incidents · {data?.fleetAnalytics.totalVehicles ?? 0} vehicles</span>
        </div>
      </div>

      {/* Global Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Corridor Scope:</span>
            <select
              value={corridorFilter}
              onChange={(e) => setCorridorFilter(e.target.value)}
              className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-800"
            >
              <option value="ALL">All Northeast Corridors</option>
              <option value="NH-37-JORHAT">NH-37 · Guwahati – Upper Assam</option>
              <option value="NH-2-KOHIMA">NH-2 · Dimapur – Kohima – Imphal</option>
              <option value="NH-6-SHILLONG">NH-6 · Guwahati – Shillong – Silchar</option>
              <option value="NH-53-SILCHAR">NH-53 · Silchar – Jiribam – Imphal</option>
              <option value="NH-39-IMPHAL">NH-39 · Numaligarh – Imphal</option>
              <option value="NH-44-AGARTALA">NH-44 · Shillong – Agartala</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Time Horizon:</span>
            <select
              value={timeRangeFilter}
              onChange={(e) => setTimeRangeFilter(e.target.value)}
              className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-800"
            >
              <option value="ALL">Active Operational Snapshot</option>
              <option value="LAST_24H">Last 24 Hours</option>
            </select>
          </div>
        </div>

        <div className="text-[11px] text-slate-500 font-mono">
          Last computed: {data ? new Date(data.regionalOverview.metadata.generatedAt).toLocaleTimeString() : "--:--:--"}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-2 text-xs font-semibold">
        {[
          { id: "regional", label: "Regional Overview", icon: Building2 },
          { id: "corridors", label: "Corridor Accessibility", icon: Route },
          { id: "logistics", label: "Logistics & Delay Causes", icon: PackageCheck },
          { id: "fleet", label: "Fleet & GPS Health", icon: Truck },
          { id: "emergency", label: "Emergency Response", icon: ShieldAlert },
          { id: "field", label: "Field Officer Throughput", icon: FileWarning },
          { id: "audit", label: "Audit Ledger", icon: Database },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = selectedTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id as any)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-all ${
                isActive
                  ? "bg-[#12313b] text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: REGIONAL OVERVIEW (GOVERNMENT ADMIN) */}
      {selectedTab === "regional" && data && (
        <div className="space-y-6">
          {/* Top Regional KPI Tiles */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between text-emerald-700">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Regional Accessibility
                </span>
                <Route size={18} />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {data.regionalOverview.accessibilityPercentage}%
              </p>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-600">
                <span className="text-emerald-700 font-semibold">{data.regionalOverview.accessibleCorridors} Accessible</span>
                <span>·</span>
                <span className="text-amber-700 font-semibold">{data.regionalOverview.restrictedCorridors} Restricted</span>
                <span>·</span>
                <span className="text-red-700 font-semibold">{data.regionalOverview.blockedCorridors} Blocked</span>
              </div>
            </Card>

            <Card className="border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between text-red-600">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Active Disruptions
                </span>
                <Flame size={18} />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {data.regionalOverview.totalActiveIncidents}
              </p>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-600">
                <span className="text-red-700 font-semibold">{data.regionalOverview.activeDisruptions.critical} Critical</span>
                <span>·</span>
                <span className="text-orange-700 font-semibold">{data.regionalOverview.activeDisruptions.high} High</span>
                <span>·</span>
                <span className="text-amber-700 font-semibold">{data.regionalOverview.activeDisruptions.moderate} Moderate</span>
              </div>
            </Card>

            <Card className="border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between text-violet-700">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Logistics Transit Impact
                </span>
                <Clock size={18} />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {data.regionalOverview.logisticsImpact.averageDelayMinutes} min
              </p>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-600">
                <span className="text-orange-700 font-semibold">{data.regionalOverview.logisticsImpact.delayedShipments} Delayed</span>
                <span>·</span>
                <span className="text-red-700 font-semibold">{data.regionalOverview.logisticsImpact.criticalShipments} Critical Cargo</span>
              </div>
            </Card>

            <Card className="border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between text-sky-700">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Ground Truth Verification
                </span>
                <CheckCircle2 size={18} />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {data.regionalOverview.verifiedIncidents} / {data.regionalOverview.totalActiveIncidents}
              </p>
              <div className="mt-1 text-[11px] text-slate-500">
                {data.incidentAnalytics.unresolvedCount} unverified field reports pending review
              </div>
            </Card>
          </div>

          {/* Regional Details Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-slate-200 bg-white shadow-xs">
              <CardHeader className="border-b border-slate-100 px-5 py-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Regional Corridor Accessibility Breakdown
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Physical connectivity status across key interstate mountain highways
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] text-slate-600">
                  {data.corridorData.totalCorridors} Corridors
                </Badge>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                {data.corridorData.corridors.map((c) => {
                  const color =
                    c.accessibility === "blocked"
                      ? "bg-red-500"
                      : c.accessibility === "restricted"
                      ? "bg-amber-500"
                      : "bg-emerald-500";
                  const badgeColor =
                    c.accessibility === "blocked"
                      ? "bg-red-100 text-red-800"
                      : c.accessibility === "restricted"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-emerald-100 text-emerald-800";
                  return (
                    <div key={c.id} className="rounded-lg border border-slate-100 p-3 bg-slate-50/50">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-bold text-slate-800">{c.name}</span>
                        <Badge className={`text-[10px] border-0 font-bold uppercase ${badgeColor}`}>
                          {c.accessibility}
                        </Badge>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden mb-2">
                        <div
                          className={`h-full ${color}`}
                          style={{
                            width:
                              c.accessibility === "blocked"
                                ? "100%"
                                : c.accessibility === "restricted"
                                ? "60%"
                                : "20%",
                          }}
                        />
                      </div>
                      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 gap-2">
                        <span>Disruptions: <strong className="text-slate-700">{c.activeDisruptions}</strong></span>
                        <span>Risk: <strong className="text-slate-700">{c.riskLevel} ({c.riskProbability}%)</strong></span>
                        <span>Avg Delay: <strong className="text-slate-700">{c.averageDelayMinutes}m</strong></span>
                        <span>Safety: <strong className="text-slate-700">{c.safetyStatus}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white shadow-xs">
              <CardHeader className="border-b border-slate-100 px-5 py-4">
                <CardTitle className="text-sm font-bold text-slate-900">
                  Active Incidents by Hazard Type
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verified structural failures, weather hazards, and corridor blockages
                </p>
              </CardHeader>
              <CardContent className="p-5 space-y-3">
                {Object.entries(data.incidentAnalytics.byType).length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No incident records in this filter.</p>
                ) : (
                  Object.entries(data.incidentAnalytics.byType).map(([type, count]) => {
                    const pct = Math.round((count / data.incidentAnalytics.total) * 100);
                    return (
                      <div key={type} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-slate-800">{type}</span>
                          <span className="text-slate-500 font-mono">{count} incidents ({pct}%)</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full bg-slate-700 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}

                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs space-y-2">
                  <div className="flex items-center gap-2 text-slate-800 font-bold">
                    <ShieldCheck size={16} className="text-emerald-700" />
                    <span>Authoritative Safety Constraints Active</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Safety Validator holds hard authority over routing. Blocked bridges and verified critical blockages cannot be bypassed without explicit Government Admin human override.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: CORRIDOR ACCESSIBILITY */}
      {selectedTab === "corridors" && data && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Lifeline Corridor Accessibility Matrix</h3>
              <p className="text-xs text-slate-500">
                Segment-level accessibility states, Safety Validator judgements, and operational delay calculations.
              </p>
            </div>
            {data.corridorData.mostDisruptedCorridor && (
              <Badge className="bg-red-100 text-red-800 border-0 text-xs">
                ⚠️ Primary Bottleneck: {data.corridorData.mostDisruptedCorridor}
              </Badge>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.corridorData.corridors.map((c) => {
              const badgeClass =
                c.accessibility === "blocked"
                  ? "bg-red-600 text-white"
                  : c.accessibility === "restricted"
                  ? "bg-amber-500 text-white"
                  : "bg-emerald-600 text-white";

              const safetyBadge =
                c.safetyStatus === "REJECTED"
                  ? "bg-red-100 text-red-800"
                  : c.safetyStatus === "CAUTION"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-emerald-100 text-emerald-800";

              return (
                <Card key={c.id} className="border-slate-200 bg-white shadow-xs flex flex-col justify-between">
                  <div>
                    <CardHeader className="border-b border-slate-100 px-4 py-3.5 flex flex-row items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-500">{c.id}</span>
                          <Badge className={`text-[10px] px-2 py-0.5 border-0 font-bold uppercase ${badgeClass}`}>
                            {c.accessibility}
                          </Badge>
                        </div>
                        <h4 className="mt-1 text-sm font-bold text-slate-900 line-clamp-1">{c.name}</h4>
                        <p className="text-[11px] text-slate-500">{c.state} · {c.lengthKm} km</p>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">Risk Level</span>
                          <p className="font-bold text-slate-800">{c.riskLevel} ({c.riskProbability}%)</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">Avg Delay</span>
                          <p className="font-bold text-slate-800">{c.averageDelayMinutes} min</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">Active Incidents</span>
                          <p className="font-bold text-slate-800">{c.activeDisruptions}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">Affected Convoys</span>
                          <p className="font-bold text-slate-800">{c.affectedVehiclesCount} vehicles</p>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-600">Safety Status:</span>
                          <Badge variant="outline" className={`text-[10px] font-bold ${safetyBadge}`}>
                            {c.safetyStatus}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-slate-500 italic bg-white p-2 rounded border border-slate-100">
                          "{c.safetyReasons[0] ?? "Operational within normal mountain tolerances"}"
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-500">
                        <span>Weather: {c.weatherSource}</span>
                        <span>Critical transit: {c.criticalLoadTransitAllowed ? "Permitted" : "Prohibited"}</span>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: LOGISTICS & DELAY ROOT CAUSES */}
      {selectedTab === "logistics" && data && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between text-violet-700">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Tracked Shipments</span>
                <PackageCheck size={18} />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{data.shipmentAnalytics.totalShipments}</p>
              <div className="mt-1 text-[11px] text-slate-500">
                {data.shipmentAnalytics.inTransit} In Transit · {data.shipmentAnalytics.delivered} Delivered
              </div>
            </Card>

            <Card className="border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between text-emerald-700">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">On-Time Reliability</span>
                <TrendingUp size={18} />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{data.shipmentAnalytics.onTimeRatePercentage}%</p>
              <div className="mt-1 text-[11px] text-slate-500">
                {data.shipmentAnalytics.delayed} shipments delayed
              </div>
            </Card>

            <Card className="border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between text-orange-700">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Average Transit Delay</span>
                <Clock size={18} />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{data.delayAnalytics.averageDelayMinutes} min</p>
              <div className="mt-1 text-[11px] text-slate-500">
                Max recorded delay: {data.delayAnalytics.maxDelayMinutes} min
              </div>
            </Card>

            <Card className="border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between text-red-700">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Critical Cargo Convoys</span>
                <ShieldAlert size={18} />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{data.shipmentAnalytics.critical}</p>
              <div className="mt-1 text-[11px] text-slate-500">
                Medical & disaster relief consignments
              </div>
            </Card>
          </div>

          {/* Delay Root Causes Matrix */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-slate-200 bg-white shadow-xs">
              <CardHeader className="border-b border-slate-100 px-5 py-4">
                <CardTitle className="text-sm font-bold text-slate-900">
                  Deterministic Delay Root Cause Distribution
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Root cause classified strictly from operational ETA records and incident linkage
                </p>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                {data.delayAnalytics.causesBreakdown.map((cause) => {
                  return (
                    <div key={cause.cause} className="rounded-lg border border-slate-100 p-3 bg-slate-50/60">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <strong className="text-slate-800">{cause.label}</strong>
                        <Badge variant="outline" className="text-[10px] font-mono border-slate-300">
                          {cause.count} incidents ({cause.percentage}%)
                        </Badge>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden mb-2">
                        <div
                          className="h-full bg-[#12313b]"
                          style={{ width: `${cause.percentage}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span>Total Delay Impact: <strong className="text-slate-700">{cause.totalDelayMinutes} min</strong></span>
                        <span>Avg Delay: <strong className="text-slate-700">{cause.averageDelayMinutes} min</strong></span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white shadow-xs">
              <CardHeader className="border-b border-slate-100 px-5 py-4">
                <CardTitle className="text-sm font-bold text-slate-900">
                  Delay Severity Distribution
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Shipment delay magnitude across active transport orders
                </p>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 text-center">
                    <span className="text-[10px] font-bold uppercase text-emerald-800">On Time</span>
                    <p className="text-xl font-bold text-emerald-950 mt-1">{data.delayAnalytics.delayDistribution.onTime}</p>
                    <span className="text-[10px] text-emerald-700">0 min delay</span>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 text-center">
                    <span className="text-[10px] font-bold uppercase text-amber-800">Minor Delay</span>
                    <p className="text-xl font-bold text-amber-950 mt-1">{data.delayAnalytics.delayDistribution.minor}</p>
                    <span className="text-[10px] text-amber-700">1 - 30 min</span>
                  </div>
                  <div className="p-3 bg-orange-50 rounded-lg border border-orange-100 text-center">
                    <span className="text-[10px] font-bold uppercase text-orange-800">Moderate Delay</span>
                    <p className="text-xl font-bold text-orange-950 mt-1">{data.delayAnalytics.delayDistribution.moderate}</p>
                    <span className="text-[10px] text-orange-700">31 - 60 min</span>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg border border-red-100 text-center">
                    <span className="text-[10px] font-bold uppercase text-red-800">Severe Delay</span>
                    <p className="text-xl font-bold text-red-950 mt-1">{data.delayAnalytics.delayDistribution.severe}</p>
                    <span className="text-[10px] text-red-700">&gt; 60 min</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-slate-800 mb-2">Most Delayed Corridors:</h4>
                  <div className="space-y-2">
                    {data.delayAnalytics.mostAffectedCorridors.map((c) => (
                      <div key={c.corridor} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded">
                        <span className="font-medium text-slate-700">{c.corridor}</span>
                        <span className="font-mono text-slate-900 font-bold">{c.totalDelayMinutes} min total delay ({c.delayedShipmentsCount} shipments)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 4: FLEET & GPS FRESHNESS */}
      {selectedTab === "fleet" && data && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between text-sky-700">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Tracked Fleet</span>
                <Truck size={18} />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{data.fleetAnalytics.totalVehicles}</p>
              <div className="mt-1 text-[11px] text-slate-500">
                {data.fleetAnalytics.activeVehicles} active · {data.fleetAnalytics.idleVehicles} idle
              </div>
            </Card>

            <Card className="border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between text-emerald-700">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Fresh GPS Telemetry</span>
                <Radio size={18} />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{data.fleetAnalytics.gpsFreshness.fresh}</p>
              <div className="mt-1 text-[11px] text-slate-500">
                Updated within last 2 minutes
              </div>
            </Card>

            <Card className="border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between text-amber-700">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Aging / Stale Telemetry</span>
                <Clock size={18} />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {data.fleetAnalytics.gpsFreshness.aging + data.fleetAnalytics.gpsFreshness.stale}
              </p>
              <div className="mt-1 text-[11px] text-slate-500">
                {data.fleetAnalytics.gpsFreshness.aging} aging (2-10m) · {data.fleetAnalytics.gpsFreshness.stale} stale (&gt;10m)
              </div>
            </Card>

            <Card className="border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between text-violet-700">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Fleet Average Speed</span>
                <Activity size={18} />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{data.fleetAnalytics.averageSpeedKmH} km/h</p>
              <div className="mt-1 text-[11px] text-slate-500">
                {data.fleetAnalytics.vehiclesOnAlternateRoutes} vehicles on alternate routes
              </div>
            </Card>
          </div>

          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="border-b border-slate-100 px-5 py-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-slate-900">
                  Fleet Telemetry & Corridor Assignment Intelligence
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  GPS source provenance: <span className="font-semibold text-orange-700">{data.fleetAnalytics.gpsProvenance}</span>
                </p>
              </div>
              <Badge className="bg-orange-100 text-orange-800 border-0 text-[10px]">
                {data.fleetAnalytics.gpsProvenance}
              </Badge>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-bold uppercase text-slate-400 bg-slate-50/70">
                    <th className="px-5 py-3">Vehicle ID</th>
                    <th className="px-3 py-3">Corridor Assignment</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Speed</th>
                    <th className="px-3 py-3">Risk Assessment</th>
                    <th className="px-5 py-3 text-right">GPS Freshness</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.fleetAnalytics.vehicles.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3 font-bold font-mono text-slate-900">{v.id}</td>
                      <td className="px-3 py-3 text-slate-600">{v.currentCorridor ?? "Unknown Corridor"}</td>
                      <td className="px-3 py-3 capitalize text-slate-700">{v.status.replace("_", " ")}</td>
                      <td className="px-3 py-3 font-mono">{v.speed} km/h</td>
                      <td className="px-3 py-3">
                        <Badge
                          variant="outline"
                          className={
                            v.risk === "HIGH"
                              ? "border-red-300 text-red-700 bg-red-50 text-[10px]"
                              : "border-emerald-300 text-emerald-700 bg-emerald-50 text-[10px]"
                          }
                        >
                          {v.risk}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right font-mono">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            v.gpsFreshness === "FRESH"
                              ? "bg-emerald-100 text-emerald-800"
                              : v.gpsFreshness === "AGING"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {v.gpsFreshness}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 5: EMERGENCY RESPONSE */}
      {selectedTab === "emergency" && data && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between text-red-700">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total In-App Broadcasts</span>
                <ShieldAlert size={18} />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{data.emergencyAnalytics.totalAlerts}</p>
              <div className="mt-1 text-[11px] text-slate-500">
                {data.emergencyAnalytics.activeAlerts} Active · {data.emergencyAnalytics.acknowledgedAlerts} Acknowledged
              </div>
            </Card>

            <Card className="border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between text-orange-700">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Emergency Corridors</span>
                <Route size={18} />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{data.emergencyAnalytics.emergencyCorridorsCount}</p>
              <div className="mt-1 text-[11px] text-slate-500">
                Full blockages requiring emergency detour
              </div>
            </Card>

            <Card className="border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between text-red-700">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Critical Cargo at Risk</span>
                <PackageCheck size={18} />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{data.emergencyAnalytics.affectedCriticalShipmentsCount}</p>
              <div className="mt-1 text-[11px] text-slate-500">
                Directly impacted by road hazards
              </div>
            </Card>

            <Card className="border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between text-sky-700">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Affected Convoys</span>
                <Truck size={18} />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{data.emergencyAnalytics.affectedVehiclesCount}</p>
              <div className="mt-1 text-[11px] text-slate-500">
                Convoys in hazard catchment areas
              </div>
            </Card>
          </div>

          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="border-b border-slate-100 px-5 py-4">
              <CardTitle className="text-sm font-bold text-slate-900">Emergency Alert Lifecycle & Severity</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">Distribution of emergency actions dispatched across roles</p>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="p-3 rounded-lg bg-red-50 border border-red-100">
                  <span className="text-[10px] font-bold uppercase text-red-700">Critical Alerts</span>
                  <p className="text-2xl font-bold text-red-950 mt-1">{data.emergencyAnalytics.bySeverity.CRITICAL}</p>
                  <span className="text-[10px] text-red-700">Immediate action required</span>
                </div>
                <div className="p-3 rounded-lg bg-orange-50 border border-orange-100">
                  <span className="text-[10px] font-bold uppercase text-orange-700">High Alerts</span>
                  <p className="text-2xl font-bold text-orange-950 mt-1">{data.emergencyAnalytics.bySeverity.HIGH}</p>
                  <span className="text-[10px] text-orange-700">Cautionary reroute suggested</span>
                </div>
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
                  <span className="text-[10px] font-bold uppercase text-amber-700">Advisory Alerts</span>
                  <p className="text-2xl font-bold text-amber-950 mt-1">{data.emergencyAnalytics.bySeverity.ADVISORY}</p>
                  <span className="text-[10px] text-amber-700">Weather / clearance notices</span>
                </div>
                <div className="p-3 rounded-lg bg-sky-50 border border-sky-100">
                  <span className="text-[10px] font-bold uppercase text-sky-700">Info Alerts</span>
                  <p className="text-2xl font-bold text-sky-950 mt-1">{data.emergencyAnalytics.bySeverity.INFO}</p>
                  <span className="text-[10px] text-sky-700">Operational updates</span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
                <p className="font-semibold text-slate-800">Human-in-the-Loop Protocol Enforced:</p>
                <p className="mt-1 text-slate-600 leading-relaxed text-[11px]">
                  Emergency alternate routes are calculated deterministically via A* graph search bypassing verified obstacles, but vehicles are NEVER autonomously rerouted. Manual driver or operator acknowledgement is strictly audited.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 6: FIELD OFFICER & VERIFICATION THROUGHPUT */}
      {selectedTab === "field" && data && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between text-sky-700">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Field Reports</span>
                <FileWarning size={18} />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{data.fieldOfficerAnalytics.totalReportsSubmitted}</p>
              <div className="mt-1 text-[11px] text-slate-500">
                Ground truth reports submitted from app
              </div>
            </Card>

            <Card className="border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between text-emerald-700">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Verified Ground Truth</span>
                <CheckCheck size={18} />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{data.fieldOfficerAnalytics.verifiedReports}</p>
              <div className="mt-1 text-[11px] text-slate-500">
                {data.fieldOfficerAnalytics.verificationRatePercentage}% verification rate
              </div>
            </Card>

            <Card className="border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between text-amber-700">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pending Field Review</span>
                <Clock size={18} />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {data.fieldOfficerAnalytics.underReviewReports + data.fieldOfficerAnalytics.unverifiedReports}
              </p>
              <div className="mt-1 text-[11px] text-slate-500">
                Awaiting review / site visit
              </div>
            </Card>

            <Card className="border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between text-red-700">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Confirmed Blockages</span>
                <ShieldAlert size={18} />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{data.fieldOfficerAnalytics.blockageReportsCount}</p>
              <div className="mt-1 text-[11px] text-slate-500">
                Physical obstacles preventing transit
              </div>
            </Card>
          </div>

          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="border-b border-slate-100 px-5 py-4">
              <CardTitle className="text-sm font-bold text-slate-900">Recent Field Submissions</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">Reports captured via low-connectivity field workflow</p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {data.fieldOfficerAnalytics.recentSubmissions.map((s) => (
                  <div key={s.id} className="p-4 hover:bg-slate-50/60 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-500">{s.id}</span>
                        <strong className="text-slate-900">{s.type}</strong>
                        <Badge
                          variant="outline"
                          className={
                            s.severity === "CRITICAL"
                              ? "border-red-300 text-red-700 text-[10px]"
                              : "border-slate-300 text-slate-600 text-[10px]"
                          }
                        >
                          {s.severity}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Accessibility: <strong className="text-slate-700 uppercase">{s.roadAccessibility}</strong> · Occurred: {new Date(s.occurredAt).toLocaleString()}
                      </p>
                    </div>
                    <Badge
                      className={
                        s.status === "VERIFIED"
                          ? "bg-emerald-600 text-white text-[10px]"
                          : s.status === "REJECTED"
                          ? "bg-slate-200 text-slate-700 text-[10px]"
                          : "bg-amber-500 text-white text-[10px]"
                      }
                    >
                      {s.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 7: AUDIT LEDGER */}
      {selectedTab === "audit" && (
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader className="border-b border-slate-100 px-5 py-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900">Tamper-Evident Audit Ledger</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Every operator action, safety override, and field sync is immutably logged with timestamps
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] text-slate-500">
              {auditEvents.length} Recorded Events
            </Badge>
          </CardHeader>
          <CardContent className="p-0 overflow-y-auto max-h-[500px]">
            {auditEvents.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-400">No audit events recorded yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {auditEvents.map((evt) => (
                  <div key={evt.id} className="p-3.5 hover:bg-slate-50 transition text-xs">
                    <div className="flex items-center justify-between">
                      <strong className="font-semibold text-slate-900 capitalize">
                        {evt.action.replace(".", " ")}
                      </strong>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(evt.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      Entity: <span className="font-mono text-slate-700">{evt.entityType}:{evt.entityId ?? "N/A"}</span>
                    </div>
                    {evt.details && (
                      <div className="mt-1 text-[10px] text-slate-500 font-mono truncate bg-slate-50 p-1.5 rounded">
                        {evt.details}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
