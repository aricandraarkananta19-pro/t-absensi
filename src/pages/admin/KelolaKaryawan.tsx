import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Users, Plus, Search, Edit, Trash2,
  Building2, MoreHorizontal, UserPlus, Mail, KeyRound,
  Filter, LayoutGrid, List as ListIcon, ShieldAlert,
  Briefcase, Phone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

// Brand Colors
const BRAND_COLORS = {
  blue: "#1A5BA8",
  lightBlue: "#00A0E3",
  green: "#7DC242",
};

const employeeSchema = z.object({
  full_name: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.string().email("Email tidak valid").optional().or(z.literal("")),
  password: z.string()
    .min(6, "Password minimal 6 karakter") // Relaxed for admin ease
    .optional()
    .or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  department: z.string().optional().or(z.literal("")),
  position: z.string().optional().or(z.literal("")),
  role: z.string().default("karyawan"),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;

interface Employee {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  department: string | null;
  position: string | null;
  role?: string;
  email?: string;
  created_at: string;
}

const KelolaKaryawan = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  // Initialize filter from URL param if available
  const [filterDepartment, setFilterDepartment] = useState(searchParams.get("dept") || "all");
  const [filterRole, setFilterRole] = useState("all");

  // Modal & Form State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newDepartment, setNewDepartment] = useState("");

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      full_name: "",
      email: "",
      password: "",
      phone: "",
      department: "",
      position: "",
      role: "karyawan",
    },
  });

  useEffect(() => {
    fetchEmployees();
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    const { data } = await supabase.from("profiles").select("department").not("department", "is", null);
    if (data) {
      const uniqueDepts = [...new Set(data.map(d => d.department).filter(Boolean))] as string[];
      setDepartments(uniqueDepts.sort());
    }
  };

  const fetchEmployees = async () => {
    setIsLoading(true);
    let emailMap: Record<string, string> = {};
    try {
      const emailResponse = await supabase.functions.invoke("list-employees");
      if (emailResponse.data?.success) emailMap = emailResponse.data.emails;
    } catch (e) {
      console.error("Failed to fetch emails", e);
    }

    const { data: profiles, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });

    if (!error && profiles) {
      const userIds = profiles.map(p => p.user_id);
      const { data: allRoles } = await supabase.from("user_roles").select("user_id, role").in("user_id", userIds);
      const roleMap = new Map(allRoles?.map(r => [r.user_id, r.role]) || []);

      const employeesWithRoles = profiles.map((profile) => ({
        ...profile,
        role: roleMap.get(profile.user_id) || "karyawan",
        email: emailMap[profile.user_id] || "",
      }));

      setEmployees(employeesWithRoles);
    }
    setIsLoading(false);
  };

  const handleAddNew = () => {
    setEditingEmployee(null);
    setNewDepartment("");
    form.reset({
      full_name: "",
      email: "",
      password: "",
      phone: "",
      department: "",
      position: "",
      role: "karyawan",
    });
    setDialogOpen(true);
  };

  const onSubmit = async (data: EmployeeFormData) => {
    setIsSubmitting(true);
    let finalDepartment = data.department;
    if (finalDepartment === "__new__") finalDepartment = newDepartment;
    else if (finalDepartment === "__none__") finalDepartment = null;

    if (editingEmployee) {
      // Update Logic
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: data.full_name,
          phone: data.phone || null,
          department: finalDepartment || null,
          position: data.position || null,
        })
        .eq("id", editingEmployee.id);

      if (error) {
        toast({ variant: "destructive", title: "Gagal", description: error.message });
      } else {
        if (data.role !== editingEmployee.role) {
          await supabase.from("user_roles").update({ role: data.role as any }).eq("user_id", editingEmployee.user_id);
        }
        toast({ title: "Berhasil", description: "Data karyawan diperbarui" });
        setDialogOpen(false);
        fetchEmployees();
        fetchDepartments();
      }
    } else {
      // Create Logic
      const response = await supabase.functions.invoke("create-employee", {
        body: { ...data, department: finalDepartment, password: data.password || "password123" }
      });

      if (response.error || !response.data?.success) {
        let msg = response.data?.error || "Gagal membuat karyawan";
        if (msg.includes("already")) msg = "Email sudah terdaftar";
        toast({ variant: "destructive", title: "Gagal", description: msg });
      } else {
        toast({ title: "Berhasil", description: "Karyawan baru ditambahkan" });
        setDialogOpen(false);
        fetchEmployees();
        fetchDepartments();
      }
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (employee: Employee) => {
    if (!confirm(`Hapus ${employee.full_name}? Aksi ini tidak dapat dibatalkan.`)) return;
    const { error } = await supabase.from("profiles").delete().eq("id", employee.id);
    if (error) toast({ variant: "destructive", title: "Gagal", description: error.message });
    else {
      toast({ title: "Berhasil", description: "Karyawan dihapus" });
      fetchEmployees();
    }
  };

  // Filter Logic
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.position?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = filterDepartment === "all" || emp.department === filterDepartment;
    const matchesRole = filterRole === "all" || emp.role === filterRole;
    return matchesSearch && matchesDept && matchesRole;
  });

  // Stats
  const stats = useMemo(() => ({
    total: employees.length,
    admins: employees.filter(e => e.role === 'admin').length,
    managers: employees.filter(e => e.role === 'manager').length,
    staff: employees.filter(e => e.role === 'karyawan').length,
  }), [employees]);

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-8">
      {/* Header with Gradient */}
      <header className="sticky top-0 z-40 shadow-sm transition-all duration-300 bg-white"
        style={{ background: `linear-gradient(135deg, ${BRAND_COLORS.blue} 0%, ${BRAND_COLORS.lightBlue} 100%)`, paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3 text-white">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-xl bg-white/10 hover:bg-white/20 text-white shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold">Kelola Karyawan</h1>
              <p className="text-xs text-white/80">Manajemen database & akses</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-none shadow-sm bg-white"><CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <div className="text-3xl font-bold text-slate-800">{stats.total}</div>
            <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">Total Karyawan</div>
          </CardContent></Card>
          <Card className="border-none shadow-sm bg-blue-50/50"><CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <div className="text-3xl font-bold text-blue-700">{stats.staff}</div>
            <div className="text-xs text-blue-600 font-medium uppercase tracking-wider mt-1">Staff</div>
          </CardContent></Card>
          <Card className="border-none shadow-sm bg-amber-50/50"><CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <div className="text-3xl font-bold text-amber-700">{stats.managers}</div>
            <div className="text-xs text-amber-600 font-medium uppercase tracking-wider mt-1">Manager</div>
          </CardContent></Card>
          <Card className="border-none shadow-sm bg-red-50/50"><CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <div className="text-3xl font-bold text-red-700">{stats.admins}</div>
            <div className="text-xs text-red-600 font-medium uppercase tracking-wider mt-1">Admin</div>
          </CardContent></Card>
        </div>

        {/* Actions & Filters */}
        <div className="flex flex-col md:flex-row gap-3 justify-between items-start md:items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Cari nama, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-slate-50 border-slate-200"
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
            <Select value={filterDepartment} onValueChange={setFilterDepartment}>
              <SelectTrigger className="w-[140px] bg-slate-50 border-slate-200">
                <SelectValue placeholder="Departemen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Dept</SelectItem>
                {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-[130px] bg-slate-50 border-slate-200">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Role</SelectItem>
                <SelectItem value="karyawan">Karyawan</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleAddNew} className="bg-blue-700 hover:bg-blue-800 shrink-0 gap-2">
              <UserPlus className="h-4 w-4" /> <span className="hidden sm:inline">Tambah</span>
            </Button>
          </div>
        </div>

        {/* List Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-dashed border-slate-200">
            <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-slate-900">Tidak ada karyawan</h3>
            <p className="text-slate-500">Coba sesuaikan filter pencarian anda.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {/* Mobile View */}
            {isMobile ? (
              <div className="space-y-3">
                {filteredEmployees.map(emp => (
                  <div key={emp.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-start gap-3">
                    <div className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                      emp.role === 'admin' ? "bg-red-100 text-red-600" :
                        emp.role === 'manager' ? "bg-amber-100 text-amber-600" :
                          "bg-blue-100 text-blue-600"
                    )}>
                      {emp.full_name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold text-slate-900 truncate">{emp.full_name}</h4>
                          <p className="text-xs text-slate-500 truncate">{emp.email}</p>
                        </div>
                        <Badge variant="outline" className={cn(
                          "text-[10px] h-5",
                          emp.role === 'admin' ? "bg-red-50 text-red-600 border-red-200" :
                            emp.role === 'manager' ? "bg-amber-50 text-amber-600 border-amber-200" :
                              "bg-blue-50 text-blue-600 border-blue-200"
                        )}>
                          {emp.role === 'admin' ? 'Admin' : emp.role === 'manager' ? 'Manajer' : 'Staff'}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-xs text-slate-600">
                        <div className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {emp.department || "-"}</div>
                        <div className="flex items-center gap-1"><Briefcase className="h-3 w-3" /> {emp.position || "-"}</div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button variant="outline" size="sm" className="h-8 flex-1 text-xs" onClick={() => {
                          setEditingEmployee(emp);
                          setNewDepartment("");
                          if (emp.department && !departments.includes(emp.department)) setDepartments(prev => [...prev, emp.department!].sort());
                          form.reset({
                            full_name: emp.full_name || "",
                            email: "",
                            password: "",
                            phone: emp.phone || "",
                            department: emp.department || "",
                            position: emp.position || "",
                            role: emp.role || "karyawan",
                          });
                          setDialogOpen(true);
                        }}>
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 text-red-600 border-red-200" onClick={() => handleDelete(emp)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Desktop Table */
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                      <TableHead className="w-[250px]">Karyawan</TableHead>
                      <TableHead>Kontak/Posisi</TableHead>
                      <TableHead>Departemen</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees.map(emp => (
                      <TableRow key={emp.id} className="hover:bg-slate-50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold",
                              emp.role === 'admin' ? "bg-red-100 text-red-600" :
                                emp.role === 'manager' ? "bg-amber-100 text-amber-600" :
                                  "bg-blue-100 text-blue-600"
                            )}>
                              {emp.full_name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-slate-900">{emp.full_name}</div>
                              <div className="text-xs text-slate-500">{emp.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-slate-700">{emp.position || "-"}</div>
                          <div className="text-xs text-slate-500">{emp.phone || "-"}</div>
                        </TableCell>
                        <TableCell>
                          {emp.department ? <Badge variant="secondary" className="font-normal">{emp.department}</Badge> : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(
                            "capitalize",
                            emp.role === 'admin' && "text-red-600 border-red-200 bg-red-50",
                            emp.role === 'manager' && "text-amber-600 border-amber-200 bg-amber-50",
                            emp.role === 'karyawan' && "text-blue-600 border-blue-200 bg-blue-50"
                          )}>
                            {emp.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => {
                              setEditingEmployee(emp);
                              setNewDepartment("");
                              if (emp.department && !departments.includes(emp.department)) setDepartments(prev => [...prev, emp.department!].sort());
                              form.reset({
                                full_name: emp.full_name || "",
                                email: "",
                                password: "",
                                phone: emp.phone || "",
                                department: emp.department || "",
                                position: emp.position || "",
                                role: emp.role || "karyawan",
                              });
                              setDialogOpen(true);
                            }}>
                              <Edit className="h-4 w-4 text-slate-500" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleDelete(emp)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Dialog for Add/Edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? "Edit Karyawan" : "Tambah Karyawan Baru"}</DialogTitle>
            <DialogDescription>
              {editingEmployee ? "Perbarui informasi data karyawan." : "Isi form berikut untuk menambahkan karyawan ke database."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="full_name" render={({ field }) => (
                <FormItem><FormLabel>Nama Lengkap</FormLabel><FormControl><Input {...field} placeholder="Contoh: Budi Santoso" /></FormControl><FormMessage /></FormItem>
              )} />

              {!editingEmployee && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} type="email" placeholder="email@kantor.com" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="password" render={({ field }) => (
                    <FormItem><FormLabel>Password</FormLabel><FormControl><Input {...field} type="password" placeholder="Min 6 karakter" /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="department" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Departemen</FormLabel>
                    <Select onValueChange={(val) => { if (val === "__new__") setNewDepartment(""); field.onChange(val); }} value={field.value || ""}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Tidak ada</SelectItem>
                        {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        <SelectItem value="__new__">+ Tambah Baru</SelectItem>
                      </SelectContent>
                    </Select>
                    {field.value === "__new__" && <Input placeholder="Nama Departemen Baru" value={newDepartment} onChange={e => setNewDepartment(e.target.value)} className="mt-2" />}
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="position" render={({ field }) => (
                  <FormItem><FormLabel>Jabatan</FormLabel><FormControl><Input {...field} placeholder="Contoh: Staff IT" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>No. Telepon</FormLabel><FormControl><Input {...field} placeholder="08..." /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hak Akses (Role)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="karyawan">Karyawan (Staff)</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="flex gap-3 pt-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Batal</Button>
                <Button type="submit" className="flex-1 bg-blue-700 hover:bg-blue-800" disabled={isSubmitting}>{isSubmitting ? "Menyimpan..." : "Simpan Data"}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KelolaKaryawan;