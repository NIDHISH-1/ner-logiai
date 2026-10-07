import { useState, useEffect } from "react";
import { useAuth, type OperationalRoleType } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Compass, ShieldCheck, Truck, MapPin, Boxes, Siren, Eye, LogOut, CheckCircle2, Lock, UserPlus, LogIn, Sparkles, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";

interface AuthDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
  initialTab?: "personas" | "login" | "signup";
}

const roleIcons: Record<string, typeof ShieldCheck> = {
  admin: ShieldCheck,
  field_officer: MapPin,
  truck_driver: Truck,
  logistics_manager: Boxes,
  emergency_team: Siren,
  viewer: Eye,
};

export function AuthDialog({ open = false, onOpenChange, onSuccess, initialTab = "personas" }: AuthDialogProps) {
  const [, setLocation] = useLocation();
  const { user, login, signup, loginWithCredentials, logout, isAuthenticated, loading } = useAuth();
  const [internalOpen, setInternalOpen] = useState(open);
  const [activeTab, setActiveTab] = useState<"personas" | "login" | "signup">(initialTab);

  // Sign In state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Sign Up state
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [signupOrganization, setSignupOrganization] = useState("");
  const [signupRole, setSignupRole] = useState<OperationalRoleType>("logistics_manager");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const personasQuery = trpc.auth.personas.useQuery();

  useEffect(() => {
    setInternalOpen(open);
    if (open) {
      setError(null);
    }
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

  const handlePersonaLogin = async (role: OperationalRoleType, name?: string, email?: string) => {
    setSubmitting(true);
    setError(null);
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
      setError(err.message ?? "Authentication failed");
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCredentialLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!loginEmail.trim() || !loginPassword) {
      setError("Please enter both email and password.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await loginWithCredentials({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      toast.success(`Welcome back, ${res.user?.name ?? "User"}!`);
      handleOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      const msg = err.message || "Invalid email or password.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!signupName.trim() || signupName.trim().length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(signupEmail.trim())) {
      setError("Please provide a valid email address.");
      return;
    }
    if (signupPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (signupPassword !== signupConfirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await signup({
        name: signupName.trim(),
        email: signupEmail.trim(),
        password: signupPassword,
        confirmPassword: signupConfirmPassword,
        organization: signupOrganization.trim() || undefined,
        requestedRole: signupRole,
      });
      toast.success(`Account created successfully! Welcome, ${res.user?.name ?? signupName}`);
      handleOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      const msg = err.message || "Failed to create account.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
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
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-6 bg-white border border-slate-200 shadow-2xl rounded-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-orange-400 text-[#102b35] shadow-md shadow-orange-400/20 font-bold">
                <Compass size={22} strokeWidth={2.4} />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-950">
                  NER-LogiAI Identity & RBAC Access
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Authenticate or register to unlock role-targeted corridors, tools and safety controls.
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="border-slate-300 text-slate-600 text-[10px] font-mono hidden sm:inline-block">
              SIH26002
            </Badge>
          </div>
        </DialogHeader>

        {/* Current Active Session Banner */}
        {isAuthenticated && user && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-600 text-white text-xs font-bold">
                {user.name ? user.name.slice(0, 2).toUpperCase() : "OP"}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-emerald-950">{user.name}</p>
                  <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0 font-medium">Session Active</Badge>
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

        {/* Tab Switcher */}
        <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-medium text-slate-600">
          <button
            type="button"
            onClick={() => { setActiveTab("personas"); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all ${
              activeTab === "personas" ? "bg-white text-slate-950 font-bold shadow-xs" : "hover:text-slate-900"
            }`}
          >
            <Sparkles size={13} className={activeTab === "personas" ? "text-amber-500" : "text-slate-400"} />
            Quick Personas
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("login"); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all ${
              activeTab === "login" ? "bg-white text-slate-950 font-bold shadow-xs" : "hover:text-slate-900"
            }`}
          >
            <LogIn size={13} className={activeTab === "login" ? "text-sky-500" : "text-slate-400"} />
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("signup"); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all ${
              activeTab === "signup" ? "bg-white text-slate-950 font-bold shadow-xs" : "hover:text-slate-900"
            }`}
          >
            <UserPlus size={13} className={activeTab === "signup" ? "text-orange-500" : "text-slate-400"} />
            Create Account
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-start gap-2">
            <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        {/* Tab 1: Quick Personas */}
        {activeTab === "personas" && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Evaluation & Demonstration Personas
              </p>
              <span className="text-[10px] text-slate-400 font-mono">1-click instant access</span>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              {personas.map((persona, index) => {
                const Icon = roleIcons[persona.role] ?? ShieldCheck;
                const isCurrent = user?.operationalRole === persona.role;
                return (
                  <button
                    key={`${persona.role}-${index}`}
                    type="button"
                    disabled={submitting || loading}
                    onClick={() => handlePersonaLogin(persona.role as OperationalRoleType, persona.name, persona.email)}
                    className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
                      isCurrent
                        ? "border-orange-500 bg-orange-50/50 shadow-sm ring-1 ring-orange-400"
                        : "border-slate-200 bg-slate-50/60 hover:bg-slate-100 hover:border-slate-300"
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
        )}

        {/* Tab 2: Sign In (Credentials) */}
        {activeTab === "login" && (
          <form onSubmit={handleCredentialLogin} className="space-y-4 pt-1">
            <div>
              <Label htmlFor="login-email" className="text-xs font-semibold text-slate-700">Official Email</Label>
              <Input
                id="login-email"
                type="email"
                required
                placeholder="user@ner-logiai.gov.in"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="mt-1 h-9 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="login-password" className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Lock size={12} className="text-slate-400" />
                <span>Password</span>
              </Label>
              <Input
                id="login-password"
                type="password"
                required
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="mt-1 h-9 text-xs"
              />
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-9 bg-[#0d2530] text-white hover:bg-[#153743] text-xs font-bold"
            >
              {submitting ? "Signing in..." : "Sign in with Credentials"}
            </Button>
            <div className="text-center text-xs text-slate-500 pt-1">
              Need a new account?{" "}
              <button
                type="button"
                onClick={() => { setActiveTab("signup"); setError(null); }}
                className="text-orange-600 font-bold hover:underline"
              >
                Create an account
              </button>
            </div>
          </form>
        )}

        {/* Tab 3: Create Account (Sign Up) */}
        {activeTab === "signup" && (
          <form onSubmit={handleSignupSubmit} className="space-y-3.5 pt-1">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="signup-name" className="text-xs font-semibold text-slate-700">Full Name *</Label>
                <Input
                  id="signup-name"
                  required
                  placeholder="e.g. Officer Barua"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <Label htmlFor="signup-email" className="text-xs font-semibold text-slate-700">Official Email *</Label>
                <Input
                  id="signup-email"
                  type="email"
                  required
                  placeholder="user@ner-logiai.gov.in"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  className="mt-1 h-8 text-xs"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="signup-role" className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>DEMO ROLE ASSIGNMENT</span>
                <span className="text-[10px] text-slate-400 font-normal">Controls RBAC Workspace</span>
              </Label>
              <select
                id="signup-role"
                value={signupRole}
                onChange={(e) => setSignupRole(e.target.value as OperationalRoleType)}
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

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="signup-password" className="text-xs font-semibold text-slate-700">Password (min. 6) *</Label>
                <Input
                  id="signup-password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <Label htmlFor="signup-confirm" className="text-xs font-semibold text-slate-700">Confirm Password *</Label>
                <Input
                  id="signup-confirm"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={signupConfirmPassword}
                  onChange={(e) => setSignupConfirmPassword(e.target.value)}
                  className="mt-1 h-8 text-xs"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="signup-org" className="text-xs font-semibold text-slate-700">Organization (Optional)</Label>
              <Input
                id="signup-org"
                placeholder="e.g. State Disaster Management / Transport Dept"
                value={signupOrganization}
                onChange={(e) => setSignupOrganization(e.target.value)}
                className="mt-1 h-8 text-xs"
              />
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-9 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 font-bold text-xs shadow-md"
            >
              {submitting ? "Creating Account..." : "Create Account & Sign In"}
            </Button>
            <div className="text-center text-xs text-slate-500 pt-1">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => { setActiveTab("login"); setError(null); }}
                className="text-orange-600 font-bold hover:underline"
              >
                Sign in
              </button>
            </div>
          </form>
        )}

        <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-[11px] text-slate-400">
          <span>Dedicated registration available:</span>
          <button
            type="button"
            onClick={() => {
              handleOpenChange(false);
              setLocation("/signup");
            }}
            className="text-orange-600 font-medium hover:underline"
          >
            Open standalone signup page →
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
