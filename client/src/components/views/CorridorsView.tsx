import { trpc } from "@/lib/trpc";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Route, ShieldCheck, ShieldAlert, AlertTriangle, CloudRain, MapPin, CheckCircle2, ArrowRight } from "lucide-react";

export function CorridorsView({ onSelectRoute }: { onSelectRoute?: (corridorId: string) => void }) {
  const corridorsQuery = trpc.operations.corridors.useQuery();
  const corridors = corridorsQuery.data ?? [];

  const getSafetyBadge = (status: string) => {
    switch (status) {
      case "SAFE":
        return <Badge className="bg-emerald-600 text-white border-0 text-[10px]">SAFE</Badge>;
      case "CAUTION":
        return <Badge className="bg-amber-500 text-white border-0 text-[10px]">CAUTION</Badge>;
      case "REJECTED":
        return <Badge className="bg-red-600 text-white border-0 text-[10px]">REJECTED / BLOCKED</Badge>;
      default:
        return <Badge className="bg-slate-500 text-white border-0 text-[10px]">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Badge className="border-0 bg-emerald-100 text-emerald-800">ARTERIAL NETWORK</Badge>
            <span className="text-xs text-slate-500">6 Lifeline Mountain Corridors</span>
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Regional Highway Corridor Matrix</h2>
          <p className="mt-1 text-xs text-slate-500">
            Operational accessibility status, safety engine validations, and deterministic risk scores for critical supply corridors.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {corridors.map((c) => {
          const isBlocked = c.safetyStatus === "REJECTED";
          const isCaution = c.safetyStatus === "CAUTION";
          return (
            <Card
              key={c.id}
              className={`border transition shadow-sm hover:shadow-md ${
                isBlocked
                  ? "border-red-200 bg-red-50/10"
                  : isCaution
                  ? "border-amber-200 bg-amber-50/10"
                  : "border-slate-200 bg-white"
              }`}
            >
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <strong className="text-sm font-bold text-slate-900 block">{c.name}</strong>
                    <span className="text-[11px] text-slate-500">{c.state} · {c.lengthKm} km</span>
                  </div>
                  {getSafetyBadge(c.safetyStatus)}
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2.5 text-xs">
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold">ML Risk Level</span>
                    <p className={`font-bold mt-0.5 ${
                      c.riskLevel === "CRITICAL" ? "text-red-600" : c.riskLevel === "HIGH" ? "text-orange-600" : "text-emerald-600"
                    }`}>
                      {c.riskLevel} ({c.riskProbability}%)
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold">Critical Transit</span>
                    <p className="font-semibold text-slate-700 mt-0.5">
                      {c.criticalLoadTransitAllowed ? "Permitted" : "Prohibited"}
                    </p>
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <span className="text-[11px] font-semibold text-slate-700">Safety Reasons:</span>
                  <ul className="space-y-0.5 text-[11px] text-slate-600 list-disc list-inside">
                    {c.safetyReasons.map((reason, idx) => (
                      <li key={idx} className="truncate">{reason}</li>
                    ))}
                  </ul>
                </div>

                {c.weather && (
                  <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-600 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-medium">
                      <CloudRain size={13} className="text-sky-500" />
                      {c.weather.rainfallIntensity} mm/h rain
                    </span>
                    <span className="text-slate-500 font-mono text-[11px]">
                      {c.weather.temperatureC}°C
                    </span>
                  </div>
                )}

                <div className="pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSelectRoute?.(c.id)}
                    className="w-full text-xs gap-1.5 border-slate-200 hover:bg-slate-100"
                  >
                    <Route size={13} /> View in Route Engine
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
