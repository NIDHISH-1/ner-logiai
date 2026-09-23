import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Camera, CheckCircle2, FilePlus2, MapPin, UploadCloud, X } from "lucide-react";
import { fileToDataUrl, newOfflineIncidentId, readOfflineQueue, writeOfflineQueue } from "@/lib/offlineIncidentQueue";

const incidentTypes = ["Landslide", "Flood", "Road Damage", "Bridge Damage", "Traffic", "Fallen Tree", "Road Blockage", "Other"] as const;
const severityOptions = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const accessibilityOptions = ["accessible", "restricted", "blocked", "unknown"] as const;
const fieldClass = "mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

function nowLocalInput() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

async function uploadPhoto(file: File) {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) throw new Error("Photo must be JPEG, PNG, or WebP.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Photo must be smaller than 5 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  const response = await fetch("/api/uploads/incident-photo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.name, mimeType: file.type, sizeBytes: file.size, dataBase64: btoa(binary) }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? "Photo upload failed. No report was submitted.");
  return payload.url as string;
}

export function IncidentReportForm({ offline, onClose }: { offline: boolean; onClose: () => void }) {
  const [type, setType] = useState<(typeof incidentTypes)[number]>("Road Blockage");
  const [severity, setSeverity] = useState<(typeof severityOptions)[number]>("HIGH");
  const [description, setDescription] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [roadAccessibility, setRoadAccessibility] = useState<(typeof accessibilityOptions)[number]>("restricted");
  const [occurredAt, setOccurredAt] = useState(nowLocalInput);
  const [photo, setPhoto] = useState<File | null>(null);
  const [gpsError, setGpsError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const mutation = trpc.demo.createIncident.useMutation({
    onSuccess: async () => {
      await Promise.all([
        trpcUtils.demo.snapshot.invalidate(),
        trpcUtils.demo.incidents.invalidate(),
        trpcUtils.operations.snapshot.invalidate(),
        trpcUtils.operations.corridors.invalidate(),
        trpcUtils.operations.route.invalidate(),
      ]);
      toast("Incident submitted as UNVERIFIED");
      onClose();
    },
    onError: error => toast.error(error.message)
  });
  const trpcUtils = trpc.useUtils();

  const captureGps = () => {
    setGpsError("");
    if (!navigator.geolocation) { setGpsError("Browser geolocation is unavailable. Enter coordinates manually."); return; }
    navigator.geolocation.getCurrentPosition(position => { setLatitude(position.coords.latitude.toFixed(6)); setLongitude(position.coords.longitude.toFixed(6)); }, error => setGpsError(`GPS unavailable (${error.message}). Enter coordinates manually.`), { enableHighAccuracy: true, timeout: 8000 });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPhotoError("");
    if (!description.trim()) { toast.error("Description is required."); return; }
    const lat = Number(latitude); const lon = Number(longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) { toast.error("Enter valid latitude and longitude."); return; }
    try {
      let photoUrl: string | undefined;
      if (photo && !offline) photoUrl = await uploadPhoto(photo);
      if (offline) {
        const photoDataUrl = photo ? await fileToDataUrl(photo) : undefined;
        const queued = readOfflineQueue();
        queued.push({ id: newOfflineIncidentId(), type, severity, description, latitude: lat, longitude: lon, roadAccessibility, occurredAt: new Date(occurredAt).toISOString(), photoName: photo?.name ?? null, photoDataUrl, queuedAt: new Date().toISOString(), status: "PENDING", attempts: 0 });
        try {
          writeOfflineQueue(queued);
        } catch {
          throw new Error("Report could not be saved locally. Storage may be full; remove an old queued report and retry.");
        }
        toast.success("Saved locally as PENDING sync");
        onClose();
        return;
      }
      await mutation.mutateAsync({ type, severity, description, latitude: lat, longitude: lon, roadAccessibility, occurredAt: new Date(occurredAt), photoUrl });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to submit incident.";
      setPhotoError(message);
      toast.error(message);
    }
  };

  return <CardShell><form onSubmit={submit} className="space-y-4"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-600">Field report</p><h3 className="mt-1 text-lg font-semibold">Report an incident</h3><p className="mt-1 text-xs text-slate-500">New reports enter the workflow as UNVERIFIED.</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close incident form"><X size={17} /></button></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-600">Incident type<select className={fieldClass} value={type} onChange={event => setType(event.target.value as typeof type)}>{incidentTypes.map(option => <option key={option}>{option}</option>)}</select></label><label className="text-xs font-semibold text-slate-600">Severity<select className={fieldClass} value={severity} onChange={event => setSeverity(event.target.value as typeof severity)}>{severityOptions.map(option => <option key={option}>{option}</option>)}</select></label></div><label className="block text-xs font-semibold text-slate-600">Description<textarea required minLength={3} maxLength={4000} className="mt-1 min-h-20 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder="Describe the road, bridge, weather, or access condition…" value={description} onChange={event => setDescription(event.target.value)} /></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-600">Road accessibility<select className={fieldClass} value={roadAccessibility} onChange={event => setRoadAccessibility(event.target.value as typeof roadAccessibility)}>{accessibilityOptions.map(option => <option key={option} value={option}>{option}</option>)}</select></label><label className="text-xs font-semibold text-slate-600">Timestamp<input required type="datetime-local" className={fieldClass} value={occurredAt} onChange={event => setOccurredAt(event.target.value)} /></label></div><div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-slate-700">GPS location</p><p className="mt-1 text-[11px] text-slate-500">{latitude && longitude ? `${latitude}, ${longitude}` : "Not captured yet"}</p></div><Button type="button" onClick={captureGps} variant="outline" className="gap-2 border-emerald-200 bg-white text-xs text-emerald-700"><MapPin size={14} /> Use current location</Button></div>{gpsError && <p className="mt-2 text-[11px] font-medium text-red-600">{gpsError}</p>}<div className="mt-3 grid grid-cols-2 gap-2"><input aria-label="Latitude" inputMode="decimal" placeholder="Latitude" className={fieldClass} value={latitude} onChange={event => setLatitude(event.target.value)} /><input aria-label="Longitude" inputMode="decimal" placeholder="Longitude" className={fieldClass} value={longitude} onChange={event => setLongitude(event.target.value)} /></div></div><label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 p-3 hover:border-emerald-400"><Camera size={18} className="text-slate-500" /><span className="min-w-0 flex-1"><strong className="block text-xs text-slate-700">Photo evidence</strong><small className="block truncate text-[11px] text-slate-500">{photo ? `${photo.name} · ${(photo.size / 1024 / 1024).toFixed(1)} MB` : "JPEG, PNG or WebP · max 5 MB"}</small></span><input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={event => { const selected = event.target.files?.[0] ?? null; setPhotoError(""); if (selected && (!(["image/jpeg", "image/png", "image/webp"].includes(selected.type)) || selected.size > 5 * 1024 * 1024)) { setPhoto(null); setPhotoError("Photo must be JPEG, PNG or WebP and smaller than 5 MB."); return; } setPhoto(selected); }} /></label>{photoError && <p className="text-xs font-medium text-red-600">{photoError}</p>}{offline && <div className="rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-800"><strong>OFFLINE MODE</strong> — report metadata will be stored locally as Pending Sync. Photo upload waits for connection.</div>}<Button disabled={mutation.isPending} type="submit" className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700">{mutation.isPending ? <UploadCloud size={15} className="animate-pulse" /> : <CheckCircle2 size={15} />} {offline ? "Save pending sync" : "Submit incident report"}</Button></form></CardShell>;
}

function CardShell({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border-0 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">{children}</div>;
}
