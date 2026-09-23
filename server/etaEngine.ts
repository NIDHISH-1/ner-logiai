/**
 * NER-LogiAI Phase 3 ETA & Delay Intelligence Engine
 * 
 * Provides:
 * 1. Deterministic ETA calculation based on route distance, terrain baseline speed,
 *    current speed, road accessibility, route risk, and verified incidents.
 * 2. Delay computation: delayMinutes = max(0, currentEta - plannedEta).
 * 3. Transparent, explainable delay reasons (weather risk, road blockage, route change)
 *    strictly avoiding fabricated traffic claims.
 */

export interface EtaCalculationInput {
  routeDistanceKm: number;
  expectedSpeedKmH?: number;
  currentVehicleSpeedKmH?: number;
  roadAccessibility?: "accessible" | "restricted" | "blocked";
  riskLevel?: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  hasVerifiedBlockage?: boolean;
  isAlternateRoute?: boolean;
  alternateAddedDistanceKm?: number;
  weatherDelayPenaltyMinutes?: number;
}

export interface EtaCalculationResult {
  plannedEtaMinutes: number;
  currentEtaMinutes: number;
  delayMinutes: number;
  delayReason: string;
  isDelayed: boolean;
  baseTravelMinutes: number;
  penalties: {
    accessibilityPenaltyMinutes: number;
    riskPenaltyMinutes: number;
    reroutePenaltyMinutes: number;
    weatherPenaltyMinutes: number;
  };
}

// Standard average baseline speed for heavy vehicles across mountainous Northeast corridors
export const DEFAULT_NER_TRUCK_SPEED_KMH = 45;

/**
 * Calculates deterministic planned and current ETA with explainable operational delay reasons.
 */
export function calculateOperationalEta(input: EtaCalculationInput): EtaCalculationResult {
  const expectedSpeed = input.expectedSpeedKmH && input.expectedSpeedKmH > 10 ? input.expectedSpeedKmH : DEFAULT_NER_TRUCK_SPEED_KMH;
  
  // Baseline clean planned travel time
  const baselineDistance = input.isAlternateRoute && input.alternateAddedDistanceKm 
    ? Math.max(10, input.routeDistanceKm - input.alternateAddedDistanceKm)
    : input.routeDistanceKm;

  const plannedEtaMinutes = Math.max(15, Math.round((baselineDistance / expectedSpeed) * 60));

  // Current travel base time (using current speed if reasonable or expected speed)
  const effectiveSpeed = input.currentVehicleSpeedKmH && input.currentVehicleSpeedKmH >= 15
    ? Math.min(expectedSpeed, input.currentVehicleSpeedKmH)
    : expectedSpeed;

  const baseTravelMinutes = Math.round((input.routeDistanceKm / effectiveSpeed) * 60);

  // Operational penalties
  let accessibilityPenaltyMinutes = 0;
  if (input.roadAccessibility === "restricted") {
    accessibilityPenaltyMinutes = 35; // Single-lane clearance / convoy slowing
  } else if (input.roadAccessibility === "blocked" || input.hasVerifiedBlockage) {
    accessibilityPenaltyMinutes = 75; // Bottleneck before diversion
  }

  let riskPenaltyMinutes = 0;
  if (input.riskLevel === "CRITICAL") {
    riskPenaltyMinutes = 45;
  } else if (input.riskLevel === "HIGH") {
    riskPenaltyMinutes = 25;
  } else if (input.riskLevel === "MODERATE") {
    riskPenaltyMinutes = 10;
  }

  let reroutePenaltyMinutes = 0;
  if (input.isAlternateRoute && input.alternateAddedDistanceKm && input.alternateAddedDistanceKm > 0) {
    reroutePenaltyMinutes = Math.round((input.alternateAddedDistanceKm / expectedSpeed) * 60);
  }

  const weatherPenaltyMinutes = input.weatherDelayPenaltyMinutes ?? 0;

  const totalPenalties = accessibilityPenaltyMinutes + riskPenaltyMinutes + reroutePenaltyMinutes + weatherPenaltyMinutes;
  const currentEtaMinutes = Math.max(plannedEtaMinutes, baseTravelMinutes + totalPenalties);
  const delayMinutes = Math.max(0, currentEtaMinutes - plannedEtaMinutes);

  // Determine primary delay reason
  let delayReason = "On schedule · standard mountain transit";
  if (delayMinutes > 0) {
    if (input.hasVerifiedBlockage || input.roadAccessibility === "blocked") {
      delayReason = "Delay due to verified road blockage";
    } else if (input.isAlternateRoute && reroutePenaltyMinutes > 0) {
      delayReason = `Delay due to route change (+${input.alternateAddedDistanceKm ?? 23} km safe corridor detour)`;
    } else if (input.riskLevel === "CRITICAL" || input.riskLevel === "HIGH") {
      delayReason = "Delay due to weather risk and mountain sector caution";
    } else if (input.roadAccessibility === "restricted") {
      delayReason = "Delay due to single-lane road restriction";
    } else if (weatherPenaltyMinutes > 0) {
      delayReason = "Delay due to adverse weather condition";
    } else {
      delayReason = "Delay due to terrain speed adjustments";
    }
  }

  return {
    plannedEtaMinutes,
    currentEtaMinutes,
    delayMinutes,
    delayReason,
    isDelayed: delayMinutes > 0,
    baseTravelMinutes,
    penalties: {
      accessibilityPenaltyMinutes,
      riskPenaltyMinutes,
      reroutePenaltyMinutes,
      weatherPenaltyMinutes,
    },
  };
}

/**
 * Formats ETA minutes into human-readable duration (e.g. "3h 42m" or "45m")
 */
export function formatEtaDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
