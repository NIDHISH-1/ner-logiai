/**
 * NER-LogiAI Phase 6: Unified Offline Action Store & IndexedDB Engine
 * 
 * Provides:
 * 1. Persistent storage for all offline operational actions:
 *    - INCIDENT_REPORT
 *    - ROUTE_ACCEPTANCE
 *    - ALERT_ACKNOWLEDGE
 *    - ROAD_STATUS_UPDATE
 * 2. Pure client-side IndexedDB with transparent localStorage fallback
 * 3. Stable, deterministic action IDs for safe idempotent replay
 * 4. Safe image quota compression & blob storage
 * 5. Event dispatch for reactive UI updates
 */

export type OfflineActionType =
  | "INCIDENT_REPORT"
  | "ROUTE_ACCEPTANCE"
  | "ALERT_ACKNOWLEDGE"
  | "ROAD_STATUS_UPDATE";

export type OfflineActionStatus =
  | "PENDING"
  | "SYNCING"
  | "SYNCED"
  | "FAILED"
  | "CONFLICT";

export interface OfflineAction<T = any> {
  actionId: string;
  actionType: OfflineActionType;
  createdAt: string;
  payload: T;
  status: OfflineActionStatus;
  retryCount: number;
  lastAttemptAt?: string;
  lastError?: string;
  conflictReason?: string;
  syncedAt?: string;
}

export interface RouteAcceptancePayload {
  routeId: string;
  vehicleId: string;
  driverId?: string;
  routeLabel: string;
  distanceKm: number;
  etaMinutes: number;
  humanInTheLoopConfirmed: boolean;
  automaticVehicleRedirect: boolean;
  acceptedAt: string;
}

export interface AlertAcknowledgePayload {
  alertId: string;
  alertTitle?: string;
  acknowledgedBy?: string;
  userRole?: string;
  acknowledgedAt: string;
}

export interface RoadStatusUpdatePayload {
  corridorId: string;
  corridorName?: string;
  accessibility: "accessible" | "restricted" | "blocked";
  reason?: string;
  updatedBy?: string;
  updatedAt: string;
}

export const OFFLINE_ACTIONS_STORE_KEY = "ner-logiai.offlineActions.v1";
export const OFFLINE_ACTIONS_EVENT = "ner-logiai.offline-actions-changed";
export const DB_NAME = "ner-logiai-offline-db";
export const DB_VERSION = 1;

let idbPromise: Promise<IDBDatabase | null> | null = null;

function openOfflineDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }
  if (!idbPromise) {
    idbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains("actions")) {
            db.createObjectStore("actions", { keyPath: "actionId" });
          }
          if (!db.objectStoreNames.contains("blobs")) {
            db.createObjectStore("blobs", { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains("cache")) {
            db.createObjectStore("cache", { keyPath: "key" });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          console.warn("[IndexedDB] Failed to open database; using memory/localStorage fallback.");
          resolve(null);
        };
      } catch (err) {
        console.warn("[IndexedDB] Exception opening database:", err);
        resolve(null);
      }
    });
  }
  return idbPromise;
}

// -----------------------------------------------------------------------------
// Synchronous LocalStorage Backup Layer
// Ensures fast synchronous reads and full compatibility when IndexedDB is unavailable
// -----------------------------------------------------------------------------

function readActionsFromLocalStorage(): OfflineAction[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(OFFLINE_ACTIONS_STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeActionsToLocalStorage(actions: OfflineAction[]) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(OFFLINE_ACTIONS_STORE_KEY, JSON.stringify(actions));
  } catch (err) {
    console.warn("[OfflineStore] LocalStorage write quota warning:", err);
  }
}

// In-memory cache synced with storage
let memoryActions: OfflineAction[] = readActionsFromLocalStorage();

function notifyActionsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OFFLINE_ACTIONS_EVENT));
  }
}

// -----------------------------------------------------------------------------
// Public Action Store API
// -----------------------------------------------------------------------------

export function getAllOfflineActions(): OfflineAction[] {
  if (typeof localStorage !== "undefined") {
    const fromStorage = readActionsFromLocalStorage();
    if (fromStorage.length > 0 || memoryActions.length === 0) {
      memoryActions = fromStorage;
    }
  }
  return [...memoryActions];
}

export function getOfflineActionById(actionId: string): OfflineAction | undefined {
  return getAllOfflineActions().find((a) => a.actionId === actionId);
}

export function getPendingActionsCount(): number {
  return getAllOfflineActions().filter(
    (a) => a.status === "PENDING" || a.status === "SYNCING" || a.status === "FAILED"
  ).length;
}

export function getActionsByStatus(status: OfflineActionStatus): OfflineAction[] {
  return getAllOfflineActions().filter((a) => a.status === status);
}

export function saveOfflineAction(action: OfflineAction): void {
  const current = getAllOfflineActions();
  const existingIdx = current.findIndex((a) => a.actionId === action.actionId);
  if (existingIdx >= 0) {
    current[existingIdx] = action;
  } else {
    current.push(action);
  }
  memoryActions = current;
  writeActionsToLocalStorage(current);

  // Asynchronously write to IndexedDB
  void (async () => {
    const db = await openOfflineDb();
    if (!db) return;
    try {
      const tx = db.transaction("actions", "readwrite");
      tx.objectStore("actions").put(action);
    } catch {}
  })();

  notifyActionsChanged();
}

export function updateActionStatus(
  actionId: string,
  status: OfflineActionStatus,
  options?: {
    lastError?: string;
    conflictReason?: string;
    syncedAt?: string;
    incrementRetry?: boolean;
  }
): OfflineAction | null {
  const current = getAllOfflineActions();
  const item = current.find((a) => a.actionId === actionId);
  if (!item) return null;

  item.status = status;
  item.lastAttemptAt = new Date().toISOString();
  if (options?.lastError !== undefined) item.lastError = options.lastError;
  if (options?.conflictReason !== undefined) item.conflictReason = options.conflictReason;
  if (options?.syncedAt !== undefined) item.syncedAt = options.syncedAt;
  if (options?.incrementRetry) item.retryCount = (item.retryCount || 0) + 1;

  memoryActions = current;
  writeActionsToLocalStorage(current);

  void (async () => {
    const db = await openOfflineDb();
    if (!db) return;
    try {
      const tx = db.transaction("actions", "readwrite");
      tx.objectStore("actions").put(item);
    } catch {}
  })();

  notifyActionsChanged();
  return item;
}

export function updateOfflineActionStatus(
  actionId: string,
  status: OfflineActionStatus,
  options?: {
    lastError?: string;
    conflictReason?: string;
    syncedAt?: string;
  }
): OfflineAction | null {
  return updateActionStatus(actionId, status, options);
}

export function markActionAttemptFailed(actionId: string, error: string): OfflineAction | null {
  return updateActionStatus(actionId, "FAILED", {
    lastError: error,
    incrementRetry: true,
  });
}

export function removeOfflineAction(actionId: string): void {
  const current = getAllOfflineActions().filter((a) => a.actionId !== actionId);
  memoryActions = current;
  writeActionsToLocalStorage(current);

  void (async () => {
    const db = await openOfflineDb();
    if (!db) return;
    try {
      const tx = db.transaction("actions", "readwrite");
      tx.objectStore("actions").delete(actionId);
    } catch {}
  })();

  notifyActionsChanged();
}

export function clearSyncedActions(): void {
  const current = getAllOfflineActions().filter((a) => a.status !== "SYNCED");
  memoryActions = current;
  writeActionsToLocalStorage(current);
  notifyActionsChanged();
}

export function clearAllOfflineActionsForTesting(): void {
  memoryActions = [];
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(OFFLINE_ACTIONS_STORE_KEY);
  }
}

// -----------------------------------------------------------------------------
// Stable ID Generators
// -----------------------------------------------------------------------------

export function generateStableActionId(type: OfflineActionType, identifier?: string): string {
  const prefixMap: Record<OfflineActionType, string> = {
    INCIDENT_REPORT: "ACT-INC",
    ROUTE_ACCEPTANCE: "ACT-ROUTE",
    ALERT_ACKNOWLEDGE: "ACT-ALERT",
    ROAD_STATUS_UPDATE: "ACT-ROAD",
  };
  const prefix = prefixMap[type] || "ACT-GEN";
  if (identifier) {
    const cleanId = identifier.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24);
    return `${prefix}-${cleanId}`.slice(0, 36);
  }
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  const timePart = Date.now().toString(36).toUpperCase();
  return `${prefix}-${timePart}-${randomPart}`.slice(0, 36);
}

// -----------------------------------------------------------------------------
// Photo Blob Storage & Quota Optimization
// -----------------------------------------------------------------------------

export async function storeOfflineBlob(id: string, dataUrl: string): Promise<boolean> {
  const db = await openOfflineDb();
  if (db) {
    try {
      const tx = db.transaction("blobs", "readwrite");
      tx.objectStore("blobs").put({ id, dataUrl, storedAt: new Date().toISOString() });
      return true;
    } catch (err) {
      console.warn("[OfflineStore] IndexedDB blob storage error:", err);
    }
  }
  return false;
}

export async function getOfflineBlob(id: string): Promise<string | null> {
  const db = await openOfflineDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction("blobs", "readonly");
      const req = tx.objectStore("blobs").get(id);
      req.onsuccess = () => resolve(req.result ? req.result.dataUrl : null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Compresses an image file if it exceeds maximum offline dimensions or size
 */
export async function optimizePhotoForOffline(file: File, maxDim = 1280, quality = 0.75): Promise<{ dataUrl: string; sizeBytes: number; compressed: boolean }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read image file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Unable to decode image"));
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        let needsResize = false;

        if (width > maxDim || height > maxDim) {
          needsResize = true;
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          const direct = String(reader.result);
          resolve({ dataUrl: direct, sizeBytes: file.size, compressed: false });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        const sizeBytes = Math.ceil(dataUrl.length * 0.75);
        resolve({ dataUrl, sizeBytes, compressed: needsResize || file.size > sizeBytes });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
