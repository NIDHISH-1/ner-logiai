import { getDemoRiskPredictions, type RiskPrediction } from "./riskEngine";

export type SafetyStatus = "SAFE" | "CAUTION" | "REJECTED";
export type SafetyIncident = { type?: string; severity?: string; status?: string; roadAccessibility?: string };

export type SafetyInput = {
  roadAccessibility?: string;
  incidents?: SafetyIncident[];
  prediction?: RiskPrediction;
};

export type SafetyValidation = {
  status: SafetyStatus;
  reasons: string[];
  mlRiskProbability: number | null;
  mlConfidence: number | null;
  dataFreshness: RiskPrediction["freshness"] | "MISSING";
  advisory: "AI prediction — requires route safety validation.";
};

const isVerified = (incident: SafetyIncident) => incident.status === "VERIFIED";
const isCritical = (incident: SafetyIncident) => incident.severity === "CRITICAL";
const isBlockingType = (incident: SafetyIncident) => incident.type === "Road Blockage" || incident.type === "Bridge Damage";

export function validateRouteSafety(input: SafetyInput): SafetyValidation {
  const incidents = input.incidents ?? [];
  const prediction = input.prediction;
  const rejectedReasons: string[] = [];
  const cautionReasons: string[] = [];
  const verifiedBlocking = incidents.filter(incident => isVerified(incident) && isBlockingType(incident));
  const criticalVerified = incidents.filter(incident => isVerified(incident) && isCritical(incident));
  if (verifiedBlocking.some(incident => incident.type === "Road Blockage")) rejectedReasons.push("Verified road blockage");
  if (verifiedBlocking.some(incident => incident.type === "Bridge Damage")) rejectedReasons.push("Verified bridge damage");
  if (input.roadAccessibility && input.roadAccessibility !== "accessible") rejectedReasons.push(`Road is ${input.roadAccessibility}`);
  if (criticalVerified.length) rejectedReasons.push("Critical verified incident");
  if (rejectedReasons.length) return { status: "REJECTED", reasons: rejectedReasons, mlRiskProbability: prediction?.probability ?? null, mlConfidence: prediction?.confidence ?? null, dataFreshness: prediction?.freshness ?? "MISSING", advisory: "AI prediction — requires route safety validation." };
  if (!prediction) cautionReasons.push("Missing ML risk prediction");
  if (prediction?.riskLevel === "HIGH" || prediction?.riskLevel === "CRITICAL") cautionReasons.push(`ML risk is ${prediction.riskLevel} (${prediction.probability}%)`);
  if (prediction?.freshness === "STALE") cautionReasons.push("Risk data is stale");
  if (prediction?.freshness === "AGING") cautionReasons.push("Risk data is aging");
  if (incidents.some(incident => !isVerified(incident) && incident.status !== "REJECTED")) cautionReasons.push("Unresolved incident on or near route");
  if (!input.roadAccessibility) cautionReasons.push("Missing road accessibility status");
  if (!input.roadAccessibility && !incidents.length && !prediction) cautionReasons.push("Insufficient safety data");
  if (cautionReasons.length) return { status: "CAUTION", reasons: cautionReasons, mlRiskProbability: prediction?.probability ?? null, mlConfidence: prediction?.confidence ?? null, dataFreshness: prediction?.freshness ?? "MISSING", advisory: "AI prediction — requires route safety validation." };
  return { status: "SAFE", reasons: ["Road is accessible", "No blocking verified incident", "Fresh safety data available"], mlRiskProbability: prediction?.probability ?? null, mlConfidence: prediction?.confidence ?? null, dataFreshness: prediction?.freshness ?? "MISSING", advisory: "AI prediction — requires route safety validation." };
}

export function getDemoSafetyValidations() {
  const predictions = getDemoRiskPredictions();
  const incidentsByRoute: Record<string, SafetyIncident[]> = {
    "NH-37-JORHAT": [{ type: "Bridge Damage", severity: "CRITICAL", status: "VERIFIED", roadAccessibility: "blocked" }],
    "NH-2-KOHIMA": [{ type: "Landslide", severity: "HIGH", status: "UNDER_REVIEW", roadAccessibility: "accessible" }],
    "NH-6-SHILLONG": [],
  };
  return predictions.map(item => ({ id: item.id, label: item.label, validation: validateRouteSafety({ roadAccessibility: item.id === "NH-37-JORHAT" ? "blocked" : "accessible", incidents: incidentsByRoute[item.id], prediction: item.prediction }) }));
}
