import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Building2, Plus, Search, Edit, Trash2, Users, MoreHorizontal,
  Briefcase, LayoutGrid, List as ListIcon, UserCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import EnterpriseLayout from "@/components/layout/EnterpriseLayout";
import { ADMIN_MENU_SECTIONS } from "@/config/menu";

// Brand Colors
const BRAND_COLORS = {
  blue: "#1A5BA8",
  lightBlue: "#00A0E3",
  green: "#7DC242",
};

const departmentSchema = z.object({
  name: z.string().min(2, "Nama departemen minimal 2 karakter"),
});

type DepartmentFormData = z.infer<typeof departmentSchema>;

interface Department {
  name: string;
  employeeCount: number;
  managerCount: number;
  employees: string[]; // List of names for preview
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

  // Form
  const form = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentSchema),
    defaultValues: { name: "" },
  });

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    setIsLoading(true);

    // 1. Fetch Profiles
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("user_id, full_name, department");

    if (error || !profiles) {
      setIsLoading(false);
      return;
    }

    // 2. Fetch Roles
    const userIds = profiles.map(p => p.user_id);
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", userIds);

    const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

    // 3. Aggregate Data
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
      // Update department name in profiles
      const { error } = await supabase
        .from("profiles")
        .update({ department: data.name })
        .eq("department", editingDepartment);

      if (error) {
        toast({ variant: "destructive", title: "Gagal Update", description: error.message });
      } else {
        toast({ title: "Berhasil", description: `Departemen diubah menjadi ${data.name}` });
        setDialogOpen(false);
        setEditingDepartment(null);
        fetchDepartments();
      }
    } else {
      // Create new (Client side check only since strict schema doesn't exist for depts)
      if (departments.some(d => d.name.toLowerCase() === data.name.toLowerCase())) {
        toast({ variant: "destructive", title: "Gagal", description: "Departemen sudah ada" });
      } else {
        toast({ title: "Departemen Dibuat", description: `Departemen "${data.name}" siap digunakan.` });
        // In this virtual schema, we can't "create" a row, but we can mock it visually or 
        // wait for a user to be assigned. 
        // For better UX, we'll optimistically add it to the list 
        // OR warn user they need to assign someone.
        // Let's rely on the previous logic: It's just a visual placeholder until data exists,
        // BUT for a real feel, let's allow it in the UI temporarily if we had a dedicated table.
        // Since we rely on profiles.department, we'll just show a success message prompting assignment.
        toast({ title: "Info", description: "Silakan tetapkan karyawan ke departemen ini agar muncul di daftar." });
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

  const handleDelete = async (deptName: string) => {
    if (!confirm(`Hapus departemen ${deptName}? \nPERINGATAN: ${departments.find(d => d.name === deptName)?.employeeCount} karyawan akan kehilangan status departemen mereka.`)) return;

    const { error } = await supabase
      .from("profiles")
      .update({ department: null })
      .eq("department", deptName);

    if (error) {
      toast({ variant: "destructive", title: "Gagal", description: error.message });
    } else {
      toast({ title: "Berhasil", description: "Departemen dihapus" });
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
      title="Struktur Organisasi"
      subtitle="Departemen & Divisi"
      roleLabel="Administrator"
      menuSections={ADMIN_MENU_SECTIONS}
    >
      <div className="pb-20 md:pb-8">

        <main className="container mx-auto px-4 py-6 space-y-6">

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-none shadow-sm bg-white"><CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-slate-800">{stats.totalDepts}</div>
              <div className="text-[10px] uppercase font-bold text-slate-400 mt-1">Departemen</div>
            </CardContent></Card>
            <Card className="border-none shadow-sm bg-white"><CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.totalManagers}</div>
              <div className="text-[10px] uppercase font-bold text-blue-400 mt-1">Manager</div>
            </CardContent></Card>
            <Card className="border-none shadow-sm bg-white"><CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">{stats.totalEmployees}</div>
              <div className="text-[10px] uppercase font-bold text-emerald-400 mt-1">Total Staff</div>
            </CardContent></Card>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Cari departemen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-white border-slate-200"
              />
            </div>
            <Button onClick={handleAddNew} className="w-full sm:w-auto bg-blue-700 hover:bg-blue-800 gap-2">
              <Plus className="h-4 w-4" /> Departemen Baru
            </Button>
          </div>

          {/* Grid Content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
            </div>
          ) : filteredDepartments.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-200">
              <Building2 className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-slate-900">Belum Ada Departemen</h3>
              <p className="text-slate-500 max-w-xs mx-auto mt-1">Tambahkan departemen baru untuk mulai mengorganisir karyawan anda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDepartments.map((dept) => (
                <Card key={dept.name} className="hover:shadow-md transition-shadow border-slate-200 group">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-slate-400 hover:text-slate-600">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(dept.name)}><Edit className="h-4 w-4 mr-2" /> Ubah Nama</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDelete(dept.name)} className="text-red-600"><Trash2 className="h-4 w-4 mr-2" /> Hapus</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardHeader>
                  <CardContent>
                    <h3 className="font-bold text-lg text-slate-800 mb-1">{dept.name}</h3>
                    <div className="flex items-center gap-4 text-sm text-slate-500 mb-4">
                      <div className="flex items-center gap-1.5">
                        <Users className="h-4 w-4" /> {dept.employeeCount} Staff
                      </div>
                      {dept.managerCount > 0 && (
                        <div className="flex items-center gap-1.5 text-blue-600 font-medium">
                          <Briefcase className="h-4 w-4" /> {dept.managerCount} Manager
                        </div>
                      )}
                    </div>

                    {/* Staff Preview Pile */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                      <div className="flex -space-x-2">
                        {dept.employees.map((name, i) => (
                          <div key={i} className="h-8 w-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600" title={name}>
                            {name.charAt(0)}
                          </div>
                        ))}
                        {dept.employeeCount > 3 && (
                          <div className="h-8 w-8 rounded-full border-2 border-white bg-slate-50 flex items-center justify-center text-[10px] text-slate-500">
                            +{dept.employeeCount - 3}
                          </div>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => navigate(`/admin/karyawan?dept=${encodeURIComponent(dept.name)}`)}>
                        Lihat Detail <ArrowLeft className="h-3 w-3 ml-1 rotate-180" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>

        {/* Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingDepartment ? "Ubah Nama Departemen" : "Departemen Baru"}</DialogTitle>
              <DialogDescription>
                {editingDepartment ? "Perubahan akan diterapkan ke seluruh karyawan di departemen ini." : "Buat departemen baru untuk struktur organisasi."}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Departemen / Divisi</FormLabel>
                    <FormControl><Input {...field} placeholder="Contoh: Engineering, Marketing..." /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex gap-2 justify-end pt-2">
                  <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Batal</Button>
                  <Button type="submit" className="bg-blue-700 hover:bg-blue-800" disabled={isSubmitting}>
                    {isSubmitting ? "Menyimpan..." : "Simpan"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </EnterpriseLayout>
  );
};

export default Departemen;