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
  ArrowRight, CheckCircle2, Lock, AlertCircle, Info
} from "lucide-react";
import { DEMO_AUTH_SECURITY_NOTICE } from "@/lib/demoAuth";

const roleDescriptions: Record<OperationalRoleType, { label: string; desc: string; icon: typeof ShieldCheck }> = {
  admin: { label: "Government / District Administrator", desc: "Full command authority: route overrides, verification, regional audit logs", icon: ShieldCheck },
  field_officer: { label: "Field Officer", desc: "Ground intelligence: report road blockages, upload photos, offline queue", icon: MapPin },
  truck_driver: { label: "Truck Driver", desc: "Assigned vehicle cockpit: turn-by-turn navigation, route acceptance, GPS freshness", icon: Truck },
  logistics_manager: { label: "Logistics Manager", desc: "Supply chain operations: priority shipments, fleet capacity, delays", icon: Boxes },
  emergency_team: { label: "Emergency Response Team", desc: "Disaster response: critical corridors, bypass routing, emergency alerts", icon: Siren },
  viewer: { label: "Public Viewer / Auditor", desc: "Read-only access: live corridor status & regional risk intelligence", icon: Eye },
};

export default function Signup() {
  const [, setLocation] = useLocation();
  const { signup, isAuthenticated } = useAuth();
  const { language, setLanguage } = useLanguage();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [organization, setOrganization] = useState("");
  const [requestedRole, setRequestedRole] = useState<OperationalRoleType>("logistics_manager");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // If already authenticated, redirect to active dashboard
  useEffect(() => {
    if (isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthenticated, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation
    if (!name.trim() || name.trim().length < 2) {
      setError(language === "hi" ? "कृपया अपना पूरा नाम दर्ज करें (कम से कम 2 अक्षर)।" : "Please enter your full name (minimum 2 characters).");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError(language === "hi" ? "कृपया एक मान्य ईमेल पता दर्ज करें।" : "Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError(language === "hi" ? "पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।" : "Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError(language === "hi" ? "पासवर्ड और पुष्टि पासवर्ड मेल नहीं खाते।" : "Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await signup({
        name: name.trim(),
        email: email.trim(),
        password,
        confirmPassword,
        organization: organization.trim() || undefined,
        requestedRole,
      });

      toast.success(
        language === "hi"
          ? `खाता सफलतापूर्वक बनाया गया! ${res.user?.name ?? name} के रूप में स्वागत है।`
          : "Account created successfully."
      );

      // Navigate to homepage with the selected role workspace active
      setLocation("/");
    } catch (err: any) {
      const rawMsg = err.message || "";
      let msg = language === "hi" ? "पंजीकरण विफल रहा।" : "Registration failed.";
      if (rawMsg.includes("already exists")) {
        msg = language === "hi" ? "इस ईमेल के साथ एक खाता पहले से मौजूद है।" : "An account with this email already exists.";
      } else if (rawMsg.includes("do not match")) {
        msg = language === "hi" ? "पासवर्ड और पुष्टि पासवर्ड मेल नहीं खाते।" : "Passwords do not match.";
      } else if (rawMsg) {
        msg = rawMsg;
      }
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07161c] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0d2a36] via-[#07161c] to-[#040c10] text-slate-100 flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8">
      {/* Top Bar with Language Toggle */}
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
              <span>LOCAL PROTOTYPE AUTHENTICATION</span>
              <Badge className="bg-amber-400 text-slate-950 text-[9px] font-bold py-0">SELF-CONTAINED</Badge>
            </div>
            <p className="text-[11px] text-amber-200/80">
              {DEMO_AUTH_SECURITY_NOTICE} Your registered demo account is stored locally and will be used to log in.
            </p>
          </div>
        </div>

        <Card className="border border-slate-800 bg-slate-900/95 shadow-2xl backdrop-blur-md rounded-2xl overflow-hidden text-slate-100">
          <div className="h-1.5 w-full bg-gradient-to-r from-orange-400 via-amber-300 to-sky-400" />
          <CardHeader className="p-6 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold tracking-tight text-white">
                  {language === "hi" ? "नया डेमो खाता बनाएं" : "Create Demo Operational Account"}
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-1">
                  {language === "hi"
                    ? "पूर्वोत्तर रसद प्लेटफॉर्म के लिए अपनी भूमिका के साथ पंजीकरण करें।"
                    : "Register with your operational role to access assigned corridors and workspace."}
                </CardDescription>
              </div>
              <Badge variant="outline" className="border-slate-700 bg-slate-800 text-slate-300 text-[10px] font-mono">
                RBAC PROTECTED
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-6 pt-2 space-y-5">
            {error && (
              <div className="rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-xs text-red-300 flex items-start gap-2.5">
                <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1">{error}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="name" className="text-xs font-semibold text-slate-300">
                    {language === "hi" ? "पूरा नाम *" : "Full Name *"}
                  </Label>
                  <Input
                    id="name"
                    required
                    placeholder={language === "hi" ? "जैसे: राजेश बोरा" : "e.g. Captain Rajesh Bora"}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1.5 h-9 bg-slate-950/80 border-slate-700 text-xs text-white placeholder:text-slate-500 focus:border-orange-400"
                  />
                </div>
                <div>
                  <Label htmlFor="email" className="text-xs font-semibold text-slate-300">
                    {language === "hi" ? "आधिकारिक ईमेल *" : "Official Email *"}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    placeholder="user@ner-logiai.gov.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1.5 h-9 bg-slate-950/80 border-slate-700 text-xs text-white placeholder:text-slate-500 focus:border-orange-400"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="organization" className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>{language === "hi" ? "संस्थान / विभाग (वैकल्पिक)" : "Optional Organization / Department"}</span>
                  <span className="text-[10px] text-slate-500 font-normal">State / Central Agency</span>
                </Label>
                <Input
                  id="organization"
                  placeholder={language === "hi" ? "जैसे: असम राज्य आपदा प्रबंधन प्राधिकरण" : "e.g. Assam State Disaster Management Authority / NHAI / Fleet Ops"}
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className="mt-1.5 h-9 bg-slate-950/80 border-slate-700 text-xs text-white placeholder:text-slate-500 focus:border-orange-400"
                />
              </div>

              {/* DEMO ROLE ASSIGNMENT SECTION */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-orange-300">DEMO ROLE ASSIGNMENT</span>
                    <Badge className="bg-orange-500 text-slate-950 text-[9px] font-bold py-0">LIVE RBAC</Badge>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">Role defines active workspace</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {language === "hi"
                    ? "मूल्यांकन एवं सिमुलेशन हेतु अपनी परिचालन भूमिका चुनें। यह भूमिका आपके वर्कस्पेस उपकरण, अनुमतियां और नेविगेशन निर्धारित करती है।"
                    : "Select your operational role for demonstration & simulation testing. Controls workspace tools, route authority and sidebar navigation."}
                </p>

                <div className="grid gap-2 sm:grid-cols-2 pt-1">
                  {(Object.keys(roleDescriptions) as OperationalRoleType[]).map((r) => {
                    const info = roleDescriptions[r];
                    const Icon = info.icon;
                    const isSelected = requestedRole === r;
                    return (
                      <button
                        type="button"
                        key={r}
                        onClick={() => setRequestedRole(r)}
                        className={`flex flex-col text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? "border-orange-400 bg-orange-950/40 text-white shadow-sm ring-1 ring-orange-400/50"
                            : "border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-1.5">
                            <Icon size={14} className={isSelected ? "text-orange-400" : "text-slate-400"} />
                            <span className="text-xs font-bold">{info.label.split("/")[0].trim()}</span>
                          </div>
                          {isSelected && <CheckCircle2 size={13} className="text-orange-400 shrink-0" />}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{info.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Password Fields */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="password" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Lock size={12} className="text-slate-400" />
                    <span>{language === "hi" ? "पासवर्ड (कम से कम 6 अक्षर) *" : "Password (min. 6 chars) *"}</span>
                  </Label>
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
                <div>
                  <Label htmlFor="confirm-password" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Lock size={12} className="text-slate-400" />
                    <span>{language === "hi" ? "पासवर्ड की पुष्टि करें *" : "Confirm Password *"}</span>
                  </Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="mt-1.5 h-9 bg-slate-950/80 border-slate-700 text-xs text-white placeholder:text-slate-500 focus:border-orange-400"
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-10 gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 font-bold text-xs shadow-lg shadow-orange-500/20 cursor-pointer"
                >
                  {submitting ? (
                    language === "hi" ? "पंजीकरण जारी है..." : "Creating Demo Account..."
                  ) : (
                    <>
                      <span>{language === "hi" ? "खाता बनाएं एवं वर्कस्पेस खोलें" : "Create Account & Enter Workspace"}</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </Button>
              </div>
            </form>

            <div className="border-t border-slate-800 pt-4 text-center">
              <p className="text-xs text-slate-400">
                {language === "hi" ? "क्या आपके पास पहले से खाता है? " : "Already have a demo account? "}
                <button
                  type="button"
                  onClick={() => setLocation("/login")}
                  className="font-bold text-orange-400 hover:text-orange-300 underline underline-offset-2 ml-1 cursor-pointer"
                >
                  {language === "hi" ? "साइन इन करें" : "Sign in here"}
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
