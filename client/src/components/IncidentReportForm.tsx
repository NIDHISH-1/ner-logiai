import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Camera, CheckCircle2, FilePlus2, MapPin, UploadCloud, X, Save, ShieldAlert, Route } from "lucide-react";
import { fileToDataUrl, newOfflineIncidentId, readOfflineQueue, writeOfflineQueue } from "@/lib/offlineIncidentQueue";
import { optimizePhotoForOffline, storeOfflineBlob } from "@/lib/offlineStore";
import { useLanguage } from "@/contexts/LanguageContext";

const incidentTypes = ["Road Blockage", "Landslide", "Bridge Damage", "Flood", "Road Damage", "Traffic", "Fallen Tree", "Other"] as const;
const severityOptions = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
const corridorOptions = [
  "NH-37 (Guwahati - Jorhat - Dibrugarh)",
  "NH-2 (Dimapur - Kohima - Imphal)",
  "NH-6 (Shillong - Silchar)",
  "NH-29 (Dabaka - Dimapur)",
  "NH-102 (Imphal - Moreh)",
  "Local Feeder Road / Remote Bypass",
] as const;
const accessibilityOptions = ["blocked", "restricted", "accessible", "unknown"] as const;
const fieldClass = "mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 font-medium";

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
  const { language, t } = useLanguage();
  const [type, setType] = useState<(typeof incidentTypes)[number]>("Road Blockage");
  const [severity, setSeverity] = useState<(typeof severityOptions)[number]>("CRITICAL");
  const [corridor, setCorridor] = useState<(typeof corridorOptions)[number]>("NH-37 (Guwahati - Jorhat - Dibrugarh)");
  const [description, setDescription] = useState("");
  const [latitude, setLatitude] = useState("26.7509");
  const [longitude, setLongitude] = useState("94.2037");
  const [roadAccessibility, setRoadAccessibility] = useState<(typeof accessibilityOptions)[number]>("blocked");
  const [occurredAt, setOccurredAt] = useState(nowLocalInput);
  const [photo, setPhoto] = useState<File | null>(null);
  const [gpsError, setGpsError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [syncStateLabel, setSyncStateLabel] = useState<"DRAFT" | "PENDING SYNC" | "SYNCING" | "SYNCED">("DRAFT");

  const trpcUtils = trpc.useUtils();
  const mutation = trpc.demo.createIncident.useMutation({
    onSuccess: async () => {
      setSyncStateLabel("SYNCED");
      await Promise.all([
        trpcUtils.demo.snapshot.invalidate(),
        trpcUtils.demo.incidents.invalidate(),
        trpcUtils.operations.snapshot.invalidate(),
        trpcUtils.operations.corridors.invalidate(),
        trpcUtils.operations.route.invalidate(),
      ]);
      toast.success(language === "hi" ? "घटना रिपोर्ट दर्ज की गई (सत्यापन लंबित)" : "Incident submitted as UNVERIFIED");
      onClose();
    },
    onError: error => toast.error(error.message)
  });

  const captureGps = () => {
    setGpsError("");
    if (!navigator.geolocation) { setGpsError("Browser geolocation is unavailable. Enter coordinates manually."); return; }
    navigator.geolocation.getCurrentPosition(position => {
      setLatitude(position.coords.latitude.toFixed(6));
      setLongitude(position.coords.longitude.toFixed(6));
    }, error => setGpsError(`GPS unavailable (${error.message}). Enter coordinates manually.`), { enableHighAccuracy: true, timeout: 8000 });
  };

  const handleSaveDraft = () => {
    const fullDesc = `[${corridor}] ${description || "Field draft report"}`;
    const queued = readOfflineQueue();
    queued.push({
      id: newOfflineIncidentId(),
      type,
      severity,
      description: fullDesc,
      latitude: Number(latitude) || 26.75,
      longitude: Number(longitude) || 94.20,
      roadAccessibility,
      occurredAt: new Date(occurredAt).toISOString(),
      photoName: photo?.name ?? null,
      queuedAt: new Date().toISOString(),
      status: "DRAFT" as any,
      attempts: 0,
    });
    writeOfflineQueue(queued);
    toast.success(language === "hi" ? "ड्राफ्ट के रूप में सहेजा गया" : "Saved locally as DRAFT");
    onClose();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPhotoError("");
    if (!description.trim()) { toast.error(language === "hi" ? "विवरण अनिवार्य है।" : "Description is required."); return; }
    const lat = Number(latitude); const lon = Number(longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
      toast.error("Enter valid latitude and longitude.");
      return;
    }
    const combinedDescription = `[${corridor}] ${description.trim()}`;
    try {
      let photoUrl: string | undefined;
      if (photo && !offline) photoUrl = await uploadPhoto(photo);
      if (offline) {
        setSyncStateLabel("PENDING SYNC");
        let photoDataUrl: string | undefined;
        if (photo) {
          try {
            const optimized = await optimizePhotoForOffline(photo, 1024, 0.7);
            photoDataUrl = optimized.dataUrl;
          } catch {
            photoDataUrl = await fileToDataUrl(photo);
          }
        }
        const queued = readOfflineQueue();
        const id = newOfflineIncidentId();
        const newIncident = {
          id,
          type,
          severity,
          description: combinedDescription,
          latitude: lat,
          longitude: lon,
          roadAccessibility,
          occurredAt: new Date(occurredAt).toISOString(),
          photoName: photo?.name ?? null,
          photoDataUrl,
          queuedAt: new Date().toISOString(),
          status: "PENDING" as const,
          attempts: 0,
        };

        if (photoDataUrl) {
          void storeOfflineBlob(id, photoDataUrl);
        }

        try {
          queued.push(newIncident);
          writeOfflineQueue(queued);
        } catch (storageErr) {
          console.warn("[IncidentReportForm] Storage quota warning, preserving incident without binary payload:", storageErr);
          queued[queued.length - 1] = { ...newIncident, photoDataUrl: undefined };
          try {
            writeOfflineQueue(queued);
            toast.warning("Photo exceeds local quota. Incident text details saved safely.");
          } catch {
            toast.error("Offline storage quota exhausted.");
          }
        }

        toast.success(language === "hi" ? "स्थानीय रूप से सहेजा गया (सिंक लंबित)" : "Saved locally as PENDING sync");
        onClose();
        return;
      }
      setSyncStateLabel("SYNCING");
      await mutation.mutateAsync({
        type,
        severity,
        description: combinedDescription,
        latitude: lat,
        longitude: lon,
        roadAccessibility,
        occurredAt: new Date(occurredAt),
        photoUrl,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to submit incident.";
      setPhotoError(message);
      toast.error(message);
    }
  };

  return (
    <CardShell>
      <form onSubmit={submit} className="space-y-4">
        {/* Header & Statuses */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-emerald-600 text-white border-0 text-[10px] font-mono">
                {language === "hi" ? "फ़ील्ड रिपोर्ट" : "FIELD REPORT"}
              </Badge>
              <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-800 text-[10px] font-bold">
                {t("verificationState")}: UNVERIFIED
              </Badge>
              <Badge variant="outline" className="border-sky-400 bg-sky-50 text-sky-800 text-[10px] font-bold font-mono">
                {t("syncState")}: {offline ? "PENDING SYNC" : syncStateLabel}
              </Badge>
            </div>
            <h3 className="mt-2 text-lg font-bold text-slate-900">
              {language === "hi" ? "घटना दर्ज करें (ग्राउंड रिपोर्ट)" : "Ground Truth Incident Report"}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {language === "hi"
                ? "सभी नई रिपोर्ट 'अपुष्ट' (UNVERIFIED) के रूप में शुरू होती हैं और नियंत्रण केंद्र द्वारा जांची जाती हैं।"
                : "Operational evidence with automatic low-connectivity local persistence."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close">
            <X size={17} />
          </button>
        </div>

        {/* Operational Fields */}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-bold text-slate-700">
            {t("incidentType")}
            <select className={fieldClass} value={type} onChange={event => setType(event.target.value as typeof type)}>
              {incidentTypes.map(option => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-700">
            {t("severity")}
            <select className={fieldClass} value={severity} onChange={event => setSeverity(event.target.value as typeof severity)}>
              {severityOptions.map(option => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-700">
            {t("accessibility")}
            <select className={fieldClass} value={roadAccessibility} onChange={event => setRoadAccessibility(event.target.value as typeof roadAccessibility)}>
              {accessibilityOptions.map(option => <option key={option} value={option}>{option.toUpperCase()}</option>)}
            </select>
          </label>
        </div>

        {/* Corridor Selection */}
        <label className="block text-xs font-bold text-slate-700">
          <span className="flex items-center gap-1.5">
            <Route size={13} className="text-emerald-600" />
            {t("affectedCorridor")}
          </span>
          <select className={fieldClass} value={corridor} onChange={event => setCorridor(event.target.value as typeof corridor)}>
            {corridorOptions.map(opt => <option key={opt}>{opt}</option>)}
          </select>
        </label>

        {/* Description */}
        <label className="block text-xs font-bold text-slate-700">
          {t("description")}
          <textarea
            required
            minLength={3}
            maxLength={4000}
            className="mt-1 min-h-20 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 font-normal"
            placeholder={language === "hi" ? "सड़क, पुल या मौसम की सटीक स्थिति दर्ज करें..." : "Describe the exact road, bridge, landslide, or obstruction condition…"}
            value={description}
            onChange={event => setDescription(event.target.value)}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* GPS Coordinates */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <MapPin size={13} className="text-emerald-600" /> GPS {t("coordinates")}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500 font-mono">
                  {latitude && longitude ? `${latitude}° N, ${longitude}° E` : "Not captured"}
                </p>
              </div>
              <Button type="button" onClick={captureGps} variant="outline" className="gap-1 border-emerald-200 bg-white text-xs text-emerald-700">
                <MapPin size={13} /> {language === "hi" ? "वर्तमान GPS" : "Capture GPS"}
              </Button>
            </div>
            {gpsError && <p className="mt-2 text-[11px] font-medium text-red-600">{gpsError}</p>}
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <input aria-label="Latitude" inputMode="decimal" placeholder="Latitude" className={fieldClass} value={latitude} onChange={event => setLatitude(event.target.value)} />
              <input aria-label="Longitude" inputMode="decimal" placeholder="Longitude" className={fieldClass} value={longitude} onChange={event => setLongitude(event.target.value)} />
            </div>
          </div>

          {/* Timestamp & Photo */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              {language === "hi" ? "घटना का समय" : "Incident Timestamp"}
              <input required type="datetime-local" className={fieldClass} value={occurredAt} onChange={event => setOccurredAt(event.target.value)} />
            </label>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 p-2.5 hover:border-emerald-400 bg-white">
              <Camera size={18} className="text-slate-500" />
              <span className="min-w-0 flex-1">
                <strong className="block text-xs text-slate-700">{language === "hi" ? "फ़ोटो साक्ष्य (वैकल्पिक)" : "Photo Evidence (Optional)"}</strong>
                <small className="block truncate text-[10px] text-slate-500">
                  {photo ? `${photo.name} · ${(photo.size / 1024 / 1024).toFixed(1)} MB` : "JPEG, PNG, WebP · max 5 MB"}
                </small>
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={event => {
                  const selected = event.target.files?.[0] ?? null;
                  setPhotoError("");
                  if (selected && (!["image/jpeg", "image/png", "image/webp"].includes(selected.type) || selected.size > 5 * 1024 * 1024)) {
                    setPhoto(null);
                    setPhotoError("Photo must be JPEG, PNG or WebP and smaller than 5 MB.");
                    return;
                  }
                  setPhoto(selected);
                }}
              />
            </label>
          </div>
        </div>

        {photoError && <p className="text-xs font-medium text-red-600">{photoError}</p>}

        {offline && (
          <div className="rounded-lg bg-orange-50 border border-orange-200 px-3 py-2 text-xs text-orange-800 font-medium">
            <strong>OFFLINE MODE:</strong> Report queued locally as PENDING SYNC. Syncs automatically when network is re-established.
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-1">
          <Button
            type="button"
            onClick={handleSaveDraft}
            variant="outline"
            className="flex-1 gap-2 border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            <Save size={14} /> {language === "hi" ? "ड्राफ्ट सहेजें" : "Save as Draft"}
          </Button>

          <Button
            disabled={mutation.isPending}
            type="submit"
            className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          >
            {mutation.isPending ? <UploadCloud size={15} className="animate-pulse" /> : <CheckCircle2 size={15} />}
            {offline
              ? (language === "hi" ? "स्थानीय रूप से कतारबद्ध करें" : "Queue for Sync")
              : (language === "hi" ? "रिपोर्ट सबमिट करें" : "Submit Field Report")}
          </Button>
        </div>
      </form>
    </CardShell>
  );
}

function CardShell({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border-0 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">{children}</div>;
}
