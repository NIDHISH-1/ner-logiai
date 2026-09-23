import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Radio, AlertTriangle, ShieldAlert, CheckCircle2, Clock, MapPin, Filter, Truck, Package, Check, XCircle } from "lucide-react";
import { toast } from "sonner";
import { BroadcastAlertDialog } from "@/components/BroadcastAlertDialog";

export function AlertsView() {
  const [severityFilter, setSeverityFilter] = useState<"ALL" | "CRITICAL" | "HIGH" | "ADVISORY">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "ACKNOWLEDGED">("ALL");
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  const utils = trpc.useUtils();
  const alertsQuery = trpc.operations.alerts.useQuery();
  const alerts = alertsQuery.data ?? [];

  const ackMutation = trpc.operations.acknowledgeAlert.useMutation({
    onSuccess: (data) => {
      toast.success(`Alert ${data.alert?.id} acknowledged.`);
      utils.operations.alerts.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to acknowledge alert.");
    },
  });

  const resolveMutation = trpc.operations.resolveAlert.useMutation({
    onSuccess: (data) => {
      toast.success(`Alert ${data.alert?.id} resolved.`);
      utils.operations.alerts.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to resolve alert.");
    },
  });

  const filtered = alerts.filter((a) => {
    if (severityFilter !== "ALL" && a.severity !== severityFilter) return false;
    if (statusFilter !== "ALL" && (a.status ?? "ACTIVE") !== statusFilter) return false;
    return true;
  });

  const handleAcknowledge = (id: string) => {
    ackMutation.mutate({ alertId: id });
  };

  const handleResolve = (id: string) => {
    resolveMutation.mutate({ alertId: id, resolutionNotes: "Resolved by operations commander." });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Badge className="border-0 bg-red-100 text-red-700 font-bold">OPERATIONAL ALERTS</Badge>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">IN-APP ALERT SYSTEM</span>
            <span className="text-xs text-slate-500">Targeted logistics & emergency alerts</span>
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Active Incident & Road Alerts</h2>
          <p className="mt-1 text-xs text-slate-500">
            Automated propagation connecting verified incidents, blocked corridors, and affected convoys.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setBroadcastOpen(true)}
            className="gap-2 bg-red-600 hover:bg-red-700 text-white text-xs"
          >
            <Radio size={14} /> Issue Alert Broadcast
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 font-semibold text-slate-500 mr-1">
            <Filter size={13} /> Severity:
          </span>
          {(["ALL", "CRITICAL", "HIGH", "ADVISORY"] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setSeverityFilter(lvl)}
              className={`rounded-lg px-3 py-1 font-medium transition ${
                severityFilter === lvl
                  ? "bg-[#12313b] text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {lvl} ({lvl === "ALL" ? alerts.length : alerts.filter((a) => a.severity === lvl).length})
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">Status:</span>
          {(["ALL", "ACTIVE", "ACKNOWLEDGED"] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                statusFilter === st
                  ? "bg-slate-800 text-white"
                  : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Alert Feed */}
      <div className="grid gap-4">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
            No active alerts matching the selected filters.
          </div>
        ) : (
          filtered.map((alert) => {
            const isAck = alert.status === "ACKNOWLEDGED";
            const isResolved = alert.status === "RESOLVED";
            return (
              <Card
                key={alert.id}
                className={`border transition shadow-sm ${
                  isResolved
                    ? "bg-slate-50/50 border-slate-200 opacity-60"
                    : isAck
                    ? "bg-slate-50/80 border-slate-300"
                    : alert.severity === "CRITICAL"
                    ? "border-red-300 bg-red-50/25"
                    : alert.severity === "HIGH"
                    ? "border-amber-300 bg-amber-50/25"
                    : "border-slate-200 bg-white"
                }`}
              >
                <CardContent className="p-5">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong className="text-sm font-bold text-slate-900">{alert.title}</strong>
                        <Badge
                          className={
                            alert.severity === "CRITICAL"
                              ? "bg-red-600 text-white border-0 text-[10px]"
                              : alert.severity === "HIGH"
                              ? "bg-amber-500 text-white border-0 text-[10px]"
                              : "bg-sky-600 text-white border-0 text-[10px]"
                          }
                        >
                          {alert.severity}
                        </Badge>
                        {alert.alertType && (
                          <Badge variant="outline" className="border-slate-300 text-[10px] font-mono text-slate-600 bg-slate-100">
                            {alert.alertType}
                          </Badge>
                        )}
                        <span className="text-[11px] font-mono text-slate-400">{alert.id}</span>
                        {isAck ? (
                          <span className="flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            <CheckCircle2 size={11} /> Acknowledged {alert.acknowledgedByName ? `(${alert.acknowledgedByName})` : ""}
                          </span>
                        ) : isResolved ? (
                          <span className="flex items-center gap-1 rounded bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                            <Check size={11} /> Resolved
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 animate-pulse">
                            ACTIVE
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-700 leading-relaxed max-w-3xl">{alert.message}</p>

                      {/* Affected Entities */}
                      {((alert.affectedVehicleIds && alert.affectedVehicleIds.length > 0) ||
                        (alert.affectedShipmentIds && alert.affectedShipmentIds.length > 0)) && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {alert.affectedVehicleIds?.map((vId) => (
                            <span
                              key={vId}
                              className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 border border-blue-200"
                            >
                              <Truck size={10} /> {vId}
                            </span>
                          ))}
                          {alert.affectedShipmentIds?.map((sId) => (
                            <span
                              key={sId}
                              className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 border border-amber-200"
                            >
                              <Package size={10} /> {sId}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 pt-1">
                        <span className="flex items-center gap-1 font-semibold text-slate-700">
                          <MapPin size={12} className="text-slate-400" /> {alert.corridor}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} className="text-slate-400" />
                          {new Date(alert.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {alert.targetRoles && alert.targetRoles.length > 0 && (
                          <span className="text-slate-400">
                            Target: {alert.targetRoles.join(", ")}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2 pt-1">
                      {!isAck && !isResolved && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAcknowledge(alert.id)}
                          disabled={ackMutation.isPending}
                          className="h-8 text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                        >
                          <CheckCircle2 size={12} className="mr-1" /> Acknowledge
                        </Button>
                      )}
                      {!isResolved && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleResolve(alert.id)}
                          disabled={resolveMutation.isPending}
                          className="h-8 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                        >
                          Resolve
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <BroadcastAlertDialog open={broadcastOpen} onOpenChange={setBroadcastOpen} />
    </div>
  );
}
