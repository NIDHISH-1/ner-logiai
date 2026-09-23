import { describe, expect, it } from "vitest";
import { newOfflineIncidentId, pendingOfflineCount } from "./offlineIncidentQueue";

describe("offline incident queue", () => {
  it("counts pending and failed items but not synced items", () => {
    expect(pendingOfflineCount([
      { status: "PENDING" },
      { status: "FAILED" },
      { status: "SYNCING" },
      { status: "SYNCED" },
      { status: "CONFLICT" },
    ] as never)).toBe(3);
  });

  it("creates bounded stable IDs for offline retries", () => {
    const id = newOfflineIncidentId();
    expect(id).toMatch(/^INC-OFF-/);
    expect(id.length).toBeLessThanOrEqual(32);
  });
});
