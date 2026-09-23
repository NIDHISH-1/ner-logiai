/**
 * NER-LogiAI Phase 3 GPS & Vehicle Telemetry Engine
 * 
 * Provides:
 * 1. Pluggable GPS Provider architecture (IGpsProvider)
 * 2. Deterministic SimulatedGpsProvider labeled as "SIMULATED GPS"
 * 3. GPS data freshness evaluator (FRESH <2m, AGING 2-10m, STALE >10m)
 * 4. Deterministic Vehicle -> Road / Corridor matching engine
 */

export type GpsSourceType = "SIMULATED GPS" | "LIVE GPS";
export type GpsFreshness = "FRESH" | "AGING" | "STALE";

export interface VehicleGpsTelemetry {
  vehicleId: string;
  latitude: number;
  longitude: number;
  speed: number; // km/h
  heading: number; // degrees 0 - 360
  gpsSource: GpsSourceType;
  timestamp: Date;
  freshness: GpsFreshness;
  freshnessLabel: string;
  currentCorridor?: string;
  nearestRoadSegment?: string;
  roadAccessibility?: "accessible" | "restricted" | "blocked";
  riskLevel?: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  isSimulated: boolean;
}

export interface CorridorSegment {
  corridorId: string;
  name: string;
  state: string;
  coordinates: [number, number][]; // [lat, lng]
  defaultSpeedLimitKmH: number;
}

export const KNOWN_CORRIDORS: CorridorSegment[] = [
  {
    corridorId: "NH-37-JORHAT",
    name: "NH-37 · Guwahati to Upper Assam (Jorhat / Dibrugarh)",
    state: "Assam",
    coordinates: [
      [26.1445, 91.7362], // Guwahati
      [26.3450, 92.6840], // Nagaon
      [26.5820, 93.1710], // Kaziranga
      [26.7500, 94.2000], // Jorhat
      [27.4728, 94.9120], // Dibrugarh
    ],
    defaultSpeedLimitKmH: 50,
  },
  {
    corridorId: "NH-2-KOHIMA",
    name: "NH-2 · Dimapur to Kohima / Imphal Corridor",
    state: "Nagaland & Manipur",
    coordinates: [
      [25.9064, 93.7275], // Dimapur
      [25.6747, 94.1086], // Kohima
      [25.2630, 94.0320], // Maram
      [24.8170, 93.9368], // Imphal
    ],
    defaultSpeedLimitKmH: 40,
  },
  {
    corridorId: "NH-6-SHILLONG",
    name: "NH-6 · Guwahati - Shillong - Silchar Expressway",
    state: "Meghalaya & Assam",
    coordinates: [
      [26.1445, 91.7362], // Guwahati
      [25.9000, 91.8000], // Nongpoh
      [25.5788, 91.8933], // Shillong
      [25.4500, 92.2000], // Jowai
      [24.8333, 92.7789], // Silchar
    ],
    defaultSpeedLimitKmH: 45,
  },
  {
    corridorId: "NH-27-WESTERN",
    name: "NH-27 · Western Assam Transit Gateway",
    state: "Assam",
    coordinates: [
      [26.5000, 90.5500], // Bongaigaon
      [26.3500, 91.0000], // Barpeta
      [26.1445, 91.7362], // Guwahati
    ],
    defaultSpeedLimitKmH: 60,
  },
  {
    corridorId: "NH-39-IMPHAL",
    name: "NH-39 · Southern Hills Link (Silchar - Imphal)",
    state: "Manipur & Assam",
    coordinates: [
      [24.8333, 92.7789], // Silchar
      [24.8500, 93.3000], // Jiribam
      [24.8170, 93.9368], // Imphal
    ],
    defaultSpeedLimitKmH: 35,
  },
];

/**
 * Computes data freshness category and human-readable label
 * Requirements:
 * - < 2 min: FRESH
 * - 2 to 10 min: AGING
 * - > 10 min: STALE
 */
export function calculateGpsFreshness(date: Date | string | number): {
  freshness: GpsFreshness;
  ageMinutes: number;
  label: string;
} {
  const ts = new Date(date).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - ts);
  const ageMinutes = Math.floor(diffMs / 60000);
  const ageSeconds = Math.floor(diffMs / 1000);

  if (ageMinutes < 2) {
    const s = Math.max(1, ageSeconds);
    return {
      freshness: "FRESH",
      ageMinutes,
      label: s < 60 ? `GPS updated ${s}s ago` : "GPS updated 1m ago",
    };
  }

  if (ageMinutes <= 10) {
    return {
      freshness: "AGING",
      ageMinutes,
      label: `GPS updated ${ageMinutes}m ago`,
    };
  }

  return {
    freshness: "STALE",
    ageMinutes,
    label: `GPS STALE (${ageMinutes > 60 ? `${Math.floor(ageMinutes / 60)}h ago` : `${ageMinutes}m ago`})`,
  };
}

/**
 * Calculates straight line distance between two lat/lng coordinates in kilometers (Haversine formula).
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Deterministic point-to-segment distance and nearest projection.
 * Limitations note:
 * Computes 2D Euclidean spherical distance to corridor polylines.
 * Designed for regional logistics corridor identification without external API dependencies.
 */
export function matchVehicleToCorridor(
  latitude: number,
  longitude: number
): {
  corridorId: string;
  corridorName: string;
  nearestSegment: string;
  distanceToCorridorKm: number;
} {
  let closestCorridor = KNOWN_CORRIDORS[0];
  let minDistance = Number.POSITIVE_INFINITY;
  let segmentLabel = "Guwahati approach";

  for (const corridor of KNOWN_CORRIDORS) {
    const coords = corridor.coordinates;
    for (let i = 0; i < coords.length - 1; i++) {
      const p1 = coords[i];
      const p2 = coords[i + 1];

      // Midpoint / segment representation
      const midLat = (p1[0] + p2[0]) / 2;
      const midLon = (p1[1] + p2[1]) / 2;
      const d1 = haversineDistanceKm(latitude, longitude, p1[0], p1[1]);
      const d2 = haversineDistanceKm(latitude, longitude, p2[0], p2[1]);
      const dMid = haversineDistanceKm(latitude, longitude, midLat, midLon);
      const segMin = Math.min(d1, d2, dMid);

      if (segMin < minDistance) {
        minDistance = segMin;
        closestCorridor = corridor;
        segmentLabel = `${corridor.name} (near [${p1[0].toFixed(2)}, ${p1[1].toFixed(2)}])`;
      }
    }
  }

  return {
    corridorId: closestCorridor.corridorId,
    corridorName: closestCorridor.name,
    nearestSegment: segmentLabel,
    distanceToCorridorKm: Math.round(minDistance * 10) / 10,
  };
}

/**
 * Standard GPS Provider interface enabling real GPS hardware integration
 * or simulated GPS for testing and demonstration.
 */
export interface IGpsProvider {
  readonly providerName: string;
  readonly isSimulated: boolean;
  getVehicleTelemetry(vehicleId: string): Promise<VehicleGpsTelemetry | null>;
  getAllVehicleTelemetry(): Promise<VehicleGpsTelemetry[]>;
  updateVehiclePosition(input: {
    vehicleId: string;
    latitude: number;
    longitude: number;
    speed?: number;
    heading?: number;
    corridor?: string;
  }): Promise<VehicleGpsTelemetry>;
}

/**
 * Deterministic Simulated GPS Provider for demo and development.
 * Explicitly labeled as "SIMULATED GPS".
 */
export class SimulatedGpsProvider implements IGpsProvider {
  public readonly providerName = "SIMULATED GPS";
  public readonly isSimulated = true;

  // In-memory simulation state table for known demo vehicles
  private simulatedPositions: Map<
    string,
    {
      latitude: number;
      longitude: number;
      speed: number;
      heading: number;
      timestamp: Date;
      corridor: string;
      waypoints: [number, number][];
      currentWaypointIndex: number;
    }
  > = new Map();

  constructor() {
    this.seedDefaultSimulatedVehicles();
  }

  private seedDefaultSimulatedVehicles() {
    // TRK-104: Emergency Medicine Guwahati -> Imphal along NH-2 corridor
    this.simulatedPositions.set("TRK-104", {
      latitude: 26.1445,
      longitude: 91.7362,
      speed: 42.5,
      heading: 75,
      timestamp: new Date(),
      corridor: "NH-2 · Dimapur to Kohima / Imphal Corridor",
      waypoints: [
        [26.1445, 91.7362], // Guwahati
        [25.9064, 93.7275], // Dimapur
        [25.6747, 94.1086], // Kohima
        [24.8170, 93.9368], // Imphal
      ],
      currentWaypointIndex: 0,
    });

    // TRK-219: Flood Relief Kits Dimapur -> Kohima
    this.simulatedPositions.set("TRK-219", {
      latitude: 25.6747,
      longitude: 94.1086,
      speed: 38.0,
      heading: 140,
      timestamp: new Date(Date.now() - 3 * 60 * 1000), // 3 min ago (AGING)
      corridor: "NH-2 · Dimapur to Kohima / Imphal Corridor",
      waypoints: [
        [25.9064, 93.7275],
        [25.6747, 94.1086],
      ],
      currentWaypointIndex: 1,
    });

    // TRK-302: Blood Plasma Supply Guwahati -> Jorhat
    this.simulatedPositions.set("TRK-302", {
      latitude: 26.75,
      longitude: 94.2,
      speed: 48.0,
      heading: 85,
      timestamp: new Date(),
      corridor: "NH-37 · Guwahati to Upper Assam (Jorhat / Dibrugarh)",
      waypoints: [
        [26.1445, 91.7362],
        [26.75, 94.2],
      ],
      currentWaypointIndex: 1,
    });

    // TRK-410: Water Purification Filters Shillong Bypass
    this.simulatedPositions.set("TRK-410", {
      latitude: 25.5788,
      longitude: 91.8933,
      speed: 35.5,
      heading: 190,
      timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 min ago (STALE)
      corridor: "NH-6 · Guwahati - Shillong - Silchar Expressway",
      waypoints: [
        [26.1445, 91.7362],
        [25.5788, 91.8933],
      ],
      currentWaypointIndex: 1,
    });
  }

  public async getVehicleTelemetry(
    vehicleId: string
  ): Promise<VehicleGpsTelemetry | null> {
    const pos = this.simulatedPositions.get(vehicleId);
    if (!pos) return null;

    const freshnessData = calculateGpsFreshness(pos.timestamp);
    const corridorMatch = matchVehicleToCorridor(pos.latitude, pos.longitude);

    return {
      vehicleId,
      latitude: pos.latitude,
      longitude: pos.longitude,
      speed: pos.speed,
      heading: pos.heading,
      gpsSource: "SIMULATED GPS",
      timestamp: pos.timestamp,
      freshness: freshnessData.freshness,
      freshnessLabel: freshnessData.label,
      currentCorridor: pos.corridor || corridorMatch.corridorName,
      nearestRoadSegment: corridorMatch.nearestSegment,
      isSimulated: true,
    };
  }

  public async getAllVehicleTelemetry(): Promise<VehicleGpsTelemetry[]> {
    const results: VehicleGpsTelemetry[] = [];
    const vehicleIds = Array.from(this.simulatedPositions.keys());
    for (const vehicleId of vehicleIds) {
      const telemetry = await this.getVehicleTelemetry(vehicleId);
      if (telemetry) results.push(telemetry);
    }
    return results;
  }

  public async updateVehiclePosition(input: {
    vehicleId: string;
    latitude: number;
    longitude: number;
    speed?: number;
    heading?: number;
    corridor?: string;
  }): Promise<VehicleGpsTelemetry> {
    const existing = this.simulatedPositions.get(input.vehicleId);
    const now = new Date();
    const speed = input.speed ?? existing?.speed ?? 40.0;
    const heading = input.heading ?? existing?.heading ?? 0;
    const corridorMatch = matchVehicleToCorridor(input.latitude, input.longitude);
    const corridor = input.corridor ?? corridorMatch.corridorName;

    this.simulatedPositions.set(input.vehicleId, {
      latitude: input.latitude,
      longitude: input.longitude,
      speed,
      heading,
      timestamp: now,
      corridor,
      waypoints: existing?.waypoints ?? [[input.latitude, input.longitude]],
      currentWaypointIndex: existing?.currentWaypointIndex ?? 0,
    });

    const freshnessData = calculateGpsFreshness(now);

    return {
      vehicleId: input.vehicleId,
      latitude: input.latitude,
      longitude: input.longitude,
      speed,
      heading,
      gpsSource: "SIMULATED GPS",
      timestamp: now,
      freshness: freshnessData.freshness,
      freshnessLabel: freshnessData.label,
      currentCorridor: corridor,
      nearestRoadSegment: corridorMatch.nearestSegment,
      isSimulated: true,
    };
  }

  /**
   * Deterministically step the vehicle along its demo waypoints.
   * Useful for testing simulated vehicle progress.
   */
  public async stepVehicleSimulation(vehicleId: string): Promise<VehicleGpsTelemetry | null> {
    const existing = this.simulatedPositions.get(vehicleId);
    if (!existing || existing.waypoints.length <= 1) return null;

    const nextIndex = (existing.currentWaypointIndex + 1) % existing.waypoints.length;
    const targetWaypoint = existing.waypoints[nextIndex];

    // Compute heading from current to target
    const latDiff = targetWaypoint[0] - existing.latitude;
    const lonDiff = targetWaypoint[1] - existing.longitude;
    const headingRad = Math.atan2(lonDiff, latDiff);
    const headingDeg = (Math.round((headingRad * 180) / Math.PI) + 360) % 360;

    return this.updateVehiclePosition({
      vehicleId,
      latitude: targetWaypoint[0],
      longitude: targetWaypoint[1],
      heading: headingDeg,
      speed: existing.speed,
    });
  }
}

// Global singleton instance of Simulated GPS provider
export const simulatedGpsProvider = new SimulatedGpsProvider();
