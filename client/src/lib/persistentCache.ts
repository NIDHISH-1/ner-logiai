/**
 * NER-LogiAI Phase 6: Persistent Application Cache
 * 
 * Persists critical read data across browser reloads in low-connectivity conditions:
 * - Role snapshots
 * - Corridors
 * - Active alerts
 * - Risk predictions & weather snapshots
 * - Route recommendations
 * 
 * Provides transparent stale-data age calculation and status labeling.
 */

export interface CachedItem<T = any> {
  key: string;
  data: T;
  cachedAt: string; // ISO
  ageMs?: number;
}

const LOCAL_STORAGE_CACHE_PREFIX = "ner-logiai.cache.";
const CACHE_INDEX_KEY = "ner-logiai.cache-index";

function getCacheIndex(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(CACHE_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addToCacheIndex(key: string) {
  if (typeof localStorage === "undefined") return;
  try {
    const index = new Set(getCacheIndex());
    index.add(key);
    localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(Array.from(index)));
  } catch {}
}

export function setPersistedCache<T>(key: string, data: T): void {
  if (typeof localStorage === "undefined" || !data) return;
  try {
    const item: CachedItem<T> = {
      key,
      data,
      cachedAt: new Date().toISOString(),
    };
    localStorage.setItem(LOCAL_STORAGE_CACHE_PREFIX + key, JSON.stringify(item));
    addToCacheIndex(key);
  } catch (err) {
    console.warn(`[PersistentCache] Failed to cache ${key}:`, err);
  }
}

export function getPersistedCache<T>(key: string): CachedItem<T> | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CACHE_PREFIX + key);
    if (!raw) return null;
    const item: CachedItem<T> = JSON.parse(raw);
    item.ageMs = Math.max(0, Date.now() - new Date(item.cachedAt).getTime());
    return item;
  } catch {
    return null;
  }
}

export function getCacheAgeMinutes(key: string): number | null {
  const item = getPersistedCache(key);
  if (!item) return null;
  const diffMs = Math.max(0, Date.now() - new Date(item.cachedAt).getTime());
  return Math.floor(diffMs / 60000);
}

export function formatCacheAge(cachedAt: string | Date): string {
  const ts = new Date(cachedAt).getTime();
  const diffMs = Math.max(0, Date.now() - ts);
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);

  if (diffSec < 60) return "JUST NOW";
  if (diffMin < 60) return `${diffMin} MIN AGO`;
  return `${diffHours}H ${diffMin % 60}M AGO`;
}

export function clearPersistedCache(): void {
  if (typeof localStorage === "undefined") return;
  try {
    const index = getCacheIndex();
    for (const key of index) {
      localStorage.removeItem(LOCAL_STORAGE_CACHE_PREFIX + key);
    }
    localStorage.removeItem(CACHE_INDEX_KEY);
  } catch {}
}
