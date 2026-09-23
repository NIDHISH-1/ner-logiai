import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Route, Truck, TriangleAlert } from "lucide-react";
import { Role, roleKeyByLabel } from "./roleConfig";
import { trpc } from "@/lib/trpc";

type MapPoint = { label: string; point: [number, number]; color: string; layer: string; popup?: string };
type RouteNodeId = "GUWAHATI" | "JORHAT" | "KOHIMA" | "SHILLONG" | "IMPHAL" | "REMOTE_BLOCKED";
const points: MapPoint[] = [
  { label: "TRK-104 · Emergency Medicine", point: [26.1445, 91.7362] as [number, number], color: "#f97316", layer: "vehicles" },
  { label: "TRK-219 · Flood Relief Kits", point: [25.6747, 94.1086] as [number, number], color: "#38bdf8", layer: "vehicles" },
  { label: "Verified bridge damage · NH-37", point: [26.75, 94.2] as [number, number], color: "#ef4444", layer: "incidents" },
  { label: "Road blockage · NH-2 Kohima approach", point: [25.6747, 94.1086] as [number, number], color: "#ef4444", layer: "blocked" },
  { label: "Moderate rainfall · Shillong bypass", point: [25.5788, 91.8933] as [number, number], color: "#eab308", layer: "risk" },
];

const layersByRole: Record<Role, string[]> = {
  "Government / District Administrator": ["vehicles", "incidents", "blocked", "risk", "routes"],
  "Truck Driver": ["vehicles", "incidents", "risk", "routes"],
  "Field Officer": ["incidents", "blocked", "roads", "risk"],
  "Logistics Manager": ["vehicles", "routes", "risk"],
  "Emergency Response Team": ["incidents", "blocked", "risk", "routes", "vehicles"],
};

const labelsByRole: Record<Role, string> = {
  "Government / District Administrator": "All operational layers",
  "Truck Driver": "Assigned route · vehicle · relevant risks",
  "Field Officer": "Nearby incidents · roads · accessibility",
  "Logistics Manager": "Fleet · shipments · routes · delays",
  "Emergency Response Team": "Blockages · emergency corridors · critical assets",
};
const routePoints: Record<string, [number, number]> = { GUWAHATI: [26.1445, 91.7362], JORHAT: [26.75, 94.2], KOHIMA: [25.6747, 94.1086], SHILLONG: [25.5788, 91.8933], IMPHAL: [24.817, 93.9368] };

export function RoleMap({ role, compact = false }: { role: Role; compact?: boolean }) {
  const mapId = useMemo(() => `role-map-${roleKeyByLabel[role]}-${compact ? "compact" : "full"}`, [role, compact]);
  const [routeSelection, setRouteSelection] = useState<{ origin: RouteNodeId; destination: RouteNodeId }>({ origin: "GUWAHATI", destination: "IMPHAL" });
  const visibleLayers = layersByRole[role];
  const incidentsQuery = trpc.demo.incidents.useQuery();
  const riskQuery = trpc.demo.risk.useQuery();
  const routeQuery = trpc.demo.routes.useQuery(routeSelection);
  useEffect(() => { const handler = (event: Event) => { const detail = (event as CustomEvent<{ origin: RouteNodeId; destination: RouteNodeId }>).detail; if (detail?.origin && detail?.destination) setRouteSelection({ origin: detail.origin, destination: detail.destination }); }; window.addEventListener("ner-route-selection", handler); return () => window.removeEventListener("ner-route-selection", handler); }, []);
  const persistedPoints = useMemo<MapPoint[]>(() => (incidentsQuery.data ?? []).filter(incident => role === "Emergency Response Team" ? incident.status === "VERIFIED" && incident.severity === "CRITICAL" : role === "Truck Driver" ? ["HIGH", "CRITICAL"].includes(incident.severity) : true).map(incident => ({ label: `${incident.id} · ${incident.type}`, point: [Number(incident.latitude), Number(incident.longitude)] as [number, number], color: incident.severity === "CRITICAL" ? "#ef4444" : incident.severity === "HIGH" ? "#f97316" : "#eab308", layer: incident.roadAccessibility === "blocked" ? "blocked" : "incidents", popup: `<strong>${incident.id} · ${incident.type}</strong><br/><span>Severity: ${incident.severity}<br/>Location: ${incident.latitude}, ${incident.longitude}<br/>Reporter: ${incident.reporterRole}<br/>Timestamp: ${new Date(incident.occurredAt).toLocaleString()}<br/>Status: ${incident.status}<br/>Last updated: ${new Date(incident.updatedAt).toLocaleString()}</span>` })), [incidentsQuery.data, role]);
  const riskPoints = useMemo<MapPoint[]>(() => (riskQuery.data?.predictions ?? []).map((item, index) => ({ label: item.label, point: [[26.75, 94.2], [25.6747, 94.1086], [25.5788, 91.8933]][index] as [number, number], color: item.prediction.riskLevel === "CRITICAL" ? "#dc2626" : item.prediction.riskLevel === "HIGH" ? "#f97316" : item.prediction.riskLevel === "MEDIUM" ? "#eab308" : "#16a34a", layer: "risk", popup: `<strong>${item.prediction.riskLevel} risk · ${item.label}</strong><br/><span>Probability: ${item.prediction.probability}%<br/>Confidence: ${item.prediction.confidence}%<br/>Freshness: ${item.prediction.freshness}<br/>Factors: ${item.prediction.contributingFactors.join(" · ")}<br/><em>AI prediction — requires route safety validation.</em></span>` })), [riskQuery.data]);
  const mapPoints = [...points.filter(point => point.layer === "vehicles"), ...persistedPoints, ...riskPoints];

  useEffect(() => {
    const map = L.map(mapId, { zoomControl: false, attributionControl: true }).setView([25.8, 92.7], compact ? 6.2 : 6);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap contributors" }).addTo(map);

    if (visibleLayers.includes("routes")) {
      L.polyline([[26.1445, 91.7362], [26.75, 94.2], [25.6747, 94.1086]], { color: role === "Emergency Response Team" ? "#ef4444" : "#fb923c", weight: 5, opacity: 0.9, dashArray: "8 8" }).addTo(map).bindTooltip(role === "Emergency Response Team" ? "Emergency corridor · accessible in demo" : "Recommended corridor · role-scoped route layer");
      const selectedRoute = routeQuery.data?.recommendation.route.map(node => routePoints[node]).filter(Boolean) as [number, number][] | undefined;
      if (selectedRoute && selectedRoute.length > 1) L.polyline(selectedRoute, { color: "#16a34a", weight: 6, opacity: 0.9 }).addTo(map).bindTooltip("Recommended route · safety-aware A* prototype");
    }
    if (visibleLayers.includes("roads")) {
      L.polyline([[25.95, 91.7], [26.35, 92.45], [26.75, 94.2]], { color: "#22c55e", weight: 4, opacity: 0.75 }).addTo(map).bindTooltip("Accessible road segment · field status layer");
    }
    mapPoints.filter((point) => visibleLayers.includes(point.layer)).forEach((point) => {
      const icon = L.divIcon({ className: "custom-pin", html: `<span style="--pin:${point.color}" class="map-pin ${point.layer === "blocked" ? "incident" : ""}"></span>`, iconSize: [22, 22], iconAnchor: [11, 11] });
      L.marker(point.point, { icon }).addTo(map).bindPopup(point.popup ?? `<strong>${point.label}</strong><br/><span>Role-scoped simulated layer · last sync 7 min ago</span>`);
    });
    if (visibleLayers.includes("risk")) L.circle([25.58, 91.89], { radius: 36000, color: "#eab308", fillColor: "#eab308", fillOpacity: 0.12, weight: 1 }).addTo(map).bindTooltip("Moderate risk zone · role-scoped exposure");
    return () => { map.remove(); };
  }, [mapId, role, compact, visibleLayers, mapPoints, routeQuery.data]);

  return <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-[#dce8e7]">
    <div id={mapId} className={compact ? "h-[230px] w-full" : "h-[360px] w-full"} />
    <div className="absolute left-3 top-3 z-[500] flex items-center gap-2 rounded-lg bg-white/95 px-3 py-2 text-[10px] font-bold text-slate-700 shadow-lg"><MapPin size={13} className="text-orange-500" />{labelsByRole[role]}</div>
    <div className="absolute bottom-3 left-3 z-[500] flex gap-2 rounded-lg bg-white/95 px-3 py-2 text-[10px] text-slate-600 shadow-lg"><span><i className="legend-dot bg-emerald-500" />Accessible</span><span><i className="legend-dot bg-orange-500" />High risk</span><span><i className="legend-dot bg-red-500" />Blocked</span></div>
  </div>;
}

export function RoleMapIcon({ role }: { role: Role }) {
  if (role === "Truck Driver") return <Truck size={16} />;
  if (role === "Emergency Response Team") return <TriangleAlert size={16} />;
  return <Route size={16} />;
}
