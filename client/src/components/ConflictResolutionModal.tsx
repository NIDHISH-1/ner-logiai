import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { AlertTriangle, Check, GitFork, ShieldCheck } from "lucide-react";
import { type OfflineIncident, readOfflineQueue, writeOfflineQueue } from "@/lib/offlineIncidentQueue";

interface ConflictResolutionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incident: OfflineIncident | null;
  serverIncident?: any | null;
  onResolved?: () => void;
}

export function ConflictResolutionModal({
  open,
  onOpenChange,
  incident,
  serverIncident,
  onResolved,
}: ConflictResolutionModalProps) {
  const [resolving, setResolving] = useState(false);
  const resolveMutation = trpc.demo.resolveIncidentConflict.useMutation();
  const utils = trpc.useUtils();

  if (!incident) return null;

  const handleResolution = async (resolution: "KEEP_SERVER" | "FORK_LOCAL") => {
    setResolving(true);
    try {
      const result = await resolveMutation.mutateAsync({
        incidentId: incident.id,
        resolution,
        localPayload: resolution === "FORK_LOCAL" ? {
          type: incident.type,
          severity: incident.severity,
          description: incident.description,
          latitude: incident.latitude,
          longitude: incident.longitude,
          roadAccessibility: incident.roadAccessibility,
          occurredAt: new Date(incident.occurredAt),
          photoUrl: incident.photoUrl,
        } : undefined,
      });

      // Update local offline queue
      const currentQueue = readOfflineQueue();
      if (resolution === "KEEP_SERVER") {
        // Discard local conflict, mark local entry as synced/resolved
        const updated = currentQueue.map((item) =>
          item.id === incident.id
            ? { ...item, status: "SYNCED" as const, lastError: "Resolved: kept server version." }
            : item
        );
        writeOfflineQueue(updated);
        toast.success(`Server version preserved for ${incident.id}.`);
      } else {
        // Forked: remove original conflict, add forked incident if not already created
        const updated = currentQueue.filter((item) => item.id !== incident.id);
        writeOfflineQueue(updated);
        toast.success(`Local report forked as new report: ${result.incident?.id ?? "INC-OFF-FORK"}`);
      }

      await Promise.all([
        utils.demo.incidents.invalidate(),
        utils.demo.snapshot.invalidate(),
        utils.operations.snapshot.invalidate(),
        utils.operations.corridors.invalidate(),
      ]);

      onOpenChange(false);
      onResolved?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to resolve conflict");
    } finally {
      setResolving(false);
    }
  };

  const localDesc = incident.description;
  const serverDesc = serverIncident?.description ?? "Server version has differing content";
  const descDiffers = localDesc !== serverDesc;

  const localSev = incident.severity;
  const serverSev = serverIncident?.severity ?? "UNKNOWN";
  const sevDiffers = localSev !== serverSev;

  const localAccess = incident.roadAccessibility;
  const serverAccess = serverIncident?.roadAccessibility ?? "unknown";
  const accessDiffers = localAccess !== serverAccess;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge className="bg-red-100 text-red-800 border-0 text-[10px] font-bold">
              DATA CONFLICT DETECTED
            </Badge>
            <span className="font-mono text-xs text-slate-500">{incident.id}</span>
          </div>
          <DialogTitle className="text-lg font-bold text-slate-900 mt-2 flex items-center gap-2">
            <AlertTriangle className="text-amber-600 shrink-0" size={20} />
            Resolve Incident Data Discrepancy
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            A version of this incident exists on the central server with differing information. Select how to reconcile the conflicting data.
          </DialogDescription>
        </DialogHeader>

        {/* Side-by-side comparison */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 text-xs">
          {/* Local Version */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-2.5">
            <div className="flex items-center justify-between border-b border-amber-200 pb-2">
              <span className="font-bold text-amber-900 uppercase tracking-wider text-[10px]">
                📱 Your Offline Report
              </span>
              <Badge variant="outline" className="border-amber-300 text-amber-800 text-[10px]">LOCAL</Badge>
            </div>
            <div>
              <p className="text-slate-500 text-[10px] font-semibold">TYPE</p>
              <p className="font-medium text-slate-900">{incident.type}</p>
            </div>
            <div>
              <p className="text-slate-500 text-[10px] font-semibold">SEVERITY</p>
              <p className={`font-semibold ${sevDiffers ? "text-amber-800 font-bold" : "text-slate-900"}`}>
                {localSev}
              </p>
            </div>
            <div>
              <p className="text-slate-500 text-[10px] font-semibold">ROAD ACCESSIBILITY</p>
              <p className={`font-semibold ${accessDiffers ? "text-amber-800 font-bold" : "text-slate-900"}`}>
                {localAccess.toUpperCase()}
              </p>
            </div>
            <div>
              <p className="text-slate-500 text-[10px] font-semibold">DESCRIPTION</p>
              <p className={`mt-0.5 leading-relaxed ${descDiffers ? "text-amber-950 bg-amber-100/60 p-1.5 rounded" : "text-slate-700"}`}>
                {localDesc}
              </p>
            </div>
          </div>

          {/* Server Version */}
          <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 space-y-2.5">
            <div className="flex items-center justify-between border-b border-sky-200 pb-2">
              <span className="font-bold text-sky-900 uppercase tracking-wider text-[10px]">
                ☁️ Central Server Authority
              </span>
              <Badge variant="outline" className="border-sky-300 text-sky-800 text-[10px]">SERVER</Badge>
            </div>
            <div>
              <p className="text-slate-500 text-[10px] font-semibold">TYPE</p>
              <p className="font-medium text-slate-900">{serverIncident?.type ?? incident.type}</p>
            </div>
            <div>
              <p className="text-slate-500 text-[10px] font-semibold">SEVERITY</p>
              <p className={`font-semibold ${sevDiffers ? "text-sky-800 font-bold" : "text-slate-900"}`}>
                {serverSev}
              </p>
            </div>
            <div>
              <p className="text-slate-500 text-[10px] font-semibold">ROAD ACCESSIBILITY</p>
              <p className={`font-semibold ${accessDiffers ? "text-sky-800 font-bold" : "text-slate-900"}`}>
                {String(serverAccess).toUpperCase()}
              </p>
            </div>
            <div>
              <p className="text-slate-500 text-[10px] font-semibold">DESCRIPTION</p>
              <p className={`mt-0.5 leading-relaxed ${descDiffers ? "text-sky-950 bg-sky-100/60 p-1.5 rounded" : "text-slate-700"}`}>
                {serverDesc}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-2 rounded-lg bg-slate-50 p-3 text-[11px] text-slate-600 border border-slate-200">
          <p className="font-medium text-slate-800">Reconciliation Policy:</p>
          <p className="mt-0.5">
            Under strict audit standards, server data cannot be silently overwritten. You may either preserve the server authoritative record or fork your field report into a separate audit-logged record.
          </p>
        </div>

        <DialogFooter className="mt-4 flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={resolving}
            onClick={() => void handleResolution("KEEP_SERVER")}
            className="gap-1.5 text-xs text-slate-700"
          >
            <ShieldCheck size={14} className="text-sky-600" />
            Keep Server Version
          </Button>
          <Button
            type="button"
            disabled={resolving}
            onClick={() => void handleResolution("FORK_LOCAL")}
            className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <GitFork size={14} />
            Fork Local Version As New Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
