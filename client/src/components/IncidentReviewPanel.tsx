import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Check, FileWarning, X } from "lucide-react";
import { OFFLINE_QUEUE_EVENT, readOfflineQueue } from "@/lib/offlineIncidentQueue";

function tone(status: string) {
  if (status === "VERIFIED") return "bg-emerald-50 text-emerald-700";
  if (status === "REJECTED") return "bg-slate-100 text-slate-500";
  return "bg-orange-50 text-orange-700";
}

export function IncidentReviewPanel() {
  const incidentsQuery = trpc.demo.incidents.useQuery();
  const [conflictIds, setConflictIds] = useState<Set<string>>(() => new Set(readOfflineQueue().filter(item => item.status === "CONFLICT").map(item => item.id)));
  const utils = trpc.useUtils();
  useEffect(() => {
    const refreshConflicts = () => setConflictIds(new Set(readOfflineQueue().filter(item => item.status === "CONFLICT").map(item => item.id)));
    window.addEventListener(OFFLINE_QUEUE_EVENT, refreshConflicts);
    return () => window.removeEventListener(OFFLINE_QUEUE_EVENT, refreshConflicts);
  }, []);
  const review = trpc.demo.reviewIncident.useMutation({
    onSuccess: async (_data, variables) => { await Promise.all([utils.demo.incidents.invalidate(), utils.demo.snapshot.invalidate()]); toast(`Incident marked ${variables.status.replace("_", " ")}`); },
    onError: error => toast.error(`Could not update incident: ${error.message}`),
  });
  const incidents = (incidentsQuery.data ?? []).slice(0, 6);
  return <CardShell><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-orange-600">Admin workflow</p><h3 className="mt-1 flex items-center gap-2 text-lg font-semibold"><FileWarning size={18} /> Incident review queue</h3><p className="mt-1 text-xs text-slate-500">Persisted field reports · every decision creates an audit event</p></div><Badge variant="outline" className="border-slate-200 text-[10px]">{incidents.length} visible</Badge></div><div className="mt-4 divide-y divide-slate-100">{incidents.length ? incidents.map(incident => <div key={incident.id} className="flex flex-col gap-3 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex items-center gap-2"><strong className="text-sm text-slate-800">{incident.id}</strong><span className="truncate text-xs text-slate-600">{incident.type}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tone(incident.status)}`}>{incident.status.replace("_", " ")}</span>{conflictIds.has(incident.id) && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">CONFLICT</span>}</div><p className="mt-1 truncate text-xs text-slate-500">{incident.severity} · {incident.latitude}, {incident.longitude} · {incident.reporterRole}</p>{conflictIds.has(incident.id) && <p className="mt-1 text-[11px] font-medium text-red-700">Server data preserved; review the remote record before deciding.</p>}</div>{incident.status !== "VERIFIED" && incident.status !== "REJECTED" && <div className="flex shrink-0 gap-2"><Button disabled={review.isPending} onClick={() => review.mutate({ id: incident.id, status: "VERIFIED" })} size="sm" className="h-8 gap-1 bg-emerald-600 px-2 text-[11px] hover:bg-emerald-700"><Check size={13} /> Verify</Button><Button disabled={review.isPending} onClick={() => review.mutate({ id: incident.id, status: "REJECTED" })} variant="outline" size="sm" className="h-8 gap-1 border-red-200 px-2 text-[11px] text-red-600 hover:bg-red-50"><X size={13} /> Reject</Button></div>}</div>) : <p className="py-6 text-center text-sm text-slate-500">No persisted incidents yet. Seed demo data or submit a field report.</p>}</div></CardShell>;
}

function CardShell({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border-0 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">{children}</div>;
}
