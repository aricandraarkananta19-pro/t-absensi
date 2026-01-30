import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Clock, Users, Shield, Fingerprint, ArrowRight, CheckCircle, Sparkles } from "lucide-react";
import talentaLogo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// Talenta Brand Colors
const BRAND = {
  blue: "#1A5BA8",
  lightBlue: "#00A0E3",
  green: "#7DC242",
};

const loginSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(1, "Password harus diisi"),
});

type LoginFormData = z.infer<typeof loginSchema>;

// Animated Floating Orb
const FloatingOrb = ({
  size,
  color,
  blur,
  top,
  left,
  delay,
  duration
}: {
  size: number;
  color: string;
  blur: number;
  top: string;
  left: string;
  delay: number;
  duration: number;
}) => (
  <div
    className="absolute rounded-full animate-float-orb pointer-events-none"
    style={{
      width: size,
      height: size,
      background: color,
      filter: `blur(${blur}px)`,
      top,
      left,
      animationDelay: `${delay}s`,
      animationDuration: `${duration}s`,
    }}
  />
);

// Animated Grid Pattern
const GridPattern = () => (
  <div className="absolute inset-0 overflow-hidden opacity-[0.03]">
    <svg className="w-full h-full">
      <defs>
        <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>
  </div>
);

// Feature Badge Component
const FeatureBadge = ({
  icon: Icon,
  text,
  delay
}: {
  icon: React.ElementType;
  text: string;
  delay: number;
}) => (
  <div
    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-sm animate-slide-up"
    style={{ animationDelay: `${delay}s` }}
  >
    <Icon className="w-4 h-4" />
    <span>{text}</span>
  </div>
);

// Animated Stats Card
const StatCard = ({
  value,
  label,
  delay
}: {
  value: string;
  label: string;
  delay: number;
}) => (
  <div
    className="text-center animate-slide-up"
    style={{ animationDelay: `${delay}s` }}
  >
    <div className="text-3xl font-bold text-white mb-1">{value}</div>
    <div className="text-sm text-white/60">{label}</div>
  </div>
);

const Auth = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Generate floating orbs
  const orbs = useMemo(() => [
    { size: 400, color: `${BRAND.green}40`, blur: 80, top: "10%", left: "10%", delay: 0, duration: 15 },
    { size: 300, color: `${BRAND.lightBlue}30`, blur: 60, top: "60%", left: "70%", delay: 2, duration: 18 },
    { size: 200, color: `${BRAND.blue}30`, blur: 50, top: "80%", left: "20%", delay: 4, duration: 12 },
    { size: 150, color: `${BRAND.green}25`, blur: 40, top: "30%", left: "80%", delay: 1, duration: 20 },
  ], []);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Navigation Logic based on Role
  useEffect(() => {
    if (!loading && user) {
      if (role) {
        navigate("/dashboard");
      }
    }
  }, [user, role, loading, navigate]);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onLogin = async (data: LoginFormData) => {
    setIsLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Login gagal",
        description: error.message === "Invalid login credentials"
          ? "Email atau password salah"
          : error.message,
      });
      setIsLoading(false);
    } else {
      toast({
        title: "Login berhasil",
        description: "Selamat datang kembali!",
      });
    }
  };

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${BRAND.blue} 0%, ${BRAND.lightBlue} 50%, ${BRAND.green} 100%)` }}
      >
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="h-20 w-20 rounded-2xl bg-white/20 backdrop-blur-lg flex items-center justify-center">
              <img src={talentaLogo} alt="Logo" className="h-12 w-12 object-contain" />
            </div>
            <div className="absolute inset-0 h-20 w-20 animate-ping rounded-2xl border-2 border-white/30" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-1">
              <div className="h-2 w-2 rounded-full bg-white animate-bounce" style={{ animationDelay: "0s" }} />
              <div className="h-2 w-2 rounded-full bg-white animate-bounce" style={{ animationDelay: "0.1s" }} />
              <div className="h-2 w-2 rounded-full bg-white animate-bounce" style={{ animationDelay: "0.2s" }} />
            </div>
            <p className="text-white/80 text-sm">Memuat...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen font-['Inter',system-ui,sans-serif]">
      {/* Left Side - Brand Showcase */}
      <div
        className="hidden lg:flex lg:w-[55%] xl:w-[60%] relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${BRAND.blue} 0%, #0D3A6B 50%, ${BRAND.blue} 100%)`
        }}
      >
        {/* Grid Pattern */}
        <GridPattern />

        {/* Floating Orbs */}
        {orbs.map((orb, i) => (
          <FloatingOrb key={i} {...orb} />
        ))}

        {/* Diagonal Accent Line */}
        <div
          className="absolute -right-20 top-0 bottom-0 w-40 opacity-20"
          style={{
            background: `linear-gradient(45deg, transparent 0%, ${BRAND.lightBlue} 50%, transparent 100%)`,
            transform: "skewX(-15deg)"
          }}
        />

        {/* Content Container */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full px-12 xl:px-20">
          {/* Logo Card */}
          <div
            className={`relative transform transition-all duration-1000 ${mounted ? "translate-y-0 opacity-100 scale-100" : "-translate-y-8 opacity-0 scale-95"
              }`}
          >
            <div className="bg-white rounded-3xl p-8 shadow-2xl shadow-black/20 relative overflow-hidden">
              {/* Shine Effect */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/50 to-transparent translate-x-[-100%] animate-shine" />
              <img
                src={talentaLogo}
                alt="Talenta Traincom Indonesia"
                className="w-72 xl:w-80 h-auto object-contain relative z-10"
              />
            </div>
            {/* Floating Badge */}
            <div
              className="absolute -right-4 -bottom-4 bg-white rounded-2xl px-4 py-2 shadow-lg animate-bounce-slow"
              style={{ animationDelay: "0.5s" }}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${BRAND.green}20` }}>
                  <CheckCircle className="w-4 h-4" style={{ color: BRAND.green }} />
                </div>
                <span className="text-sm font-semibold text-slate-700">Enterprise Ready</span>
              </div>
            </div>
          </div>

          {/* Tagline */}
          <div
            className={`text-center mt-12 transform transition-all duration-1000 delay-300 ${mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              }`}
          >
            <h2 className="text-3xl xl:text-4xl font-bold text-white leading-tight">
              Sistem Absensi
              <br />
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: `linear-gradient(90deg, ${BRAND.lightBlue}, ${BRAND.green})` }}
              >
                Modern & Terpercaya
              </span>
            </h2>
            <p className="text-white/70 text-lg mt-4 max-w-md mx-auto">
              Kelola kehadiran karyawan dengan mudah, akurat, dan real-time
            </p>
          </div>

          {/* Feature Badges */}
          <div
            className={`flex flex-wrap justify-center gap-3 mt-8 transform transition-all duration-1000 delay-500 ${mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              }`}
          >
            <FeatureBadge icon={Clock} text="Real-time Tracking" delay={0.6} />
            <FeatureBadge icon={Fingerprint} text="GPS Verification" delay={0.7} />
            <FeatureBadge icon={Shield} text="Data Secure" delay={0.8} />
          </div>

          {/* Stats Row */}
          <div
            className={`flex items-center justify-center gap-12 mt-16 pt-8 border-t border-white/10 transform transition-all duration-1000 delay-700 ${mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              }`}
          >
            <StatCard value="500+" label="Karyawan Aktif" delay={0.9} />
            <div className="h-12 w-px bg-white/20" />
            <StatCard value="99.9%" label="Uptime" delay={1.0} />
            <div className="h-12 w-px bg-white/20" />
            <StatCard value="24/7" label="Support" delay={1.1} />
          </div>
        </div>

        {/* Bottom Wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" className="w-full h-auto opacity-10">
            <path
              fill="white"
              d="M0,64L80,69.3C160,75,320,85,480,80C640,75,800,53,960,48C1120,43,1280,53,1360,58.7L1440,64L1440,120L1360,120C1280,120,1120,120,960,120C800,120,640,120,480,120C320,120,160,120,80,120L0,120Z"
            />
          </svg>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex flex-col bg-gradient-to-br from-white via-slate-50 to-blue-50/30">
        {/* Mobile Header */}
        <div
          className="lg:hidden py-10 px-6 relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${BRAND.blue} 0%, ${BRAND.lightBlue} 100%)`
          }}
        >
          <div className="absolute inset-0 opacity-20">
            <GridPattern />
          </div>
          <div className="relative z-10 flex flex-col items-center">
            <div className="bg-white rounded-2xl p-4 shadow-lg mb-4">
              <img
                src={talentaLogo}
                alt="Talenta Traincom Indonesia"
                className="h-12 w-auto"
              />
            </div>
            <h1 className="text-white font-bold text-xl">T-ABSENSI</h1>
            <p className="text-white/70 text-sm">Enterprise HRIS System</p>
          </div>
        </div>

        {/* Form Container */}
        <div className="flex-1 flex items-center justify-center px-6 sm:px-12 lg:px-16 xl:px-20 py-8">
          <div
            className={`w-full max-w-md transform transition-all duration-1000 ${mounted ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"
              }`}
          >
            {/* Desktop Header */}
            <div className="hidden lg:block text-center mb-10">
              <div className="inline-flex flex-col items-center gap-2">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
                    style={{
                      background: `linear-gradient(135deg, ${BRAND.blue} 0%, ${BRAND.lightBlue} 100%)`
                    }}
                  >
                    <Clock className="w-6 h-6 text-white" />
                  </div>
                  <h1 className="text-3xl font-bold text-slate-800">T-ABSENSI</h1>
                </div>
                <div
                  className="h-1 w-20 rounded-full"
                  style={{
                    background: `linear-gradient(90deg, ${BRAND.blue}, ${BRAND.green})`
                  }}
                />
              </div>
            </div>

            {/* Welcome Text */}
            <div
              className={`text-center mb-8 transform transition-all duration-700 delay-200 ${mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                }`}
            >
              <h2 className="text-2xl font-bold text-slate-800">Selamat Datang</h2>
              <p className="text-slate-500 mt-2">Masuk untuk melanjutkan ke dashboard</p>
            </div>

            {/* Login Form Card */}
            <div
              className={`bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100 transform transition-all duration-700 delay-300 ${mounted ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
                }`}
            >
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-6">
                  <FormField
                    control={loginForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 font-medium">Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              type="email"
                              placeholder="nama@perusahaan.com"
                              onFocus={() => setFocusedField("email")}
                              onBlur={() => setFocusedField(null)}
                              className="h-12 pl-4 pr-4 border-slate-200 rounded-xl bg-slate-50/50 transition-all duration-300 focus:bg-white focus:border-2 focus:shadow-lg"
                              style={{
                                borderColor: focusedField === "email" ? BRAND.blue : undefined,
                                boxShadow: focusedField === "email" ? `0 0 0 4px ${BRAND.blue}15` : undefined
                              }}
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-500" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 font-medium">Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              type={showPassword ? "text" : "password"}
                              placeholder="Masukkan password"
                              onFocus={() => setFocusedField("password")}
                              onBlur={() => setFocusedField(null)}
                              className="h-12 pl-4 pr-12 border-slate-200 rounded-xl bg-slate-50/50 transition-all duration-300 focus:bg-white focus:border-2 focus:shadow-lg"
                              style={{
                                borderColor: focusedField === "password" ? BRAND.blue : undefined,
                                boxShadow: focusedField === "password" ? `0 0 0 4px ${BRAND.blue}15` : undefined
                              }}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 top-1 h-10 w-10 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? (
                                <EyeOff className="h-5 w-5" />
                              ) : (
                                <Eye className="h-5 w-5" />
                              )}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-500" />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full h-12 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] group"
                    style={{
                      background: `linear-gradient(135deg, ${BRAND.blue} 0%, ${BRAND.lightBlue} 100%)`,
                      boxShadow: `0 8px 20px ${BRAND.blue}40`
                    }}
                    disabled={isLoading || loading}
                  >
                    {isLoading || loading ? (
                      <div className="flex items-center gap-3">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Memproses...</span>
                      </div>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        Masuk
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </span>
                    )}
                  </Button>
                </form>
              </Form>
            </div>

            {/* Help Box */}
            <div
              className={`mt-6 p-4 rounded-2xl border transition-all duration-700 delay-500 ${mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                }`}
              style={{
                backgroundColor: `${BRAND.green}08`,
                borderColor: `${BRAND.green}25`
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${BRAND.green}20` }}
                >
                  <Sparkles className="w-5 h-5" style={{ color: BRAND.green }} />
                </div>
                <div>
                  <p className="font-medium text-slate-700 text-sm">Butuh bantuan?</p>
                  <p className="text-slate-500 text-sm mt-0.5">
                    Hubungi admin untuk mendapatkan akses akun
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className={`py-6 text-center border-t border-slate-100 bg-white/50 backdrop-blur-sm transform transition-all duration-700 delay-700 ${mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            }`}
        >
          <p className="text-sm text-slate-500">
            © 2025{" "}
            <span
              className="font-semibold bg-clip-text text-transparent"
              style={{ backgroundImage: `linear-gradient(90deg, ${BRAND.blue}, ${BRAND.lightBlue})` }}
            >
              Talenta Traincom Indonesia
            </span>
            . All rights reserved.
          </p>
        </div>
      </div>

      {/* Animation Styles */}
      <style>{`
        @keyframes float-orb {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          25% {
            transform: translate(30px, -30px) scale(1.1);
          }
          50% {
            transform: translate(-20px, 20px) scale(0.95);
          }
          75% {
            transform: translate(20px, 10px) scale(1.05);
          }
        }
        
        @keyframes shine {
          0% {
            transform: translateX(-100%) rotate(15deg);
          }
          50%, 100% {
            transform: translateX(200%) rotate(15deg);
          }
        }
        
        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }
        
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-float-orb {
          animation: float-orb 20s ease-in-out infinite;
        }
        
        .animate-shine {
          animation: shine 3s ease-in-out infinite;
          animation-delay: 1s;
        }
        
        .animate-bounce-slow {
          animation: bounce-slow 3s ease-in-out infinite;
        }
        
        .animate-slide-up {
          animation: slide-up 0.6s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </div>
  );
};

export default Auth;
