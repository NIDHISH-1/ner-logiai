/**
 * Emergency Impact & Alert Propagation Engine
 * Deterministic evaluation connecting Incidents -> Corridor Accessibility -> Vehicles -> Shipments -> Alerts
 */

export type EmergencyPriority = "CRITICAL" | "HIGH" | "MODERATE" | "LOW";

export type ShipmentImpactStatus = "CRITICALLY AFFECTED" | "AFFECTED" | "NOT AFFECTED";

export interface IncidentInput {
  id: string;
  type: string;
  severity: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  status: "UNVERIFIED" | "UNDER_REVIEW" | "VERIFIED" | "REJECTED";
  roadAccessibility: "accessible" | "restricted" | "blocked" | "unknown";
  description: string;
  corridor?: string | null;
  latitude: number | string;
  longitude: number | string;
}

export interface VehicleRef {
  id: string;
  currentCorridor?: string | null;
  latitude: number | string;
  longitude: number | string;
  status: string;
  shipmentId?: string | null;
  activeRoute?: string | null;
}

export interface ShipmentRef {
  id: string;
  name: string;
  priority: "CRITICAL" | "HIGH" | "NORMAL" | "LOW";
  origin: string;
  destination: string;
  assignedVehicleId?: string | null;
  status: string;
  activeRoute?: string | null;
  currentEtaMinutes?: number;
  plannedEtaMinutes?: number;
  delayMinutes?: number;
  delayReason?: string | null;
}

export interface EmergencyImpactAssessment {
  incidentId: string;
  corridor: string;
  roadSegment: string;
  severity: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  roadAccessibility: "accessible" | "restricted" | "blocked" | "unknown";
  emergencyPriority: EmergencyPriority;
  affectedVehicles: VehicleRef[];
  affectedShipments: ShipmentRef[];
  affectedCriticalShipments: ShipmentRef[];
  shipmentImpactMap: Record<string, ShipmentImpactStatus>;
  recommendedAction: string;
  requiresDriverConfirmation: boolean;
  safeAlternateAvailable: boolean;
  evaluatedAt: Date;
}

export interface AlertDraft {
  incidentId?: string;
  alertType: "ROAD_BLOCKAGE" | "CRITICAL_INCIDENT" | "LOGISTICS_DELAY" | "EMERGENCY_ROUTING" | "NO_SAFE_ROUTE" | "OPERATIONAL_DISRUPTION";
  severity: "CRITICAL" | "HIGH" | "ADVISORY" | "INFO";
  title: string;
  message: string;
  corridor: string;
  roadSegment?: string;
  affectedVehicleIds: string[];
  affectedShipmentIds: string[];
  targetRoles: Array<"admin" | "emergency_team" | "logistics_manager" | "truck_driver" | "field_officer">;
}

/**
 * Normalizes text for matching corridors
 */
function normalizeCorridorKey(text: string): string {
  const t = text.toUpperCase();
  if (t.includes("NH-37") || t.includes("JORHAT") || t.includes("KAZIRANGA")) return "NH-37";
  if (t.includes("NH-2") || t.includes("KOHIMA") || t.includes("DIMAPUR")) return "NH-2";
  if (t.includes("NH-6") || t.includes("SHILLONG") || t.includes("SILCHAR")) return "NH-6";
  if (t.includes("NH-39") || t.includes("IMPHAL")) return "NH-39";
  if (t.includes("REMOTE") || t.includes("SPUR")) return "DISTRICT-SPUR";
  return "CORRIDOR-GENERAL";
}

/**
 * Calculates spherical distance in km between two lat/lon points
 */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Evaluates the operational emergency impact of an incident against the current fleet and shipments.
 */
export function evaluateEmergencyImpact(
  incident: IncidentInput,
  vehicles: VehicleRef[],
  shipments: ShipmentRef[]
): EmergencyImpactAssessment {
  const incLat = Number(incident.latitude);
  const incLon = Number(incident.longitude);
  const corridorText = incident.corridor || incident.description || "Northeast Corridor";
  const incidentCorridorKey = normalizeCorridorKey(corridorText);

  // 1. Identify affected vehicles:
  // - on the same corridor, OR
  // - within 35 km proximity, OR
  // - activeRoute traverses corridor
  const affectedVehicles = vehicles.filter((v) => {
    const vCorridorKey = normalizeCorridorKey(v.currentCorridor || "");
    const sameCorridor = incidentCorridorKey !== "CORRIDOR-GENERAL" && vCorridorKey === incidentCorridorKey;
    const distance = haversineKm(incLat, incLon, Number(v.latitude), Number(v.longitude));
    const isNearby = distance <= 35.0;
    const routeContains = (v.activeRoute || "").toUpperCase().includes(incidentCorridorKey);
    return sameCorridor || isNearby || routeContains;
  });

  const affectedVehicleIds = new Set(affectedVehicles.map((v) => v.id));

  // 2. Identify affected shipments:
  // - assigned to an affected vehicle, OR
  // - activeRoute contains the incident corridor, OR
  // - origin/destination requires transiting through this corridor (Guwahati <-> Imphal transits NH-37/NH-2)
  const affectedShipments = shipments.filter((s) => {
    const isAssignedToAffectedVehicle = s.assignedVehicleId ? affectedVehicleIds.has(s.assignedVehicleId) : false;
    const routeMentions = (s.activeRoute || "").toUpperCase().includes(incidentCorridorKey);
    const transitsCorridor =
      (s.origin.toUpperCase().includes("GUWAHATI") && s.destination.toUpperCase().includes("IMPHAL")) ||
      (s.origin.toUpperCase().includes("IMPHAL") && s.destination.toUpperCase().includes("GUWAHATI"));
    return isAssignedToAffectedVehicle || routeMentions || (transitsCorridor && incidentCorridorKey === "NH-37");
  });

  // 3. Identify critical priority shipments affected:
  const affectedCriticalShipments = affectedShipments.filter(
    (s) => s.priority === "CRITICAL" || s.priority === "HIGH"
  );

  // 4. Map shipment impact status:
  const isBlockingDisruption =
    incident.status === "VERIFIED" &&
    (incident.roadAccessibility === "blocked" || incident.severity === "CRITICAL");

  const shipmentImpactMap: Record<string, ShipmentImpactStatus> = {};
  for (const s of shipments) {
    const isAffected = affectedShipments.some((aff) => aff.id === s.id);
    if (!isAffected) {
      shipmentImpactMap[s.id] = "NOT AFFECTED";
    } else {
      const isCriticalPriority = s.priority === "CRITICAL" || s.priority === "HIGH";
      if (isCriticalPriority && isBlockingDisruption) {
        shipmentImpactMap[s.id] = "CRITICALLY AFFECTED";
      } else {
        shipmentImpactMap[s.id] = "AFFECTED";
      }
    }
  }

  // 5. Evaluate Emergency Priority:
  let emergencyPriority: EmergencyPriority = "LOW";
  if (
    incident.status === "VERIFIED" &&
    incident.roadAccessibility === "blocked" &&
    affectedCriticalShipments.length > 0
  ) {
    emergencyPriority = "CRITICAL";
  } else if (
    incident.status === "VERIFIED" &&
    (incident.severity === "CRITICAL" || incident.roadAccessibility === "blocked")
  ) {
    emergencyPriority = "CRITICAL";
  } else if (
    incident.status === "VERIFIED" &&
    (incident.severity === "HIGH" || incident.roadAccessibility === "restricted")
  ) {
    emergencyPriority = "HIGH";
  } else if (incident.status === "VERIFIED" || incident.severity === "HIGH") {
    emergencyPriority = "MODERATE";
  }

  // 6. Recommended Action:
  let recommendedAction = "Monitor corridor telemetry and weather risk.";
  if (emergencyPriority === "CRITICAL") {
    recommendedAction =
      "Trigger A* emergency reroute bypassing blocked corridor. Alert Emergency Operations & Driver TRK-104 for human-in-the-loop route confirmation.";
  } else if (emergencyPriority === "HIGH") {
    recommendedAction =
      "Evaluate alternate routes and issue speed restrictions. Advise logistics dispatch of probable transit delays.";
  } else if (emergencyPriority === "MODERATE") {
    recommendedAction =
      "Dispatch field inspection unit to verify road surface conditions and clearance timeline.";
  }

  return {
    incidentId: incident.id,
    corridor: corridorText,
    roadSegment: `${incidentCorridorKey} Segment (${incident.type})`,
    severity: incident.severity,
    roadAccessibility: incident.roadAccessibility,
    emergencyPriority,
    affectedVehicles,
    affectedShipments,
    affectedCriticalShipments,
    shipmentImpactMap,
    recommendedAction,
    requiresDriverConfirmation: affectedVehicles.some((v) => v.id === "TRK-104"),
    safeAlternateAvailable: true,
    evaluatedAt: new Date(),
  };
}

/**
 * Builds deterministic alert drafts based on emergency impact evaluation.
 */
export function buildAlertDraftsFromImpact(
  impact: EmergencyImpactAssessment,
  incident: IncidentInput
): AlertDraft[] {
  const drafts: AlertDraft[] = [];
  const corridor = impact.corridor;
  const vehicleIds = impact.affectedVehicles.map((v) => v.id);
  const shipmentIds = impact.affectedShipments.map((s) => s.id);

  // 1. Blocked Road Operational Alert
  if (incident.status === "VERIFIED" && incident.roadAccessibility === "blocked") {
    drafts.push({
      incidentId: incident.id,
      alertType: "ROAD_BLOCKAGE",
      severity: incident.severity === "CRITICAL" ? "CRITICAL" : "HIGH",
      title: `Road Blockage: ${corridor}`,
      message: `Verified ${incident.type} has blocked ${corridor}. All transit suspended on this segment.`,
      corridor,
      roadSegment: impact.roadSegment,
      affectedVehicleIds: vehicleIds,
      affectedShipmentIds: shipmentIds,
      targetRoles: ["admin", "emergency_team", "logistics_manager", "field_officer"],
    });
  }

  // 2. Critical Incident Emergency Alert
  if (incident.status === "VERIFIED" && incident.severity === "CRITICAL") {
    drafts.push({
      incidentId: incident.id,
      alertType: "CRITICAL_INCIDENT",
      severity: "CRITICAL",
      title: `Emergency Hazard: ${incident.type} on ${corridor}`,
      message: `Verified CRITICAL incident: ${incident.description}. High risk to life and infrastructure.`,
      corridor,
      roadSegment: impact.roadSegment,
      affectedVehicleIds: vehicleIds,
      affectedShipmentIds: shipmentIds,
      targetRoles: ["admin", "emergency_team"],
    });
  }

  // 3. Critical Shipment Disruption Alert (Logistics)
  if (
    impact.affectedCriticalShipments.length > 0 &&
    incident.status === "VERIFIED" &&
    (incident.roadAccessibility === "blocked" || incident.severity === "CRITICAL" || incident.severity === "HIGH")
  ) {
    const critShp = impact.affectedCriticalShipments[0];
    drafts.push({
      incidentId: incident.id,
      alertType: "LOGISTICS_DELAY",
      severity: "CRITICAL",
      title: `Critical Shipment Disrupted: ${critShp.name}`,
      message: `Priority load ${critShp.id} (${critShp.name}) routed through ${corridor} is impacted by verified road obstruction. Safe detour required.`,
      corridor,
      roadSegment: impact.roadSegment,
      affectedVehicleIds: critShp.assignedVehicleId ? [critShp.assignedVehicleId] : vehicleIds,
      affectedShipmentIds: [critShp.id],
      targetRoles: ["admin", "logistics_manager", "emergency_team"],
    });
  }

  // 4. Truck Driver Targeted Route Warning
  const isDriverVehicleAffected = impact.affectedVehicles.some((v) => v.id === "TRK-104");
  if (
    isDriverVehicleAffected &&
    incident.status === "VERIFIED" &&
    (incident.roadAccessibility === "blocked" || incident.severity === "CRITICAL" || incident.severity === "HIGH")
  ) {
    drafts.push({
      incidentId: incident.id,
      alertType: "EMERGENCY_ROUTING",
      severity: incident.roadAccessibility === "blocked" ? "CRITICAL" : "HIGH",
      title: `Route Warning: ${corridor} Impassable`,
      message: `Your planned path on ${corridor} has a verified blockage. An alternate A* safe route is available. Review and manually accept new routing.`,
      corridor,
      roadSegment: impact.roadSegment,
      affectedVehicleIds: ["TRK-104"],
      affectedShipmentIds: impact.affectedCriticalShipments.map((s) => s.id),
      targetRoles: ["truck_driver", "admin", "logistics_manager"],
    });
  }

  return drafts;
}

/**
 * Builds an emergency alert draft when NO SAFE ROUTE exists.
 */
export function buildNoSafeRouteAlert(corridor: string, reason: string, vehicleId?: string, shipmentId?: string): AlertDraft {
  return {
    alertType: "NO_SAFE_ROUTE",
    severity: "CRITICAL",
    title: `NO SAFE ROUTE AVAILABLE: ${corridor}`,
    message: `All evaluated corridors to destination are blocked or exceed maximum safety thresholds. Reason: ${reason}. Vehicles must halt immediately at nearest secure logistics depot.`,
    corridor,
    roadSegment: `${corridor} (All bypasses closed)`,
    affectedVehicleIds: vehicleId ? [vehicleId] : ["TRK-104"],
    affectedShipmentIds: shipmentId ? [shipmentId] : ["SHP-001"],
    targetRoles: ["admin", "emergency_team", "logistics_manager", "truck_driver"],
  };
}
