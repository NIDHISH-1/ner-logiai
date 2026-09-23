import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { MapPin, Route, ShieldAlert, CheckCircle2 } from "lucide-react";

const CORRIDOR_PRESETS = [
  { name: "NH-37 · Jorhat Bypass Segment", lat: 26.7500, lon: 94.2000 },
  { name: "NH-6 · Shillong to Silchar Highway", lat: 25.5788, lon: 91.8933 },
  { name: "NH-2 · Kohima to Imphal Pass", lat: 25.6747, lon: 94.1086 },
  { name: "NH-10 · Siliguri to Gangtok Artery", lat: 27.0360, lon: 88.4312 },
  { name: "NH-27 · Guwahati East Approach", lat: 26.1445, lon: 91.7362 },
];

export function UpdateRoadStatusDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [selectedCorridor, setSelectedCorridor] = useState(CORRIDOR_PRESETS[0].name);
  const [accessibility, setAccessibility] = useState<"accessible" | "restricted" | "blocked">("restricted");
  const [severity, setSeverity] = useState<"LOW" | "MODERATE" | "HIGH" | "CRITICAL">("HIGH");
  const [description, setDescription] = useState("");
  const [latitude, setLatitude] = useState(String(CORRIDOR_PRESETS[0].lat));
  const [longitude, setLongitude] = useState(String(CORRIDOR_PRESETS[0].lon));
  const [gpsDetecting, setGpsDetecting] = useState(false);

  const trpcUtils = trpc.useUtils();

  const handleCorridorChange = (name: string) => {
    setSelectedCorridor(name);
    const preset = CORRIDOR_PRESETS.find((p) => p.name === name);
    if (preset) {
      setLatitude(String(preset.lat));
      setLongitude(String(preset.lon));
    }
  };

  const handleDetectGps = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your device browser.");
      return;
    }
    setGpsDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        setGpsDetecting(false);
        toast.success("Current GPS coordinates captured!");
      },
      (err) => {
        setGpsDetecting(false);
        toast.error(`GPS error: ${err.message}`);
      },
      { timeout: 8000 }
    );
  };

  const mutation = trpc.operations.updateRoadStatus.useMutation({
    onSuccess: async () => {
      await Promise.all([
        trpcUtils.operations.snapshot.invalidate(),
        trpcUtils.operations.corridors.invalidate(),
        trpcUtils.demo.snapshot.invalidate(),
        trpcUtils.demo.incidents.invalidate(),
      ]);
      toast.success(`Road status updated to ${accessibility.toUpperCase()}`);
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(`Failed to update road status: ${err.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error("Please provide observational details regarding road condition.");
      return;
    }
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lon)) {
      toast.error("Please enter valid latitude and longitude coordinates.");
      return;
    }

    mutation.mutate({
      corridor: selectedCorridor,
      roadAccessibility: accessibility,
      severity,
      description: description.trim(),
      latitude: lat,
      longitude: lon,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge className="border-0 bg-emerald-100 text-emerald-800">GROUND TRUTH REPORT</Badge>
            <Badge variant="outline" className="text-[11px] border-slate-200 text-slate-600">
              FIELD OFFICER
            </Badge>
          </div>
          <DialogTitle className="text-xl font-bold text-slate-900 mt-2 flex items-center gap-2">
            <Route className="text-emerald-600" size={20} />
            Update Corridor Road Status
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Publish official ground observation to update accessibility across regional dispatch and routing engines.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-3">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Select Regional Corridor / Segment
            </label>
            <select
              value={selectedCorridor}
              onChange={(e) => handleCorridorChange(e.target.value)}
              className="w-full text-xs h-9 px-3 border border-slate-200 rounded-lg bg-white font-medium text-slate-800"
            >
              {CORRIDOR_PRESETS.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Road Accessibility Assessment
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: "accessible", label: "Accessible", color: "border-emerald-300 bg-emerald-50 text-emerald-800" },
                { val: "restricted", label: "Restricted", color: "border-amber-300 bg-amber-50 text-amber-800" },
                { val: "blocked", label: "Blocked", color: "border-red-300 bg-red-50 text-red-800" },
              ].map((item) => (
                <button
                  type="button"
                  key={item.val}
                  onClick={() => setAccessibility(item.val as any)}
                  className={`p-2.5 rounded-lg border text-xs font-semibold text-center transition-all ${
                    accessibility === item.val
                      ? `${item.color} ring-2 ring-emerald-500 shadow-sm font-bold`
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Risk / Severity
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as any)}
                className="w-full text-xs h-9 px-3 border border-slate-200 rounded-lg bg-white text-slate-800"
              >
                <option value="LOW">Low Hazard</option>
                <option value="MODERATE">Moderate Caution</option>
                <option value="HIGH">High Severity</option>
                <option value="CRITICAL">Critical Closure</option>
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  GPS Position
                </label>
                <button
                  type="button"
                  onClick={handleDetectGps}
                  disabled={gpsDetecting}
                  className="text-[10px] text-emerald-600 hover:underline flex items-center gap-1 font-semibold"
                >
                  <MapPin size={11} /> {gpsDetecting ? "Locating..." : "Use Device GPS"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="text"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="Lat"
                  className="text-xs h-9 px-2 border border-slate-200 rounded-lg"
                />
                <input
                  type="text"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="Lon"
                  className="text-xs h-9 px-2 border border-slate-200 rounded-lg"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Field Observations & Physical Evidence
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Single-lane clearance due to boulder debris. Escorted heavy vehicles only."
              className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs border-slate-200"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={mutation.isPending}
              className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700 text-xs"
            >
              <CheckCircle2 size={14} />
              {mutation.isPending ? "Broadcasting..." : "Publish Road Status"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
