import { trpc } from "@/lib/trpc";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CloudRain, Wind, Thermometer, AlertTriangle, ShieldCheck, RefreshCw, Sun, CloudLightning } from "lucide-react";

const stations = [
  { city: "Guwahati (Kamrup)", state: "Assam", rainfall: 4.2, temp: 28, condition: "Light Rain", floodRisk: false, landslideRisk: false, windSpeed: 12 },
  { city: "Jorhat (Upper Assam)", state: "Assam", rainfall: 18.6, temp: 24, condition: "Heavy Downpour", floodRisk: true, landslideRisk: false, windSpeed: 24 },
  { city: "Kohima / Dimapur", state: "Nagaland", rainfall: 14.5, temp: 19, condition: "Monsoon Showers", floodRisk: false, landslideRisk: true, windSpeed: 18 },
  { city: "Shillong (East Khasi Hills)", state: "Meghalaya", rainfall: 8.0, temp: 17, condition: "Dense Fog & Rain", floodRisk: false, landslideRisk: false, windSpeed: 16 },
  { city: "Imphal (Valley)", state: "Manipur", rainfall: 3.1, temp: 22, condition: "Scattered Showers", floodRisk: false, landslideRisk: false, windSpeed: 8 },
  { city: "Aizawl (Lushai Hills)", state: "Mizoram", rainfall: 12.0, temp: 20, condition: "Mountain Rain", floodRisk: false, landslideRisk: true, windSpeed: 14 },
  { city: "Agartala (West Tripura)", state: "Tripura", rainfall: 1.5, temp: 30, condition: "Overcast", floodRisk: false, landslideRisk: false, windSpeed: 10 },
  { city: "Itanagar (Papum Pare)", state: "Arunachal Pradesh", rainfall: 16.2, temp: 21, condition: "Torrential Rain", floodRisk: true, landslideRisk: true, windSpeed: 22 },
];

export function WeatherView() {
  const riskQuery = trpc.operations.risk.useQuery();
  const weatherLabel = riskQuery.data?.weatherDataLabel ?? "SIMULATED WEATHER DATA";

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Badge className="border-0 bg-sky-100 text-sky-800">{weatherLabel}</Badge>
            <span className="text-xs text-slate-500">Regional Monsoon Radar</span>
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Northeast Weather & Precipitation Matrix</h2>
          <p className="mt-1 text-xs text-slate-500">
            Automated weather intelligence feeding directly into the 31-tree Random Forest landslide risk engine.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => riskQuery.refetch()}
          className="gap-2 border-slate-200 text-xs"
        >
          <RefreshCw size={13} /> Sync Weather Feed
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stations.map((st) => (
          <Card key={st.city} className="border-slate-200 bg-white shadow-sm hover:shadow-md transition">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <strong className="text-sm font-bold text-slate-900 block">{st.city}</strong>
                  <span className="text-[11px] text-slate-500">{st.state}</span>
                </div>
                {st.rainfall > 15 ? (
                  <CloudLightning size={20} className="text-amber-500" />
                ) : st.rainfall > 5 ? (
                  <CloudRain size={20} className="text-sky-500" />
                ) : (
                  <Sun size={20} className="text-yellow-500" />
                )}
              </div>

              <div className="rounded-xl bg-slate-50 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1">
                    <CloudRain size={12} className="text-sky-500" /> Rainfall:
                  </span>
                  <span className="font-bold text-slate-900">{st.rainfall} mm/h</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Thermometer size={12} className="text-orange-500" /> Temperature:
                  </span>
                  <span className="font-medium text-slate-800">{st.temp}°C</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Wind size={12} className="text-slate-400" /> Wind Velocity:
                  </span>
                  <span className="font-medium text-slate-800">{st.windSpeed} km/h</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {st.floodRisk && (
                  <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px]">
                    FLOOD RISK
                  </Badge>
                )}
                {st.landslideRisk && (
                  <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                    LANDSLIDE RISK
                  </Badge>
                )}
                {!st.floodRisk && !st.landslideRisk && (
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                    NORMAL CONDITIONS
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
