import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Lock, Mail, ArrowRight, ShieldCheck } from "lucide-react";
import talentaLogo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// ─── Schema ──────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});
type LoginFormData = z.infer<typeof loginSchema>;

// ─── Component ───────────────────────────────────────────
const Auth = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Trigger mount animation after a tick
    const t = setTimeout(() => setMounted(true), 50);
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
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (error) {
      toast({
        variant: "destructive",
        title: "Login gagal",
        description:
          error.message === "Invalid login credentials"
            ? "Email atau password salah"
            : error.message,
      });
      setIsLoading(false);
    } else {
      toast({ title: "Login berhasil", description: "Selamat datang kembali!" });
    }
  };

  // ─── Loading State ───────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9fb]">
        <div className="flex flex-col items-center gap-5">
          <div className="relative">
            <div className="h-16 w-16 rounded-2xl bg-white shadow-lg flex items-center justify-center">
              <img src={talentaLogo} alt="Logo" className="h-10 w-10 object-contain" />
            </div>
            <div className="absolute -inset-1 rounded-2xl border-2 border-blue-200 animate-ping opacity-30" />
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-2 w-2 rounded-full bg-blue-500 animate-bounce"
                style={{ animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Main Render ─────────────────────────────────────
  return (
    <div className="flex min-h-screen font-['Inter',system-ui,sans-serif] bg-[#f8f9fb]">
      {/* ═══════════════════════════════════════════════
          LEFT PANEL — Brand Showcase (Desktop Only)
         ═══════════════════════════════════════════════ */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] relative overflow-hidden bg-[#0f172a]">
        {/* Soft radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(59,130,246,0.15) 0%, transparent 70%)",
          }}
        />

        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.04]">
          <svg className="w-full h-full">
            <defs>
              <pattern id="saas-grid" width="48" height="48" patternUnits="userSpaceOnUse">
                <path d="M 48 0 L 0 0 0 48" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#saas-grid)" />
          </svg>
        </div>

        {/* Floating geometric accents */}
        <div
          className="absolute top-[15%] left-[10%] w-72 h-72 rounded-full pointer-events-none auth-float"
          style={{
            background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)",
            animationDelay: "0s",
          }}
        />
        <div
          className="absolute bottom-[20%] right-[5%] w-96 h-96 rounded-full pointer-events-none auth-float"
          style={{
            background: "radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)",
            animationDelay: "3s",
          }}
        />
        <div
          className="absolute top-[60%] left-[50%] w-48 h-48 rounded-full pointer-events-none auth-float"
          style={{
            background: "radial-gradient(circle, rgba(34,197,94,0.08) 0%, transparent 70%)",
            animationDelay: "6s",
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full px-14 xl:px-20">
          {/* Logo Card */}
          <div
            className={`transition-all duration-1000 ease-out ${mounted ? "translate-y-0 opacity-100 scale-100" : "-translate-y-6 opacity-0 scale-95"
              }`}
          >
            <div className="bg-white rounded-[28px] p-7 shadow-2xl shadow-black/20">
              <img
                src={talentaLogo}
                alt="Talenta Traincom Indonesia"
                className="w-64 xl:w-72 h-auto object-contain"
              />
            </div>
          </div>

          {/* Tagline */}
          <div
            className={`text-center mt-12 max-w-lg transition-all duration-1000 delay-200 ease-out ${mounted ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
              }`}
          >
            <h2 className="text-[2rem] xl:text-[2.25rem] font-bold text-white leading-[1.2] tracking-tight">
              Human Resources
              <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-300">
                Information System
              </span>
            </h2>
            <p className="text-slate-400 text-[15px] mt-5 leading-relaxed max-w-sm mx-auto">
              Platform enterprise untuk mengelola kehadiran, kinerja, dan data karyawan secara real-time.
            </p>
          </div>

          {/* Feature pills */}
          <div
            className={`flex flex-wrap justify-center gap-2.5 mt-10 transition-all duration-1000 delay-400 ease-out ${mounted ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
              }`}
          >
            {[
              "Real-time Attendance",
              "GPS Verification",
              "Work Journals",
              "Leave Management",
            ].map((feat, i) => (
              <span
                key={feat}
                className="px-4 py-2 rounded-full text-[13px] font-medium text-slate-300 bg-white/[0.06] border border-white/[0.08] backdrop-blur-sm"
                style={{ animationDelay: `${0.5 + i * 0.1}s` }}
              >
                {feat}
              </span>
            ))}
          </div>

          {/* Stats strip */}
          <div
            className={`flex items-center gap-10 mt-16 pt-8 border-t border-white/[0.06] transition-all duration-1000 delay-500 ease-out ${mounted ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
              }`}
          >
            {[
              { value: "500+", label: "Karyawan" },
              { value: "99.9%", label: "Uptime" },
              { value: "24/7", label: "Monitoring" },
            ].map((stat, i) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-xs text-slate-500 mt-1 font-medium tracking-wide uppercase">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          RIGHT PANEL — Login Form
         ═══════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col relative">
        {/* ── Mobile branded header ── */}
        <div className="lg:hidden relative overflow-hidden" style={{ background: "#0f172a" }}>
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 100% 80% at 50% 30%, rgba(59,130,246,0.12) 0%, transparent 70%)",
            }}
          />
          <div className="relative z-10 flex flex-col items-center pt-12 pb-8 px-6">
            <div
              className={`bg-white rounded-2xl p-4 shadow-xl transition-all duration-700 ${mounted ? "scale-100 opacity-100" : "scale-90 opacity-0"
                }`}
            >
              <img src={talentaLogo} alt="Logo" className="w-40 h-auto object-contain" />
            </div>
            <p className="text-slate-400 text-sm mt-4 font-medium">Human Resources Information System</p>
          </div>
        </div>

        {/* ── Form Container ── */}
        <div className="flex-1 flex items-center justify-center px-6 sm:px-10 lg:px-16 xl:px-24 py-10">
          <div
            className={`w-full max-w-[420px] transition-all duration-700 ease-out ${mounted ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
              }`}
          >
            {/* Desktop logo hint (hidden on mobile because we have header) */}
            <div className="hidden lg:flex items-center gap-3 mb-10">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <img src={talentaLogo} alt="Logo" className="w-6 h-6 object-contain brightness-0 invert" />
              </div>
              <span className="text-[17px] font-bold text-slate-800 tracking-tight">Talenta Traincom</span>
            </div>

            {/* Title */}
            <div className="mb-8">
              <h1 className="text-[26px] font-bold text-slate-900 tracking-tight">
                Selamat Datang
              </h1>
              <p className="text-slate-500 text-[15px] mt-1.5">
                Masuk ke akun Anda untuk melanjutkan
              </p>
            </div>

            {/* ── Login Card ── */}
            <div
              className={`bg-white rounded-[24px] p-7 sm:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-slate-200/60 transition-all duration-700 delay-150 ease-out ${mounted ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
                }`}
            >
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  {/* Email */}
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[13px] font-semibold text-slate-700 ml-1">
                          Email
                        </FormLabel>
                        <FormControl>
                          <div className="relative group">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                            <Input
                              {...field}
                              type="email"
                              placeholder="nama@perusahaan.com"
                              autoComplete="email"
                              className="h-[52px] pl-11 pr-4 rounded-[16px] border-slate-200 bg-slate-50/60 text-[15px] placeholder:text-slate-400 focus-visible:bg-white focus-visible:border-blue-500 focus-visible:ring-4 focus-visible:ring-blue-500/10 transition-all duration-200"
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-xs text-red-500 ml-1 mt-1" />
                      </FormItem>
                    )}
                  />

                  {/* Password */}
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[13px] font-semibold text-slate-700 ml-1">
                          Password
                        </FormLabel>
                        <FormControl>
                          <div className="relative group">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                            <Input
                              {...field}
                              type={showPassword ? "text" : "password"}
                              placeholder="••••••••"
                              autoComplete="current-password"
                              className="h-[52px] pl-11 pr-12 rounded-[16px] border-slate-200 bg-slate-50/60 text-[15px] placeholder:text-slate-400 focus-visible:bg-white focus-visible:border-blue-500 focus-visible:ring-4 focus-visible:ring-blue-500/10 transition-all duration-200"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
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
                        <FormMessage className="text-xs text-red-500 ml-1 mt-1" />
                      </FormItem>
                    )}
                  />

                  {/* Submit */}
                  <div className="pt-2">
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full h-[52px] rounded-[16px] bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-[15px] shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:brightness-110 active:scale-[0.98] transition-all duration-200 disabled:opacity-60"
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2.5">
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle
                              className="opacity-20"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="3"
                              fill="none"
                            />
                            <path
                              className="opacity-80"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            />
                          </svg>
                          Memproses...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          Masuk
                          <ArrowRight className="h-4 w-4" />
                        </span>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>

              {/* Security Indicator */}
              <div className="flex items-center justify-center gap-1.5 mt-5 pt-5 border-t border-slate-100">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-[12px] text-slate-400 font-medium">
                  Dilindungi enkripsi enterprise-grade
                </span>
              </div>
            </div>

            {/* Help text */}
            <div
              className={`mt-6 text-center transition-all duration-700 delay-300 ease-out ${mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                }`}
            >
              <p className="text-[13px] text-slate-400">
                Belum punya akun?{" "}
                <span className="text-blue-600 font-medium">Hubungi administrator</span>
              </p>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div
          className={`py-5 text-center border-t border-slate-100/80 bg-white/40 backdrop-blur-sm transition-all duration-700 delay-500 ease-out ${mounted ? "opacity-100" : "opacity-0"
            }`}
        >
          <p className="text-[12px] text-slate-400">
            © {new Date().getFullYear()}{" "}
            <span className="font-semibold text-slate-500">Talenta Traincom Indonesia</span>
            . All rights reserved.
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          ANIMATION STYLES
         ═══════════════════════════════════════════════ */}
      <style>{`
        @keyframes auth-float {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(15px, -20px) scale(1.05);
          }
          66% {
            transform: translate(-10px, 10px) scale(0.97);
          }
        }

        .auth-float {
          animation: auth-float 20s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default Auth;
