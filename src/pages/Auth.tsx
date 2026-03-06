import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Eye, EyeOff, Lock, Mail, ArrowRight, ShieldCheck,
  Fingerprint, BarChart3, MapPin, Activity, Smartphone
} from "lucide-react";
import talentaLogo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// ─── Schema ──────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
  rememberMe: z.boolean().default(false).optional(),
});
type LoginFormData = z.infer<typeof loginSchema>;

// ─── Component ───────────────────────────────────────────
const Auth = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hasError, setHasError] = useState(false);

  // PWA stub state
  const [showInstallBanner, setShowInstallBanner] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 150);
    return () => clearTimeout(t);
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user && role) {
      navigate("/dashboard");
    }
  }, [user, role, loading, navigate]);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setHasError(false);

    // Premium delay feel
    await new Promise(resolve => setTimeout(resolve, 800));

    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      setHasError(true);
      toast({
        variant: "destructive",
        title: "Authentication Failed",
        description: error.message === "Invalid login credentials"
          ? "Invalid work email or password."
          : error.message,
      });
      setTimeout(() => setHasError(false), 600);
      setIsLoading(false);
    } else {
      toast({ title: "Welcome back", description: "Authenticating secure session..." });
    }
  };

  const handleBiometric = async () => {
    toast({
      title: "Biometric Login",
      description: "Face ID / Touch ID initiation requested.",
    });
    // Fallback or actual logic based on previous implementation
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090b]">
        <div className="flex flex-col items-center justify-center space-y-6">
          <div className="relative">
            <div className="absolute -inset-8 rounded-[2rem] bg-indigo-500/20 blur-2xl animate-pulse" />
            <div className="relative inline-block bg-white/5 backdrop-blur-md p-4 rounded-3xl border border-white/10 shadow-2xl mx-auto">
              <img src={talentaLogo} alt="Loading" className="h-16 w-auto object-contain drop-shadow-xl animate-pulse" />
            </div>
          </div>
          <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 w-1/2 animate-[shimmer_1.5s_infinite_linear]" style={{ backgroundSize: '200% 100%' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#09090b] text-slate-200 overflow-hidden font-['Inter',system-ui,sans-serif] selection:bg-indigo-500/30 flex flex-col lg:flex-row">

      {/* ── Background Ambient FX ── */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-indigo-900/20 blur-[140px] mix-blend-screen animate-float-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-blue-900/10 blur-[130px] mix-blend-screen animate-float-delayed" />
        <div className="absolute top-[40%] left-[30%] w-[30vw] h-[30vw] rounded-full bg-cyan-900/10 blur-[100px] mix-blend-screen animate-float-slow" />

        {/* Particle/Noise Overlay */}
        <div className="absolute inset-0 opacity-[0.02] mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }} />
      </div>

      {/* ═══════════════════════════════════════════════
          LEFT PANEL — BRANDING & HERO (Split desktop)
         ═══════════════════════════════════════════════ */}
      <div className={`hidden lg:flex flex-col justify-between w-[50%] xl:w-[55%] relative z-10 p-12 lg:p-16 xl:p-24 transition-all duration-1000 ease-out ${mounted ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-12"}`}>

        {/* Header / Logo */}
        <div>
          <div className="flex items-center gap-4 mb-3">
            <div className="bg-white/5 backdrop-blur-md p-3 rounded-2xl border border-white/10 shadow-xl relative group">
              <div className="absolute inset-0 bg-white/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <img src={talentaLogo} alt="T-Absensi" className="h-10 w-auto object-contain drop-shadow-md relative z-10" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white leading-none">T-Absensi</h1>
              <p className="text-sm text-indigo-300 font-medium tracking-wide">Smart Workforce Attendance Platform</p>
            </div>
          </div>
        </div>

        {/* Hero Content */}
        <div className="my-auto relative">
          <h2 className="text-[3.5rem] xl:text-[4rem] font-extrabold text-white leading-[1.1] tracking-tight mb-6">
            Elevate Your <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-400">
              Workforce Experience
            </span>
          </h2>
          <p className="text-lg text-slate-400 max-w-lg mb-12 leading-relaxed font-light">
            The premium HRIS platform for modern enterprises. Seamlessly track attendance, manage workforce analytics, and secure your company's data in real-time.
          </p>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-y-8 gap-x-6 max-w-2xl">
            {/* Feature 1 */}
            <div className="flex items-start gap-4 group">
              <div className="mt-1 p-2.5 rounded-xl bg-white/5 border border-white/10 text-indigo-400 group-hover:bg-indigo-500/20 group-hover:text-indigo-300 transition-colors shadow-lg">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-white font-semibold text-[15px] mb-1">Bank-grade Security</h4>
                <p className="text-sm text-slate-400 leading-snug">AES-256 encryption & secure authentication</p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="flex items-start gap-4 group">
              <div className="mt-1 p-2.5 rounded-xl bg-white/5 border border-white/10 text-cyan-400 group-hover:bg-cyan-500/20 group-hover:text-cyan-300 transition-colors shadow-lg">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-white font-semibold text-[15px] mb-1">Real-time Attendance</h4>
                <p className="text-sm text-slate-400 leading-snug">GPS location & biometric verification</p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="flex items-start gap-4 group">
              <div className="mt-1 p-2.5 rounded-xl bg-white/5 border border-white/10 text-blue-400 group-hover:bg-blue-500/20 group-hover:text-blue-300 transition-colors shadow-lg">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-white font-semibold text-[15px] mb-1">Smart Analytics</h4>
                <p className="text-sm text-slate-400 leading-snug">Attendance insights and reporting dashboard</p>
              </div>
            </div>
          </div>

          {/* Floating UI Elements Preview (Parallax) */}
          <div className="absolute right-[-15%] top-[-20%] xl:top-[-10%] opacity-40 xl:opacity-60 pointer-events-none hidden md:block animate-float-slow">
            <div className="w-[300px] h-[200px] rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-2xl p-4 transform rotate-12 -translate-z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-500" />
                <div className="space-y-2 flex-1">
                  <div className="h-2 w-1/2 bg-white/20 rounded-full" />
                  <div className="h-2 w-1/3 bg-white/10 rounded-full" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-8 w-full bg-white/5 rounded-lg border border-white/5" />
                <div className="h-8 w-full bg-white/5 rounded-lg border border-white/5" />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6 text-[13px] text-slate-500 font-medium">
            <span>© 2026 Talenta Traincom Indonesia</span>
            <div className="w-1 h-1 rounded-full bg-slate-700 hidden xl:block" />
            <a href="#" className="hover:text-slate-300 transition-colors hidden xl:block">Privacy Policy</a>
            <div className="w-1 h-1 rounded-full bg-slate-700 hidden xl:block" />
            <a href="#" className="hover:text-slate-300 transition-colors hidden xl:block">Terms of Service</a>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </div>
            <span className="text-[11px] font-semibold text-emerald-400 tracking-wide uppercase">System Operational</span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          RIGHT PANEL — LOGIN CARD
         ═══════════════════════════════════════════════ */}
      <div className={`flex-1 flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16 xl:p-24 relative z-10 transition-all duration-1000 delay-200 ease-out ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}>

        {/* Mobile Header / Branding (Shows only on Mobile/Tablet) */}
        <div className="lg:hidden flex flex-col items-center justify-center mb-8 text-center mt-4">
          <div className="bg-white/5 backdrop-blur-md p-3.5 rounded-2xl border border-white/10 shadow-xl mb-5">
            <img src={talentaLogo} alt="T-Absensi" className="h-14 w-auto object-contain drop-shadow-md relative z-10" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-none mb-2">T-Absensi</h1>
          <p className="text-xs sm:text-sm text-indigo-300 font-medium tracking-wide">Smart Workforce Platform</p>
        </div>

        {/* Glassmorphism Card */}
        <div className={`w-full max-w-[420px] bg-white/[0.02] sm:bg-white/[0.03] backdrop-blur-[20px] sm:backdrop-blur-3xl border border-white/[0.08] sm:border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.4)] sm:shadow-[0_8px_40px_rgba(0,0,0,0.5)] rounded-[24px] p-6 sm:p-10 relative overflow-hidden ${hasError ? 'animate-shake' : ''}`}>

          {/* Subtle top glow line */}
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

          {/* Form Header */}
          <div className="mb-8">
            <h2 className="text-2xl sm:text-[26px] font-bold text-white tracking-tight mb-1.5">Welcome Back</h2>
            <p className="text-sm text-slate-400 font-light">Login to T-Absensi HRIS Platform</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

              {/* Email */}
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-[12px] font-semibold text-slate-300">Work Email</FormLabel>
                  <FormControl>
                    <div className="relative group">
                      <div className="absolute left-0 top-0 bottom-0 w-11 flex items-center justify-center text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                        <Mail className="h-[18px] w-[18px]" />
                      </div>
                      <Input
                        {...field}
                        type="email"
                        placeholder="name@company.com"
                        className="h-12 pl-11 pr-4 rounded-xl border-white/10 bg-black/40 text-sm text-white placeholder:text-slate-600 focus-visible:bg-black/60 focus-visible:border-indigo-500/50 focus-visible:ring-2 focus-visible:ring-indigo-500/20 transition-all shadow-inner"
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="text-[11px] text-rose-400" />
                </FormItem>
              )} />

              {/* Password */}
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-[12px] font-semibold text-slate-300">Password</FormLabel>
                    <a href="#" className="text-[12px] text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                      Forgot password?
                    </a>
                  </div>
                  <FormControl>
                    <div className="relative group">
                      <div className="absolute left-0 top-0 bottom-0 w-11 flex items-center justify-center text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                        <Lock className="h-[18px] w-[18px]" />
                      </div>
                      <Input
                        {...field}
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className="h-12 pl-11 pr-11 rounded-xl border-white/10 bg-black/40 text-sm text-white placeholder:text-slate-600 focus-visible:bg-black/60 focus-visible:border-indigo-500/50 focus-visible:ring-2 focus-visible:ring-indigo-500/20 transition-all shadow-inner"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-0 top-0 bottom-0 w-11 flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-[16px] w-[16px]" /> : <Eye className="h-[16px] w-[16px]" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage className="text-[11px] text-rose-400" />
                </FormItem>
              )} />

              {/* Remember Me */}
              <FormField control={form.control} name="rememberMe" render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-2.5 space-y-0 pt-2 pb-1.5">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="data-[state=checked]:bg-indigo-500 data-[state=unchecked]:bg-white/10 h-4 w-8"
                    />
                  </FormControl>
                  <FormLabel className="text-[13px] text-slate-400 font-normal cursor-pointer select-none">
                    Keep me signed in
                  </FormLabel>
                </FormItem>
              )} />

              {/* CTA Custom Styles for Premium App */}
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-[14px] shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] border border-indigo-500/50 transition-all duration-300 relative overflow-hidden group"
                >
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                  {isLoading ? (
                    <span className="flex items-center gap-2 relative z-10">
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Authenticating...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2 relative z-10">
                      Sign In to T-Absensi
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  )}
                </Button>
              </div>

            </form>
          </Form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-7">
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-white/10" />
            <span className="text-[11px] font-semibold text-slate-500 tracking-wider">OR</span>
            <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-white/10" />
          </div>

          {/* Biometric Custom Implementation */}
          <Button
            type="button"
            onClick={handleBiometric}
            disabled={isLoading}
            variant="outline"
            className="w-full h-12 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/20 text-slate-300 font-medium text-[14px] transition-all flex items-center justify-center gap-2.5"
          >
            <Fingerprint className="h-4 w-4 text-indigo-400" />
            Login with Face ID / Biometric
          </Button>

        </div>

        {/* Mobile Mini Footer */}
        <div className="lg:hidden mt-8 text-center px-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </div>
            <span className="text-[11px] font-medium text-emerald-400">System Operational</span>
          </div>
          <p className="text-[11px] text-slate-500 mb-2">© 2026 Talenta Traincom Indonesia | <a href="#" className="underline decoration-slate-600 underline-offset-2">Privacy</a></p>
        </div>

      </div>

      {/* PWA Install Banner */}
      {showInstallBanner && (
        <div className="fixed bottom-0 left-0 right-0 sm:left-auto sm:right-6 sm:bottom-6 sm:w-80 bg-slate-900/90 backdrop-blur-xl border-t sm:border border-white/10 sm:rounded-2xl p-4 z-50 shadow-2xl animate-in slide-in-from-bottom-8 duration-700 delay-1000">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 flex-shrink-0 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
              <Smartphone className="h-5 w-5 text-indigo-400" />
            </div>
            <div className="flex-1">
              <h4 className="text-[13px] font-semibold text-white">T-Absensi App</h4>
              <p className="text-[11px] text-slate-400">Install for faster access</p>
            </div>
            <Button size="sm" onClick={() => setShowInstallBanner(false)} className="h-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs px-4">
              Install
            </Button>
          </div>
        </div>
      )}

      {/* Embedded Styles for custom animations */}
      <style>{`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-30px) scale(1.05); }
        }
        @keyframes float-delayed {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(30px) scale(0.95); }
        }
        .animate-float-slow {
          animation: float-slow 12s ease-in-out infinite;
        }
        .animate-float-delayed {
          animation: float-delayed 15s ease-in-out infinite alternate;
          animation-delay: 2s;
        }
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-4px); }
          40%, 80% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
        }
      `}</style>
    </div>
  );
};

export default Auth;
