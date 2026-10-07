import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth, type OperationalRoleType } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Compass, ShieldCheck, MapPin, Truck, Boxes, Siren, Eye,
  ArrowRight, Lock, AlertCircle, Sparkles, UserPlus, Info, CheckCircle2
} from "lucide-react";
import { DEMO_AUTH_SECURITY_NOTICE, DEFAULT_DEMO_PERSONAS } from "@/lib/demoAuth";

const roleIcons: Record<string, typeof ShieldCheck> = {
  admin: ShieldCheck,
  field_officer: MapPin,
  truck_driver: Truck,
  logistics_manager: Boxes,
  emergency_team: Siren,
  viewer: Eye,
};

interface LoginProps {
  defaultMode?: "login" | "signup";
}

export default function Login({ defaultMode = "login" }: LoginProps) {
  const [, setLocation] = useLocation();
  const { loginWithCredentials, login, isAuthenticated } = useAuth();
  const { language, setLanguage } = useLanguage();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // If already authenticated, redirect to role dashboard
  useEffect(() => {
    if (isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthenticated, setLocation]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("registered") === "true") {
        setSuccessMsg("Account created successfully.");
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError(language === "hi" ? "कृपया अपना ईमेल और पासवर्ड दर्ज करें।" : "Please enter your email and password.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await loginWithCredentials({
        email: trimmedEmail,
        password,
      });

      toast.success(
        language === "hi"
          ? `सफलतापूर्वक साइन इन किया गया! स्वागत है, ${res.user?.name ?? "User"}`
          : `Signed in successfully as ${res.user?.name ?? "User"}`
      );
      setLocation("/");
    } catch (err: any) {
      const msg = err.message || (language === "hi" ? "अमान्य ईमेल या पासवर्ड।" : "Invalid email or password.");
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePersonaLogin = async (role: OperationalRoleType, name?: string, email?: string) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await login({ role, name, email });
      toast.success(
        language === "hi"
          ? `${res.user?.name ?? role} के रूप में प्रमाणीकृत`
          : `Authenticated as ${res.user?.name ?? role}`
      );
      setLocation("/");
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  const personas = DEFAULT_DEMO_PERSONAS;

  return (
    <div className="min-h-screen bg-[#07161c] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0d2a36] via-[#07161c] to-[#040c10] text-slate-100 flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8">
      {/* Top Bar */}
      <div className="mx-auto w-full max-w-xl mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-orange-400 text-[#102b35] shadow-lg shadow-orange-400/20 font-bold">
            <Compass size={22} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              NER-LogiAI
              <Badge className="bg-orange-500/20 text-orange-300 border border-orange-400/30 text-[9px] px-1.5 py-0">SIH26002</Badge>
            </h1>
            <p className="text-[11px] text-slate-400">North Eastern Region Logistics & Accessibility Platform</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLanguage(language === "en" ? "hi" : "en")}
            className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs text-slate-300 hover:text-white"
          >
            {language === "en" ? "हिन्दी" : "English"}
          </button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-xl">
        {/* Prototype / Demo Auth Notice Banner */}
        <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200/90 flex items-start gap-2.5">
          <Info size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">
            <div className="flex items-center gap-2 font-bold text-amber-300 mb-0.5">
              <span>DEMO AUTHENTICATION / PROTOTYPE AUTH</span>
              <Badge className="bg-amber-400 text-slate-950 text-[9px] font-bold py-0">SIH EVALUATION</Badge>
            </div>
            <p className="text-[11px] text-amber-200/80">
              {DEMO_AUTH_SECURITY_NOTICE} Operational data and role-based access control (RBAC) are completely preserved.
            </p>
          </div>
        </div>

        <Card className="border border-slate-800 bg-slate-900/95 shadow-2xl backdrop-blur-md rounded-2xl overflow-hidden text-slate-100">
          <div className="h-1.5 w-full bg-gradient-to-r from-orange-400 via-amber-300 to-sky-400" />
          <CardHeader className="p-6 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold tracking-tight text-white">
                  {language === "hi" ? "परिचालन साइन इन" : "Sign In to Workspace"}
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-1">
                  {language === "hi"
                    ? "ईमेल एवं पासवर्ड से लॉगिन करें या त्वरित सिमुलेशन हेतु एक-क्लिक भूमिका चुनें।"
                    : "Log in with registered demo credentials or select a 1-click evaluation persona."}
                </CardDescription>
              </div>
              <Badge variant="outline" className="border-slate-700 bg-slate-800 text-slate-300 text-[10px] font-mono">
                LOCAL DEMO AUTH
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-6 pt-2 space-y-5">
            {successMsg && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-3 text-xs text-emerald-300 flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{successMsg}</div>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-xs text-red-300 flex items-start gap-2.5">
                <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{error}</div>
              </div>
            )}

            {/* Documented DEMO ACCOUNT Card for SIH evaluation */}
            <div className="rounded-xl border border-sky-500/40 bg-sky-950/30 p-3.5 text-xs text-sky-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-sky-400 text-slate-950 font-bold text-[9px] px-2 py-0.5">
                    DEMO ACCOUNT
                  </Badge>
                  <span className="font-bold text-sky-300">Default Prototype Credential</span>
                </div>
                <Badge variant="outline" className="border-sky-500/40 text-sky-300 text-[9px]">
                  Government Admin
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-slate-950/70 p-2.5 rounded-lg border border-sky-900/50 mb-2.5">
                <div>
                  <span className="text-slate-400 block text-[9px]">Email:</span>
                  <span className="text-white font-semibold">demo@nerlogiai.local</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px]">Password:</span>
                  <span className="text-amber-300 font-bold">demo123</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-sky-300/70">Click to autofill valid demo credentials</span>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setEmail("demo@nerlogiai.local");
                    setPassword("demo123");
                    setError(null);
                  }}
                  className="h-7 text-[11px] bg-sky-600 hover:bg-sky-500 text-white font-semibold px-2.5 cursor-pointer"
                >
                  Fill Demo Credentials
                </Button>
              </div>
            </div>

            {/* Email & Password Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-xs font-semibold text-slate-300">
                  {language === "hi" ? "ईमेल पता *" : "Email Address *"}
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="e.g. demo@nerlogiai.local"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 h-9 bg-slate-950/80 border-slate-700 text-xs text-white placeholder:text-slate-500 focus:border-orange-400"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Lock size={12} className="text-slate-400" />
                    <span>{language === "hi" ? "पासवर्ड *" : "Password *"}</span>
                  </Label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Default demo password: <strong className="text-amber-300 font-bold">demo123</strong>
                  </span>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1.5 h-9 bg-slate-950/80 border-slate-700 text-xs text-white placeholder:text-slate-500 focus:border-orange-400"
                />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-10 gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 font-bold text-xs shadow-lg shadow-orange-500/20 cursor-pointer"
              >
                {submitting ? (
                  language === "hi" ? "सत्यापित किया जा रहा है..." : "Validating Demo Credentials..."
                ) : (
                  <>
                    <span>{language === "hi" ? "साइन इन करें" : "Sign In"}</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </Button>
            </form>

            {/* Quick Persona Simulation Section */}
            <div className="border-t border-slate-800 pt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={13} className="text-amber-400" />
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                    {language === "hi" ? "त्वरित सिमुलेशन भूमिकाएं" : "1-Click Evaluation Personas"}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">All 6 roles supported</span>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {personas.map((persona, index) => {
                  const Icon = roleIcons[persona.role] ?? ShieldCheck;
                  return (
                    <button
                      key={`${persona.role}-${index}`}
                      type="button"
                      disabled={submitting}
                      onClick={() => handlePersonaLogin(persona.role as OperationalRoleType, persona.name, persona.email)}
                      className="flex flex-col text-left p-2.5 rounded-xl border border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-800/60 transition-all group cursor-pointer"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <div className="p-1 rounded-lg bg-slate-800 text-orange-400 group-hover:bg-orange-500 group-hover:text-slate-950 transition-colors">
                            <Icon size={13} />
                          </div>
                          <span className="text-xs font-bold text-white">{persona.name}</span>
                        </div>
                        <Badge variant="outline" className="border-slate-700 bg-slate-900 text-[9px] uppercase text-slate-400">
                          {persona.role.replace("_", " ")}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{persona.organization}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Create Account Link */}
            <div className="border-t border-slate-800 pt-4 text-center">
              <p className="text-xs text-slate-400">
                {language === "hi" ? "नया खाता बनाना चाहते हैं? " : "Need to register a custom demo account? "}
                <button
                  type="button"
                  onClick={() => setLocation("/signup")}
                  className="font-bold text-orange-400 hover:text-orange-300 underline underline-offset-2 ml-1 cursor-pointer"
                >
                  {language === "hi" ? "यहाँ पंजीकरण करें" : "Sign up / Register here"}
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
