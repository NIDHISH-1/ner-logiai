import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { getDemoRiskPredictions, LIVE_WEATHER_DATA_LABEL, predictRisk, riskModel, WEATHER_DATA_LABEL } from "./riskEngine";
import type { TrpcContext } from "./_core/context";

describe("synthetic random forest risk engine", () => {
  it("loads a labeled prototype forest", () => {
    expect(riskModel.name).toBe("synthetic-random-forest-v1");
    expect(riskModel.trainingRows).toBeGreaterThan(50);
    expect(riskModel.trees.length).toBeGreaterThan(10);
  });

  it("returns bounded probability, risk level, and confidence", () => {
    const prediction = predictRisk({ rainfallIntensity: 82, slope: 62, roadCondition: 38, bridgeCondition: 31, recentVerifiedIncidents: 2, incidentSeverity: 84, dataAgeMinutes: 18 });
    expect(prediction.probability).toBeGreaterThanOrEqual(0);
    expect(prediction.probability).toBeLessThanOrEqual(100);
    expect(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).toContain(prediction.riskLevel);
    expect(prediction.confidence).toBeGreaterThanOrEqual(0);
    expect(prediction.confidence).toBeLessThanOrEqual(100);
  });

  it("classifies the deterministic demo scenarios and includes factors", () => {
    const predictions = getDemoRiskPredictions();
    expect(predictions).toHaveLength(3);
    expect(predictions.some(item => ["HIGH", "CRITICAL"].includes(item.prediction.riskLevel))).toBe(true);
    expect(predictions.every(item => item.prediction.contributingFactors.length > 0)).toBe(true);
    expect(predictions.every(item => item.prediction.dataLabel === "SIMULATED / PROTOTYPE DATA")).toBe(true);
  });

  it("reduces confidence and flags stale or missing data", () => {
    const completeFresh = predictRisk({ rainfallIntensity: 30, slope: 20, roadCondition: 80, bridgeCondition: 80, roadAccessibility: 80, dataAgeMinutes: 10 });
    const incompleteStale = predictRisk({ rainfallIntensity: 30, dataAgeMinutes: 240 });
    expect(incompleteStale.freshness).toBe("STALE");
    expect(incompleteStale.missingFeatures.length).toBeGreaterThan(0);
    expect(incompleteStale.confidence).toBeLessThan(completeFresh.confidence);
    expect(incompleteStale.contributingFactors.some(factor => factor.startsWith("Missing inputs:"))).toBe(true);
    expect(incompleteStale.contributingFactors.some(factor => factor.includes("stale"))).toBe(true);
  });

  it("publishes advisory risk output through the demo router", async () => {
    const context: TrpcContext = { user: null, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
    const result = await appRouter.createCaller(context).demo.risk();
    expect(result.dataLabel).toBe("SIMULATED / PROTOTYPE DATA");
    expect(result.advisory).toContain("requires route safety validation");
    expect(result.predictions[0]?.prediction.model).toBe("synthetic-random-forest-v1");
    expect([WEATHER_DATA_LABEL, LIVE_WEATHER_DATA_LABEL]).toContain(result.weatherDataLabel);
  });

  it("passes weather features into prediction and explains their contribution", () => {
    const prediction = predictRisk({ rainfallIntensity: 80, slope: 40, roadCondition: 70, bridgeCondition: 70, dataAgeMinutes: 10, weather: { rainfallIntensity: 80, temperatureC: 24, floodWarning: true, landslideWarning: false, observedAt: new Date().toISOString(), dataLabel: LIVE_WEATHER_DATA_LABEL } });
    expect(prediction.weather?.rainfallIntensity).toBe(80);
    expect(prediction.weather?.floodWarning).toBe(true);
    expect(prediction.weatherFreshness).toBe("FRESH");
    expect(prediction.weatherContribution).toBeGreaterThan(0);
    expect(prediction.contributingFactors.some(factor => factor.includes("Weather contribution"))).toBe(true);
    expect(prediction.weatherDataLabel).toBe(LIVE_WEATHER_DATA_LABEL);
  });

  it("reduces confidence and flags stale or missing weather without silently treating it as fresh", () => {
    const fresh = predictRisk({ rainfallIntensity: 30, slope: 20, roadCondition: 80, bridgeCondition: 80, dataAgeMinutes: 10, weather: { rainfallIntensity: 30, temperatureC: 24, floodWarning: false, landslideWarning: false, observedAt: new Date().toISOString(), dataLabel: WEATHER_DATA_LABEL } });
    const stale = predictRisk({ rainfallIntensity: 30, slope: 20, roadCondition: 80, bridgeCondition: 80, dataAgeMinutes: 10, weather: { rainfallIntensity: 30, temperatureC: 24, floodWarning: false, landslideWarning: false, observedAt: new Date(Date.now() - 240 * 60_000).toISOString(), dataLabel: WEATHER_DATA_LABEL } });
    const missing = predictRisk({ rainfallIntensity: 30, slope: 20, roadCondition: 80, bridgeCondition: 80, dataAgeMinutes: 10 });
    expect(stale.weatherFreshness).toBe("STALE");
    expect(stale.confidence).toBeLessThan(fresh.confidence);
    expect(stale.contributingFactors.some(factor => factor.includes("Weather data is stale"))).toBe(true);
    expect(missing.weatherFreshness).toBe("MISSING");
    expect(missing.weather).toBeNull();
    expect(missing.confidence).toBeLessThan(fresh.confidence);
    expect(missing.contributingFactors).toContain("Weather data missing; confidence reduced");
  });
});
