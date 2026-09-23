import { getDemoRiskPredictions, type RiskPrediction } from "./riskEngine";
import { getDemoSafetyValidations, type SafetyStatus, validateRouteSafety, type SafetyValidation } from "./safetyEngine";

export type RouteNodeId = "GUWAHATI" | "JORHAT" | "KOHIMA" | "SHILLONG" | "IMPHAL" | "REMOTE_BLOCKED";
export type RouteEdge = { from: RouteNodeId; to: RouteNodeId; label: string; distanceKm: number; etaMinutes: number; riskId?: string; roadAccessibility: "accessible" | "restricted" | "blocked"; incidents?: { type: string; severity: string; status: string }[] };
export type RouteRiskInput = { id: string; prediction: RiskPrediction };

export type RouteRecommendation = {
  origin: RouteNodeId;
  destination: RouteNodeId;
  status: "RECOMMENDED" | "NO SAFE ROUTE AVAILABLE";
  route: RouteNodeId[];
  routeLabel: string;
  distanceKm: number | null;
  etaMinutes: number | null;
  riskProbability: number | null;
  confidence: number | null;
  safetyStatus: SafetyStatus | "UNAVAILABLE";
  weatherSource: string;
  weatherFreshness: RiskPrediction["weatherFreshness"] | "MISSING";
  weatherObservedAt: string | null;
  reason: string;
  shortestRouteRejected: boolean;
  shortestRouteLabel: string | null;
  shortestRoute: RouteSummary | null;
  costBreakdown: { distanceCost: number; riskPenalty: number; delayPenalty: number; safetyPenalty: number };
  rejectedAlternatives: { label: string; reason: string }[];
  advisory: "AI prediction — requires route safety validation.";
};

export type RouteSummary = { route: RouteNodeId[]; routeLabel: string; distanceKm: number; etaMinutes: number; riskProbability: number; confidence: number | null; safetyStatus: SafetyStatus };

type Candidate = { edge: RouteEdge; risk: RiskPrediction | undefined; safety: SafetyValidation };
type QueueItem = { node: RouteNodeId; cost: number; path: RouteNodeId[]; candidates: Candidate[] };

const coordinates: Record<RouteNodeId, [number, number]> = {
  GUWAHATI: [26.1445, 91.7362], JORHAT: [26.75, 94.2], KOHIMA: [25.6747, 94.1086], SHILLONG: [25.5788, 91.8933], IMPHAL: [24.817, 93.9368], REMOTE_BLOCKED: [27.2, 95.2],
};

export const simulatedRoadGraph: RouteEdge[] = [
  { from: "GUWAHATI", to: "JORHAT", label: "NH-37 · Jorhat corridor", distanceKm: 140, etaMinutes: 145, riskId: "NH-37-JORHAT", roadAccessibility: "blocked", incidents: [{ type: "Bridge Damage", severity: "CRITICAL", status: "VERIFIED" }] },
  { from: "JORHAT", to: "IMPHAL", label: "NH-39 · eastern connector", distanceKm: 120, etaMinutes: 150, roadAccessibility: "accessible" },
  { from: "GUWAHATI", to: "KOHIMA", label: "NH-2 · Kohima approach", distanceKm: 220, etaMinutes: 250, riskId: "NH-2-KOHIMA", roadAccessibility: "accessible", incidents: [{ type: "Landslide", severity: "HIGH", status: "UNDER_REVIEW" }] },
  { from: "KOHIMA", to: "IMPHAL", label: "NH-39 · Kohima-Imphal", distanceKm: 160, etaMinutes: 190, roadAccessibility: "accessible" },
  { from: "GUWAHATI", to: "SHILLONG", label: "NH-6 · Shillong bypass", distanceKm: 190, etaMinutes: 220, riskId: "NH-6-SHILLONG", roadAccessibility: "accessible" },
  { from: "SHILLONG", to: "IMPHAL", label: "NH-44 · southern connector", distanceKm: 250, etaMinutes: 300, roadAccessibility: "accessible" },
  { from: "GUWAHATI", to: "REMOTE_BLOCKED", label: "District spur · blocked access", distanceKm: 80, etaMinutes: 120, roadAccessibility: "blocked", incidents: [{ type: "Road Blockage", severity: "HIGH", status: "VERIFIED" }] },
];

const defaultPredictions = getDemoRiskPredictions();
const predictionById = new Map(defaultPredictions.map(item => [item.id, item.prediction]));
const safetyById = new Map(getDemoSafetyValidations().map(item => [item.id, item.validation]));
const baselinePrediction: RiskPrediction = { model: "synthetic-random-forest-v1", dataLabel: "SIMULATED / PROTOTYPE DATA", probability: 12, riskLevel: "LOW", confidence: 91, freshness: "FRESH", missingFeatures: [], contributingFactors: ["Stable road condition", "Weather contribution low"], features: { rainfallIntensity: 15, slope: 10, elevation: 400, roadCondition: 84, bridgeCondition: 86, recentVerifiedIncidents: 0, historicalFloodCount: 1, historicalLandslideCount: 0, trafficLevel: 20, roadAccessibility: 90, incidentSeverity: 0, dataAgeMinutes: 12 }, weather: null, weatherDataLabel: "SIMULATED WEATHER DATA", weatherFreshness: "MISSING", weatherContribution: 0, advisory: "AI prediction — requires route safety validation." };

function edgeSafety(edge: RouteEdge, predictions: Map<string, RiskPrediction>, useStoredSafety: boolean): Candidate {
  const risk = edge.riskId ? predictions.get(edge.riskId) : baselinePrediction;
  const safety = (edge.riskId && useStoredSafety && edge.roadAccessibility === "accessible")
    ? safetyById.get(edge.riskId) ?? validateRouteSafety({ roadAccessibility: edge.roadAccessibility, incidents: edge.incidents, prediction: risk })
    : validateRouteSafety({ roadAccessibility: edge.roadAccessibility, incidents: edge.incidents, prediction: risk });
  return { edge, risk, safety };
}

function heuristic(from: RouteNodeId, to: RouteNodeId) {
  const [fromLat, fromLon] = coordinates[from];
  const [toLat, toLon] = coordinates[to];
  return Math.hypot(fromLat - toLat, fromLon - toLon) * 18;
}

function edgeCost(candidate: Candidate) {
  const riskPenalty = (candidate.risk?.probability ?? 50) * 4;
  const delayPenalty = candidate.edge.etaMinutes * 0.12;
  const cautionPenalty = candidate.safety.status === "CAUTION" ? 115 : 0;
  return candidate.edge.distanceKm + riskPenalty + delayPenalty + cautionPenalty;
}

export function buildRoadGraphWithIncidents(
  activeIncidents?: Array<{
    id?: string;
    type?: string;
    severity?: string;
    status?: string;
    description?: string;
    roadAccessibility?: string | null;
    latitude?: string | number | null;
    longitude?: string | number | null;
    isDemo?: boolean;
  }>
): RouteEdge[] {
  if (!activeIncidents || activeIncidents.length === 0) {
    return simulatedRoadGraph;
  }

  const newOrUpdatedIncidents = activeIncidents.filter((inc) => {
    if (inc.id === "INC-2407" && inc.roadAccessibility !== "blocked") return false;
    return true;
  });

  return simulatedRoadGraph.map((edge) => {
    const relevant = newOrUpdatedIncidents.filter((inc) => {
      const desc = (inc.description || "").toUpperCase();
      const type = (inc.type || "").toUpperCase();
      if (edge.riskId === "NH-37-JORHAT" && (desc.includes("NH-37") || desc.includes("JORHAT") || type.includes("JORHAT"))) return true;
      if (edge.riskId === "NH-2-KOHIMA" && (desc.includes("NH-2") || desc.includes("KOHIMA") || desc.includes("DIMAPUR") || type.includes("KOHIMA"))) return true;
      if (edge.riskId === "NH-6-SHILLONG" && (desc.includes("NH-6") || desc.includes("SHILLONG") || type.includes("SHILLONG"))) return true;
      if (edge.from === "GUWAHATI" && edge.to === "REMOTE_BLOCKED" && (desc.includes("REMOTE") || desc.includes("DISTRICT SPUR"))) return true;
      return false;
    });

    if (relevant.length === 0) return edge;

    const hasVerifiedBlocking = relevant.some(
      (r) => r.status === "VERIFIED" && (r.roadAccessibility === "blocked" || r.severity === "CRITICAL")
    );
    const hasExplicitBlocked = relevant.some((r) => r.roadAccessibility === "blocked");

    const mergedIncidents = [
      ...(edge.incidents ?? []),
      ...relevant.map((r) => ({
        type: r.type ?? "Incident",
        severity: r.severity ?? "MODERATE",
        status: r.status ?? "UNVERIFIED",
        roadAccessibility: r.roadAccessibility ?? undefined,
      })),
    ];

    return {
      ...edge,
      roadAccessibility: (hasVerifiedBlocking || hasExplicitBlocked)
        ? ("blocked" as const)
        : edge.roadAccessibility,
      incidents: mergedIncidents,
    };
  });
}

function shortestByDistance(origin: RouteNodeId, destination: RouteNodeId, roadGraph: RouteEdge[] = simulatedRoadGraph) {
  const queue: { node: RouteNodeId; distance: number; path: RouteNodeId[]; edges: RouteEdge[] }[] = [{ node: origin, distance: 0, path: [origin], edges: [] }];
  const visited = new Set<RouteNodeId>();
  while (queue.length) {
    queue.sort((a, b) => a.distance - b.distance);
    const current = queue.shift()!;
    if (current.node === destination) return current;
    if (visited.has(current.node)) continue;
    visited.add(current.node);
    for (const edge of roadGraph.filter(item => item.from === current.node)) queue.push({ node: edge.to, distance: current.distance + edge.distanceKm, path: [...current.path, edge.to], edges: [...current.edges, edge] });
  }
  return null;
}

function formatRoute(path: RouteNodeId[]) {
  return path.map(node => node.replace("GUWAHATI", "Guwahati").replace("JORHAT", "Jorhat").replace("KOHIMA", "Kohima").replace("SHILLONG", "Shillong").replace("IMPHAL", "Imphal").replace("REMOTE_BLOCKED", "Remote district")).join(" → ");
}

function summarizeCandidates(path: RouteNodeId[], candidates: Candidate[]): RouteSummary {
  const risks = candidates.map(item => item.risk).filter(Boolean) as RiskPrediction[];
  const safetyStatus: SafetyStatus = candidates.some(item => item.safety.status === "REJECTED") ? "REJECTED" : candidates.some(item => item.safety.status === "CAUTION") ? "CAUTION" : "SAFE";
  return { route: path, routeLabel: formatRoute(path), distanceKm: candidates.reduce((sum, item) => sum + item.edge.distanceKm, 0), etaMinutes: candidates.reduce((sum, item) => sum + item.edge.etaMinutes, 0), riskProbability: risks.length ? Math.round(risks.reduce((sum, item) => sum + item.probability, 0) / risks.length) : 0, confidence: risks.length ? Math.min(...risks.map(item => item.confidence)) : null, safetyStatus };
}

function weatherDetails(candidates: Candidate[]) {
  const risks = candidates.map(item => item.risk).filter(Boolean) as RiskPrediction[];
  const sources = Array.from(new Set(risks.map(item => item.weatherDataLabel)));
  const freshnessOrder: RiskPrediction["weatherFreshness"][] = ["MISSING", "STALE", "AGING", "FRESH"];
  const freshness = risks.reduce<RiskPrediction["weatherFreshness"]>((worst, risk) => freshnessOrder.indexOf(risk.weatherFreshness) < freshnessOrder.indexOf(worst) ? risk.weatherFreshness : worst, "FRESH");
  const observed = risks.map(item => item.weather?.observedAt).filter(Boolean).sort().at(-1) ?? null;
  return { weatherSource: sources.join(" / ") || "SIMULATED WEATHER DATA", weatherFreshness: freshness, weatherObservedAt: observed };
}

export function optimizeRoute(
  origin: RouteNodeId,
  destination: RouteNodeId,
  liveRiskInputs?: readonly RouteRiskInput[],
  roadGraph: RouteEdge[] = simulatedRoadGraph
): RouteRecommendation {
  const useStoredSafety = !liveRiskInputs;
  const predictions = liveRiskInputs ? new Map(liveRiskInputs.map(item => [item.id, item.prediction])) : predictionById;
  const shortest = shortestByDistance(origin, destination, roadGraph);
  const shortestRouteRejected = Boolean(shortest?.edges.some(edge => edgeSafety(edge, predictions, useStoredSafety).safety.status === "REJECTED"));
  const shortestRoute = shortest ? summarizeCandidates(shortest.path, shortest.edges.map(edge => edgeSafety(edge, predictions, useStoredSafety))) : null;
  const queue: QueueItem[] = [{ node: origin, cost: 0, path: [origin], candidates: [] }];
  const bestCost = new Map<RouteNodeId, number>();
  let solution: QueueItem | undefined;
  while (queue.length) {
    queue.sort((a, b) => (a.cost + heuristic(a.node, destination)) - (b.cost + heuristic(b.node, destination)));
    const current = queue.shift()!;
    if (current.node === destination) { solution = current; break; }
    if ((bestCost.get(current.node) ?? Infinity) <= current.cost) continue;
    bestCost.set(current.node, current.cost);
    for (const edge of roadGraph.filter(item => item.from === current.node)) {
      const candidate = edgeSafety(edge, predictions, useStoredSafety);
      if (candidate.safety.status === "REJECTED") continue;
      if (current.path.includes(edge.to)) continue;
      queue.push({ node: edge.to, cost: current.cost + edgeCost(candidate), path: [...current.path, edge.to], candidates: [...current.candidates, candidate] });
    }
  }
  const rejectedEdges = (shortest?.edges ?? []).filter(edge => edgeSafety(edge, predictions, useStoredSafety).safety.status === "REJECTED");
  const otherRejected = roadGraph.filter(edge => !shortest?.edges.includes(edge) && edgeSafety(edge, predictions, useStoredSafety).safety.status === "REJECTED");
  const rejectedAlternatives = [...rejectedEdges, ...otherRejected].map(edge => ({
    label: edge.label,
    reason: edgeSafety(edge, predictions, useStoredSafety).safety.reasons.join("; "),
  }));
  if (!solution) return { origin, destination, status: "NO SAFE ROUTE AVAILABLE", route: [], routeLabel: "NO SAFE ROUTE AVAILABLE", distanceKm: null, etaMinutes: null, riskProbability: null, confidence: null, safetyStatus: "UNAVAILABLE", ...weatherDetails(shortest?.edges.map(edge => edgeSafety(edge, predictions, useStoredSafety)) ?? []), reason: "Every known route is rejected by the safety validator or no graph connection exists.", shortestRouteRejected, shortestRouteLabel: shortest ? formatRoute(shortest.path) : null, shortestRoute, costBreakdown: { distanceCost: shortest?.distance ?? 0, riskPenalty: shortest ? shortest.edges.map(edge => edgeSafety(edge, predictions, useStoredSafety)).reduce((sum, item) => sum + (item.risk?.probability ?? 0) * 4, 0) : 0, delayPenalty: shortest ? shortest.edges.reduce((sum, item) => sum + item.etaMinutes * 0.12, 0) : 0, safetyPenalty: shortest ? shortest.edges.map(edge => edgeSafety(edge, predictions, useStoredSafety)).filter(item => item.safety.status === "CAUTION").length * 115 : 0 }, rejectedAlternatives, advisory: "AI prediction — requires route safety validation." };
  const distanceKm = solution.candidates.reduce((sum, item) => sum + item.edge.distanceKm, 0);
  const etaMinutes = solution.candidates.reduce((sum, item) => sum + item.edge.etaMinutes, 0);
  const risks = solution.candidates.map(item => item.risk).filter(Boolean) as RiskPrediction[];
  const riskProbability = risks.length ? Math.round(risks.reduce((sum, item) => sum + item.probability, 0) / risks.length) : 0;
  const confidence = risks.length ? Math.min(...risks.map(item => item.confidence)) : null;
  const safetyStatus: SafetyStatus = solution.candidates.some(item => item.safety.status === "CAUTION") ? "CAUTION" : "SAFE";
  const reason = shortestRouteRejected ? "Shortest route rejected by safety validator. Recommended this viable alternative with lower safety exposure." : safetyStatus === "CAUTION" ? "Recommended route balances distance with available safety data; proceed only after human validation." : "Shortest viable route is accessible with no blocking verified incident.";
  const costBreakdown = { distanceCost: distanceKm, riskPenalty: solution.candidates.reduce((sum, item) => sum + (item.risk?.probability ?? 0) * 4, 0), delayPenalty: solution.candidates.reduce((sum, item) => sum + item.edge.etaMinutes * 0.12, 0), safetyPenalty: solution.candidates.filter(item => item.safety.status === "CAUTION").length * 115 };
  return { origin, destination, status: "RECOMMENDED", route: solution.path, routeLabel: formatRoute(solution.path), distanceKm, etaMinutes, riskProbability, confidence, safetyStatus, ...weatherDetails(solution.candidates), reason, shortestRouteRejected, shortestRouteLabel: shortest ? formatRoute(shortest.path) : null, shortestRoute, costBreakdown, rejectedAlternatives, advisory: "AI prediction — requires route safety validation." };
}

export const demoRouteRecommendations = {
  assigned: optimizeRoute("GUWAHATI", "IMPHAL"),
  blocked: optimizeRoute("GUWAHATI", "REMOTE_BLOCKED"),
};
