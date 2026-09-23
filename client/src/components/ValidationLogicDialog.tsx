import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, AlertTriangle, ArrowRight, CheckCircle2, Lock } from "lucide-react";

export function ValidationLogicDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-orange-600">
            <ShieldCheck size={20} />
            <span className="text-[11px] font-bold uppercase tracking-wider">SIH26002 Verification Core</span>
          </div>
          <DialogTitle className="text-xl font-bold text-slate-900">Safety Engine & Decision Integrity Logic</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Automated recommendations are strictly advisory. The engine applies deterministic constraints before any route can be recommended.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2 text-sm text-slate-700">
          {/* Step 1: Hard Constraints */}
          <div className="rounded-xl border border-red-100 bg-red-50/60 p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-bold text-red-900 text-xs uppercase tracking-wide">
                <ShieldAlert size={15} className="text-red-600" /> Tier 1: Hard Rejection Constraints (Zero Tolerance)
              </span>
              <Badge className="bg-red-600 text-white border-0 text-[10px]">REJECTED</Badge>
            </div>
            <p className="mt-1.5 text-xs text-red-800 leading-relaxed">
              If ANY of the following field conditions are verified, the road edge is completely pruned from the A* graph:
            </p>
            <ul className="mt-2 space-y-1 text-xs text-red-900/90 list-disc list-inside font-medium">
              <li><strong>Verified Bridge Damage:</strong> Structural bridge failure or wash-out.</li>
              <li><strong>Verified Road Blockage:</strong> Landslide debris, total mud accumulation, or road cratering.</li>
              <li><strong>Impassable Road Status:</strong> Field-reported status is <code className="bg-red-100 px-1 rounded">blocked</code> or <code className="bg-red-100 px-1 rounded">restricted</code>.</li>
              <li><strong>Critical Verified Incidents:</strong> Incidents marked <code className="bg-red-100 px-1 rounded">VERIFIED</code> with severity <code className="bg-red-100 px-1 rounded">CRITICAL</code>.</li>
            </ul>
          </div>

          {/* Step 2: Caution Penalties */}
          <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-bold text-amber-900 text-xs uppercase tracking-wide">
                <AlertTriangle size={15} className="text-amber-600" /> Tier 2: Caution & Risk Penalty Penalization
              </span>
              <Badge className="bg-amber-500 text-white border-0 text-[10px]">CAUTION</Badge>
            </div>
            <p className="mt-1.5 text-xs text-amber-800 leading-relaxed">
              Corridors without hard blockages but with potential hazards incur heavy routing cost penalties:
            </p>
            <ul className="mt-2 space-y-1 text-xs text-amber-900/90 list-disc list-inside font-medium">
              <li><strong>High ML Risk Prediction:</strong> Synthetic Random Forest probability &ge; 50% (+400 cost penalty).</li>
              <li><strong>Data Freshness Aging/Stale:</strong> Telemetry or weather observations older than 60 minutes (+115 penalty).</li>
              <li><strong>Unverified Incident Under Review:</strong> Reported hazard not yet inspected by field officer (+115 penalty).</li>
            </ul>
          </div>

          {/* Step 3: Multi-Objective A* Cost Function */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <span className="flex items-center gap-2 font-bold text-slate-900 text-xs uppercase tracking-wide">
              <CheckCircle2 size={15} className="text-emerald-600" /> Tier 3: Multi-Objective A* Heuristic Formula
            </span>
            <div className="mt-2 rounded-lg bg-white p-3 border border-slate-200 font-mono text-[11px] text-slate-800 overflow-x-auto">
              Total Cost = Distance(km) + (ML_Risk% &times; 4.0) + (ETA_min &times; 0.12) + Caution_Penalty(115)
            </div>
            <p className="mt-2 text-xs text-slate-500">
              The algorithm guarantees that an accessible, low-risk route with a slightly longer distance will always be preferred over a shorter road with active landslide risks.
            </p>
          </div>

          {/* Step 4: Human-in-the-Loop Override */}
          <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-bold text-violet-900 text-xs uppercase tracking-wide">
                <Lock size={14} className="text-violet-700" /> Human Authority & Government Admin Override
              </span>
              <Badge variant="outline" className="border-violet-300 text-violet-700 text-[10px]">AUDITED</Badge>
            </div>
            <p className="mt-1.5 text-xs text-violet-800 leading-relaxed">
              No AI decision can automatically redirect emergency vehicles or alter road closures without authorized personnel. 
              Only <strong>Government / District Administrators</strong> possess cryptographic permission to override a safety determination, requiring a documented justification recorded in the immutable audit ledger.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
