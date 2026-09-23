import { describe, expect, it } from "vitest";
import { roleCapabilities, roleNavigation, roleSummary, roles } from "./roleConfig";

describe("role-specific dashboard configuration", () => {
  it("defines a different navigation surface for every supported role", () => {
    expect(roles).toHaveLength(5);
    const navigationSignatures = roles.map((role) => roleNavigation[role].join("|"));
    expect(new Set(navigationSignatures).size).toBe(roles.length);
    expect(roleNavigation["Truck Driver"]).toContain("My Trip");
    expect(roleNavigation["Government / District Administrator"]).toContain("Audit Logs");
  });

  it("keeps workflow intent and capabilities role-specific", () => {
    expect(roleSummary["Field Officer"].primaryAction).toBe("Report incident");
    expect(roleSummary["Emergency Response Team"].primaryAction).toBe("Find emergency route");
    expect(roleCapabilities["Truck Driver"]).not.toContain("analytics");
    expect(roleCapabilities["Government / District Administrator"]).toContain("view-audit");
    expect(roleCapabilities["Logistics Manager"]).toContain("shipment-ops");
  });
});
