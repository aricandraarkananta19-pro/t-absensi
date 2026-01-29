import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Clock, Users, Shield, Sparkles } from "lucide-react";
import talentaLogo from "@/assets/talenta-traincom-logo.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const loginSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(1, "Password harus diisi"),
});

type LoginFormData = z.infer<typeof loginSchema>;

// Floating Particle Component
const FloatingParticle = ({ delay, duration, size, left, top }: {
  delay: number;
  duration: number;
  size: number;
  left: string;
  top: string
}) => (
  <div
    className="absolute rounded-full bg-white/10 animate-float-particle"
    style={{
      width: size,
      height: size,
      left,
      top,
      animationDelay: `${delay}s`,
      animationDuration: `${duration}s`,
    }}
  />
);

// Animated Clock Icon
const AnimatedClock = () => (
  <div className="relative">
    <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center animate-float">
      <Clock className="w-10 h-10 text-white" />
      <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#7dc242] animate-ping" />
    </div>
  </div>
);

// Feature Card Component
const FeatureCard = ({ icon: Icon, title, description, delay }: {
  icon: React.ElementType;
  title: string;
  description: string;
  delay: number;
}) => (
  <div
    className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm animate-slide-up"
    style={{ animationDelay: `${delay}s` }}
  >
    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#7dc242] to-[#5aa530] flex items-center justify-center flex-shrink-0">
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div>
      <h3 className="text-white font-semibold mb-1">{title}</h3>
      <p className="text-white/60 text-sm">{description}</p>
    </div>
  </div>
);

const Auth = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Generate random particles
  const particles = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      delay: Math.random() * 5,
      duration: 15 + Math.random() * 10,
      size: 4 + Math.random() * 8,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
    })), []
  );

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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0066b3] to-[#004080]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-4 border-white/20" />
            <div className="absolute inset-0 h-16 w-16 animate-spin rounded-full border-4 border-white border-t-transparent" />
          </div>
          <p className="text-white/80 animate-pulse">Memuat data pengguna...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen overflow-hidden">
      {/* Left Side - Animated Branding */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative bg-gradient-to-br from-[#0066b3] via-[#0077cc] to-[#004080] overflow-hidden">
        {/* Animated gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#00aaff]/20 via-transparent to-[#7dc242]/10 animate-gradient-shift" />

        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden">
          {particles.map((particle) => (
            <FloatingParticle key={particle.id} {...particle} />
          ))}
        </div>

        {/* Animated decorative circles */}
        <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-[#7dc242]/20 blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-20 right-20 w-80 h-80 rounded-full bg-[#00aaff]/20 blur-3xl animate-pulse-slow" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/3 w-40 h-40 rounded-full bg-white/10 blur-2xl animate-float" />

        {/* Animated mesh gradient */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_600px_600px_at_20%_30%,rgba(125,194,66,0.3),transparent)]" />
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_500px_500px_at_80%_70%,rgba(0,170,255,0.3),transparent)]" />
        </div>

        {/* Animated wave decoration */}
        <svg className="absolute bottom-0 left-0 w-full opacity-20" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path
            fill="currentColor"
            className="text-white animate-wave"
            d="M0,160L48,176C96,192,192,224,288,224C384,224,480,192,576,176C672,160,768,160,864,176C960,192,1056,224,1152,234.7C1248,245,1344,235,1392,229.3L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          />
        </svg>
        <svg className="absolute bottom-0 left-0 w-full opacity-10" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path
            fill="currentColor"
            className="text-white animate-wave-reverse"
            d="M0,256L48,234.7C96,213,192,171,288,165.3C384,160,480,192,576,213.3C672,235,768,245,864,234.7C960,224,1056,192,1152,181.3C1248,171,1344,181,1392,186.7L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          />
        </svg>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full px-12 xl:px-20">
          {/* Animated Logo Container */}
          <div
            className={`bg-white rounded-3xl p-8 shadow-2xl mb-8 transform transition-all duration-1000 ${mounted ? "translate-y-0 opacity-100" : "-translate-y-10 opacity-0"
              }`}
          >
            <img
              src={talentaLogo}
              alt="Talenta Traincom Indonesia"
              className="w-80 xl:w-96 h-auto object-contain"
            />
          </div>

          {/* Animated Clock Icon */}
          <div
            className={`transform transition-all duration-1000 delay-300 ${mounted ? "scale-100 opacity-100" : "scale-90 opacity-0"
              }`}
          >
            <AnimatedClock />
          </div>

          {/* Tagline */}
          <p
            className={`text-xl xl:text-2xl text-white/80 font-light text-center mt-8 transform transition-all duration-1000 delay-500 ${mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              }`}
          >
            Empowering People. Driving Performance.
          </p>

          {/* Feature Cards */}
          <div className="mt-12 space-y-4 w-full max-w-md">
            <FeatureCard
              icon={Clock}
              title="Real-time Attendance"
              description="Track clock-in & clock-out dengan GPS"
              delay={0.7}
            />
            <FeatureCard
              icon={Users}
              title="Employee Management"
              description="Kelola karyawan dengan mudah"
              delay={0.9}
            />
            <FeatureCard
              icon={Shield}
              title="Secure & Reliable"
              description="Data terenkripsi dan aman"
              delay={1.1}
            />
          </div>


        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex flex-col bg-gradient-to-br from-white to-gray-50">
        {/* Mobile Header */}
        <div className="lg:hidden bg-gradient-to-r from-[#0066b3] to-[#0077cc] py-8 px-6 relative overflow-hidden">
          {/* Mobile particles */}
          {particles.slice(0, 8).map((particle) => (
            <FloatingParticle key={particle.id} {...particle} />
          ))}
          <img
            src={talentaLogo}
            alt="Talenta Traincom Indonesia"
            className="h-14 w-auto mx-auto bg-white rounded-lg p-2 relative z-10"
          />
        </div>

        {/* Form Container */}
        <div className="flex-1 flex items-center justify-center px-8 sm:px-12 lg:px-16 xl:px-24">
          <div
            className={`w-full max-w-md transform transition-all duration-1000 ${mounted ? "translate-x-0 opacity-100" : "translate-x-10 opacity-0"
              }`}
          >
            {/* Logo for desktop right side */}
            <div className="hidden lg:block text-center mb-8">
              <div className="inline-flex items-center gap-2 mb-2">
                <Sparkles className="w-6 h-6 text-[#7dc242] animate-pulse" />
                <h1 className="text-3xl font-bold bg-gradient-to-r from-[#0066b3] to-[#0077cc] bg-clip-text text-transparent tracking-wide">
                  T-ABSENSI
                </h1>
                <Sparkles className="w-6 h-6 text-[#7dc242] animate-pulse" />
              </div>
              <p className="text-gray-500 text-sm">Attendance Management System</p>
            </div>

            {/* Welcome Text with animation */}
            <div
              className={`text-center mb-8 transform transition-all duration-700 delay-200 ${mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                }`}
            >
              <h2 className="text-2xl font-semibold text-gray-900">Welcome Back</h2>
              <p className="text-gray-500 mt-1">Please sign in to continue</p>
            </div>

            {/* Login Form with slide-up animation */}
            <div
              className={`transform transition-all duration-700 delay-400 ${mounted ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
                }`}
            >
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-5">
                  <FormField
                    control={loginForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-600 text-sm font-medium">User ID / Email</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            placeholder="Masukkan email"
                            className="h-12 border-gray-300 focus:border-[#0066b3] focus:ring-[#0066b3] rounded-xl bg-white/80 backdrop-blur-sm transition-all duration-300 focus:shadow-lg focus:shadow-[#0066b3]/10"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-600 text-sm font-medium">Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              type={showPassword ? "text" : "password"}
                              placeholder="Masukkan password"
                              className="h-12 border-gray-300 focus:border-[#0066b3] focus:ring-[#0066b3] rounded-xl pr-12 bg-white/80 backdrop-blur-sm transition-all duration-300 focus:shadow-lg focus:shadow-[#0066b3]/10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full px-4 hover:bg-transparent text-gray-400 hover:text-gray-600 transition-colors"
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full h-12 bg-gradient-to-r from-[#0066b3] to-[#0077cc] hover:from-[#0077cc] hover:to-[#0088dd] text-white font-medium rounded-xl mt-6 transition-all duration-300 shadow-lg shadow-[#0066b3]/30 hover:shadow-xl hover:shadow-[#0066b3]/40 hover:scale-[1.02] active:scale-[0.98]"
                    disabled={isLoading || loading}
                  >
                    {isLoading || loading ? (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Signing in...</span>
                      </div>
                    ) : (
                      <span className="flex items-center gap-2">
                        Sign In
                        <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </span>
                    )}
                  </Button>
                </form>
              </Form>
            </div>

            {/* Quick demo info */}
            <div
              className={`mt-8 p-4 rounded-xl bg-gradient-to-r from-[#7dc242]/10 to-[#5aa530]/10 border border-[#7dc242]/20 transform transition-all duration-700 delay-600 ${mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                }`}
            >
              <p className="text-xs text-gray-600 text-center">
                <span className="font-medium text-[#7dc242]">Tip:</span> Hubungi admin untuk mendapatkan akun login
              </p>
            </div>
          </div>
        </div>

        {/* Footer with animation */}
        <div
          className={`py-6 text-center border-t border-gray-100 transform transition-all duration-700 delay-800 ${mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            }`}
        >
          <p className="text-sm text-gray-400">
            Copyright © <span className="font-semibold bg-gradient-to-r from-[#0066b3] to-[#0077cc] bg-clip-text text-transparent">T-ABSENSI</span> by Talenta Traincom Indonesia
          </p>
        </div>
      </div>

      {/* Custom CSS for animations */}
      <style>{`
        @keyframes float-particle {
          0%, 100% {
            transform: translateY(0) translateX(0) scale(1);
            opacity: 0;
          }
          10% {
            opacity: 0.8;
          }
          50% {
            transform: translateY(-100px) translateX(50px) scale(1.2);
            opacity: 0.5;
          }
          90% {
            opacity: 0.2;
          }
        }
        
        @keyframes gradient-shift {
          0%, 100% {
            opacity: 0.5;
            transform: rotate(0deg) scale(1);
          }
          50% {
            opacity: 0.8;
            transform: rotate(180deg) scale(1.1);
          }
        }
        
        @keyframes pulse-slow {
          0%, 100% {
            opacity: 0.2;
            transform: scale(1);
          }
          50% {
            opacity: 0.4;
            transform: scale(1.1);
          }
        }
        
        @keyframes float {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        
        @keyframes wave {
          0%, 100% {
            transform: translateX(0);
          }
          50% {
            transform: translateX(-20px);
          }
        }
        
        @keyframes wave-reverse {
          0%, 100% {
            transform: translateX(0);
          }
          50% {
            transform: translateX(20px);
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
        
        .animate-float-particle {
          animation: float-particle 20s ease-in-out infinite;
        }
        
        .animate-gradient-shift {
          animation: gradient-shift 15s ease-in-out infinite;
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }
        
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        
        .animate-wave {
          animation: wave 8s ease-in-out infinite;
        }
        
        .animate-wave-reverse {
          animation: wave-reverse 6s ease-in-out infinite;
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
