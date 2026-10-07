import { beforeEach, describe, expect, it } from "vitest";

class LocalStorageMock {
  store: Record<string, string> = {};
  clear() { this.store = {}; }
  getItem(key: string) { return this.store[key] ?? null; }
  setItem(key: string, value: string) { this.store[key] = String(value); }
  removeItem(key: string) { delete this.store[key]; }
  get length() { return Object.keys(this.store).length; }
  key(index: number) { return Object.keys(this.store)[index] ?? null; }
}

if (typeof globalThis.localStorage === "undefined" || !globalThis.localStorage.clear) {
  (globalThis as any).localStorage = new LocalStorageMock();
}

import {
  generateStableActionId,
  saveOfflineAction,
  getAllOfflineActions,
  updateOfflineActionStatus,
  markActionAttemptFailed,
  removeOfflineAction,
  clearSyncedActions,
  clearAllOfflineActionsForTesting,
  type OfflineAction,
} from "./offlineStore";
import {
  setPersistedCache,
  getPersistedCache,
  formatCacheAge,
  clearPersistedCache,
} from "./persistentCache";

describe("Unified Offline Action Store", () => {
  beforeEach(() => {
    localStorage.clear();
    clearAllOfflineActionsForTesting();
  });

  it("generates deterministic and stable action IDs", () => {
    const id1 = generateStableActionId("ROUTE_ACCEPTANCE", "TRK-104-ROUTE-B");
    const id2 = generateStableActionId("ROUTE_ACCEPTANCE", "TRK-104-ROUTE-B");
    const id3 = generateStableActionId("ROUTE_ACCEPTANCE", "TRK-105-ROUTE-A");

    expect(id1).toBe(id2);
    expect(id1).not.toBe(id3);
    expect(id1).toMatch(/^ACT-ROUTE-/);
  });

  it("saves, lists, and retrieves offline actions", () => {
    const actionId = generateStableActionId("ALERT_ACKNOWLEDGE", "ALT-101");
    const action: OfflineAction = {
      actionId,
      actionType: "ALERT_ACKNOWLEDGE",
      createdAt: new Date().toISOString(),
      payload: { alertId: "ALT-101", acknowledgedAt: new Date().toISOString() },
      status: "PENDING",
      retryCount: 0,
    };

    saveOfflineAction(action);
    const actions = getAllOfflineActions();

    expect(actions).toHaveLength(1);
    expect(actions[0].actionId).toBe(actionId);
    expect(actions[0].actionType).toBe("ALERT_ACKNOWLEDGE");
    expect(actions[0].status).toBe("PENDING");
  });

  it("transitions action status safely (PENDING -> SYNCING -> SYNCED)", () => {
    const actionId = generateStableActionId("ROAD_STATUS_UPDATE", "NH-37-blocked");
    saveOfflineAction({
      actionId,
      actionType: "ROAD_STATUS_UPDATE",
      createdAt: new Date().toISOString(),
      payload: { corridor: "NH-37", roadAccessibility: "blocked" },
      status: "PENDING",
      retryCount: 0,
    });

    updateOfflineActionStatus(actionId, "SYNCING");
    let current = getAllOfflineActions().find((a) => a.actionId === actionId);
    expect(current?.status).toBe("SYNCING");

    updateOfflineActionStatus(actionId, "SYNCED");
    current = getAllOfflineActions().find((a) => a.actionId === actionId);
    expect(current?.status).toBe("SYNCED");
  });

  it("handles retry failures with bounded retry count and backoff", () => {
    const actionId = generateStableActionId("ROUTE_ACCEPTANCE", "TRK-104-B");
    saveOfflineAction({
      actionId,
      actionType: "ROUTE_ACCEPTANCE",
      createdAt: new Date().toISOString(),
      payload: { vehicleId: "TRK-104", routeId: "ROUTE-B" },
      status: "SYNCING",
      retryCount: 0,
    });

    markActionAttemptFailed(actionId, "Network timeout during transmission");
    const updated = getAllOfflineActions().find((a) => a.actionId === actionId);

    expect(updated?.status).toBe("FAILED");
    expect(updated?.retryCount).toBe(1);
    expect(updated?.lastError).toBe("Network timeout during transmission");
    expect(updated?.lastAttemptAt).toBeDefined();
  });

  it("clears synced actions while preserving pending, failed, and conflict actions", () => {
    saveOfflineAction({
      actionId: "ACT-1",
      actionType: "ALERT_ACKNOWLEDGE",
      createdAt: new Date().toISOString(),
      payload: {},
      status: "SYNCED",
      retryCount: 0,
    });
    saveOfflineAction({
      actionId: "ACT-2",
      actionType: "ALERT_ACKNOWLEDGE",
      createdAt: new Date().toISOString(),
      payload: {},
      status: "PENDING",
      retryCount: 0,
    });
    saveOfflineAction({
      actionId: "ACT-3",
      actionType: "ALERT_ACKNOWLEDGE",
      createdAt: new Date().toISOString(),
      payload: {},
      status: "CONFLICT",
      retryCount: 0,
    });

    clearSyncedActions();
    const remaining = getAllOfflineActions();

    expect(remaining).toHaveLength(2);
    expect(remaining.map((a) => a.actionId)).toEqual(["ACT-2", "ACT-3"]);
  });
});

describe("Persistent Application Cache", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists read data with timestamp and allows offline retrieval", () => {
    const sampleAlerts = [
      { id: "ALT-001", title: "Heavy Landslide on NH-37", severity: "CRITICAL" },
      { id: "ALT-002", title: "Flash Flood Warning on NH-6", severity: "HIGH" },
    ];

    setPersistedCache("operations.alerts", sampleAlerts);
    const cached = getPersistedCache<typeof sampleAlerts>("operations.alerts");

    expect(cached).not.toBeNull();
    expect(cached?.data).toEqual(sampleAlerts);
    expect(cached?.cachedAt).toBeDefined();
  });

  it("formats relative cache age accurately", () => {
    const now = Date.now();
    expect(formatCacheAge(now - 10_000)).toBe("JUST NOW");
    expect(formatCacheAge(now - 120_000)).toBe("2 MIN AGO");
    expect(formatCacheAge(now - 7_200_000)).toBe("2H 0M AGO");
  });

  it("clears cache correctly", () => {
    setPersistedCache("test.key", { value: 123 });
    clearPersistedCache("test.key");
    expect(getPersistedCache("test.key")).toBeNull();
  });
});
