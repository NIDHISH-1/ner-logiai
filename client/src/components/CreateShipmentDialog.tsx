import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Boxes, Truck, MapPin, AlertCircle, Loader2 } from "lucide-react";

const origins = ["Guwahati", "Dimapur", "Siliguri", "Agartala", "Shillong", "Dibrugarh", "Imphal", "Aizawl", "Kohima", "Itanagar"];
const destinations = ["Imphal", "Kohima", "Aizawl", "Itanagar", "Jowai", "Pasighat", "Ukhrul", "Tura", "Dharmanagar", "Mokokchung"];
const priorityOptions = [
  { value: "CRITICAL", label: "CRITICAL (Medical / Oxygen / Rescue)", badge: "bg-red-50 text-red-700 border-red-200" },
  { value: "HIGH", label: "HIGH (Food / Water / Generator Fuel)", badge: "bg-orange-50 text-orange-700 border-orange-200" },
  { value: "NORMAL", label: "NORMAL (Shelter / Tarps / Supplies)", badge: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "LOW", label: "LOW (General Equipment)", badge: "bg-slate-50 text-slate-700 border-slate-200" },
] as const;

export function CreateShipmentDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const [name, setName] = useState("");
  const [priority, setPriority] = useState<"CRITICAL" | "HIGH" | "NORMAL" | "LOW">("HIGH");
  const [origin, setOrigin] = useState("Guwahati");
  const [destination, setDestination] = useState("Imphal");
  const [etaMinutes, setEtaMinutes] = useState(240);
  const [vehicleId, setVehicleId] = useState("TRK-104");

  const trpcUtils = trpc.useUtils();
  const createMutation = trpc.operations.createShipment.useMutation({
    onSuccess: async (data) => {
      await Promise.all([
        trpcUtils.operations.snapshot.invalidate(),
        trpcUtils.demo.snapshot.invalidate(),
      ]);
      toast.success(`Shipment created: ${data.name} (${data.id})`);
      onOpenChange(false);
      setName("");
      onSuccess?.();
    },
    onError: (err) => {
      toast.error(`Could not create shipment: ${err.message}`);
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a shipment name or cargo description");
      return;
    }
    createMutation.mutate({
      name: name.trim(),
      priority,
      origin,
      destination,
      etaMinutes: Number(etaMinutes) || 180,
      vehicleId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-violet-600">
            <Boxes size={18} />
            <span className="text-[11px] font-bold uppercase tracking-wider">Logistics Dispatch</span>
          </div>
          <DialogTitle className="text-lg font-bold text-slate-900">Create Priority Shipment</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Provision emergency cargo with real-time risk tracking across Northeast corridors.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <label className="text-xs font-semibold text-slate-700">Cargo / Shipment Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Essential Medical Supplies - Batch 4"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Priority Level</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
            >
              {priorityOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700">Origin Depot</label>
              <select
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
              >
                {origins.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Destination</label>
              <select
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
              >
                {destinations.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700">Assigned Vehicle</label>
              <select
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
              >
                <option value="TRK-104">TRK-104 (Heavy Duty 4x4)</option>
                <option value="TRK-219">TRK-219 (All-Terrain Medium)</option>
                <option value="TRK-088">TRK-088 (Refrigerated Cold Chain)</option>
                <option value="TRK-302">TRK-302 (Flatbed Supplies)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Expected ETA (mins)</label>
              <input
                type="number"
                min={30}
                max={2000}
                value={etaMinutes}
                onChange={(e) => setEtaMinutes(Number(e.target.value))}
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
              />
            </div>
          </div>

          <DialogFooter className="pt-3">
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
              disabled={createMutation.isPending}
              className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
            >
              {createMutation.isPending && <Loader2 size={13} className="animate-spin" />}
              Dispatch Shipment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
