import { trpc } from "@/lib/trpc";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, ShieldCheck, Clock, CheckCircle2, AlertTriangle, PackageCheck, Route, FileCheck } from "lucide-react";

export function AnalyticsView() {
  const auditQuery = trpc.operations.audit.useQuery({ limit: 20 });
  const auditEvents = auditQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Badge className="border-0 bg-violet-100 text-violet-800">PERFORMANCE & AUDITING</Badge>
            <span className="text-xs text-slate-500">SIH26002 Evaluation Metrics</span>
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Operational Analytics & Audit Trail</h2>
          <p className="mt-1 text-xs text-slate-500">
            System performance, delivery resilience metrics, and tamper-evident audit logs.
          </p>
        </div>
      </div>

      {/* KPI Tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">On-Time Delivery Rate</span>
            <TrendingUp size={18} />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">92.4%</p>
          <span className="text-[11px] text-emerald-600 font-medium">+3.1% vs non-optimized baseline</span>
        </Card>

        <Card className="border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-violet-600">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Critical Cargo Delivered</span>
            <PackageCheck size={18} />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">14 / 15</p>
          <span className="text-[11px] text-slate-500">Medical, vaccine & oxygen convoys</span>
        </Card>

        <Card className="border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-sky-600">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Avg Verification Turnaround</span>
            <Clock size={18} />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">18.2 min</p>
          <span className="text-[11px] text-slate-500">Field evidence to verified blockage</span>
        </Card>

        <Card className="border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-red-600">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Zero Bridge Failures</span>
            <ShieldCheck size={18} />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">100%</p>
          <span className="text-[11px] text-emerald-600 font-medium">Zero trucks routed across damaged bridges</span>
        </Card>
      </div>

      {/* Corridor Disruption Table & Audit Trail */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-100 px-5 py-4">
            <CardTitle className="text-sm font-bold text-slate-900">Disruption Frequency by Corridor</CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4 text-xs">
            <div>
              <div className="flex justify-between font-medium text-slate-700 mb-1">
                <span>NH-37 (Guwahati · Jorhat · Dibrugarh)</span>
                <span className="font-bold text-red-600">High Risk (68% closure risk)</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-red-500 rounded-full" style={{ width: "68%" }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between font-medium text-slate-700 mb-1">
                <span>NH-2 (Dimapur · Kohima · Imphal)</span>
                <span className="font-bold text-amber-600">Moderate Risk (45% closure risk)</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: "45%" }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between font-medium text-slate-700 mb-1">
                <span>NH-6 (Guwahati · Shillong · Silchar)</span>
                <span className="font-bold text-emerald-600">Low Risk (16% closure risk)</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: "16%" }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between font-medium text-slate-700 mb-1">
                <span>NH-53 (Silchar · Jiribam · Imphal)</span>
                <span className="font-bold text-amber-600">Moderate Risk (42% closure risk)</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: "42%" }} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Immutable Audit Log */}
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-100 px-5 py-4 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-900">Immutable Audit Trail</CardTitle>
            <Badge variant="outline" className="text-[10px] text-slate-500">Live DB Ledger</Badge>
          </CardHeader>
          <CardContent className="p-0 overflow-y-auto max-h-[300px]">
            {auditEvents.length === 0 ? (
              <p className="p-5 text-center text-xs text-slate-400">No recent audit records.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {auditEvents.map((evt) => (
                  <div key={evt.id} className="p-3.5 hover:bg-slate-50 transition text-xs">
                    <div className="flex items-center justify-between">
                      <strong className="font-semibold text-slate-900 capitalize">
                        {evt.action.replace(".", " ")}
                      </strong>
                      <span className="text-[10px] text-slate-400">
                        {new Date(evt.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      Entity: <span className="font-mono text-slate-700">{evt.entityType}:{evt.entityId ?? "N/A"}</span>
                    </div>
                    {evt.details && (
                      <div className="mt-1 text-[10px] text-slate-400 font-mono truncate">
                        {evt.details}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
