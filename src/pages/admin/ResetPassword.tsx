import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Key, Search, Users, Eye, EyeOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import EnterpriseLayout from "@/components/layout/EnterpriseLayout";
import { ADMIN_MENU_SECTIONS } from "@/config/menu";

const resetPasswordSchema = z.object({
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
    // Ensure at least one uppercase, one lowercase, one number
    password += "ABCDEFGHJKLMNPQRSTUVWXYZ"[Math.floor(Math.random() * 24)];
    password += "abcdefghjkmnpqrstuvwxyz"[Math.floor(Math.random() * 24)];
    password += "23456789"[Math.floor(Math.random() * 8)];
    for (let i = 0; i < 5; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }
    // Shuffle
    password = password.split("").sort(() => Math.random() - 0.5).join("");
    form.setValue("newPassword", password);
    form.setValue("confirmPassword", password);
  };

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!selectedEmployee) return;
    setIsResetting(true);

    try {
      const { data: response, error } = await supabase.functions.invoke("reset-password", {
        body: {
          user_id: selectedEmployee.user_id,
          new_password: data.newPassword,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (response?.error) {
        throw new Error(response.error);
      }

      toast({
        title: "Berhasil",
        description: `Password untuk ${selectedEmployee.full_name} telah berhasil direset.`,
      });

      setDialogOpen(false);
      setSelectedEmployee(null);
      form.reset();
    } catch (error: any) {
      console.error("Reset password error:", error);
      toast({
        variant: "destructive",
        title: "Gagal",
        description: error.message || "Gagal mereset password. Silakan coba lagi.",
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
      title="Reset Password"
      subtitle="Reset password karyawan"
      roleLabel="Administrator"
      showExport={false}
      menuSections={ADMIN_MENU_SECTIONS}
    >
      <div className="pb-8">

        {/* Main Content */}
        <main className="max-w-[1400px] w-full mx-auto">
          {/* Search */}
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Cari karyawan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 bg-white dark:bg-slate-900/70 backdrop-blur-md border-slate-200/60 rounded-xl shadow-sm focus:ring-2 focus:ring-slate-200/50 font-medium text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-900/70 backdrop-blur-md rounded-[20px] border border-white/60 shadow-sm shadow-slate-200/40 overflow-hidden vibe-glass-card">
            <div className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-300 border-t-slate-700" />
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800/80 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Users className="h-8 w-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">Tidak Ada Data</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">Belum ada karyawan terdaftar</p>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                          <TableHead className="font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Nama</TableHead>
                          <TableHead className="font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Departemen</TableHead>
                          <TableHead className="w-[120px] font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEmployees.map((employee) => (
                          <TableRow key={employee.id} className="hover:bg-slate-50/50 dark:bg-slate-800/50 transition-colors">
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center">
                                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                    {employee.full_name?.charAt(0)?.toUpperCase() || "?"}
                                  </span>
                                </div>
                                <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{employee.full_name || "-"}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-slate-500 dark:text-slate-400 text-sm">
                              {employee.department || "-"}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-2 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:bg-slate-800 font-semibold text-xs h-9"
                                onClick={() => {
                                  setSelectedEmployee(employee);
                                  setDialogOpen(true);
                                }}
                              >
                                <Key className="h-3.5 w-3.5" />
                                Reset
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden flex flex-col p-4 gap-3">
                    {filteredEmployees.map((employee) => (
                      <div key={employee.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-4 flex items-center justify-between gap-3">
                        <div className="flex gap-3 items-center min-w-0">
                          <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                              {employee.full_name?.charAt(0)?.toUpperCase() || "?"}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white text-sm truncate">{employee.full_name || "-"}</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{employee.department || "-"}</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:bg-slate-800 font-semibold text-xs h-9 flex-shrink-0"
                          onClick={() => {
                            setSelectedEmployee(employee);
                            setDialogOpen(true);
                          }}
                        >
                          <Key className="h-3.5 w-3.5" />
                          Reset
                        </Button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Reset Password Dialog */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="rounded-[20px] border-slate-200/60">
              <DialogHeader>
                <DialogTitle className="text-lg font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">Reset Password</DialogTitle>
                <DialogDescription className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                  Reset password untuk <span className="font-bold text-slate-700 dark:text-slate-200">{selectedEmployee?.full_name}</span>
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={generateRandomPassword} className="gap-2 rounded-xl border-slate-200 dark:border-slate-700 font-semibold text-xs">
                      <RefreshCw className="h-3.5 w-3.5" />
                      Generate Password
                    </Button>
                  </div>

                  <FormField
                    control={form.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password Baru</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              type={showPassword ? "text" : "password"}
                              placeholder="Masukkan password baru"
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                        <FormLabel>Konfirmasi Password</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type={showPassword ? "text" : "password"}
                            placeholder="Konfirmasi password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <Button type="button" variant="outline" className="flex-1 h-11 rounded-xl border-slate-200 dark:border-slate-700 font-bold" onClick={() => {
                      setDialogOpen(false);
                      form.reset();
                    }}>
                      Batal
                    </Button>
                    <Button type="submit" className="flex-1 h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-lg shadow-slate-900/20" disabled={isResetting}>
                      {isResetting ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      ) : (
                        "Reset Password"
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </EnterpriseLayout>
  );
};

export default ResetPassword;
