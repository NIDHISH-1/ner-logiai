import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Radio, AlertTriangle, Send, Loader2 } from "lucide-react";

const corridors = [
  "NH-37 Jorhat / Dibrugarh Corridor",
  "NH-2 Kohima / Imphal Highway",
  "NH-6 Shillong / Silchar Pass",
  "NH-39 Eastern Connector",
  "NH-44 Agartala Connector",
  "NH-53 Silchar to Imphal",
  "All Northeast Arterial Corridors",
];

export function BroadcastAlertDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<"CRITICAL" | "HIGH" | "ADVISORY">("HIGH");
  const [corridor, setCorridor] = useState(corridors[0]);

  const trpcUtils = trpc.useUtils();
  const broadcastMutation = trpc.operations.broadcastAlert.useMutation({
    onSuccess: async (data) => {
      await Promise.all([
        trpcUtils.operations.alerts.invalidate(),
        trpcUtils.operations.snapshot.invalidate(),
        trpcUtils.demo.snapshot.invalidate(),
      ]);
      toast.error(`ALERT DISPATCHED: ${data.title}`, {
        description: `${data.corridor} · ${data.severity}`,
      });
      onOpenChange(false);
      setTitle("");
      setMessage("");
      onSuccess?.();
    },
    onError: (err) => {
      toast.error(`Broadcast failed: ${err.message}`);
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.error("Please enter both alert title and message.");
      return;
    }
    broadcastMutation.mutate({
      title: title.trim(),
      message: message.trim(),
      severity,
      corridor,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-red-600">
            <Radio size={18} className="animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-wider">Emergency Broadcast Network</span>
          </div>
          <DialogTitle className="text-lg font-bold text-slate-900">Broadcast Regional Emergency Alert</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Instantly pushes actionable safety directives to active drivers, field officers, and logistics depots.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <label className="text-xs font-semibold text-slate-700">Alert Title / Headline</label>
            <input
              type="text"
              required
              placeholder="e.g. NH-37 Bridge Impassable — Divert to NH-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700">Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as any)}
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
              >
                <option value="CRITICAL">CRITICAL (Immediate Halt / Evacuate)</option>
                <option value="HIGH">HIGH (Severe Hazard / Reroute)</option>
                <option value="ADVISORY">ADVISORY (Caution / Weather Notice)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Affected Corridor</label>
              <select
                value={corridor}
                onChange={(e) => setCorridor(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
              >
                {corridors.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Detailed Action Directives</label>
            <textarea
              required
              rows={3}
              placeholder="e.g. Flash flooding has submerged the low-water bridge approach. Heavy trucks must halt at Numaligarh staging area. Essential light relief vehicles escorted via secondary bypass."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
            />
          </div>

          <div className="rounded-lg bg-red-50 p-2.5 text-[11px] text-red-700 flex items-start gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5 text-red-600" />
            <span>This broadcast will be timestamped and permanently recorded in the system audit log.</span>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={broadcastMutation.isPending}
              className="gap-1.5 bg-red-600 hover:bg-red-700 text-white"
            >
              {broadcastMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              Transmit Broadcast
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
