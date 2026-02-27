import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Lock, Shield, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const passwordSchema = z.object({
  newPassword: z
    .string()
    .min(8, "Password minimal 8 karakter")
    .regex(/[A-Z]/, "Password harus mengandung huruf besar")
    .regex(/[a-z]/, "Password harus mengandung huruf kecil")
    .regex(/[0-9]/, "Password harus mengandung angka"),
  confirmPassword: z.string().min(1, "Konfirmasi password harus diisi"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Password tidak cocok",
  path: ["confirmPassword"],
});

type PasswordFormData = z.infer<typeof passwordSchema>;

const EditPasswordKaryawan = () => {
  const navigate = useNavigate();
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const newPassword = form.watch("newPassword");

  const passwordRequirements = [
    { label: "Minimal 8 karakter", met: newPassword.length >= 8 },
    { label: "Mengandung huruf besar", met: /[A-Z]/.test(newPassword) },
    { label: "Mengandung huruf kecil", met: /[a-z]/.test(newPassword) },
    { label: "Mengandung angka", met: /[0-9]/.test(newPassword) },
  ];

  const onSubmit = async (data: PasswordFormData) => {
    setIsLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: data.newPassword,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Gagal mengubah password",
        description: error.message,
      });
    } else {
      toast({
        title: "Password berhasil diubah",
        description: "Password Anda telah diperbarui.",
      });
      form.reset();
      navigate("/dashboard");
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20 font-['Inter',sans-serif] relative overflow-x-hidden text-slate-900">
      {/* Background Graphic Abstract */}
      <div className="absolute top-0 right-0 -z-0 w-[60vw] h-[40vh] bg-blue-100/40 rounded-full blur-[100px] pointer-events-none opacity-60 transform translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 left-0 -z-0 w-[40vw] h-[40vh] bg-indigo-100/30 rounded-full blur-[100px] pointer-events-none opacity-60 transform -translate-x-1/2 translate-y-1/2"></div>

      {/* Header */}
      <header className="px-6 py-6 md:py-8 max-w-5xl mx-auto relative z-10">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="text-slate-500 hover:text-slate-800 hover:bg-white/50 border border-transparent hover:border-slate-200/60 rounded-xl transition-all shadow-sm bg-white border-slate-100"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali ke Dashboard
          </Button>
        </div>
        <h1 className="text-3xl lg:text-4xl font-extrabold text-slate-800 tracking-tight">Edit Password</h1>
        <p className="text-slate-500 font-medium text-sm mt-2 max-w-md">Kelola keamanan akun Anda dengan memperbarui kata sandi secara berkala.</p>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-4 relative z-10">
        <div className="mx-auto max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white/70 backdrop-blur-md rounded-[24px] border border-white/60 shadow-xl shadow-slate-200/40 overflow-hidden">
            <div className="p-6 border-b border-slate-200/50 flex flex-col items-center text-center">
              <div className="flex h-16 w-16 mb-4 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100/50 border border-blue-100 shadow-sm">
                <Lock className="h-8 w-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Ubah Password</h2>
              <p className="text-sm font-medium text-slate-500 mt-2">
                Pastikan password baru Anda kuat dan belum pernah digunakan sebelumnya.
              </p>
            </div>

            <div className="p-6 md:p-8">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* New Password */}
                  <FormField
                    control={form.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold text-slate-700 uppercase tracking-widest">Password Baru</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              type={showNewPassword ? "text" : "password"}
                              placeholder="Masukkan password baru"
                              className="pr-10 h-12 bg-slate-50 border-slate-200 rounded-xl focus:bg-white focus:ring-blue-500/20 font-medium text-slate-800 shadow-sm transition-all"
                            />
                            <button
                              type="button"
                              className="absolute right-0 top-0 h-full px-4 text-slate-400 hover:text-slate-600 transition-colors"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                            >
                              {showNewPassword ? (
                                <EyeOff className="h-5 w-5" />
                              ) : (
                                <Eye className="h-5 w-5" />
                              )}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Password Requirements */}
                  {newPassword && (
                    <div className="rounded-xl border border-slate-200/60 bg-slate-50/80 p-5 mt-2 transition-all duration-300">
                      <p className="mb-3 text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Persyaratan Password
                      </p>
                      <ul className="space-y-2.5">
                        {passwordRequirements.map((req, index) => (
                          <li
                            key={index}
                            className={cn("flex items-center gap-2.5 text-sm font-medium transition-colors", req.met ? "text-emerald-700" : "text-slate-500")}
                          >
                            <div className={cn("flex items-center justify-center w-5 h-5 rounded-full", req.met ? "bg-emerald-100" : "bg-slate-200/50")}>
                              <CheckCircle2
                                className={cn("h-3.5 w-3.5", req.met ? "text-emerald-600" : "text-slate-400")}
                              />
                            </div>
                            {req.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Confirm Password */}
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold text-slate-700 uppercase tracking-widest mt-2 block">Konfirmasi Password Baru</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              type={showConfirmPassword ? "text" : "password"}
                              placeholder="Masukkan ulang password baru"
                              className="pr-10 h-12 bg-slate-50 border-slate-200 rounded-xl focus:bg-white focus:ring-blue-500/20 font-medium text-slate-800 shadow-sm transition-all"
                            />
                            <button
                              type="button"
                              className="absolute right-0 top-0 h-full px-4 text-slate-400 hover:text-slate-600 transition-colors"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            >
                              {showConfirmPassword ? (
                                <EyeOff className="h-5 w-5" />
                              ) : (
                                <Eye className="h-5 w-5" />
                              )}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Submit Button */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-6 mt-6 border-t border-slate-200/50">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate("/dashboard")}
                      className="flex-1 h-12 rounded-xl border-slate-200 font-bold text-slate-700 hover:bg-slate-50 shadow-sm order-2 sm:order-1"
                    >
                      Batalkan
                    </Button>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-lg shadow-slate-900/20 active:scale-[0.98] transition-all order-1 sm:order-2"
                    >
                      {isLoading ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          Memproses...
                        </div>
                      ) : (
                        "Simpan Password Baru"
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </div>

          {/* Security Tips */}
          <div className="mt-8 rounded-2xl border border-blue-100 bg-blue-50/50 p-6 shadow-sm">
            <h3 className="mb-3 text-xs font-bold text-blue-800 uppercase tracking-widest flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600" /> Tips Keamanan Akun
            </h3>
            <ul className="space-y-2.5 text-sm font-medium text-slate-600">
              <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">•</span> Jangan merekas password yang sama dengan akun platform lain.</li>
              <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">•</span> Hindari menggunakan informasi pribadi seperti tanggal lahir, nomor KTP atau nama lengkap.</li>
              <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">•</span> Disarankan mengganti password secara berkala minimal setiap 3-6 bulan.</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
};

export default EditPasswordKaryawan;
