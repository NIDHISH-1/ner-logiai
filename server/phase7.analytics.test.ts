import { describe, expect, it } from "vitest";
import {
  AnalyticsEngine,
  categorizeDelayReason,
  buildAnalyticsMetadata,
  type OperationalVehicle,
  type OperationalShipment,
} from "./analyticsEngine";
import { appRouter } from "./routers";
import type { Incident } from "../drizzle/schema";
import type { BroadcastAlert } from "./db";

describe("Phase 7: Analytics & Dashboard Intelligence Engine", () => {
  // Sample operational test data strictly modeled after actual DB entities
  const sampleIncidents: Incident[] = [
    {
      id: "INC-701",
      type: "Road Blockage",
      severity: "CRITICAL",
      status: "VERIFIED",
      roadAccessibility: "blocked",
      description: "Major structural rockslide blocking NH-37 near Jorhat bypass",
      latitude: "26.750000",
      longitude: "94.200000",
      occurredAt: new Date(Date.now() - 30 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
      reporterRole: "field_officer",
      photoUrl: null,
      isDemo: true,
    },
    {
      id: "INC-702",
      type: "Flood",
      severity: "HIGH",
      status: "VERIFIED",
      roadAccessibility: "restricted",
      description: "Flash flood inundation on NH-2 Kohima approach, single lane open",
      latitude: "25.674700",
      longitude: "94.108600",
      occurredAt: new Date(Date.now() - 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
      reporterRole: "field_officer",
      photoUrl: null,
      isDemo: true,
    },
    {
      id: "INC-703",
      type: "Landslide",
      severity: "MODERATE",
      status: "UNDER_REVIEW",
      roadAccessibility: "restricted",
      description: "Minor mud accumulation along NH-6 Shillong corridor",
      latitude: "25.578800",
      longitude: "91.893300",
      occurredAt: new Date(Date.now() - 120 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
      reporterRole: "truck_driver",
      photoUrl: null,
      isDemo: true,
    },
    {
      id: "INC-704",
      type: "Traffic",
      severity: "LOW",
      status: "UNVERIFIED",
      roadAccessibility: "accessible",
      description: "Heavy commercial convoy queue at NH-44 border checkpoint",
      latitude: "23.831500",
      longitude: "91.286800",
      occurredAt: new Date(Date.now() - 15 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
      reporterRole: "truck_driver",
      photoUrl: null,
      isDemo: true,
    },
  ];

  const sampleVehicles: OperationalVehicle[] = [
    {
      id: "TRK-101",
      status: "in_transit",
      speed: 42,
      latitude: 26.75,
      longitude: 94.2,
      currentCorridor: "NH-37-JORHAT",
      activeRoute: "Guwahati -> Jorhat -> Imphal",
      shipmentId: "SHP-101",
      lastUpdated: new Date(Date.now() - 60 * 1000), // 1 min ago -> FRESH
      gpsFreshnessCategory: "FRESH",
      gpsSource: "SIMULATED GPS",
      risk: "HIGH",
      isStale: false,
    },
    {
      id: "TRK-102",
      status: "delayed",
      speed: 25,
      latitude: 25.67,
      longitude: 94.1,
      currentCorridor: "NH-2-KOHIMA",
      activeRoute: "Dimapur -> Kohima",
      shipmentId: "SHP-102",
      lastUpdated: new Date(Date.now() - 6 * 60 * 1000), // 6 min ago -> AGING
      gpsFreshnessCategory: "AGING",
      gpsSource: "SIMULATED GPS",
      risk: "MODERATE",
      isStale: false,
    },
    {
      id: "TRK-103",
      status: "idle",
      speed: 0,
      latitude: 25.57,
      longitude: 91.89,
      currentCorridor: "NH-6-SHILLONG",
      activeRoute: "Guwahati -> Shillong",
      shipmentId: null,
      lastUpdated: new Date(Date.now() - 25 * 60 * 1000), // 25 min ago -> STALE
      gpsFreshnessCategory: "STALE",
      gpsSource: "SIMULATED GPS",
      risk: "LOW",
      isStale: true,
    },
  ];

  const sampleShipments: OperationalShipment[] = [
    {
      id: "SHP-101",
      name: "Emergency Medical Supplies",
      priority: "CRITICAL",
      origin: "Guwahati",
      destination: "Imphal",
      status: "in_transit",
      plannedEtaMinutes: 180,
      currentEtaMinutes: 240,
      delayMinutes: 60,
      delayReason: "Road blockage and structural damage on NH-37",
      assignedVehicleId: "TRK-101",
      activeRoute: "Guwahati -> Jorhat -> Imphal",
      isDelayed: true,
    },
    {
      id: "SHP-102",
      name: "Flood Relief Tents & Kits",
      priority: "HIGH",
      origin: "Dimapur",
      destination: "Kohima",
      status: "in_transit",
      plannedEtaMinutes: 90,
      currentEtaMinutes: 110,
      delayMinutes: 20,
      delayReason: "Heavy monsoon weather risk on mountain road",
      assignedVehicleId: "TRK-102",
      activeRoute: "Dimapur -> Kohima",
      isDelayed: true,
    },
    {
      id: "SHP-103",
      name: "Standard Commercial Dry Ration",
      priority: "NORMAL",
      origin: "Guwahati",
      destination: "Shillong",
      status: "delivered",
      plannedEtaMinutes: 120,
      currentEtaMinutes: 120,
      delayMinutes: 0,
      delayReason: null,
      assignedVehicleId: null,
      activeRoute: "Guwahati -> Shillong",
      isDelayed: false,
    },
  ];

  const sampleAlerts: BroadcastAlert[] = [
    {
      id: "ALT-701",
      corridor: "NH-37-JORHAT",
      alertType: "ROAD_CLOSURE",
      severity: "CRITICAL",
      message: "NH-37 blocked at Jorhat",
      status: "ACTIVE",
      createdAt: new Date(),
      affectedVehicleIds: ["TRK-101"],
      affectedShipmentIds: ["SHP-101"],
      targetRoles: ["admin", "truck_driver", "logistics_manager"],
      actionRequired: "REROUTE_MANDATORY",
      sourceIncidentId: "INC-701",
    },
    {
      id: "ALT-702",
      corridor: "NH-2-KOHIMA",
      alertType: "SPEED_RESTRICTION",
      severity: "HIGH",
      message: "Single lane speed restriction due to flood",
      status: "ACKNOWLEDGED",
      createdAt: new Date(),
      affectedVehicleIds: ["TRK-102"],
      affectedShipmentIds: ["SHP-102"],
      targetRoles: ["truck_driver"],
      actionRequired: "ACKNOWLEDGE_ONLY",
      sourceIncidentId: "INC-702",
    },
  ];

  const samplePredictions = [
    {
      id: "NH-37-JORHAT",
      prediction: {
        probability: 88,
        riskLevel: "CRITICAL" as const,
        confidence: 94,
        contributingFactors: ["Bridge structural alert", "Heavy rainfall"],
        weatherDataLabel: "SIMULATED WEATHER DATA",
        weatherFreshness: "FRESH",
      },
    },
    {
      id: "NH-2-KOHIMA",
      prediction: {
        probability: 62,
        riskLevel: "HIGH" as const,
        confidence: 89,
        contributingFactors: ["Flash flood advisory"],
        weatherDataLabel: "SIMULATED WEATHER DATA",
        weatherFreshness: "FRESH",
      },
    },
  ];

  const sampleValidations = [
    {
      id: "NH-37-JORHAT",
      validation: {
        status: "REJECTED" as const,
        confidence: 95,
        reasons: ["Active verified road blockage / structural disruption reported"],
      },
    },
    {
      id: "NH-2-KOHIMA",
      validation: {
        status: "CAUTION" as const,
        confidence: 90,
        reasons: ["Single-lane traffic open at hazard clearance zone"],
      },
    },
  ];

  it("1. builds deterministic metadata with strictly labeled DEMO / SYNTHETIC DATA", () => {
    const meta = buildAnalyticsMetadata({
      incidents: 4,
      vehicles: 3,
      shipments: 3,
      alerts: 2,
      auditEvents: 10,
      corridors: 6,
    });

    expect(meta.dataMode).toBe("DEMO / SYNTHETIC DATA");
    expect(meta.source).toBe("synthetic operational records");
    expect(meta.recordCount.incidents).toBe(4);
    expect(meta.recordCount.vehicles).toBe(3);
    expect(meta.recordCount.corridors).toBe(6);
    expect(meta.note).toContain("deterministically computed");
  });

  it("2. categorizes delay reasons deterministically without hallucinations", () => {
    expect(categorizeDelayReason("Landslide blocked bypass", 45)).toBe("ROAD_BLOCKAGE");
    expect(categorizeDelayReason("Bridge damage structural hazard", 60)).toBe("ROAD_BLOCKAGE");
    expect(categorizeDelayReason("Heavy rainfall and flood warning", 30)).toBe("WEATHER_RISK");
    expect(categorizeDelayReason("Detour via alternate mountain highway", 25)).toBe("ROUTE_CHANGE");
    expect(categorizeDelayReason("Convoy escort priority emergency shipment", 50)).toBe("EMERGENCY_ROUTING");
    expect(categorizeDelayReason("GPS signal loss along gorge", 15)).toBe("GPS_STALENESS");
    expect(categorizeDelayReason(null, 0)).toBe("OTHER");
    expect(categorizeDelayReason("Routine driver tea break", 10)).toBe("OTHER");
  });

  it("3. computes deterministic Corridor Analytics with verified blockages", () => {
    const analytics = AnalyticsEngine.getCorridorAnalytics(
      sampleIncidents,
      sampleVehicles,
      sampleShipments,
      samplePredictions,
      sampleValidations
    );

    expect(analytics.totalCorridors).toBe(6);
    expect(analytics.metadata.dataMode).toBe("DEMO / SYNTHETIC DATA");

    // NH-37 should be blocked due to INC-701 verified blockage
    const nh37 = analytics.corridors.find(c => c.id === "NH-37-JORHAT");
    expect(nh37).toBeDefined();
    expect(nh37?.accessibility).toBe("blocked");
    expect(nh37?.safetyStatus).toBe("REJECTED");
    expect(nh37?.criticalLoadTransitAllowed).toBe(false);
    expect(nh37?.affectedVehiclesCount).toBeGreaterThan(0);
    expect(nh37?.affectedShipmentsCount).toBeGreaterThan(0);

    // NH-2 should be restricted
    const nh2 = analytics.corridors.find(c => c.id === "NH-2-KOHIMA");
    expect(nh2).toBeDefined();
    expect(nh2?.accessibility).toBe("restricted");
    expect(nh2?.safetyStatus).toBe("CAUTION");

    expect(analytics.blockedCorridorsCount).toBeGreaterThanOrEqual(1);
    expect(analytics.restrictedCorridorsCount).toBeGreaterThanOrEqual(1);
    expect(analytics.mostDisruptedCorridor).toContain("NH-37");
  });

  it("4. computes deterministic Regional Operations Overview for Government Admin", () => {
    const corridorAnalytics = AnalyticsEngine.getCorridorAnalytics(
      sampleIncidents,
      sampleVehicles,
      sampleShipments,
      samplePredictions,
      sampleValidations
    );

    const regional = AnalyticsEngine.getRegionalOverview(
      sampleIncidents,
      sampleVehicles,
      sampleShipments,
      sampleAlerts,
      corridorAnalytics.corridors
    );

    expect(regional.totalActiveIncidents).toBe(4);
    expect(regional.verifiedIncidents).toBe(2);
    expect(regional.blockedCorridors).toBe(corridorAnalytics.blockedCorridorsCount);
    expect(regional.activeDisruptions.critical).toBe(1);
    expect(regional.activeDisruptions.high).toBe(1);
    expect(regional.logisticsImpact.delayedShipments).toBe(2);
    expect(regional.logisticsImpact.criticalShipments).toBe(1);
    expect(regional.logisticsImpact.averageDelayMinutes).toBe(40); // (60 + 20) / 2
    expect(regional.accessibilityPercentage).toBeLessThan(100);
  });

  it("5. computes deterministic Incident Analytics with filters and limited history notice", () => {
    const allIncidents = AnalyticsEngine.getIncidentAnalytics(sampleIncidents);

    expect(allIncidents.total).toBe(4);
    expect(allIncidents.bySeverity.CRITICAL).toBe(1);
    expect(allIncidents.bySeverity.HIGH).toBe(1);
    expect(allIncidents.bySeverity.MODERATE).toBe(1);
    expect(allIncidents.bySeverity.LOW).toBe(1);
    expect(allIncidents.byStatus.VERIFIED).toBe(2);
    expect(allIncidents.byStatus.UNDER_REVIEW).toBe(1);
    expect(allIncidents.byStatus.UNVERIFIED).toBe(1);
    expect(allIncidents.unresolvedCount).toBe(2);
    expect(allIncidents.historicalTrendNotice).toContain("Limited historical trend window available");

    // Filter by corridor
    const filteredByCorridor = AnalyticsEngine.getIncidentAnalytics(sampleIncidents, {
      corridor: "NH-37-JORHAT",
    });
    expect(filteredByCorridor.total).toBe(1);
    expect(filteredByCorridor.recentIncidents[0].id).toBe("INC-701");
  });

  it("6. computes deterministic Logistics Manager Shipment Analytics", () => {
    const shipmentAnalytics = AnalyticsEngine.getShipmentAnalytics(sampleShipments);

    expect(shipmentAnalytics.totalShipments).toBe(3);
    expect(shipmentAnalytics.inTransit).toBe(2);
    expect(shipmentAnalytics.delivered).toBe(1);
    expect(shipmentAnalytics.delayed).toBe(2);
    expect(shipmentAnalytics.critical).toBe(1);
    expect(shipmentAnalytics.highPriority).toBe(1);
    expect(shipmentAnalytics.onTimeRatePercentage).toBe(33.3); // 1 out of 3 delivered on time

    // Filter by priority
    const criticalOnly = AnalyticsEngine.getShipmentAnalytics(sampleShipments, {
      priority: "CRITICAL",
    });
    expect(criticalOnly.totalShipments).toBe(1);
    expect(criticalOnly.shipments[0].name).toContain("Emergency Medical");
  });

  it("7. computes deterministic Delay Analytics and Root Cause attribution", () => {
    const delayAnalytics = AnalyticsEngine.getDelayAnalytics(sampleShipments);

    expect(delayAnalytics.totalDelayedShipments).toBe(2);
    expect(delayAnalytics.averageDelayMinutes).toBe(40);
    expect(delayAnalytics.maxDelayMinutes).toBe(60);
    expect(delayAnalytics.delayDistribution.onTime).toBe(1);
    expect(delayAnalytics.delayDistribution.minor).toBe(1); // 20 min
    expect(delayAnalytics.delayDistribution.moderate).toBe(1); // 60 min

    const causes = delayAnalytics.causesBreakdown;
    const blockageCause = causes.find(c => c.cause === "ROAD_BLOCKAGE");
    const weatherCause = causes.find(c => c.cause === "WEATHER_RISK");

    expect(blockageCause).toBeDefined();
    expect(blockageCause?.count).toBe(1);
    expect(blockageCause?.totalDelayMinutes).toBe(60);

    expect(weatherCause).toBeDefined();
    expect(weatherCause?.count).toBe(1);
    expect(weatherCause?.totalDelayMinutes).toBe(20);
  });

  it("8. computes deterministic Fleet Telemetry & GPS Freshness Analytics", () => {
    const fleetAnalytics = AnalyticsEngine.getFleetAnalytics(sampleVehicles);

    expect(fleetAnalytics.totalVehicles).toBe(3);
    expect(fleetAnalytics.activeVehicles).toBe(2);
    expect(fleetAnalytics.idleVehicles).toBe(1);
    expect(fleetAnalytics.gpsFreshness.fresh).toBe(1);
    expect(fleetAnalytics.gpsFreshness.aging).toBe(1);
    expect(fleetAnalytics.gpsFreshness.stale).toBe(1);
    expect(fleetAnalytics.averageSpeedKmH).toBe(33.5); // (42 + 25) / 2
    expect(fleetAnalytics.gpsProvenance).toBe("SIMULATED GPS");
  });

  it("9. computes deterministic Risk Analytics preserving Safety Validator authority", () => {
    const riskAnalytics = AnalyticsEngine.getRiskAnalytics(samplePredictions, sampleValidations);

    expect(riskAnalytics.authorityNotice).toContain("Safety Validator remains authoritative");
    expect(riskAnalytics.criticalCount).toBeGreaterThanOrEqual(1);
    expect(riskAnalytics.highCount).toBeGreaterThanOrEqual(1);
    expect(riskAnalytics.averageRiskScore).toBe(75); // (88 + 62) / 2
  });

  it("10. computes Weather Impact, Emergency, and Field Officer analytics", () => {
    const corridorAnalytics = AnalyticsEngine.getCorridorAnalytics(
      sampleIncidents,
      sampleVehicles,
      sampleShipments,
      samplePredictions,
      sampleValidations
    );

    const weatherAnalytics = AnalyticsEngine.getWeatherImpactAnalytics(
      samplePredictions,
      corridorAnalytics.corridors
    );
    expect(weatherAnalytics.sourceType).toBe("SIMULATED WEATHER");
    expect(weatherAnalytics.weatherWarnings.length).toBeGreaterThan(0);

    const emergencyAnalytics = AnalyticsEngine.getEmergencyAnalytics(
      sampleAlerts,
      corridorAnalytics.corridors
    );
    expect(emergencyAnalytics.totalAlerts).toBe(2);
    expect(emergencyAnalytics.activeAlerts).toBe(1);
    expect(emergencyAnalytics.acknowledgedAlerts).toBe(1);
    expect(emergencyAnalytics.bySeverity.CRITICAL).toBe(1);

    const fieldAnalytics = AnalyticsEngine.getFieldOfficerAnalytics(sampleIncidents);
    expect(fieldAnalytics.totalReportsSubmitted).toBe(4);
    expect(fieldAnalytics.verifiedReports).toBe(2);
    expect(fieldAnalytics.blockageReportsCount).toBe(1);
    expect(fieldAnalytics.verificationRatePercentage).toBe(50);
  });

  it("11. handles empty datasets safely without NaN or crashes", () => {
    const emptyCorridors = AnalyticsEngine.getCorridorAnalytics([], [], [], [], []);
    expect(emptyCorridors.totalCorridors).toBe(6);
    expect(emptyCorridors.blockedCorridorsCount).toBe(0);

    const emptyRegional = AnalyticsEngine.getRegionalOverview([], [], [], [], emptyCorridors.corridors);
    expect(emptyRegional.totalActiveIncidents).toBe(0);
    expect(emptyRegional.accessibilityPercentage).toBe(100);
    expect(emptyRegional.logisticsImpact.averageDelayMinutes).toBe(0);

    const emptyShipments = AnalyticsEngine.getShipmentAnalytics([]);
    expect(emptyShipments.totalShipments).toBe(0);
    expect(emptyShipments.onTimeRatePercentage).toBe(100);

    const emptyDelay = AnalyticsEngine.getDelayAnalytics([]);
    expect(emptyDelay.totalDelayedShipments).toBe(0);
    expect(emptyDelay.averageDelayMinutes).toBe(0);

    const emptyFleet = AnalyticsEngine.getFleetAnalytics([]);
    expect(emptyFleet.totalVehicles).toBe(0);
    expect(emptyFleet.averageSpeedKmH).toBe(38.5);

    const emptyField = AnalyticsEngine.getFieldOfficerAnalytics([]);
    expect(emptyField.totalReportsSubmitted).toBe(0);
    expect(emptyField.verificationRatePercentage).toBe(0);
  });

  it("12. appRouter.analytics procedures execute deterministically via tRPC caller", async () => {
    const caller = appRouter.createCaller({
      user: {
        id: "usr-admin",
        openId: "user_admin",
        name: "Aditi Sharma",
        email: "aditi.admin@ner-logiai.gov.in",
        role: "admin",
        operationalRole: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
        loginMethod: "standalone_prototype",
      } as any,
      req: {} as any,
      res: {} as any,
    });

    const fullReport = await caller.analytics.fullReport();
    expect(fullReport).toBeDefined();
    expect(fullReport.regionalOverview.metadata.dataMode).toBe("DEMO / SYNTHETIC DATA");
    expect(fullReport.corridorAnalytics.corridors.length).toBe(6);
    expect(fullReport.fleetAnalytics.gpsProvenance).toBe("SIMULATED GPS");
    expect(fullReport.riskAnalytics.authorityNotice).toContain("Safety Validator remains authoritative");

    const regional = await caller.analytics.regionalOverview();
    expect(regional).toBeDefined();
    expect(typeof regional.accessibilityPercentage).toBe("number");

    const fleet = await caller.analytics.fleetAnalytics();
    expect(fleet).toBeDefined();
    expect(typeof fleet.totalVehicles).toBe("number");

    const delays = await caller.analytics.delayAnalytics();
    expect(delays).toBeDefined();
    expect(Array.isArray(delays.causesBreakdown)).toBe(true);
  });
});
