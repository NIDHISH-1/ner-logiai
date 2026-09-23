import { useState, useEffect } from "react";
import { useAuth, type OperationalRoleType } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Compass, ShieldCheck, Truck, MapPin, Boxes, Siren, Eye, LogOut, CheckCircle2 } from "lucide-react";

interface AuthDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
}

const roleIcons: Record<string, typeof ShieldCheck> = {
  admin: ShieldCheck,
  field_officer: MapPin,
  truck_driver: Truck,
  logistics_manager: Boxes,
  emergency_team: Siren,
  viewer: Eye,
};

export function AuthDialog({ open = false, onOpenChange, onSuccess }: AuthDialogProps) {
  const { user, login, logout, isAuthenticated, loading } = useAuth();
  const [internalOpen, setInternalOpen] = useState(open);
  const [customName, setCustomName] = useState("");
  const [customEmail, setCustomEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<OperationalRoleType>("admin");
  const [submitting, setSubmitting] = useState(false);

  const personasQuery = trpc.auth.personas.useQuery();

  useEffect(() => {
    setInternalOpen(open);
  }, [open]);

  useEffect(() => {
    const handleOpen = () => {
      setInternalOpen(true);
      onOpenChange?.(true);
    };
    window.addEventListener("ner-logiai:open-auth-dialog", handleOpen);
    return () => window.removeEventListener("ner-logiai:open-auth-dialog", handleOpen);
  }, [onOpenChange]);

  const handleOpenChange = (nextOpen: boolean) => {
    setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  const handleLogin = async (role: OperationalRoleType, name?: string, email?: string) => {
    setSubmitting(true);
    try {
      const res = await login({
        role,
        name: name || undefined,
        email: email || undefined,
      });
      toast.success(`Authenticated as ${res.user?.name ?? role} (${role})`);
      handleOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLogin(selectedRole, customName || undefined, customEmail || undefined);
  };

  const personas = personasQuery.data ?? [
    { role: "admin", label: "Government / District Administrator", name: "Aditi Sharma", email: "aditi.admin@ner-logiai.gov.in", description: "Full operational authority: route overrides, incident verification, system audit." },
    { role: "field_officer", label: "Field Officer", name: "Rajesh Bora", email: "rajesh.field@ner-logiai.gov.in", description: "Ground truth reporting: capture incident reports, road accessibility, GPS & photo evidence." },
    { role: "truck_driver", label: "Truck Driver", name: "Biren Gogoi", email: "biren.driver@assamtransport.in", description: "Assigned corridor TRK-104 (Emergency Medicine): view route risks & alternate bypasses." },
    { role: "logistics_manager", label: "Logistics Manager", name: "Pooja Das", email: "pooja.logistics@ner-logiai.gov.in", description: "Supply chain operations: priority shipments, fleet capacity, audit event logs." },
    { role: "emergency_team", label: "Emergency Response Team", name: "Dr. L. Hmar", email: "ert.lead@disastermgmt.ner.gov.in", description: "Rapid accessibility: critical incidents, blocked roads, high-risk vehicles." },
    { role: "viewer", label: "Public Viewer / Auditor", name: "Observer / Auditor", email: "viewer@ner-logiai.org", description: "Read-only access: view regional status and live risk intelligence." },
  ];

  return (
    <Dialog open={internalOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6 bg-white border border-slate-200 shadow-2xl rounded-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-orange-400 text-[#102b35] shadow-md shadow-orange-400/20">
              <Compass size={22} strokeWidth={2.4} />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-950">
                NER-LogiAI Standalone Authentication
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Select an operational persona or sign in to exercise Role-Based Access Control (RBAC).
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isAuthenticated && user && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-600 text-white text-xs font-bold">
                {user.name ? user.name.slice(0, 2).toUpperCase() : "OP"}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-emerald-950">{user.name}</p>
                  <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0">Active</Badge>
                </div>
                <p className="text-[11px] text-emerald-800">
                  Role: <strong className="font-semibold">{user.operationalRole ?? user.role}</strong> · {user.email}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await logout();
                toast.info("Signed out of current session");
              }}
              className="border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-xs h-8 gap-1.5"
            >
              <LogOut size={13} />
              Sign out
            </Button>
          </div>
        )}

        <div className="space-y-4 pt-1">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Quick Persona Sign-In
              </p>
              <span className="text-[10px] text-slate-400">One-click role activation</span>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              {personas.map((persona) => {
                const Icon = roleIcons[persona.role] ?? ShieldCheck;
                const isCurrent = user?.operationalRole === persona.role;
                return (
                  <button
                    key={persona.role}
                    type="button"
                    disabled={submitting || loading}
                    onClick={() => handleLogin(persona.role as OperationalRoleType, persona.name, persona.email)}
                    className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
                      isCurrent
                        ? "border-orange-500 bg-orange-50/50 shadow-sm ring-1 ring-orange-400"
                        : "border-slate-200 bg-slate-50/60 hover:bg-slate-100/80 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${isCurrent ? "bg-orange-500 text-white" : "bg-white text-slate-700 shadow-xs"}`}>
                          <Icon size={14} />
                        </div>
                        <span className="text-xs font-bold text-slate-900">{persona.name}</span>
                      </div>
                      {isCurrent ? (
                        <CheckCircle2 size={15} className="text-orange-600 shrink-0" />
                      ) : (
                        <Badge variant="outline" className="text-[9px] uppercase tracking-wide font-medium bg-white">
                          {persona.role.replace("_", " ")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-700 font-medium mt-2">{persona.label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{persona.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3">
            <details className="group">
              <summary className="text-xs font-semibold text-slate-700 cursor-pointer list-none flex items-center justify-between hover:text-slate-900">
                <span>Custom User Login</span>
                <span className="text-[11px] text-orange-600 font-medium group-open:hidden">+ Enter custom details</span>
                <span className="text-[11px] text-slate-400 hidden group-open:inline">Hide</span>
              </summary>
              <form onSubmit={handleCustomSubmit} className="mt-3 space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="custom-name" className="text-[11px]">Display Name</Label>
                    <Input
                      id="custom-name"
                      placeholder="e.g. Officer Barua"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      className="h-8 text-xs bg-white mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="custom-email" className="text-[11px]">Email</Label>
                    <Input
                      id="custom-email"
                      type="email"
                      placeholder="user@ner-logiai.gov.in"
                      value={customEmail}
                      onChange={(e) => setCustomEmail(e.target.value)}
                      className="h-8 text-xs bg-white mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="custom-role" className="text-[11px]">Assigned Role</Label>
                  <select
                    id="custom-role"
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as OperationalRoleType)}
                    className="w-full h-8 px-2 mt-1 rounded-md border border-slate-200 bg-white text-xs font-medium"
                  >
                    <option value="admin">Government / District Administrator (admin)</option>
                    <option value="field_officer">Field Officer (field_officer)</option>
                    <option value="truck_driver">Truck Driver (truck_driver)</option>
                    <option value="logistics_manager">Logistics Manager (logistics_manager)</option>
                    <option value="emergency_team">Emergency Response Team (emergency_team)</option>
                    <option value="viewer">Public Viewer / Auditor (viewer)</option>
                  </select>
                </div>
                <Button
                  type="submit"
                  disabled={submitting}
                  size="sm"
                  className="w-full bg-[#0d2530] text-white hover:bg-[#153743] text-xs h-8"
                >
                  Sign in with custom identity
                </Button>
              </form>
            </details>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
