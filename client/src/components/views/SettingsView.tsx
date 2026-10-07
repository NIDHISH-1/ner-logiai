import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings, Database, CloudRain, Key, ShieldCheck, RefreshCw, CheckCircle2, RotateCcw, Globe, Wifi, WifiOff, BellRing, Clock } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { readOfflineQueue, pendingOfflineCount } from "@/lib/offlineIncidentQueue";

export function SettingsView() {
  const trpcUtils = trpc.useUtils();
  const snapshotQuery = trpc.operations.snapshot.useQuery();
  const riskQuery = trpc.operations.risk.useQuery();
  const { language, setLanguage, t } = useLanguage();

  const [isOnline, setIsOnline] = useState(() => typeof navigator !== "undefined" ? navigator.onLine : true);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string>("Just now");
  const [alertPresentation, setAlertPresentation] = useState<"actionable" | "detailed">("actionable");

  useEffect(() => {
    const checkStatus = () => {
      setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
      const queue = readOfflineQueue();
      setOfflineQueueCount(pendingOfflineCount(queue));
      const last = queue.filter(item => item.syncedAt).sort((a, b) => (b.syncedAt ?? "").localeCompare(a.syncedAt ?? ""))[0];
      if (last?.syncedAt) {
        const diffMin = Math.max(1, Math.round((Date.now() - new Date(last.syncedAt).getTime()) / 60000));
        setLastSyncTime(`${diffMin} min ago`);
      }
    };
    checkStatus();
    window.addEventListener("online", checkStatus);
    window.addEventListener("offline", checkStatus);
    return () => {
      window.removeEventListener("online", checkStatus);
      window.removeEventListener("offline", checkStatus);
    };
  }, []);

  const isDbAvailable = snapshotQuery.data?.databaseAvailable ?? false;
  const weatherLabel = riskQuery.data?.weatherDataLabel ?? "SIMULATED WEATHER DATA";

  const seedMutation = trpc.demo.ensureSeeded.useMutation({
    onSuccess: async () => {
      await Promise.all([
        trpcUtils.operations.snapshot.invalidate(),
        trpcUtils.demo.snapshot.invalidate(),
        trpcUtils.demo.incidents.invalidate(),
      ]);
      toast.success("Demo dataset re-seeded successfully!");
    },
    onError: (err: any) => {
      toast.error(`Seeding failed: ${err.message}`);
    },
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <div className="flex items-center gap-2">
          <Badge className="border-0 bg-slate-200 text-slate-700">SYSTEM CONFIGURATION</Badge>
          <span className="text-xs text-slate-500">NER-LogiAI Prototype Parameters</span>
        </div>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Prototype Settings & Diagnostics</h2>
        <p className="mt-1 text-xs text-slate-500">
          Operational language preferences, low-connectivity synchronization state, database persistence, and external adapters.
        </p>
      </div>

      {/* Phase 5 Core Settings: Language & Connectivity */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Language Preference Card */}
        <Card className="border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <Globe size={16} className="text-teal-600" /> Operational Language
            </div>
            <Badge className="bg-teal-600 text-white border-0 text-[10px] font-mono">
              {language === "en" ? "ENGLISH" : language === "hi" ? "HINDI (हिन्दी)" : "ASSAMESE (অসমীয়া)"}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Select deterministic operational language. Translates incident advisories, road warnings, and driver instructions while preserving technical IDs, coordinates, and ETAs.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => setLanguage("en")}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition border ${
                language === "en"
                  ? "bg-[#12313b] text-white border-[#12313b] shadow-sm"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              English (EN)
            </button>
            <button
              onClick={() => setLanguage("hi")}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition border ${
                language === "hi"
                  ? "bg-[#12313b] text-white border-[#12313b] shadow-sm"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              हिन्दी / Hindi (HI)
            </button>
            <button
              onClick={() => setLanguage("as")}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition border ${
                language === "as"
                  ? "bg-[#12313b] text-white border-[#12313b] shadow-sm"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              অসমীয়া / Assamese (AS)
            </button>
          </div>
          <div className="rounded-lg bg-slate-50 p-2 text-[11px] text-slate-500 font-mono">
            Active: {language === "en" ? "Standard Operational English" : language === "hi" ? "Deterministic Hindi Translation" : "Deterministic Assamese Translation"}
          </div>
        </Card>

        {/* Connectivity & Offline Sync Status */}
        <Card className="border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              {isOnline ? <Wifi size={16} className="text-emerald-600" /> : <WifiOff size={16} className="text-orange-600" />} Field Connectivity & Sync
            </div>
            {isOnline ? (
              <Badge className="bg-emerald-600 text-white border-0 text-[10px]">ONLINE</Badge>
            ) : (
              <Badge className="bg-orange-600 text-white border-0 text-[10px]">OFFLINE</Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Monitors connection state and pending local incident queue actions. Previously synchronized alerts remain readable offline.
          </p>
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="rounded-lg bg-slate-50 p-2 text-slate-700">
              <span className="text-slate-400 block text-[9px] uppercase">Last Sync</span>
              <strong>{lastSyncTime}</strong>
            </div>
            <div className="rounded-lg bg-slate-50 p-2 text-slate-700">
              <span className="text-slate-400 block text-[9px] uppercase">Queue State</span>
              <strong>{offlineQueueCount} pending</strong>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Database */}
        <Card className="border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <Database size={16} className="text-sky-600" /> Database Persistence
            </div>
            {isDbAvailable ? (
              <Badge className="bg-emerald-600 text-white border-0 text-[10px]">MYSQL CONNECTED</Badge>
            ) : (
              <Badge className="bg-amber-500 text-white border-0 text-[10px]">IN-MEMORY FALLBACK</Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Drizzle ORM connects to MySQL via connection pool with automatic fallback to high-speed memory maps when offline or decoupled.
          </p>
          <div className="rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-600 font-mono">
            Status: {isDbAvailable ? "Active MySQL Connection Pool" : "Operational In-Memory State"}
          </div>
        </Card>

        {/* Weather API */}
        <Card className="border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <CloudRain size={16} className="text-sky-600" /> Weather Engine Source
            </div>
            <Badge className="bg-sky-600 text-white border-0 text-[10px]">ACTIVE</Badge>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            OpenWeatherMap API integration pulls live monsoon observations with automatic fallback to high-fidelity Northeast meteorological models.
          </p>
          <div className="rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-600 font-mono">
            Provider: {weatherLabel}
          </div>
        </Card>

        {/* Auth Mode */}
        <Card className="border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <Key size={16} className="text-violet-600" /> Authentication & RBAC
            </div>
            <Badge className="bg-violet-600 text-white border-0 text-[10px]">JWT HS256</Badge>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Decoupled standalone authentication issuing HMAC SHA-256 session tokens. Supports 5 personas with strict role-based routing procedures.
          </p>
          <div className="rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-600 font-mono">
            Role Matrix: Admin · Logistics · Field · Driver · Emergency
          </div>
        </Card>

        {/* ML & Safety Engine */}
        <Card className="border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <ShieldCheck size={16} className="text-emerald-600" /> Decision Integrity Engine
            </div>
            <Badge className="bg-emerald-600 text-white border-0 text-[10px]">SYNTHETIC-RF-V1</Badge>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            31-tree explainable Random Forest coupled with Tier-1 zero-tolerance bridge and road constraint validation.
          </p>
          <div className="rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-600 font-mono">
            Routing: Multi-Objective A* Graph Search
          </div>
        </Card>
      </div>

      {/* Action Card: Reset Demo Data */}
      <Card className="border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <strong className="text-sm font-bold text-slate-900">Reset & Seed Prototype Dataset</strong>
            <p className="text-xs text-slate-500 mt-1">
              Populates baseline vehicles, shipments, weather snapshots, and field incidents for demonstration.
            </p>
          </div>
          <Button
            size="sm"
            disabled={seedMutation.isPending}
            onClick={() => seedMutation.mutate()}
            className="gap-2 bg-slate-800 hover:bg-slate-900 text-white text-xs shrink-0"
          >
            <RotateCcw size={13} /> {seedMutation.isPending ? "Seeding..." : "Seed Baseline Data"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
