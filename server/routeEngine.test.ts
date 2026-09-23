import { describe, expect, it } from "vitest";
import { optimizeRoute } from "./routeEngine";
import { demoRiskScenarios, LIVE_WEATHER_DATA_LABEL, predictRisk } from "./riskEngine";

function riskInputsForWeather(kohimaRainfall: number, kohimaFlood: boolean, kohimaLandslide: boolean, shillongRainfall: number) {
  return demoRiskScenarios.map(scenario => ({
    id: scenario.id,
    prediction: predictRisk({
      ...scenario.features,
      ...(scenario.id === "NH-6-SHILLONG" ? { slope: 12, elevation: 400, roadCondition: 90, bridgeCondition: 90, recentVerifiedIncidents: 0, historicalFloodCount: 0, historicalLandslideCount: 0, trafficLevel: 10, roadAccessibility: 90, incidentSeverity: 0, dataAgeMinutes: 10 } : {}),
      weather: scenario.id === "NH-2-KOHIMA"
        ? { rainfallIntensity: kohimaRainfall, temperatureC: 24, floodWarning: kohimaFlood, landslideWarning: kohimaLandslide, observedAt: new Date().toISOString(), dataLabel: LIVE_WEATHER_DATA_LABEL }
        : scenario.id === "NH-6-SHILLONG"
          ? { rainfallIntensity: shillongRainfall, temperatureC: 24, floodWarning: shillongRainfall > 30, landslideWarning: shillongRainfall > 20, observedAt: new Date().toISOString(), dataLabel: LIVE_WEATHER_DATA_LABEL }
          : { ...scenario.weather, dataLabel: LIVE_WEATHER_DATA_LABEL, observedAt: new Date().toISOString() },
    }),
  }));
}

describe("risk-aware route optimization", () => {
  it("selects the shortest safe route when the direct road is safe", () => {
    const result = optimizeRoute("KOHIMA", "IMPHAL");
    expect(result.status).toBe("RECOMMENDED");
    expect(result.route).toEqual(["KOHIMA", "IMPHAL"]);
    expect(result.safetyStatus).toBe("SAFE");
    expect(result.shortestRouteRejected).toBe(false);
    expect(result.shortestRoute?.routeLabel).toBe("Kohima → Imphal");
    expect(result.costBreakdown.distanceCost).toBe(result.distanceKm);
  });

  it("supports a different origin and destination selection", () => {
    const result = optimizeRoute("GUWAHATI", "SHILLONG");
    expect(result.route).toEqual(["GUWAHATI", "SHILLONG"]);
    expect(result.shortestRoute?.distanceKm).toBe(190);
  });

  it("rejects an unsafe shortest route and selects a safer viable alternative", () => {
    const result = optimizeRoute("GUWAHATI", "IMPHAL");
    expect(result.status).toBe("RECOMMENDED");
    expect(result.shortestRouteRejected).toBe(true);
    expect(result.reason).toContain("Shortest route rejected by safety validator.");
    expect(result.route).not.toContain("JORHAT");
    expect(result.route).toEqual(["GUWAHATI", "KOHIMA", "IMPHAL"]);
    expect(result.safetyStatus).toBe("CAUTION");
  });

  it("never selects rejected roads", () => {
    const result = optimizeRoute("GUWAHATI", "IMPHAL");
    expect(result.route).not.toContain("JORHAT");
    expect(result.rejectedAlternatives.some(item => item.label.includes("NH-37"))).toBe(true);
  });

  it("returns the explicit no-safe-route outcome when no viable path exists", () => {
    const result = optimizeRoute("GUWAHATI", "REMOTE_BLOCKED");
    expect(result.status).toBe("NO SAFE ROUTE AVAILABLE");
    expect(result.route).toEqual([]);
    expect(result.routeLabel).toBe("NO SAFE ROUTE AVAILABLE");
    expect(result.reason).toContain("Every known route is rejected");
  });

  it("passes live-weather risk through safety and route cost so selection can change", () => {
    const lowWeather = optimizeRoute("GUWAHATI", "IMPHAL", riskInputsForWeather(0, false, false, 100));
    const highWeather = optimizeRoute("GUWAHATI", "IMPHAL", riskInputsForWeather(100, true, true, 0));
    expect(lowWeather.weatherSource).toContain(LIVE_WEATHER_DATA_LABEL);
    expect(highWeather.weatherSource).toContain(LIVE_WEATHER_DATA_LABEL);
    expect(highWeather.riskProbability).toBeGreaterThan(lowWeather.riskProbability ?? -1);
    expect(highWeather.costBreakdown.riskPenalty).toBeGreaterThan(lowWeather.costBreakdown.riskPenalty);
    expect(lowWeather.safetyStatus).toBe("CAUTION");
    expect(highWeather.route).not.toContain("JORHAT");
    expect(highWeather.route).not.toEqual(lowWeather.route);
  });
});
