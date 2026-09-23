import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileWarning, Search, Filter, Check, X, MapPin, Camera, Clock, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { IncidentReportForm } from "@/components/IncidentReportForm";

export function IncidentsView() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showReportForm, setShowReportForm] = useState(false);

  const trpcUtils = trpc.useUtils();
  const incidentsQuery = trpc.demo.incidents.useQuery();
  const incidents = incidentsQuery.data ?? [];

  const reviewMutation = trpc.demo.reviewIncident.useMutation({
    onSuccess: async (_data, vars) => {
      await Promise.all([
        trpcUtils.demo.incidents.invalidate(),
        trpcUtils.demo.snapshot.invalidate(),
        trpcUtils.operations.snapshot.invalidate(),
      ]);
      toast.success(`Incident status updated to ${vars.status}`);
    },
    onError: (err) => {
      toast.error(`Update failed: ${err.message}`);
    },
  });

  const filtered = incidents.filter((item) => {
    const matchesStatus = statusFilter === "ALL" || item.status === statusFilter;
    const matchesSearch =
      !search ||
      item.type.toLowerCase().includes(search.toLowerCase()) ||
      item.id.toLowerCase().includes(search.toLowerCase()) ||
      item.description?.toLowerCase().includes(search.toLowerCase()) ||
      item.roadAccessibility?.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return <Badge className="bg-emerald-600 text-white border-0 text-[10px]">VERIFIED</Badge>;
      case "UNDER_REVIEW":
        return <Badge className="bg-amber-500 text-white border-0 text-[10px]">UNDER REVIEW</Badge>;
      case "REJECTED":
        return <Badge className="bg-slate-200 text-slate-700 border-0 text-[10px]">REJECTED</Badge>;
      default:
        return <Badge className="bg-orange-500 text-white border-0 text-[10px]">UNVERIFIED</Badge>;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 border border-red-200">CRITICAL</span>;
      case "HIGH":
        return <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-700 border border-orange-200">HIGH</span>;
      case "MODERATE":
      case "MEDIUM":
        return <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-[10px] font-bold text-yellow-700 border border-yellow-200">MODERATE</span>;
      default:
        return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">LOW</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Badge className="border-0 bg-orange-100 text-orange-700">FIELD GROUND TRUTH</Badge>
            <span className="text-xs text-slate-500">{incidents.length} total recorded</span>
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Incident Registry & Verification</h2>
          <p className="mt-1 text-xs text-slate-500">
            Field officer evidence, road closures, and hazard validation for Northeast corridors.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowReportForm(true)}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
          >
            <Plus size={14} /> Submit Field Incident
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => incidentsQuery.refetch()}
            className="border-slate-200 text-xs"
          >
            <RefreshCw size={13} />
          </Button>
        </div>
      </div>

      {showReportForm && (
        <div className="rounded-2xl bg-white p-5 border border-slate-200 shadow-md">
          <IncidentReportForm offline={false} onClose={() => setShowReportForm(false)} />
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between border-b border-slate-200 pb-3">
        <div className="relative w-full sm:w-80">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by ID, type, description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto text-xs">
          <span className="text-slate-400 text-[11px] font-semibold flex items-center gap-1">
            <Filter size={12} /> Status:
          </span>
          {["ALL", "UNVERIFIED", "UNDER_REVIEW", "VERIFIED", "REJECTED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                statusFilter === st
                  ? "bg-[#12313b] text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {st.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Incidents Table */}
      <Card className="border-0 bg-white shadow-sm overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3">Incident ID & Type</th>
                <th className="px-3 py-3">Severity</th>
                <th className="px-3 py-3">Location & Accessibility</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Reporter</th>
                <th className="px-5 py-3 text-right">Verification Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-5 py-3.5">
                    <div className="font-bold text-slate-900">{item.id}</div>
                    <div className="text-[11px] text-slate-600 mt-0.5">{item.type}</div>
                    {item.description && (
                      <div className="text-[10px] text-slate-400 truncate max-w-[240px] mt-0.5">
                        {item.description}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3.5">
                    {getSeverityBadge(item.severity)}
                  </td>
                  <td className="px-3 py-3.5 text-slate-600">
                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      <MapPin size={11} className="text-slate-400" />
                      {Number(item.latitude).toFixed(4)}°, {Number(item.longitude).toFixed(4)}°
                    </div>
                    <div className="text-[10px] text-slate-500 capitalize mt-0.5">
                      Road: <span className="font-semibold">{item.roadAccessibility ?? "unknown"}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    {getStatusBadge(item.status)}
                  </td>
                  <td className="px-3 py-3.5 text-slate-600 text-[11px]">
                    <div>{item.reporterRole ?? "Field Officer"}</div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <Clock size={10} />
                      {new Date(item.occurredAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {item.status !== "VERIFIED" && item.status !== "REJECTED" ? (
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          disabled={reviewMutation.isPending}
                          onClick={() => reviewMutation.mutate({ id: item.id, status: "VERIFIED" })}
                          className="h-7 px-2 text-[10px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <Check size={11} /> Verify
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={reviewMutation.isPending}
                          onClick={() => reviewMutation.mutate({ id: item.id, status: "REJECTED" })}
                          className="h-7 px-2 text-[10px] gap-1 border-red-200 text-red-600 hover:bg-red-50"
                        >
                          <X size={11} /> Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">Decision Logged</span>
                    )}
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
