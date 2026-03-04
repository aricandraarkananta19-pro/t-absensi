import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Lock, Mail, ArrowRight, ShieldCheck, Sparkles, Fingerprint, WifiOff } from "lucide-react";
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
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    // Trigger mount animation
    const t = setTimeout(() => setMounted(true), 100);

    // Online/Offline detection
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      clearTimeout(t);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
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

    // Simulate slight delay for premium feeling
    await new Promise(resolve => setTimeout(resolve, 600));

    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      setHasError(true);
      toast({
        variant: "destructive",
        title: "Login gagal",
        description:
          error.message === "Invalid login credentials"
            ? "Email atau password yang Anda masukkan tidak sesuai."
            : error.message,
      });
      // Remove shake class after animation completes
      setTimeout(() => setHasError(false), 500);
      setIsLoading(false);
    } else {
      toast({ title: "Autentikasi Berhasil", description: "Mengalihkan ke sistem..." });
      // The useEffect will handle redirect
    }
  };

  // ─── Loading State ───────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0F19]">
        <div className="flex flex-col items-center justify-center space-y-8">
          <div className="relative">
            <div className="absolute -inset-4 rounded-full bg-indigo-500/20 blur-xl animate-pulse" />
            <img src={talentaLogo} alt="Talenta" className="h-12 w-auto relative z-10 brightness-0 invert" />
          </div>
          <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 w-1/2 animate-[shimmer_1.5s_infinite_linear]" style={{ backgroundSize: '200% 100%' }} />
          </div>
        </div>
      </div>
    );
  }

  // ─── Main Render ─────────────────────────────────────
  return (
    <div className="flex min-h-screen font-['Inter',system-ui,sans-serif] bg-[#0B0F19] text-slate-200 overflow-hidden relative selection:bg-indigo-500/30">

      {/* ── Offline PWA Banner ── */}
      {!isOnline && (
        <div className="absolute top-0 left-0 right-0 h-10 bg-rose-500/90 text-white text-[13px] font-medium z-50 flex items-center justify-center gap-2 backdrop-blur-md shadow-lg shadow-rose-500/20 transition-all duration-500 animate-in slide-in-from-top">
          <WifiOff className="h-4 w-4" />
          Koneksi terputus. Sistem berjalan dalam mode offline (PWA Offline-Ready).
        </div>
      )}

      {/* ── Background Ambient FX ── */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] rounded-full bg-indigo-900/20 blur-[120px] mix-blend-screen animate-blob" />
        <div className="absolute top-[20%] -right-[10%] w-[60vw] h-[60vw] rounded-full bg-emerald-900/10 blur-[120px] mix-blend-screen animate-blob animation-delay-2000" />
        <div className="absolute -bottom-[20%] left-[20%] w-[80vw] h-[80vw] rounded-full bg-blue-900/20 blur-[120px] mix-blend-screen animate-blob animation-delay-4000" />

        {/* Subtle Noise Texture overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }} />
      </div>

      {/* ═══════════════════════════════════════════════
          LEFT PANEL — Brand Showcase (Desktop Only)
         ═══════════════════════════════════════════════ */}
      <div className="hidden lg:flex lg:w-[50%] xl:w-[55%] relative z-10 flex-col justify-between p-12 xl:p-20">

        {/* Logo */}
        <div className={`transition-all duration-1000 ease-out ${mounted ? "translate-x-0 opacity-100" : "-translate-x-12 opacity-0"}`}>
          <img src={talentaLogo} alt="Talenta" className="h-10 w-auto brightness-0 invert" />
        </div>

        {/* Hero Content */}
        <div className={`my-auto max-w-2xl transition-all duration-1000 delay-200 ease-out ${mounted ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"}`}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-medium text-slate-300 tracking-wide">Enterprise HRIS Platform</span>
          </div>

          <h1 className="text-5xl xl:text-6xl font-bold text-white leading-[1.15] tracking-tight mb-8">
            Elevate Your <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-blue-400 to-emerald-400">
              Workforce Experience
            </span>
          </h1>

          <p className="text-lg text-slate-400 leading-relaxed max-w-xl mb-12">
            Platform manajemen sumber daya manusia all-in-one yang dirancang untuk perusahaan modern. Kelola kehadiran, kinerja, dan data tim dalam satu ekosistem tersinkronisasi.
          </p>

          <div className="grid grid-cols-2 gap-6">
            {[
              { label: "Bank-grade Security", sub: "AES-256 Encryption" },
              { label: "Real-time Tracking", sub: "GPS & Biometric Verification" }
            ].map((item, i) => (
              <div key={i} className="flex flex-col gap-1 border-l-2 border-indigo-500/30 pl-4">
                <span className="text-slate-200 font-semibold">{item.label}</span>
                <span className="text-slate-500 text-sm">{item.sub}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer info */}
        <div className={`flex items-center gap-6 text-sm text-slate-500 transition-all duration-1000 delay-500 ease-out ${mounted ? "opacity-100" : "opacity-0"}`}>
          <span>© {new Date().getFullYear()} Talenta Traincom Indonesia</span>
          <div className="w-1 h-1 rounded-full bg-slate-700" />
          <a href="#" className="hover:text-slate-300 transition-colors">Privacy Policy</a>
          <div className="w-1 h-1 rounded-full bg-slate-700" />
          <a href="#" className="hover:text-slate-300 transition-colors">Terms of Service</a>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          RIGHT PANEL — Login Glass Card
         ═══════════════════════════════════════════════ */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative z-10 w-full">
        <div className="w-full max-w-[440px] perspective-1000">

          {/* Mobile Logo */}
          <div className={`lg:hidden flex justify-center mb-10 transition-all duration-700 ease-out ${mounted ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-8"}`}>
            <img src={talentaLogo} alt="Talenta" className="h-10 w-auto brightness-0 invert" />
          </div>

          {/* Form Card */}
          <div
            className={`
              relative bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] 
              rounded-[28px] p-8 sm:p-10 transition-all duration-700 delay-300 ease-out overflow-hidden
              ${mounted ? "opacity-100 translate-y-0 rotate-x-0" : "opacity-0 translate-y-12 rotate-x-12"}
              ${hasError ? "animate-shake" : ""}
            `}
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Soft inner top glow */}
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            <div className="mb-10 relative z-10">
              <h2 className="text-[26px] font-bold text-white tracking-tight mb-2">Welcome Back</h2>
              <p className="text-slate-400 text-[15px]">Masuk ke sistem HRIS untuk melanjutkan</p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 relative z-10">

                {/* Email Field */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-[11px] font-bold uppercase tracking-widest text-slate-400 pl-1">
                        Work Email
                      </FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center text-slate-500 group-focus-within:text-indigo-400 transition-colors duration-300">
                            <Mail className="h-5 w-5" />
                          </div>
                          <Input
                            {...field}
                            type="email"
                            placeholder="name@company.com"
                            autoComplete="email"
                            className="h-[56px] pl-12 pr-4 rounded-[16px] border-white/10 bg-black/20 text-white placeholder:text-slate-600 focus-visible:bg-white/5 focus-visible:border-indigo-400/50 focus-visible:ring-4 focus-visible:ring-indigo-500/10 transition-all duration-300"
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs text-rose-400 bg-rose-500/10 py-1.5 px-3 rounded-md inline-block mt-2 border border-rose-500/20" />
                    </FormItem>
                  )}
                />

                {/* Password Field */}
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <div className="flex items-center justify-between pl-1">
                        <FormLabel className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                          Password
                        </FormLabel>
                        <a href="#" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
                          Forgot password?
                        </a>
                      </div>
                      <FormControl>
                        <div className="relative group">
                          <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center text-slate-500 group-focus-within:text-indigo-400 transition-colors duration-300">
                            <Lock className="h-5 w-5" />
                          </div>
                          <Input
                            {...field}
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            autoComplete="current-password"
                            className="h-[56px] pl-12 pr-12 rounded-[16px] border-white/10 bg-black/20 text-white placeholder:text-slate-600 focus-visible:bg-white/5 focus-visible:border-indigo-400/50 focus-visible:ring-4 focus-visible:ring-indigo-500/10 transition-all duration-300"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-0 top-0 bottom-0 w-12 flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors"
                            tabIndex={-1}
                          >
                            {showPassword ? (
                              <EyeOff className="h-[18px] w-[18px]" />
                            ) : (
                              <Eye className="h-[18px] w-[18px]" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs text-rose-400 bg-rose-500/10 py-1.5 px-3 rounded-md inline-block mt-2 border border-rose-500/20" />
                    </FormItem>
                  )}
                />

                {/* Remember Me Setup */}
                <FormField
                  control={form.control}
                  name="rememberMe"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 mt-6">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="data-[state=checked]:bg-indigo-500 data-[state=unchecked]:bg-slate-700 h-5 w-9 mt-0.5"
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-medium text-slate-300 cursor-pointer select-none">
                        Keep me signed in
                      </FormLabel>
                    </FormItem>
                  )}
                />

                {/* Submit Logic */}
                <div className="pt-2 mt-8 space-y-4">
                  <Button
                    type="submit"
                    disabled={isLoading || !isOnline}
                    className="w-full h-[56px] rounded-[16px] bg-white text-slate-900 font-semibold text-[15px] shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)] hover:bg-slate-100 active:scale-[0.98] transition-all duration-300 disabled:opacity-80 disabled:cursor-not-allowed group relative overflow-hidden"
                  >
                    {/* Hover Glow Effect inside button */}
                    <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />

                    {isLoading ? (
                      <span className="flex items-center gap-3 relative z-10">
                        <svg className="animate-spin h-5 w-5 text-slate-600" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span className="text-slate-600">Authenticating...</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 relative z-10">
                        Sign In to Talenta
                        <ArrowRight className="h-[18px] w-[18px] group-hover:translate-x-1 transition-transform duration-300" />
                      </span>
                    )}
                  </Button>

                  {/* Divider */}
                  <div className="flex items-center gap-3 w-full py-1">
                    <div className="h-[1px] w-full bg-white/10 rounded-full" />
                    <span className="text-xs text-slate-500 font-medium whitespace-nowrap">ATAU</span>
                    <div className="h-[1px] w-full bg-white/10 rounded-full" />
                  </div>

                  {/* Biometric WebAuthN Button */}
                  <Button
                    type="button"
                    onClick={() => {
                      toast({ title: "Autentikasi Biometrik", description: "Meminta akses Touch ID / Face ID..." });
                    }}
                    disabled={!isOnline}
                    variant="ghost"
                    className="w-full h-[56px] rounded-[16px] border border-white/10 bg-white/[0.03] text-slate-300 font-semibold text-[15px] hover:bg-white/[0.08] hover:text-white transition-all duration-300 flex items-center justify-center gap-2 group shadow-none"
                  >
                    <Fingerprint className="h-[18px] w-[18px] text-slate-400 group-hover:text-white transition-colors" />
                    Login dengan Passkey
                  </Button>
                </div>
              </form>
            </Form>

            {/* Enterprise Security Badge */}
            <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-center gap-2 relative z-10">
              <ShieldCheck className="h-[18px] w-[18px] text-emerald-400" />
              <span className="text-[12px] font-medium text-slate-400">
                Dilindungi otentikasi enterprise-grade
              </span>
            </div>

            {/* Subtle fingerprint watermark */}
            <Fingerprint className="absolute -bottom-8 -right-8 h-40 w-40 text-white/[0.02] pointer-events-none rotate-12" />
          </div>

          {/* Mobile Footer text */}
          <div className={`lg:hidden mt-10 text-center transition-all duration-700 delay-500 ease-out ${mounted ? "opacity-100" : "opacity-0"}`}>
            <p className="text-[12px] text-slate-500 leading-relaxed">
              © {new Date().getFullYear()} Talenta Traincom Indonesia.<br />All rights reserved.
            </p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          CSS ANIMATIONS
         ═══════════════════════════════════════════════ */}
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 15s infinite alternate;
          will-change: transform;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        .animate-shake {
          animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
        }
        .rotate-x-12 {
          transform: perspective(1000px) rotateX(8deg);
        }
        .rotate-x-0 {
          transform: perspective(1000px) rotateX(0deg);
        }
      `}</style>
    </div>
  );
};

export default Auth;
