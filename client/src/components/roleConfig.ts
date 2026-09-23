export type Role =
  | "Government / District Administrator"
  | "Field Officer"
  | "Truck Driver"
  | "Logistics Manager"
  | "Emergency Response Team";

export const roles: Role[] = [
  "Government / District Administrator",
  "Truck Driver",
  "Field Officer",
  "Logistics Manager",
  "Emergency Response Team",
];

export const roleKeyByLabel: Record<Role, string> = {
  "Government / District Administrator": "admin",
  "Field Officer": "field_officer",
  "Truck Driver": "truck_driver",
  "Logistics Manager": "logistics_manager",
  "Emergency Response Team": "emergency_team",
};

export const roleLabelByKey: Record<string, Role> = {
  admin: "Government / District Administrator",
  field_officer: "Field Officer",
  truck_driver: "Truck Driver",
  logistics_manager: "Logistics Manager",
  emergency_team: "Emergency Response Team",
};

export const roleNavigation: Record<Role, string[]> = {
  "Government / District Administrator": ["Dashboard", "Live Map", "Risk Intelligence", "Routes", "Vehicles", "Shipments", "Incidents", "Alerts", "Analytics", "Audit Logs"],
  "Truck Driver": ["My Trip", "Navigation", "My Shipment", "Alerts", "Report Incident", "Offline Data"],
  "Field Officer": ["Field Dashboard", "Report Incident", "Nearby Incidents", "Map", "My Reports", "Sync"],
  "Logistics Manager": ["Operations", "Shipments", "Vehicles", "Routes", "Alerts", "Analytics"],
  "Emergency Response Team": ["Emergency Dashboard", "Emergency Map", "Critical Incidents", "Emergency Routes", "Critical Shipments", "Alerts"],
};

export const roleSummary: Record<Role, { eyebrow: string; title: string; subtitle: string; primaryAction: string; accent: string }> = {
  "Government / District Administrator": { eyebrow: "Regional command center", title: "Regional monitoring", subtitle: "Decision support for accessibility, incidents and essential-supply movement.", primaryAction: "Review critical alerts", accent: "orange" },
  "Truck Driver": { eyebrow: "Driver cockpit", title: "Your assigned trip", subtitle: "A focused view of your shipment, route risk, ETA and next safe action.", primaryAction: "View navigation", accent: "sky" },
  "Field Officer": { eyebrow: "Field intelligence", title: "Capture what is happening on the ground", subtitle: "Report incidents, update road accessibility and sync evidence from the field.", primaryAction: "Report incident", accent: "emerald" },
  "Logistics Manager": { eyebrow: "Delivery operations", title: "Keep priority shipments moving", subtitle: "Manage shipment flow, fleet capacity, delays and operational handoffs.", primaryAction: "Create shipment", accent: "violet" },
  "Emergency Response Team": { eyebrow: "Emergency operations", title: "Find the accessible corridor", subtitle: "Prioritize blockages, emergency routes and critical assets during disruption.", primaryAction: "Find emergency route", accent: "red" },
};

export const roleCapabilities: Record<Role, string[]> = {
  "Government / District Administrator": ["regional-map", "review-incidents", "view-audit", "analytics"],
  "Truck Driver": ["assigned-trip", "navigation", "report-incident", "offline-cache"],
  "Field Officer": ["report-incident", "road-status", "nearby-incidents", "sync"],
  "Logistics Manager": ["shipment-ops", "fleet", "route-ops", "analytics"],
  "Emergency Response Team": ["emergency-map", "blocked-roads", "emergency-routes", "broadcast-alert"],
};
