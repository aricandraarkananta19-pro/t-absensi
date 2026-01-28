import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Building2, Plus, Search, Edit, Trash2, Users, MoreHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const departmentSchema = z.object({
  name: z.string().min(2, "Nama departemen minimal 2 karakter"),
});

type DepartmentFormData = z.infer<typeof departmentSchema>;

interface Department {
  name: string;
  employeeCount: number;
}

const Departemen = () => {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      name: "",
    },
  });

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    setIsLoading(true);
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("department");

    if (!error && profiles) {
      // Group by department and count employees
      const deptMap = new Map<string, number>();
      profiles.forEach((p) => {
        if (p.department) {
          deptMap.set(p.department, (deptMap.get(p.department) || 0) + 1);
        }
      });

      const deptList: Department[] = Array.from(deptMap.entries()).map(([name, count]) => ({
        name,
        employeeCount: count,
      }));

      setDepartments(deptList.sort((a, b) => a.name.localeCompare(b.name)));
    }
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
      // Update all employees with the old department name to the new one
      const { error } = await supabase
        .from("profiles")
        .update({ department: data.name })
        .eq("department", editingDepartment);

      if (error) {
        toast({ variant: "destructive", title: "Gagal mengupdate", description: error.message });
      } else {
        toast({ title: "Berhasil", description: `Departemen berhasil diubah menjadi ${data.name}` });
        setDialogOpen(false);
        setEditingDepartment(null);
        form.reset();
        fetchDepartments();
      }
    } else {
      // Check if department already exists
      if (departments.some(d => d.name.toLowerCase() === data.name.toLowerCase())) {
        toast({ variant: "destructive", title: "Gagal", description: "Departemen sudah ada" });
      } else {
        // For new department, we just close the dialog - it will appear when employees are assigned
        toast({
          title: "Info",
          description: `Departemen "${data.name}" akan muncul setelah ada karyawan yang ditambahkan ke departemen ini`
        });
        setDialogOpen(false);
        form.reset();
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
    if (!confirm(`Yakin ingin menghapus departemen ${deptName}? Semua karyawan di departemen ini akan diset ke kosong.`)) return;

    const { error } = await supabase
      .from("profiles")
      .update({ department: null })
      .eq("department", deptName);

    if (error) {
      toast({ variant: "destructive", title: "Gagal menghapus", description: error.message });
    } else {
      toast({ title: "Berhasil", description: "Departemen berhasil dihapus" });
      fetchDepartments();
    }
  };

  const filteredDepartments = departments.filter(
    (dept) => dept.name.toLowerCase().includes(searchQuery.toLowerCase())
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
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning">
                <Building2 className="h-5 w-5 text-warning-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Departemen</h1>
                <p className="text-sm text-muted-foreground">Kelola struktur organisasi</p>
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
              placeholder="Cari departemen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-3">
            <Badge variant="secondary" className="h-10 px-4 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {departments.length} Departemen
            </Badge>
            <Button onClick={handleAddNew} className="gap-2">
              <Plus className="h-4 w-4" />
              Tambah Departemen
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
            ) : filteredDepartments.length === 0 ? (
              <div className="py-12 text-center">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground">Tidak Ada Departemen</h3>
                <p className="text-muted-foreground mb-4">Tambahkan karyawan dengan departemen untuk memulai</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Departemen</TableHead>
                    <TableHead>Jumlah Karyawan</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDepartments.map((dept) => (
                    <TableRow key={dept.name}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-warning/10 flex items-center justify-center">
                            <Building2 className="h-4 w-4 text-warning" />
                          </div>
                          <p className="font-medium text-foreground">{dept.name}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          <Users className="h-3 w-3" />
                          {dept.employeeCount} karyawan
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
                            <DropdownMenuItem onClick={() => handleEdit(dept.name)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(dept.name)}
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

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingDepartment ? "Edit Departemen" : "Tambah Departemen"}</DialogTitle>
              <DialogDescription>
                {editingDepartment
                  ? "Ubah nama departemen. Semua karyawan di departemen ini akan diupdate."
                  : "Tambahkan departemen baru ke sistem"}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nama Departemen</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Contoh: IT, HRD, Finance" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => {
                    setDialogOpen(false);
                    setEditingDepartment(null);
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

export default Departemen;