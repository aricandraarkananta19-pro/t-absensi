import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Users, Plus, Search, Edit, Trash2,
  Building2, MoreHorizontal, UserPlus, Mail, KeyRound
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const employeeSchema = z.object({
  full_name: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.string().email("Email tidak valid").optional().or(z.literal("")),
  password: z.string().min(6, "Password minimal 6 karakter").optional().or(z.literal("")),
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
}

const KelolaKaryawan = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
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
    const { data } = await supabase
      .from("profiles")
      .select("department")
      .not("department", "is", null);

    if (data) {
      const uniqueDepts = [...new Set(data.map(d => d.department).filter(Boolean))] as string[];
      setDepartments(uniqueDepts.sort());
    }
  };

  const fetchEmployees = async () => {
    setIsLoading(true);

    // Fetch emails from edge function
    let emailMap: Record<string, string> = {};
    try {
      const emailResponse = await supabase.functions.invoke("list-employees");
      if (emailResponse.data?.success) {
        emailMap = emailResponse.data.emails;
      }
    } catch (e) {
      console.error("Failed to fetch emails:", e);
    }

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && profiles) {
      // Get roles for each profile
      const employeesWithRoles = await Promise.all(
        profiles.map(async (profile) => {
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", profile.user_id)
            .maybeSingle();

          return {
            ...profile,
            role: roleData?.role || "karyawan",
            email: emailMap[profile.user_id] || "",
          };
        })
      );
      setEmployees(employeesWithRoles);
    }
    setIsLoading(false);
  };

  const handleAddNew = () => {
    setEditingEmployee(null);
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

    // Handle department - convert special values
    let finalDepartment = data.department;
    if (finalDepartment === "__new__") {
      finalDepartment = newDepartment;
    } else if (finalDepartment === "__none__") {
      finalDepartment = null;
    }

    if (editingEmployee) {
      // Update existing employee
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
        toast({ variant: "destructive", title: "Gagal mengupdate", description: error.message });
      } else {
        // Update role if changed
        if (data.role !== editingEmployee.role) {
          await supabase
            .from("user_roles")
            .update({ role: data.role as "admin" | "manager" | "karyawan" })
            .eq("user_id", editingEmployee.user_id);
        }
        toast({ title: "Berhasil", description: "Data karyawan berhasil diupdate" });
        setDialogOpen(false);
        setEditingEmployee(null);
        setNewDepartment("");
        form.reset();
        fetchEmployees();
        fetchDepartments();
      }
    } else {
      // Create new employee via edge function (doesn't change admin session)
      const { data: session } = await supabase.auth.getSession();

      const response = await supabase.functions.invoke("create-employee", {
        body: {
          email: data.email,
          password: data.password || "password123",
          full_name: data.full_name,
          phone: data.phone,
          department: finalDepartment,
          position: data.position,
          role: data.role,
        },
      });

      if (import.meta.env.DEV) {
        console.log("Create Employee Response:", response);
      }

      if (response.error || !response.data?.success) {
        // Try to get the most specific error message possible
        let errorMessage = response.data?.error || response.error?.message || "Gagal membuat karyawan";

        // Check for detailed context if available in the error object (undocumented but common in Supabase JS)
        if (response.error && typeof response.error === 'object' && 'context' in response.error) {
          const context = (response.error as any).context;
          if (context && typeof context === 'object' && 'error' in context) {
            errorMessage = context.error;
          }
        }

        if (errorMessage.includes("already") || errorMessage.includes("exists")) {
          errorMessage = `Email ${data.email} sudah terdaftar di sistem. Silakan gunakan email lain.`;
        }

        toast({
          variant: "destructive",
          title: "Gagal menambah karyawan",
          description: errorMessage
        });
      } else {
        toast({
          title: "Berhasil",
          description: `Karyawan ${data.full_name} berhasil ditambahkan`
        });
        setDialogOpen(false);
        setNewDepartment("");
        form.reset();
        fetchEmployees();
        fetchDepartments();
      }
    }
    setIsSubmitting(false);
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setNewDepartment("");

    // Make sure the employee's department is in the list
    if (employee.department && !departments.includes(employee.department)) {
      setDepartments(prev => [...prev, employee.department!].sort());
    }

    form.reset({
      full_name: employee.full_name || "",
      email: "",
      password: "",
      phone: employee.phone || "",
      department: employee.department || "",
      position: employee.position || "",
      role: employee.role || "karyawan",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (employee: Employee) => {
    if (!confirm(`Yakin ingin menghapus ${employee.full_name}?`)) return;

    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", employee.id);

    if (error) {
      toast({ variant: "destructive", title: "Gagal menghapus", description: error.message });
    } else {
      toast({ title: "Berhasil", description: "Karyawan berhasil dihapus" });
      fetchEmployees();
    }
  };

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <Users className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Kelola Karyawan</h1>
                <p className="text-sm text-muted-foreground">Manajemen data karyawan</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats & Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari karyawan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-3">
            <Badge variant="secondary" className="h-10 px-4 flex items-center gap-2">
              <Users className="h-4 w-4" />
              {employees.length} Karyawan
            </Badge>
            <Button onClick={handleAddNew} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Tambah Karyawan
            </Button>
          </div>
        </div>

        {/* Table */}
        <Card className="border-border">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground">Tidak Ada Data</h3>
                <p className="text-muted-foreground mb-4">Belum ada karyawan terdaftar</p>
                <Button onClick={handleAddNew} className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Tambah Karyawan Pertama
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead className="hidden sm:table-cell">Email</TableHead>
                    <TableHead className="hidden md:table-cell">Departemen</TableHead>
                    <TableHead className="hidden lg:table-cell">Jabatan</TableHead>
                    <TableHead className="hidden xl:table-cell">Telepon</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-medium text-primary">
                              {employee.full_name?.charAt(0)?.toUpperCase() || "?"}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{employee.full_name || "-"}</p>
                            <p className="text-xs text-muted-foreground sm:hidden">{employee.email || "-"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">{employee.email || "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {employee.department ? (
                          <Badge variant="outline">{employee.department}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {employee.position || "-"}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-muted-foreground">
                        {employee.phone || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge className={
                          employee.role === "admin"
                            ? "bg-destructive text-destructive-foreground"
                            : employee.role === "manager"
                              ? "bg-info text-info-foreground"
                              : "bg-success text-success-foreground"
                        }>
                          {employee.role === "admin" ? "Admin" : employee.role === "manager" ? "Manager" : "Karyawan"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(employee)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate("/admin/reset-password")}>
                              <KeyRound className="h-4 w-4 mr-2" />
                              Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(employee)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Hapus
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Add/Edit Dialog - Fixed Scrolling Issue by adding max-h and overflow */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg w-full">
            <DialogHeader>
              <DialogTitle>{editingEmployee ? "Edit Karyawan" : "Tambah Karyawan"}</DialogTitle>
              <DialogDescription>
                {editingEmployee ? "Update informasi karyawan" : "Daftarkan akun karyawan baru"}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nama Lengkap</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Nama lengkap" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!editingEmployee && (
                  <>
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" placeholder="email@company.com" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input {...field} type="password" placeholder="Minimal 6 karakter" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Departemen</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            if (value === "__new__") {
                              setNewDepartment("");
                            }
                            field.onChange(value);
                          }}
                          value={field.value || ""}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih departemen" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">Tidak ada</SelectItem>
                            {departments.map((dept) => (
                              <SelectItem key={dept} value={dept}>
                                {dept}
                              </SelectItem>
                            ))}
                            <SelectItem value="__new__">+ Tambah Baru</SelectItem>
                          </SelectContent>
                        </Select>
                        {field.value === "__new__" && (
                          <Input
                            placeholder="Nama departemen baru"
                            value={newDepartment}
                            onChange={(e) => {
                              setNewDepartment(e.target.value);
                            }}
                            className="mt-2"
                          />
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="position"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jabatan</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Jabatan" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telepon</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="08xxxxxxxxxx" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="karyawan">Karyawan</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => {
                    setDialogOpen(false);
                    setEditingEmployee(null);
                    form.reset();
                  }}>
                    Batal
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isSubmitting}>
                    {isSubmitting ? "Menyimpan..." : "Simpan"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default KelolaKaryawan;