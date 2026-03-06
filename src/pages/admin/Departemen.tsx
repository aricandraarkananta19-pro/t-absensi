import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Building2, Plus, Search, Edit, Trash2, Users, MoreHorizontal,
  Briefcase, Building, Layers, SearchX
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/useIsMobile";
import EnterpriseLayout from "@/components/layout/EnterpriseLayout";
import { ADMIN_MENU_SECTIONS } from "@/config/menu";
import { cn } from "@/lib/utils";

const departmentSchema = z.object({
  name: z.string().min(2, "Nama departemen minimal 2 karakter"),
});

type DepartmentFormData = z.infer<typeof departmentSchema>;

interface Department {
  name: string;
  employeeCount: number;
  managerCount: number;
  employees: string[];
}

const Departemen = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const form = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentSchema),
    defaultValues: { name: "" },
  });

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    setIsLoading(true);

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("user_id, full_name, department");

    if (error || !profiles) {
      setIsLoading(false);
      return;
    }

    const userIds = profiles.map(p => p.user_id);
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", userIds);

    const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);
    const deptMap = new Map<string, Department>();

    profiles.forEach(p => {
      if (!p.department) return;

      const deptName = p.department;
      const role = roleMap.get(p.user_id);

      if (!deptMap.has(deptName)) {
        deptMap.set(deptName, {
          name: deptName,
          employeeCount: 0,
          managerCount: 0,
          employees: []
        });
      }

      const dept = deptMap.get(deptName)!;
      dept.employeeCount++;
      if (role === 'manager') dept.managerCount++;
      if (dept.employees.length < 3) dept.employees.push(p.full_name || "Unknown");
    });

    const deptList = Array.from(deptMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    setDepartments(deptList);
    setIsLoading(false);
  };

  const handleAddNew = () => {
    setEditingDepartment(null);
    form.reset({ name: "" });
    setDialogOpen(true);
  };

  const onSubmit = async (data: DepartmentFormData) => {
    setIsSubmitting(true);

    if (editingDepartment) {
      const { error } = await supabase
        .from("profiles")
        .update({ department: data.name })
        .eq("department", editingDepartment);

      if (error) {
        toast({ variant: "destructive", title: "Gagal Update", description: error.message });
      } else {
        toast({ title: "Departemen Diperbarui", description: `Nama departemen berahisl diubah menjadi ${data.name}` });
        setDialogOpen(false);
        setEditingDepartment(null);
        fetchDepartments();
      }
    } else {
      if (departments.some(d => d.name.toLowerCase() === data.name.toLowerCase())) {
        toast({ variant: "destructive", title: "Gagal", description: "Departemen sudah terdaftar didalam sistem." });
      } else {
        toast({ title: "Departemen Tersimpan", description: `Struktur divisi "${data.name}" siap digunakan.` });
        toast({ title: "Info Integrasi", description: "Silakan tetapkan karyawan ke departemen ini agar muncul di daftar metrik." });
        setDialogOpen(false);
      }
    }
    setIsSubmitting(false);
  };

  const handleEdit = (deptName: string) => {
    setEditingDepartment(deptName);
    form.reset({ name: deptName });
    setDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const deptName = deleteTarget;
    setDeleteTarget(null);

    const { error } = await supabase
      .from("profiles")
      .update({ department: null })
      .eq("department", deptName);

    if (error) {
      toast({ variant: "destructive", title: "Penghapusan Gagal", description: error.message });
    } else {
      toast({ title: "Penghapusan Berhasil", description: `Struktur Departemen ${deptName} telah dihapus.` });
      fetchDepartments();
    }
  };

  const filteredDepartments = departments.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = useMemo(() => ({
    totalDepts: departments.length,
    totalEmployees: departments.reduce((sum, d) => sum + d.employeeCount, 0),
    totalManagers: departments.reduce((sum, d) => sum + d.managerCount, 0),
  }), [departments]);

  return (
    <EnterpriseLayout
      title="Architecture Panel"
      menuSections={ADMIN_MENU_SECTIONS}
      breadcrumbs={[
        { label: "Admin", href: "/admin/dashboard" },
        { label: "Manajemen Struktur" },
      ]}
    >
      <div className="max-w-[1400px] mx-auto pb-32">
        {/* Page Header */}
        <div className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-none mb-3">
              Organization Structure
            </h1>
            <p className="text-base text-slate-500 dark:text-slate-400 font-medium">
              Analisis dan kendali seluruh hirarki staf dan komando tim.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <Button onClick={handleAddNew} className="h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold px-6 shadow-lg shadow-indigo-500/20 group transition-all">
              <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform" />
              Tambah Departemen
            </Button>
          </div>
        </div>

        {/* Global Stats Metrix */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
          {/* Stat: Depts */}
          <div className="bg-white/50 dark:bg-white/[0.02] border border-white/20 dark:border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-sm relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-colors" />
            <div className="flex items-center justify-between relative z-10">
              <div>
                <p className="text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Total Unit</p>
                <h3 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">{stats.totalDepts}</h3>
              </div>
              <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-100 dark:border-indigo-500/20">
                <Building className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>
          </div>

          {/* Stat: Managers */}
          <div className="bg-white/50 dark:bg-white/[0.02] border border-white/20 dark:border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-sm relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-colors" />
            <div className="flex items-center justify-between relative z-10">
              <div>
                <p className="text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Total Lead</p>
                <h3 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">{stats.totalManagers}</h3>
              </div>
              <div className="w-14 h-14 bg-blue-50 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-100 dark:border-blue-500/20">
                <Briefcase className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          {/* Stat: Employees */}
          <div className="bg-white/50 dark:bg-white/[0.02] border border-white/20 dark:border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-sm relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-colors" />
            <div className="flex items-center justify-between relative z-10">
              <div>
                <p className="text-[13px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Total Staff</p>
                <h3 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">{stats.totalEmployees}</h3>
              </div>
              <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-100 dark:border-emerald-500/20">
                <Users className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Global Toolbars */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white/40 dark:bg-white/[0.02] p-4 rounded-[20px] backdrop-blur-xl border border-white/20 dark:border-white/5 mb-8">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Cari struktur departemen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 bg-white dark:bg-black/20 border-slate-200 dark:border-white/10 rounded-xl w-full focus-visible:ring-indigo-500/20 focus-visible:border-indigo-500/50"
            />
          </div>

          <div className="w-full sm:w-auto md:hidden">
            <Button onClick={handleAddNew} className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold">
              <Plus className="w-5 h-5 mr-2" />
              Tambah Departemen
            </Button>
          </div>
        </div>

        {/* Dynamic Canvas Grid */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-4" />
            <p className="font-medium animate-pulse">Menghubungkan Database...</p>
          </div>
        ) : filteredDepartments.length === 0 ? (
          <div className="text-center py-24 bg-white/30 dark:bg-white/[0.02] rounded-[32px] border border-dashed border-slate-300 dark:border-slate-800 backdrop-blur-lg">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
              {searchQuery ? <SearchX className="w-10 h-10 text-slate-400" /> : <Layers className="w-10 h-10 text-slate-400" />}
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              {searchQuery ? "Departemen Tidak Ditemukan" : "Ruang Kosong"}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-sm mx-auto">
              {searchQuery
                ? `Tidak ada departemen yang cocok dengan kata kunci "${searchQuery}".`
                : "Belum ada alokasi struktur organisasi. Tekan tombol tambah untuk memulai departemen baru."}
            </p>
            {!searchQuery && (
              <Button onClick={handleAddNew} className="h-12 px-8 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:scale-105 transition-transform">
                <Plus className="w-5 h-5 mr-2" /> Inisiasi Departemen
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {filteredDepartments.map((dept) => (
              <div key={dept.name} className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] overflow-hidden hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] transition-all group relative">

                {/* Subtle top gradient line */}
                <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="p-6">
                  {/* Card Header */}
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-14 h-14 bg-indigo-50 dark:bg-white/5 rounded-2xl flex items-center justify-center border border-indigo-100 dark:border-white/10">
                      <Building2 className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10">
                          <MoreHorizontal className="w-5 h-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 rounded-2xl p-2 border-white/10 shadow-2xl dark:bg-slate-900">
                        <DropdownMenuItem onClick={() => handleEdit(dept.name)} className="rounded-xl px-3 py-2.5 font-medium cursor-pointer focus:bg-indigo-50 dark:focus:bg-white/10">
                          <Edit className="h-4 w-4 mr-3 text-slate-500" /> Ubah Modul
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-slate-100 dark:bg-white/10 my-1" />
                        <DropdownMenuItem onClick={() => setDeleteTarget(dept.name)} className="rounded-xl px-3 py-2.5 font-medium cursor-pointer focus:bg-red-50 dark:focus:bg-red-500/10 text-red-600 dark:text-red-400 focus:text-red-600">
                          <Trash2 className="h-4 w-4 mr-3" /> Hapus Entitas
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">{dept.name}</h3>

                  {/* Department Metrix Inner Tabs */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-100 dark:border-white/5">
                      <Users className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      <span className="text-[13px] font-bold text-slate-700 dark:text-slate-300">{dept.employeeCount} Staff</span>
                    </div>
                    {dept.managerCount > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 rounded-lg border border-blue-100 dark:border-blue-500/20">
                        <Briefcase className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span className="text-[13px] font-bold text-blue-700 dark:text-blue-300">{dept.managerCount} Lead</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer preview pane */}
                <div className="px-6 py-4 bg-slate-50/50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                  <div className="flex -space-x-2.5">
                    {dept.employees.map((name, i) => (
                      <div key={i} className="h-9 w-9 rounded-full border-2 border-white dark:border-slate-900 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center text-[11px] font-bold text-slate-600 dark:text-slate-300 shadow-sm z-10 hover:z-20 transform hover:scale-110 transition-transform" title={name}>
                        {name.charAt(0)}
                      </div>
                    ))}
                    {dept.employeeCount > 3 && (
                      <div className="h-9 w-9 rounded-full border-2 border-white dark:border-slate-900 bg-white dark:bg-slate-800 flex items-center justify-center text-[11px] font-bold text-slate-500 shadow-sm z-10">
                        +{dept.employeeCount - 3}
                      </div>
                    )}
                    {dept.employeeCount === 0 && (
                      <span className="text-[12px] font-medium text-slate-400 italic">No members assigned</span>
                    )}
                  </div>

                  <Button variant="ghost" className="rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" onClick={() => navigate(`/admin/karyawan?dept=${encodeURIComponent(dept.name)}`)}>
                    Lihat <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                  </Button>
                </div>

              </div>
            ))}
          </div>
        )}

        {/* Global Modal Create/Edit */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md rounded-[28px] dark:bg-slate-900 border-white/10 p-0 overflow-hidden">
            <div className="h-2 w-full bg-gradient-to-r from-indigo-500 to-blue-500" />
            <div className="p-6">
              <DialogHeader className="mb-6 text-left">
                <DialogTitle className="text-2xl font-bold dark:text-white">
                  {editingDepartment ? "Edit Struktur Divisi" : "Rancang Departemen"}
                </DialogTitle>
                <DialogDescription className="text-[14px] text-slate-500 dark:text-slate-400 mt-1.5">
                  {editingDepartment ? "Modifikasi nama departemen hierarkis yang sudah terbentuk." : "Ciptakan grup departemen baru ke dalam arsitektur perusahaan."}
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[13px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Label Departemen</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Cth: Design & Innovation..." className="h-14 rounded-2xl bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-white/10 font-medium text-[15px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="flex gap-3 pt-4">
                    <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} className="h-12 flex-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 font-bold">
                      Batal
                    </Button>
                    <Button type="submit" disabled={isSubmitting} className="h-12 flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-500/20">
                      {isSubmitting ? "Memproses..." : "Setujui Setup"}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Modal */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent className="sm:max-w-md rounded-[28px] dark:bg-slate-900 border-red-500/20 shadow-2xl">
            <AlertDialogHeader className="text-left">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <AlertDialogTitle className="text-2xl text-red-600">Likuidasi Departemen</AlertDialogTitle>
              <AlertDialogDescription className="text-[15px] text-slate-600 dark:text-slate-400 mt-3 leading-relaxed">
                Menghancurkan formasi kluster <b>{deleteTarget}</b>.<br /><br />
                Perhatian: <span className="font-bold text-red-500 dark:text-red-400">{departments.find(d => d.name === deleteTarget)?.employeeCount || 0} staf aktif</span> akan kehilangan tautan atasan manajerial.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6 flex-col sm:flex-row gap-3">
              <AlertDialogCancel className="h-12 rounded-xl sm:flex-1 mt-0 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white border-0 font-bold">Abaikan</AlertDialogCancel>
              <AlertDialogAction
                className="h-12 rounded-xl sm:flex-1 bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg shadow-red-500/20"
                onClick={confirmDelete}
              >
                Hancurkan Formasi
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </EnterpriseLayout>
  );
};

export default Departemen;