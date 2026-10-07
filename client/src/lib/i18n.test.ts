import { describe, it, expect } from "vitest";
import { localizeAlert, formatActionableDriverAlert, FIELD_UI_LABELS } from "@shared/i18n";

describe("Assamese Localization Engine (Phase 5 Extension)", () => {
  it("supports Assamese (as) in UI labels", () => {
    expect(FIELD_UI_LABELS.as).toBeDefined();
    expect(FIELD_UI_LABELS.as.online).toContain("অনলাইন");
    expect(FIELD_UI_LABELS.as.offline).toContain("অফলাইন");
    expect(FIELD_UI_LABELS.as.roadBlocked).toBe("অৱৰুদ্ধ (BLOCKED)");
    expect(FIELD_UI_LABELS.as.assignedVehicle).toBe("আবণ্টিত বাহন");
    expect(FIELD_UI_LABELS.as.driverAdvisory).toBe("চালকৰ কাৰ্যকৰী পৰামৰ্শ");
    expect(FIELD_UI_LABELS.as.myTrip).toBe("মোৰ যাত্ৰা");
  });

  it("localizes alerts into Assamese while preserving technical identifiers", () => {
    const alert = {
      alertType: "GPS_STALE",
      title: "Telemetry Alert: TRK-104 GPS Stale",
      message: "No live telemetry packet received from TRK-104 in over 15 minutes.",
      corridor: "NH-37",
      severity: "HIGH",
      affectedVehicleIds: ["TRK-104"],
      affectedShipmentIds: ["SHP-001"],
    };

    const localized = localizeAlert(alert, "as");
    expect(localized.language).toBe("as");
    expect(localized.title).toContain("TRK-104");
    expect(localized.title).toContain("জিপিএছ নিষ্ক্ৰিয়");
    expect(localized.driverAction).toContain("TRK-104");
  });

  it("formats actionable driver alerts in Assamese", () => {
    const formatted = formatActionableDriverAlert({
      corridor: "NH-37",
      status: "BLOCKED",
      severity: "CRITICAL",
      delayMinutes: 45,
    }, "as");

    expect(formatted).toContain("NH-37");
    expect(formatted).toContain("বন্ধ");
    expect(formatted).toContain("45");
  });
});
