import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldAlert, MapPin, AlertCircle, Clock, Route, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

export type Blockage = {
  id: string;
  roadName: string;
  location: string;
  type: string;
  status: "VERIFIED" | "UNDER_REVIEW" | "UNVERIFIED" | "REJECTED";
  reportedAt: string;
  accessibility: "blocked" | "restricted" | "accessible" | "unknown";
  recommendedBypass: string;
  impactedRoutes: string;
};

const verifiedBlockages: Blockage[] = [
  {
    id: "BLK-01",
    roadName: "NH-37 (KM 284+200)",
    location: "Jorhat / Teok Bridge Crossing (26.7500° N, 94.2000° E)",
    type: "Bridge Substructure Undermining & Scour",
    status: "VERIFIED",
    reportedAt: "24 minutes ago",
    accessibility: "blocked",
    recommendedBypass: "Divert via Golaghat - Dimapur (NH-2)",
    impactedRoutes: "Guwahati → Jorhat → Dibrugarh",
  },
  {
    id: "BLK-02",
    roadName: "District Spur RD-904",
    location: "Upper Assam Remote Foothills (27.2000° N, 95.2000° E)",
    type: "Total Mudslide Inundation",
    status: "VERIFIED",
    reportedAt: "1 hour ago",
    accessibility: "blocked",
    recommendedBypass: "Helicopter / Light All-Terrain Vehicle Only",
    impactedRoutes: "Local evacuation spur",
  },
  {
    id: "BLK-03",
    roadName: "NH-2 (KM 142)",
    location: "Kohima Approach Slope (25.6747° N, 94.1086° E)",
    type: "Active Hillside Debris Flow",
    status: "UNDER_REVIEW",
    reportedAt: "38 minutes ago",
    accessibility: "restricted",
    recommendedBypass: "Single lane alternating convoy with police escort",
    impactedRoutes: "Dimapur → Kohima",
  },
];

export function BlockagesDialog({
  open,
  onOpenChange,
  onSelectRoute,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectRoute?: (routeId: string) => void;
}) {
  const incidentsQuery = trpc.demo.incidents.useQuery(undefined, { enabled: open });
  const realIncidents = incidentsQuery.data ?? [];

  const dynamicBlockages: Blockage[] = realIncidents
    .filter((inc) => inc.roadAccessibility === "blocked" || inc.roadAccessibility === "restricted" || (inc.status === "VERIFIED" && ["Road Blockage", "Bridge Damage", "Landslide"].includes(inc.type)))
    .map((inc) => ({
      id: inc.id,
      roadName: inc.description.startsWith("[") ? inc.description.slice(1, inc.description.indexOf("]")) : `Incident ${inc.id}`,
      location: `${inc.latitude}, ${inc.longitude}`,
      type: inc.type,
      status: inc.status,
      reportedAt: "Recently updated",
      accessibility: inc.roadAccessibility as any,
      recommendedBypass: inc.roadAccessibility === "blocked" ? "Re-routed via safety-validated alternate corridor" : "Proceed with caution / escorted single lane",
      impactedRoutes: inc.description,
    }));

  const allBlockages = [
    ...dynamicBlockages,
    ...verifiedBlockages.filter(b => !dynamicBlockages.some(d => d.id === b.id)),
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-red-600">
            <ShieldAlert size={18} />
            <span className="text-[11px] font-bold uppercase tracking-wider">Ground Truth Registry</span>
          </div>
          <DialogTitle className="text-lg font-bold text-slate-900">Verified Road Blockages & Obstacles</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Active physical constraints currently enforced by the safety validation engine across Northeast corridors.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {allBlockages.map((blk) => (
            <div
              key={blk.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2.5 transition hover:border-slate-300"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-sm text-slate-900">{blk.roadName}</strong>
                    <Badge
                      className={
                        blk.accessibility === "blocked"
                          ? "bg-red-600 text-white border-0 text-[10px]"
                          : "bg-amber-500 text-white border-0 text-[10px]"
                      }
                    >
                      {blk.accessibility.toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className="border-slate-300 text-[10px] text-slate-600">
                      {blk.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 flex items-center gap-1">
                    <MapPin size={12} className="text-slate-400 shrink-0" />
                    {blk.location}
                  </p>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-1">
                  <Clock size={11} /> {blk.reportedAt}
                </span>
              </div>

              <div className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700 space-y-1">
                <div>
                  <span className="font-semibold text-slate-900">Obstacle Type: </span>
                  {blk.type}
                </div>
                <div>
                  <span className="font-semibold text-slate-900">Impacted Corridors: </span>
                  <span className="text-red-700 font-medium">{blk.impactedRoutes}</span>
                </div>
                <div>
                  <span className="font-semibold text-emerald-800">Bypass Directive: </span>
                  <span className="text-emerald-700 font-medium">{blk.recommendedBypass}</span>
                </div>
              </div>
            </div>
          ))}

          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 flex items-start gap-2">
            <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
            <span>
              The A* routing engine automatically purges these road edges from all generated civilian and supply routes unless overridden by an authorized district official.
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
