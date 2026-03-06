import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Key, Search, Users, Eye, EyeOff, RefreshCw,
  ShieldCheck, LockKeyhole, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import EnterpriseLayout from "@/components/layout/EnterpriseLayout";
import { ADMIN_MENU_SECTIONS } from "@/config/menu";

const resetPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, "Kunci akses minimal 8 karakter")
    .regex(/[A-Z]/, "Wajib mengandung huruf kapital")
    .regex(/[a-z]/, "Wajib mengandung karakter non-kapital")
    .regex(/[0-9]/, "Wajib mengandung elemen numerik"),
  confirmPassword: z.string().min(1, "Otorisasi wajib melengkapi validasi sandi ganda"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Sandi ganda tidak selaras (Missmatch)",
  path: ["confirmPassword"],
});

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

interface Employee {
  id: string;
  user_id: string;
  full_name: string | null;
  email?: string;
  department: string | null;
}

const ResetPassword = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("*")
      .order("full_name", { ascending: true });

    if (!error && profiles) {
      setEmployees(profiles);
    }
    setIsLoading(false);
  };

  const generateRandomPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let password = "";
    password += "ABCDEFGHJKLMNPQRSTUVWXYZ"[Math.floor(Math.random() * 24)];
    password += "abcdefghjkmnpqrstuvwxyz"[Math.floor(Math.random() * 24)];
    password += "23456789"[Math.floor(Math.random() * 8)];
    for (let i = 0; i < 5; i++) password += chars[Math.floor(Math.random() * chars.length)];
    password = password.split("").sort(() => Math.random() - 0.5).join("");

    // Animate typing effect
    form.setValue("newPassword", "");
    form.setValue("confirmPassword", "");

    setTimeout(() => {
      form.setValue("newPassword", password, { shouldValidate: true });
      form.setValue("confirmPassword", password, { shouldValidate: true });
    }, 150);
  };

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!selectedEmployee) return;
    setIsResetting(true);

    try {
      const { data: response, error } = await supabase.functions.invoke("reset-password", {
        body: { user_id: selectedEmployee.user_id, new_password: data.newPassword },
      });

      if (error) throw new Error(error.message);
      if (response?.error) throw new Error(response.error);

      toast({
        title: "Pemulihan Akses Selesai",
        description: `Kunci Vault untuk ${selectedEmployee.full_name} telah diregenerasi ke identitas server.`,
      });

      setDialogOpen(false);
      setSelectedEmployee(null);
      form.reset();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Otorisasi Vault Ditolak",
        description: error.message || "Endpoint memblokir pembuatan otentikasi. Silakan coba profil lain.",
      });
    } finally {
      setIsResetting(false);
    }
  };

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <EnterpriseLayout
      title="Vault Credentials"
      menuSections={ADMIN_MENU_SECTIONS}
      breadcrumbs={[
        { label: "Admin", href: "/admin/dashboard" },
        { label: "Recovery & Passwords" },
      ]}
    >
      <div className="max-w-[1400px] mx-auto pb-32">
        {/* Header Hero */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-none mb-3">
              Kunci Kredensial Karyawan
            </h1>
            <p className="text-base text-slate-500 dark:text-slate-400 font-medium max-w-2xl">
              Regenerasi atau pemaksaan setel ulang sandi jaringan internal (LAN/WAN) bagi pegawai yang kehilangan akses aplikasi otentikasi.
            </p>
          </div>

          <div className="hidden md:flex items-center gap-3 px-5 py-3 bg-red-50 dark:bg-red-500/10 rounded-2xl border border-red-100 dark:border-red-500/20 w-fit">
            <LockKeyhole className="w-5 h-5 text-red-600 dark:text-red-400" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-red-700/70 dark:text-red-400/70 uppercase tracking-widest">Security Level</span>
              <span className="text-[14px] font-bold text-red-700 dark:text-red-400 leading-none mt-0.5">High / Administrator</span>
            </div>
          </div>
        </div>

        {/* Search Panel Glass */}
        <div className="bg-white/40 dark:bg-white/[0.02] backdrop-blur-2xl border border-slate-200 dark:border-white/10 rounded-[24px] p-4 flex flex-col md:flex-row gap-4 items-center mb-8 shadow-sm">
          <div className="relative w-full md:max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Telusuri dari Pangkalan Data Karyawan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-14 bg-white dark:bg-black/20 border-slate-200 dark:border-white/10 rounded-xl w-full focus-visible:ring-indigo-500/20 focus-visible:border-indigo-500/50 text-[15px]"
            />
          </div>

          <div className="w-full md:w-auto ml-auto px-4 flex items-center gap-2 text-[13px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-black/30 rounded-xl h-14 justify-center md:px-6 border border-slate-200 dark:border-white/5">
            <ShieldCheck className="w-4 h-4 text-emerald-500" /> Encrypted Vault
          </div>
        </div>

        {/* Identity Datagrid Canvas */}
        <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-[32px] overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <div className="w-10 h-10 border-4 border-slate-900/30 dark:border-white/30 border-t-slate-900 dark:border-t-white rounded-full animate-spin mb-4" />
              <p className="font-medium animate-pulse">Memuat Enkripsi Akun...</p>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-24">
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Users className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Pencarian Tidak Relevan</h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Karyawan dengan rincian kata kunci yang anda masukkan tidak terdaftar didalam server perusahaan T-Absensi.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1 p-3">
              {filteredEmployees.map((employee) => (
                <div key={employee.id} className="p-4 md:p-6 rounded-[24px] bg-white dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-white/[0.04] border border-transparent hover:border-slate-200 dark:hover:border-white/5 transition-all group flex flex-col justify-between h-full shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)]">

                  <div className="flex items-start justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-[16px] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center border border-white dark:border-white/5 text-slate-600 dark:text-slate-300 font-bold text-lg shadow-sm group-hover:scale-105 transition-transform">
                        {employee.full_name?.charAt(0)?.toUpperCase() || "!"}
                      </div>
                      <div>
                        <h4 className="text-[16px] font-bold text-slate-900 dark:text-white tracking-tight line-clamp-1">{employee.full_name || "Tanpa Identitas"}</h4>
                        <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">{employee.department || "No Department Link"}</p>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={() => {
                      setSelectedEmployee(employee);
                      setDialogOpen(true);
                    }}
                    className="w-full h-12 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-white font-bold transition-all border-none shadow-none hover:shadow-sm mt-auto"
                  >
                    <Key className="w-4 h-4 mr-2 text-slate-400 dark:text-slate-300" />
                    Force Password Reset
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Global Key Generation Modal */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md rounded-[32px] dark:bg-slate-900 border-white/10 p-0 overflow-hidden shadow-2xl">
            {/* Top decorative bar */}
            <div className="h-2 w-full bg-slate-900 dark:bg-white" />

            <div className="p-8">
              <DialogHeader className="text-left mb-6">
                <div className="w-14 h-14 bg-slate-100 dark:bg-white/10 rounded-2xl flex items-center justify-center border border-slate-200 dark:border-white/10 mb-5">
                  <Key className="w-7 h-7 text-slate-800 dark:text-white" />
                </div>
                <DialogTitle className="text-2xl font-bold dark:text-white">Generasi Kata Sandi</DialogTitle>
                <DialogDescription className="text-[14px] text-slate-500 dark:text-slate-400 mt-2">
                  Terbitkan kunci otentikasi baru untuk <b className="text-slate-800 dark:text-slate-200">{selectedEmployee?.full_name}</b>. Karyawan wajib memiliki akses perangkat untuk menyimulasikan token masuk baru ini.
                </DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

                  {/* Password Auto Gen Button */}
                  <Button
                    type="button"
                    onClick={generateRandomPassword}
                    className="w-full h-12 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-black/30 dark:hover:bg-black/50 text-slate-600 dark:text-slate-300 font-bold border border-slate-200 dark:border-white/10 border-dashed"
                  >
                    <RefreshCw className="h-4 w-4 mr-3 text-slate-400" />
                    Auto-Generate Aman (Direkomendasikan)
                  </Button>

                  <div className="bg-slate-100/50 dark:bg-black/20 rounded-2xl p-5 border border-slate-200/50 dark:border-white/5 space-y-4">
                    <FormField
                      control={form.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">Kata Sandi Mutlak</FormLabel>
                          <FormControl>
                            <div className="relative group">
                              <Input
                                {...field}
                                type={showPassword ? "text" : "password"}
                                placeholder="[Ketik Kunci Server]"
                                className="h-14 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 pr-12 focus-visible:ring-slate-900 dark:focus-visible:ring-white font-mono text-[16px] tracking-wider transition-all"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg"
                                onClick={() => setShowPassword(!showPassword)}
                              >
                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">Validasi Sandi Identik</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                {...field}
                                type={showPassword ? "text" : "password"}
                                placeholder="[Ulangi Kunci Server]"
                                className="h-14 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 focus-visible:ring-slate-900 dark:focus-visible:ring-white font-mono text-[16px] tracking-wider transition-all"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button type="button" onClick={() => { setDialogOpen(false); form.reset(); }} className="h-12 flex-1 rounded-xl bg-transparent border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 font-bold transition-all">
                      Batalkan Validasi
                    </Button>
                    <Button type="submit" disabled={isResetting} className="h-12 flex-1 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 font-bold shadow-xl shadow-slate-900/20 dark:shadow-white/10 transition-all">
                      {isResetting ? "Otentikasi..." : "Eksekusi Inject Data"}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </EnterpriseLayout>
  );
};

export default ResetPassword;
