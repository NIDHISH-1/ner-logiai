export type OfflineSyncState = "PENDING" | "SYNCING" | "SYNCED" | "FAILED" | "CONFLICT";

export type OfflineIncident = {
  id: string;
  type: "Landslide" | "Flood" | "Road Damage" | "Bridge Damage" | "Traffic" | "Fallen Tree" | "Road Blockage" | "Other";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description: string;
  latitude: number;
  longitude: number;
  roadAccessibility: "accessible" | "restricted" | "blocked" | "unknown";
  occurredAt: string;
  photoName: string | null;
  photoDataUrl?: string;
  photoUrl?: string;
  queuedAt: string;
  status: OfflineSyncState;
  attempts: number;
  lastError?: string;
  conflictReason?: string;
  syncedAt?: string;
};

export const OFFLINE_QUEUE_KEY = "ner-logiai.pendingIncidents";
export const OFFLINE_QUEUE_EVENT = "ner-logiai.offline-queue-changed";

export function readOfflineQueue(): OfflineIncident[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function writeOfflineQueue(items: OfflineIncident[]) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_EVENT));
}

export function pendingOfflineCount(items = readOfflineQueue()) {
  return items.filter(item => item.status === "PENDING" || item.status === "FAILED" || item.status === "SYNCING").length;
}

export function newOfflineIncidentId() {
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replace(/-/g, "").slice(0, 14) : `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  return `INC-OFF-${suffix.toUpperCase()}`.slice(0, 32);
}

export async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read photo locally."));
    reader.onerror = () => reject(new Error("Could not read photo locally."));
    reader.readAsDataURL(file);
  });
}

export function dataUrlToUpload(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Queued photo data is invalid.");
  return { mimeType: match[1], dataBase64: match[2] };
}
