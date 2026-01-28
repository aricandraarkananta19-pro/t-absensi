import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
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

const Auth = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-white border-t-transparent" />
          <p className="text-white/80 animate-pulse">Memuat data pengguna...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative bg-gradient-to-br from-[#0066b3] via-[#0077cc] to-[#004080] overflow-hidden">
        {/* Decorative backgrounds */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#00aaff]/20 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-[#003366] to-transparent opacity-50" />

        {/* Decorative circles */}
        <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-[#7dc242]/10 blur-3xl" />
        <div className="absolute bottom-20 right-20 w-80 h-80 rounded-full bg-[#00aaff]/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/3 w-40 h-40 rounded-full bg-white/5 blur-2xl" />

        {/* Wave decoration */}
        <svg className="absolute bottom-0 left-0 w-full opacity-10" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path fill="currentColor" className="text-white" d="M0,160L48,176C96,192,192,224,288,224C384,224,480,192,576,176C672,160,768,160,864,176C960,192,1056,224,1152,234.7C1248,245,1344,235,1392,229.3L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
        </svg>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full px-12 xl:px-20">
          {/* Logo */}
          <div className="bg-white rounded-3xl p-8 shadow-2xl mb-8">
            <img
              src={talentaLogo}
              alt="Talenta Traincom Indonesia"
              className="w-80 xl:w-96 h-auto object-contain"
            />
          </div>

          {/* Tagline */}
          <p className="text-xl xl:text-2xl text-white/80 font-light text-center mt-6">
            Empowering People. Driving Performance.
          </p>

          {/* Additional decoration */}
          <div className="absolute bottom-16 left-12 right-12 flex justify-center">
            <div className="flex items-center gap-3 px-6 py-3 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm">
              <div className="w-2 h-2 rounded-full bg-[#7dc242] animate-pulse" />
              <span className="text-white/70 text-sm">Sistem Absensi & Manajemen Karyawan</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Mobile Header */}
        <div className="lg:hidden bg-gradient-to-r from-[#0066b3] to-[#0077cc] py-6 px-6">
          <img
            src={talentaLogo}
            alt="Talenta Traincom Indonesia"
            className="h-12 w-auto mx-auto bg-white rounded-lg p-2"
          />
        </div>

        {/* Form Container */}
        <div className="flex-1 flex items-center justify-center px-8 sm:px-12 lg:px-16 xl:px-24">
          <div className="w-full max-w-md">
            {/* Logo for desktop right side */}
            <div className="hidden lg:block text-center mb-8">
              <h1 className="text-3xl font-bold text-[#0066b3] tracking-wide">
                T-ABSENSI
              </h1>
              <p className="text-gray-500 text-sm mt-1">Attendance Management System</p>
            </div>

            {/* Welcome Text */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-gray-900">Welcome Back</h2>
              <p className="text-gray-500 mt-1">Please sign in to continue</p>
            </div>



            {/* Login Form */}
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
                          className="h-12 border-gray-300 focus:border-[#0066b3] focus:ring-[#0066b3] rounded-lg"
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
                            className="h-12 border-gray-300 focus:border-[#0066b3] focus:ring-[#0066b3] rounded-lg pr-12"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-4 hover:bg-transparent text-gray-400 hover:text-gray-600"
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
                  className="w-full h-12 bg-[#0066b3] hover:bg-[#0077cc] text-white font-medium rounded-lg mt-6 transition-all duration-200 shadow-lg shadow-[#0066b3]/30"
                  disabled={isLoading || loading}
                >
                  {isLoading || loading ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Signing in...</span>
                    </div>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
            </Form>
          </div>
        </div>

        {/* Footer */}
        <div className="py-6 text-center border-t border-gray-100">
          <p className="text-sm text-gray-400">
            Copyright © <span className="font-semibold text-[#0066b3]">T-ABSENSI</span> by Talenta Traincom Indonesia
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
