import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Route, Truck, TriangleAlert, Radio, Activity, CloudOff } from "lucide-react";
import { Role, roleKeyByLabel } from "./roleConfig";
import { trpc } from "@/lib/trpc";
import { getPersistedCache, setPersistedCache } from "@/lib/persistentCache";

type MapPoint = { label: string; point: [number, number]; color: string; layer: string; popup?: string; iconHtml?: string };
type RouteNodeId = "GUWAHATI" | "JORHAT" | "KOHIMA" | "SHILLONG" | "IMPHAL" | "REMOTE_BLOCKED";

const layersByRole: Record<Role, string[]> = {
  "Government / District Administrator": ["vehicles", "incidents", "blocked", "risk", "routes", "roads"],
  "Truck Driver": ["vehicles", "incidents", "risk", "routes", "roads"],
  "Field Officer": ["incidents", "blocked", "roads", "risk"],
  "Logistics Manager": ["vehicles", "routes", "risk", "roads"],
  "Emergency Response Team": ["incidents", "blocked", "risk", "routes", "vehicles", "roads"],
};

const labelsByRole: Record<Role, string> = {
  "Government / District Administrator": "All operational layers · Live surveillance",
  "Truck Driver": "Assigned vehicle TRK-104 · Route · Disruption alerts",
  "Field Officer": "Nearby incidents · Road accessibility · Field reports",
  "Logistics Manager": "Fleet positions · Delays · Priority cargo",
  "Emergency Response Team": "Emergency corridors · Blockages · Critical convoys",
};

const routePoints: Record<string, [number, number]> = {
  GUWAHATI: [26.1445, 91.7362],
  JORHAT: [26.75, 94.2],
  KOHIMA: [25.6747, 94.1086],
  SHILLONG: [25.5788, 91.8933],
  IMPHAL: [24.817, 93.9368],
};

// Known corridors in Northeast region with real coordinates
const corridorGeometries: { id: string; name: string; coordinates: [number, number][]; defaultStatus: "accessible" | "restricted" | "blocked" }[] = [
  {
    id: "NH-37-JORHAT",
    name: "NH-37 (Guwahati – Nagaon – Jorhat)",
    coordinates: [[26.1445, 91.7362], [26.345, 92.684], [26.75, 94.20]],
    defaultStatus: "blocked",
  },
  {
    id: "NH-2-KOHIMA",
    name: "NH-2 (Dimapur – Kohima – Imphal)",
    coordinates: [[25.906, 93.727], [25.6747, 94.1086], [24.817, 93.9368]],
    defaultStatus: "restricted",
  },
  {
    id: "NH-6-SHILLONG",
    name: "NH-6 (Guwahati – Shillong – Silchar bypass)",
    coordinates: [[26.1445, 91.7362], [25.5788, 91.8933], [24.833, 92.778]],
    defaultStatus: "accessible",
  },
  {
    id: "NH-27-BYPASS",
    name: "NH-27 / NH-29 Safe Alternative Bypass",
    coordinates: [[26.1445, 91.7362], [25.5788, 91.8933], [24.833, 92.778], [24.817, 93.9368]],
    defaultStatus: "accessible",
  },
];

export function RoleMap({ role, compact = false }: { role: Role; compact?: boolean }) {
  const mapId = useMemo(() => `role-map-${roleKeyByLabel[role]}-${compact ? "compact" : "full"}`, [role, compact]);
  const [routeSelection, setRouteSelection] = useState<{ origin: RouteNodeId; destination: RouteNodeId }>({ origin: "GUWAHATI", destination: "IMPHAL" });
  const [isOffline, setIsOffline] = useState(() => typeof navigator === "undefined" ? false : !navigator.onLine);
  const [tilesFailed, setTilesFailed] = useState(false);
  const visibleLayers = layersByRole[role];

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setTilesFailed(false);
    };
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const snapshotQuery = trpc.operations.snapshot.useQuery(undefined, { refetchInterval: 10000, retry: false });
  const incidentsQuery = trpc.demo.incidents.useQuery(undefined, { retry: false });
  const riskQuery = trpc.demo.risk.useQuery(undefined, { retry: false });
  const routeQuery = trpc.demo.routes.useQuery(routeSelection, { retry: false });

  // Update persistent cache on successful fetch
  useEffect(() => {
    if (snapshotQuery.data) setPersistedCache("operations.snapshot", snapshotQuery.data);
  }, [snapshotQuery.data]);

  useEffect(() => {
    if (incidentsQuery.data) setPersistedCache("demo.incidents", incidentsQuery.data);
  }, [incidentsQuery.data]);

  const cachedSnapshot = getPersistedCache<any>("operations.snapshot")?.data;
  const activeSnapshot = snapshotQuery.data || cachedSnapshot;
  const cachedIncidents = getPersistedCache<any>("demo.incidents")?.data;
  const activeIncidents = incidentsQuery.data || cachedIncidents;

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ origin: RouteNodeId; destination: RouteNodeId }>).detail;
      if (detail?.origin && detail?.destination) {
        setRouteSelection(prev => (prev.origin === detail.origin && prev.destination === detail.destination ? prev : { origin: detail.origin, destination: detail.destination }));
      }
    };
    window.addEventListener("ner-route-selection", handler);
    return () => window.removeEventListener("ner-route-selection", handler);
  }, []);

  // Map dynamic vehicles from snapshotQuery or fallback
  const vehiclePoints = useMemo<MapPoint[]>(() => {
    const rawVehicles = snapshotQuery.data?.vehicles;
    const list = rawVehicles && rawVehicles.length > 0 ? rawVehicles : [
      {
        id: "TRK-104",
        latitude: "26.1445",
        longitude: "91.7362",
        speed: "42.50",
        heading: 75,
        risk: "HIGH",
        status: "at_risk",
        currentCorridor: "NH-37 Jorhat",
        gpsSource: "SIMULATED GPS",
        shipmentId: "SHP-001",
        freshnessLabel: "Fresh (< 1m)",
      },
      {
        id: "TRK-219",
        latitude: "25.6747",
        longitude: "94.1086",
        speed: "35.00",
        heading: 140,
        risk: "MODERATE",
        status: "on_route",
        currentCorridor: "NH-2 Kohima",
        gpsSource: "SIMULATED GPS",
        shipmentId: "SHP-002",
        freshnessLabel: "Fresh (< 1m)",
      },
      {
        id: "TRK-088",
        latitude: "24.8170",
        longitude: "93.9368",
        speed: "0.00",
        heading: 0,
        risk: "LOW",
        status: "idle",
        currentCorridor: "NH-39 Imphal",
        gpsSource: "SIMULATED GPS",
        shipmentId: "SHP-003",
        freshnessLabel: "Fresh (< 1m)",
      },
    ];

    const filtered = role === "Truck Driver"
      ? list.filter((v: any) => v.id === "TRK-104")
      : role === "Emergency Response Team"
      ? list.filter((v: any) => ["HIGH", "CRITICAL"].includes(v.risk))
      : list;

    return filtered.map((v: any) => {
      const lat = Number(v.latitude) || 26.1445;
      const lon = Number(v.longitude) || 91.7362;
      const speed = v.speed ? `${Number(v.speed).toFixed(0)} km/h` : "40 km/h";
      const heading = v.heading ? `${v.heading}°` : "0°";
      const isCritical = v.risk === "CRITICAL" || v.risk === "HIGH";
      const color = isCritical ? "#ef4444" : v.risk === "MODERATE" ? "#f97316" : "#0284c7";
      const source = v.gpsSource || "SIMULATED GPS";
      const freshness = v.freshnessLabel || "Fresh (< 1m)";
      const corridor = v.currentCorridor || "NH-37 Corridor";

      return {
        label: `${v.id} (${speed})`,
        point: [lat, lon],
        color,
        layer: "vehicles",
        popup: `
          <div style="font-family: sans-serif; font-size: 11px; line-height: 1.4;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <strong style="font-size:13px; color:#0f172a;">${v.id}</strong>
              <span style="background:#fef3c7; color:#92400e; font-size:9px; font-weight:700; padding:2px 6px; border-radius:4px; border:1px solid #fde68a;">${source}</span>
            </div>
            <div style="color:#64748b; margin-bottom:4px;">${v.shipmentId ? `Cargo: <strong>${v.shipmentId}</strong>` : ""}</div>
            <div style="border-top:1px solid #e2e8f0; padding-top:4px; margin-top:4px;">
              <div>📍 <strong>Corridor:</strong> ${corridor}</div>
              <div>⚡ <strong>Speed:</strong> ${speed} · Heading: ${heading}</div>
              <div>⚠️ <strong>Risk Level:</strong> <span style="color:${color}; font-weight:700;">${v.risk}</span></div>
              <div>⏱️ <strong>GPS Freshness:</strong> ${freshness}</div>
              <div style="font-family:monospace; color:#64748b; font-size:10px; margin-top:2px;">[${lat.toFixed(4)}, ${lon.toFixed(4)}]</div>
            </div>
          </div>
        `,
      };
    });
  }, [activeSnapshot?.vehicles, role]);

  const persistedPoints = useMemo<MapPoint[]>(() => {
    return (activeIncidents ?? []).filter((incident: any) => {
      if (role === "Emergency Response Team") return incident.status === "VERIFIED" && incident.severity === "CRITICAL";
      if (role === "Truck Driver") return ["HIGH", "CRITICAL"].includes(incident.severity);
      return true;
    }).map((incident: any) => {
      const isBlocked = incident.roadAccessibility === "blocked";
      const color = incident.severity === "CRITICAL" ? "#ef4444" : incident.severity === "HIGH" ? "#f97316" : "#eab308";
      return {
        label: `${incident.id} · ${incident.type}`,
        point: [Number(incident.latitude), Number(incident.longitude)] as [number, number],
        color,
        layer: isBlocked ? "blocked" : "incidents",
        popup: `
          <div style="font-family: sans-serif; font-size: 11px;">
            <strong style="font-size:12px; color:#0f172a;">${incident.id} · ${incident.type}</strong>
            <div style="margin-top:4px; color:#475569;">
              <div>Severity: <strong style="color:${color}">${incident.severity}</strong></div>
              <div>Accessibility: <strong>${incident.roadAccessibility.toUpperCase()}</strong></div>
              <div>Status: <strong>${incident.status}</strong></div>
              <div>Time: ${new Date(incident.occurredAt).toLocaleTimeString()}</div>
              <p style="margin-top:4px; font-style:italic; color:#64748b;">${incident.description}</p>
            </div>
          </div>
        `,
      };
    });
  }, [incidentsQuery.data, role]);

  const riskPoints = useMemo<MapPoint[]>(() => {
    return (riskQuery.data?.predictions ?? []).map((item, index) => ({
      label: item.label,
      point: [[26.75, 94.2], [25.6747, 94.1086], [25.5788, 91.8933]][index] as [number, number],
      color: item.prediction.riskLevel === "CRITICAL" ? "#dc2626" : item.prediction.riskLevel === "HIGH" ? "#f97316" : item.prediction.riskLevel === "MEDIUM" ? "#eab308" : "#16a34a",
      layer: "risk",
      popup: `
        <div style="font-family: sans-serif; font-size: 11px;">
          <strong style="color:#0f172a;">${item.prediction.riskLevel} Risk · ${item.label}</strong>
          <div style="margin-top:4px; color:#475569;">
            <div>Probability: <strong>${item.prediction.probability}%</strong></div>
            <div>Confidence: <strong>${item.prediction.confidence}%</strong></div>
            <div>Freshness: ${item.prediction.freshness}</div>
            <div>Factors: ${item.prediction.contributingFactors.join(" · ")}</div>
            <div style="font-style:italic; font-size:10px; color:#94a3b8; margin-top:4px;">AI prediction — requires route safety validation.</div>
          </div>
        </div>
      `,
    }));
  }, [riskQuery.data]);

  const mapPoints = useMemo(() => [...vehiclePoints, ...persistedPoints, ...riskPoints], [vehiclePoints, persistedPoints, riskPoints]);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if ((mapContainerRef.current as any)._leaflet_id) {
      delete (mapContainerRef.current as any)._leaflet_id;
    }
    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: true,
      fadeAnimation: false,
      zoomAnimation: false,
    }).setView([25.8, 92.7], compact ? 6.2 : 6);

    L.control.zoom({ position: "bottomright" }).addTo(map);
    const tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap contributors" }).addTo(map);
    tileLayer.on("tileerror", () => {
      setTilesFailed(true);
    });

    const layerGroup = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerGroupRef.current = layerGroup;

    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {}
        mapRef.current = null;
        layerGroupRef.current = null;
      }
    };
  }, [compact]);

  useEffect(() => {
    const layerGroup = layerGroupRef.current;
    if (!layerGroup) return;
    layerGroup.clearLayers();

    // Corridor accessibility overlays with textual status labels
    if (visibleLayers.includes("roads") || visibleLayers.includes("routes")) {
      corridorGeometries.forEach((corridor) => {
        let strokeColor = "#22c55e"; // accessible
        let dashStyle = "";
        let weight = 4;
        let opacity = 0.75;
        let statusText = "ACCESSIBLE";

        // Check if corridor has active blockage from incidents
        const matchingIncident = (activeIncidents ?? []).find((inc: any) =>
          inc.description?.toUpperCase().includes(corridor.id.split("-")[1] ?? "") ||
          (corridor.id.includes("JORHAT") && inc.description?.toUpperCase().includes("JORHAT"))
        );

        const isBlocked = corridor.defaultStatus === "blocked" || matchingIncident?.roadAccessibility === "blocked" || matchingIncident?.severity === "CRITICAL";
        const isRestricted = corridor.defaultStatus === "restricted" || matchingIncident?.roadAccessibility === "restricted";

        if (isBlocked) {
          strokeColor = "#ef4444";
          dashStyle = "6 6";
          weight = 5;
          opacity = 0.9;
          statusText = "BLOCKED (Disruption verified)";
        } else if (isRestricted) {
          strokeColor = "#f59e0b";
          dashStyle = "4 4";
          weight = 4;
          opacity = 0.85;
          statusText = "RESTRICTED (Caution)";
        }

        L.polyline(corridor.coordinates, {
          color: strokeColor,
          weight,
          opacity,
          dashArray: dashStyle,
        }).addTo(layerGroup).bindTooltip(`<strong>${corridor.name}</strong><br/>Status: <strong>${statusText}</strong>`);
      });
    }

    // Active A* recommended safe route
    if (visibleLayers.includes("routes")) {
      const selectedRoute = routeQuery.data?.recommendation.route.map(node => routePoints[node]).filter(Boolean) as [number, number][] | undefined;
      if (selectedRoute && selectedRoute.length > 1) {
        L.polyline(selectedRoute, {
          color: "#059669",
          weight: 6,
          opacity: 0.95,
        }).addTo(layerGroup).bindTooltip("<strong>A* Recommended Safe Route</strong><br/>Human-in-the-loop verified bypass");
      }
    }

    // Markers with accessible high-contrast text labels (not just colors)
    mapPoints.filter(point => visibleLayers.includes(point.layer)).forEach(point => {
      const isVeh = point.layer === "vehicles";
      const isBlocked = point.layer === "blocked";
      const icon = L.divIcon({
        className: "custom-pin",
        html: isVeh
          ? `<div style="display:flex; align-items:center; gap:3px;">
              <div style="background:${point.color}; border:2px solid white; border-radius:50%; width:24px; height:24px; display:grid; place-items:center; box-shadow:0 2px 6px rgba(0,0,0,0.3);"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg></div>
              <span style="background:#0f172a; color:#ffffff; font-size:9px; font-weight:700; padding:1px 5px; border-radius:3px; white-space:nowrap; box-shadow:0 1px 3px rgba(0,0,0,0.4);">${point.label.split("·")[0].trim()}</span>
             </div>`
          : `<div style="display:flex; align-items:center; gap:2px;">
              <span style="--pin:${point.color}" class="map-pin ${isBlocked ? "incident" : ""}"></span>
              <span style="background:${isBlocked ? '#b91c1c' : '#c2410c'}; color:#ffffff; font-size:8.5px; font-weight:800; padding:1px 4px; border-radius:3px; white-space:nowrap; box-shadow:0 1px 3px rgba(0,0,0,0.3);">${isBlocked ? "BLOCKED" : "CAUTION"}</span>
             </div>`,
        iconSize: [80, 24],
        iconAnchor: [12, 12],
      });
      L.marker(point.point, { icon }).addTo(layerGroup).bindPopup(point.popup ?? `<strong>${point.label}</strong>`);
    });

    // Risk exposure overlay
    if (visibleLayers.includes("risk")) {
      L.circle([25.58, 91.89], {
        radius: 36000,
        color: "#eab308",
        fillColor: "#eab308",
        fillOpacity: 0.12,
        weight: 1,
      }).addTo(layerGroup).bindTooltip("Moderate risk zone · Weather / terrain penalty active");
    }
  }, [visibleLayers, mapPoints, routeQuery.data, activeIncidents]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-[#f1f5f9]">
      <div
        ref={mapContainerRef}
        className={compact ? "h-[250px] w-full" : "h-[380px] w-full"}
        style={{
          backgroundColor: "#f8fafc",
          backgroundImage: "radial-gradient(#cbd5e1 1.2px, transparent 1.2px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Top Left Header Bar */}
      <div className="absolute left-3 top-3 z-[500] flex items-center gap-2 rounded-lg bg-white/95 px-3 py-2 text-[10px] font-bold text-slate-700 shadow-lg">
        <MapPin size={13} className="text-orange-500" />
        {labelsByRole[role]}
      </div>

      {(isOffline || tilesFailed) && (
        <div className="absolute top-12 left-3 z-[500] flex items-center gap-1.5 rounded-lg bg-slate-900/90 text-amber-300 px-2.5 py-1.5 text-[9px] font-bold tracking-wide shadow-lg border border-amber-500/40 backdrop-blur-sm">
          <CloudOff size={11} className="text-amber-400" />
          OFFLINE MAP · CACHED VECTOR OVERLAYS ACTIVE
        </div>
      )}

      {routeQuery.data?.recommendation?.status === "NO SAFE ROUTE AVAILABLE" && (
        <div className="absolute top-20 left-3 z-[500] flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-[10px] font-bold tracking-wide text-white shadow-lg border border-red-400">
          <TriangleAlert size={12} className="text-white" />
          NO SAFE ROUTE AVAILABLE
        </div>
      )}

      {/* Top Right Simulated GPS Notice */}
      <div className="absolute right-3 top-3 z-[500] flex items-center gap-1.5 rounded-lg bg-[#0f172a]/90 px-2.5 py-1.5 text-[9px] font-bold tracking-wide text-amber-300 shadow-lg backdrop-blur-sm border border-amber-400/30">
        <Radio size={11} className="text-amber-400 animate-pulse" />
        SIMULATED GPS
      </div>

      {/* Bottom Legend with accessible text tags (Requirement 14) */}
      <div className="absolute bottom-3 left-3 z-[500] flex flex-wrap items-center gap-2 rounded-lg bg-white/95 px-3 py-1.5 text-[10px] text-slate-700 shadow-lg border border-slate-200">
        <span className="flex items-center gap-1 font-bold text-emerald-800">
          <span className="rounded bg-emerald-100 px-1 text-[9px] uppercase">ACCESSIBLE</span>
        </span>
        <span className="flex items-center gap-1 font-bold text-amber-800">
          <span className="rounded bg-amber-100 px-1 text-[9px] uppercase">RESTRICTED</span>
        </span>
        <span className="flex items-center gap-1 font-bold text-red-800">
          <span className="rounded bg-red-100 px-1 text-[9px] uppercase">BLOCKED</span>
        </span>
        <span className="flex items-center gap-1 font-semibold text-sky-800">
          <Truck size={12} className="text-sky-600" />
          <span className="rounded bg-sky-100 px-1 text-[9px]">VEHICLE</span>
        </span>
        <span className="flex items-center gap-1 font-semibold text-emerald-900">
          <Route size={12} className="text-emerald-700" />
          <span className="rounded bg-emerald-100 px-1 text-[9px]">A* BYPASS</span>
        </span>
      </div>
    </div>
  );
}

export function RoleMapIcon({ role }: { role: Role }) {
  if (role === "Truck Driver") return <Truck size={16} />;
  if (role === "Emergency Response Team") return <TriangleAlert size={16} />;
  return <Route size={16} />;
}
