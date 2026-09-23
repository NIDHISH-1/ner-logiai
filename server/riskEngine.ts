export const RISK_DATA_LABEL = "SIMULATED / PROTOTYPE DATA" as const;
export const WEATHER_DATA_LABEL = "SIMULATED WEATHER DATA" as const;
export const LIVE_WEATHER_DATA_LABEL = "LIVE · OPENWEATHER" as const;

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type WeatherFreshness = "FRESH" | "AGING" | "STALE" | "MISSING";
export type RiskFeatureName = keyof RiskFeatures;

export type WeatherFeatures = {
  rainfallIntensity: number;
  temperatureC: number;
  floodWarning: boolean;
  landslideWarning: boolean;
  observedAt: string;
  dataLabel: typeof WEATHER_DATA_LABEL | typeof LIVE_WEATHER_DATA_LABEL;
};

export type RiskFeatures = {
  rainfallIntensity: number;
  slope: number;
  elevation: number;
  roadCondition: number;
  bridgeCondition: number;
  recentVerifiedIncidents: number;
  historicalFloodCount: number;
  historicalLandslideCount: number;
  trafficLevel: number;
  roadAccessibility: number;
  incidentSeverity: number;
  dataAgeMinutes: number;
};

export type RiskPrediction = {
  model: "synthetic-random-forest-v1";
  dataLabel: typeof RISK_DATA_LABEL;
  probability: number;
  riskLevel: RiskLevel;
  confidence: number;
  freshness: "FRESH" | "AGING" | "STALE";
  missingFeatures: RiskFeatureName[];
  contributingFactors: string[];
  features: RiskFeatures;
  weather: WeatherFeatures | null;
  weatherDataLabel: typeof WEATHER_DATA_LABEL | typeof LIVE_WEATHER_DATA_LABEL;
  weatherFreshness: WeatherFreshness;
  weatherContribution: number;
  advisory: "AI prediction — requires route safety validation.";
};

type Tree = { feature: RiskFeatureName; threshold: number; left: number; right: number };
type TrainingRow = { features: RiskFeatures; label: 0 | 1 };

const featureNames: RiskFeatureName[] = ["rainfallIntensity", "slope", "elevation", "roadCondition", "bridgeCondition", "recentVerifiedIncidents", "historicalFloodCount", "historicalLandslideCount", "trafficLevel", "roadAccessibility", "incidentSeverity"];
const medians: RiskFeatures = { rainfallIntensity: 42, slope: 28, elevation: 520, roadCondition: 45, bridgeCondition: 44, recentVerifiedIncidents: 1, historicalFloodCount: 3, historicalLandslideCount: 2, trafficLevel: 42, roadAccessibility: 52, incidentSeverity: 32, dataAgeMinutes: 30 };

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const normalize = (name: RiskFeatureName, value: number) => {
  if (name === "elevation") return clamp(value / 20);
  if (["recentVerifiedIncidents", "historicalFloodCount", "historicalLandslideCount"].includes(name)) return clamp(value * 10);
  return clamp(value);
};
const disruptionScore = (features: RiskFeatures) => clamp(
  features.rainfallIntensity * 0.18 + features.slope * 0.09 + features.elevation / 20 * 0.04 + (100 - features.roadCondition) * 0.16 + (100 - features.bridgeCondition) * 0.14 + features.recentVerifiedIncidents * 4 + features.historicalFloodCount * 1.4 + features.historicalLandslideCount * 1.3 + features.trafficLevel * 0.07 + (100 - features.roadAccessibility) * 0.08 + features.incidentSeverity * 0.14,
);

function syntheticRow(index: number): TrainingRow {
  const features: RiskFeatures = {
    rainfallIntensity: (index * 17 + 11) % 101,
    slope: (index * 23 + 7) % 81,
    elevation: 120 + ((index * 137) % 1800),
    roadCondition: 22 + ((index * 29) % 79),
    bridgeCondition: 18 + ((index * 31) % 82),
    recentVerifiedIncidents: index % 6,
    historicalFloodCount: (index * 3) % 12,
    historicalLandslideCount: (index * 5) % 10,
    trafficLevel: (index * 19 + 13) % 101,
    roadAccessibility: 20 + ((index * 37) % 81),
    incidentSeverity: (index * 13 + 3) % 101,
    dataAgeMinutes: 15 + ((index * 11) % 180),
  };
  const score = disruptionScore(features) + ((index % 5) - 2) * 2;
  return { features, label: score >= 52 ? 1 : 0 };
}

const trainingSet: TrainingRow[] = Array.from({ length: 96 }, (_, index) => syntheticRow(index));

function trainForest(rows: TrainingRow[], treeCount = 31): Tree[] {
  return Array.from({ length: treeCount }, (_, treeIndex) => {
    const bootstrap = Array.from({ length: rows.length }, (_, index) => rows[(index * 7 + treeIndex * 11) % rows.length]);
    const candidates = featureNames.filter((_name, index) => (index + treeIndex) % 3 !== 0);
    let best: { feature: RiskFeatureName; threshold: number; gain: number } | null = null;
    for (const feature of candidates) {
      const sorted = bootstrap.map(row => row.features[feature]).sort((a, b) => a - b);
      const threshold = sorted[Math.floor(sorted.length * (0.35 + (treeIndex % 3) * 0.1))] ?? medians[feature];
      const left = bootstrap.filter(row => row.features[feature] <= threshold);
      const right = bootstrap.filter(row => row.features[feature] > threshold);
      if (!left.length || !right.length) continue;
      const leftRate = left.reduce((sum, row) => sum + row.label, 0) / left.length;
      const rightRate = right.reduce((sum, row) => sum + row.label, 0) / right.length;
      const gain = Math.abs(leftRate - rightRate) * Math.sqrt(left.length * right.length);
      if (!best || gain > best.gain) best = { feature, threshold, gain };
    }
    const chosen = best ?? { feature: "rainfallIntensity" as RiskFeatureName, threshold: 50, gain: 0 };
    const leftRows = bootstrap.filter(row => row.features[chosen.feature] <= chosen.threshold);
    const rightRows = bootstrap.filter(row => row.features[chosen.feature] > chosen.threshold);
    return { feature: chosen.feature, threshold: chosen.threshold, left: leftRows.reduce((sum, row) => sum + row.label, 0) / Math.max(1, leftRows.length), right: rightRows.reduce((sum, row) => sum + row.label, 0) / Math.max(1, rightRows.length) };
  });
}

export const riskModel = { name: "synthetic-random-forest-v1" as const, trees: trainForest(trainingSet), trainingRows: trainingSet.length };

function classify(probability: number): RiskLevel {
  if (probability >= 75) return "CRITICAL";
  if (probability >= 50) return "HIGH";
  if (probability >= 25) return "MEDIUM";
  return "LOW";
}

function freshnessFor(age: number): RiskPrediction["freshness"] {
  if (age > 180) return "STALE";
  if (age > 60) return "AGING";
  return "FRESH";
}

function weatherFreshnessFor(observedAt?: string): WeatherFreshness {
  if (!observedAt) return "MISSING";
  const ageMinutes = Math.max(0, (Date.now() - new Date(observedAt).getTime()) / 60_000);
  if (!Number.isFinite(ageMinutes)) return "MISSING";
  if (ageMinutes > 180) return "STALE";
  if (ageMinutes > 60) return "AGING";
  return "FRESH";
}

function weatherContribution(weather: WeatherFeatures | undefined, freshness: WeatherFreshness) {
  if (!weather || freshness === "MISSING") return 0;
  const rainfall = clamp(weather.rainfallIntensity) * 0.12;
  const temperature = Math.max(0, Math.abs(weather.temperatureC - 24) - 8) * 0.35;
  const warnings = (weather.floodWarning ? 12 : 0) + (weather.landslideWarning ? 12 : 0);
  return Math.round(clamp(rainfall + temperature + warnings, 0, 35));
}

const factorLabels: Record<RiskFeatureName, string> = {
  rainfallIntensity: "Heavy rainfall intensity",
  slope: "High slope exposure",
  elevation: "High-elevation corridor",
  roadCondition: "Poor road condition",
  bridgeCondition: "Weak bridge condition",
  recentVerifiedIncidents: "Recent verified incidents",
  historicalFloodCount: "Historical flood exposure",
  historicalLandslideCount: "Historical landslide exposure",
  trafficLevel: "Elevated traffic level",
  roadAccessibility: "Reduced road accessibility",
  incidentSeverity: "High current incident severity",
  dataAgeMinutes: "Aging operational data",
};

export function predictRisk(input: Partial<RiskFeatures> & { weather?: WeatherFeatures }): RiskPrediction {
  const { weather, ...riskInput } = input;
  const missingFeatures = featureNames.filter(name => riskInput[name] === undefined || !Number.isFinite(riskInput[name]));
  const features = { ...medians, ...Object.fromEntries(Object.entries(riskInput).filter(([, value]) => typeof value === "number" && Number.isFinite(value))) } as RiskFeatures;
  const treeVotes = riskModel.trees.map(tree => features[tree.feature] <= tree.threshold ? tree.left : tree.right);
  const baseProbability = Math.round((treeVotes.reduce((sum, vote) => sum + vote, 0) / treeVotes.length) * 100);
  const weatherFreshness = weatherFreshnessFor(weather?.observedAt);
  const weatherAdjustment = weatherContribution(weather, weatherFreshness);
  const probability = Math.round(clamp(baseProbability + weatherAdjustment));
  const agreement = Math.abs((baseProbability / 100) - 0.5) * 2;
  const freshness = freshnessFor(features.dataAgeMinutes);
  const freshnessFactor = freshness === "STALE" ? 0.55 : freshness === "AGING" ? 0.8 : 1;
  const weatherFactor = weatherFreshness === "MISSING" ? 0.72 : weatherFreshness === "STALE" ? 0.78 : weatherFreshness === "AGING" ? 0.9 : 1;
  const completenessFactor = Math.max(0.45, 1 - missingFeatures.length * 0.055);
  const confidence = Math.round(clamp(agreement * 100 * freshnessFactor * weatherFactor * completenessFactor));
  const rankedFactors = featureNames.map(name => ({ name, contribution: Math.abs(disruptionScore({ ...features, [name]: name === "dataAgeMinutes" ? features[name] : features[name] }) - disruptionScore({ ...features, [name]: medians[name] })) })).sort((a, b) => b.contribution - a.contribution).slice(0, 4).map(item => factorLabels[item.name]);
  const weatherFactors = weatherFreshness === "MISSING" ? ["Weather data missing; confidence reduced"] : [weatherContribution(weather, weatherFreshness) > 0 ? `Weather contribution +${weatherAdjustment} risk points` : "Weather contribution low", ...(weather?.floodWarning ? ["Flood warning active"] : []), ...(weather?.landslideWarning ? ["Landslide warning active"] : []), ...(weatherFreshness !== "FRESH" ? [`Weather data is ${weatherFreshness.toLowerCase()}`] : [])];
  const contributingFactors = [...(missingFeatures.length ? [`Missing inputs: ${missingFeatures.join(", ")}`] : []), ...(freshness !== "FRESH" ? [`Data freshness is ${freshness.toLowerCase()} (${features.dataAgeMinutes} min old)`] : []), ...weatherFactors, ...rankedFactors];
  return { model: riskModel.name, dataLabel: RISK_DATA_LABEL, probability, riskLevel: classify(probability), confidence, freshness, missingFeatures, contributingFactors, features, weather: weather ?? null, weatherDataLabel: weather?.dataLabel ?? WEATHER_DATA_LABEL, weatherFreshness, weatherContribution: weatherAdjustment, advisory: "AI prediction — requires route safety validation." };
}

const simulatedObservedAt = (ageMinutes: number) => new Date(Date.now() - ageMinutes * 60_000).toISOString();

export const demoRiskScenarios = [
  { id: "NH-37-JORHAT", label: "NH-37 · Jorhat corridor", features: { rainfallIntensity: 82, slope: 62, elevation: 410, roadCondition: 38, bridgeCondition: 31, recentVerifiedIncidents: 2, historicalFloodCount: 7, historicalLandslideCount: 3, trafficLevel: 58, roadAccessibility: 28, incidentSeverity: 84, dataAgeMinutes: 18 }, weather: { rainfallIntensity: 82, temperatureC: 24, floodWarning: true, landslideWarning: false, observedAt: simulatedObservedAt(18), dataLabel: WEATHER_DATA_LABEL } },
  { id: "NH-2-KOHIMA", label: "NH-2 · Kohima approach", features: { rainfallIntensity: 48, slope: 66, elevation: 1280, roadCondition: 56, bridgeCondition: 60, recentVerifiedIncidents: 1, historicalFloodCount: 2, historicalLandslideCount: 6, trafficLevel: 45, roadAccessibility: 52, incidentSeverity: 60, dataAgeMinutes: 32 }, weather: { rainfallIntensity: 48, temperatureC: 22, floodWarning: false, landslideWarning: true, observedAt: simulatedObservedAt(32), dataLabel: WEATHER_DATA_LABEL } },
  { id: "NH-6-SHILLONG", label: "NH-6 · Shillong bypass", features: { rainfallIntensity: 67, slope: 48, elevation: 1496, roadCondition: 70, bridgeCondition: 72, recentVerifiedIncidents: 0, historicalFloodCount: 4, historicalLandslideCount: 2, trafficLevel: 39, roadAccessibility: 76, incidentSeverity: 35, dataAgeMinutes: 74 }, weather: { rainfallIntensity: 67, temperatureC: 19, floodWarning: false, landslideWarning: false, observedAt: simulatedObservedAt(74), dataLabel: WEATHER_DATA_LABEL } },
];

export function getDemoRiskPredictions() {
  return demoRiskScenarios.map(scenario => ({ id: scenario.id, label: scenario.label, prediction: predictRisk({ ...scenario.features, weather: scenario.weather }) }));
}
