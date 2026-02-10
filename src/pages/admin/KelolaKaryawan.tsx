
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  LayoutDashboard, Users, Clock, BarChart3, Building2, Shield, Key,
  Settings, Database, BookOpen, Plus, Search, Filter, Archive, RotateCcw
} from "lucide-react";
import { ADMIN_MENU_SECTIONS } from "@/config/menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import EnterpriseLayout from "@/components/layout/EnterpriseLayout";
import { EmployeeStats } from "@/components/employee/EmployeeStats";
import { EmployeeTable, EmployeeData } from "@/components/employee/EmployeeTable";


import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// ========== CONFIG ==========
const PAGE_SIZE = 10; // Mockup shows 5-10 items

// Schema for Add/Edit
const employeeSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  password: z.string()
    .min(6, "Password must be at least 6 characters")
    .optional()
    .or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  department: z.string().optional().or(z.literal("")),
  position: z.string().optional().or(z.literal("")),
  role: z.string().default("karyawan"),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;


const KelolaKaryawan = () => {
  const [searchParams] = useSearchParams();

  // State
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Stats
  const [stats, setStats] = useState({ total: 0, active: 0, onLeave: 0, depts: 0 });

  // Dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeData | null>(null);
  const [newDepartment, setNewDepartment] = useState("");

  // Form
  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: { full_name: "", email: "", password: "", phone: "", department: "", position: "", role: "karyawan" },
  });

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset page on search
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Data Loaders
  useEffect(() => {
    fetchDepartments();
    fetchStats();
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [page, debouncedSearch, departmentFilter, statusFilter, showArchived]);

  // --- FETCH FUNCTIONS ---

  const fetchDepartments = async () => {
    const { data } = await supabase.from("profiles").select("department").not("department", "is", null);
    if (data) {
      const uniqueDepts = [...new Set(data.map(d => d.department).filter(Boolean))] as string[];
      setDepartments(uniqueDepts.sort());
      setStats(prev => ({ ...prev, depts: uniqueDepts.length }));
    }
  };

  const fetchStats = async () => {
    // Mocking Active/Leave for now as we don't have direct status column.
    // Real imp: fetch count with filters
    const { count: total } = await supabase.from("profiles").select("id", { count: 'exact', head: true }).is("deleted_at", null);
    // Simulate Active/Leave based on roles or simple math for demo
    const fakeActive = total ? Math.floor(total * 0.9) : 0;
    const fakeLeave = total ? total - fakeActive : 0;

    setStats(prev => ({ ...prev, total: total || 0, active: fakeActive, onLeave: fakeLeave }));
  };

  const fetchEmployees = async () => {
    setIsLoading(true);
    try {
      let query = supabase.from("profiles").select("*", { count: 'exact' });

      // Archived Filter
      if (showArchived) {
        query = query.not("deleted_at", "is", null);
      } else {
        query = query.is("deleted_at", null);
      }

      // Filters
      if (debouncedSearch) query = query.ilike('full_name', `%${debouncedSearch}%`);
      if (departmentFilter !== 'all') query = query.eq('department', departmentFilter);
      // Status filter logic would go here if we had the column

      // Pagination
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, count, error } = await query.range(from, to).order("created_at", { ascending: false });

      if (error) throw error;

      setTotalRecords(count || 0);
      setTotalPages(Math.ceil((count || 0) / PAGE_SIZE));

      // Fetch Relations (Roles & Emails)
      const userIds = data?.map(p => p.user_id) || [];

      // 1. Roles
      const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("user_id", userIds);
      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

      // 2. Emails (via Edge Function)
      let emailMap: Record<string, string> = {};
      try {
        const emailRes = await supabase.functions.invoke("list-employees");
        if (emailRes.data?.success && emailRes.data?.emails) {
          emailMap = emailRes.data.emails;
        }
      } catch (e) { console.warn("Email fetch failed", e); }

      // Map final data
      const formatted: EmployeeData[] = data?.map(p => ({
        ...p,
        role: roleMap.get(p.user_id) || "karyawan",
        email: emailMap[p.user_id] || "",
        status: 'active' // Mock status for now
      })) || [];

      setEmployees(formatted);

    } catch (err) {
      const error = err as Error;
      toast({ variant: "destructive", title: "Error fetching employees", description: error.message || "Unknown error" });
    } finally {
      setIsLoading(false);
    }
  };

  // --- ACTIONS ---

  const handleAddNew = () => {
    setEditingEmployee(null);
    setNewDepartment("");
    form.reset({ full_name: "", email: "", password: "", phone: "", department: "", position: "", role: "karyawan" });
    setDialogOpen(true);
  };

  const handleEdit = (emp: EmployeeData) => {
    setEditingEmployee(emp);
    setNewDepartment("");
    form.reset({
      full_name: emp.full_name || "",
      email: emp.email || "",
      password: "",
      phone: emp.phone || "",
      department: emp.department || "",
      position: emp.position || "",
      role: emp.role || "karyawan",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (emp: EmployeeData) => {
    if (!confirm(`Are you sure you want to archive ${emp.full_name}?`)) return;

    const { error } = await supabase
      .from("profiles")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", emp.id);

    if (error) toast({ variant: "destructive", title: "Failed", description: error.message });
    else {
      toast({ title: "Success", description: "Employee archived." });
      fetchEmployees();
      fetchStats();
    }
  };

  const handleRestore = async (emp: EmployeeData) => {
    if (!confirm(`Are you sure you want to restore ${emp.full_name}?`)) return;

    const { error } = await supabase
      .from("profiles")
      .update({ deleted_at: null })
      .eq("id", emp.id);

    if (error) toast({ variant: "destructive", title: "Failed", description: error.message });
    else {
      toast({ title: "Success", description: "Employee restored." });
      fetchEmployees();
      fetchStats();
    }
  };

  const onSubmit = async (values: EmployeeFormData) => {
    setIsSubmitting(true);

    let finalDept = values.department;
    if (finalDept === "__new__") finalDept = newDepartment;
    else if (finalDept === "__none__") finalDept = null;

    try {
      if (editingEmployee) {
        // Update
        const { error } = await supabase
          .from("profiles")
          .update({
            full_name: values.full_name,
            phone: values.phone || null,
            department: finalDept || null,
            position: values.position || null,
          })
          .eq("id", editingEmployee.id);

        if (error) throw error;

        // Update Role if changed
        if (values.role !== editingEmployee.role) {
          await supabase.from("user_roles").update({ role: values.role as any }).eq("user_id", editingEmployee.user_id);
        }

        toast({ title: "Updated", description: "Employee details updated." });
      } else {
        // Create
        const res = await supabase.functions.invoke("create-employee", {
          body: { ...values, department: finalDept, password: values.password || "password123" }
        });

        if (res.error || !res.data?.success) throw new Error(res.data?.error || "Failed to create employee");

        toast({ title: "Created", description: "New employee added successfully." });
      }

      setDialogOpen(false);
      fetchEmployees();
      fetchStats();
      fetchDepartments();

    } catch (err) {
      const error = err as Error;
      toast({ variant: "destructive", title: "Error", description: error.message || "Unknown error" });
    } finally {
      setIsSubmitting(false);
    }
  };


  // --- MENU CONFIG ---
  const menuSections = ADMIN_MENU_SECTIONS;

  return (
    <EnterpriseLayout
      title="Employee Management"
      subtitle="Manage your team members and permissions."
      menuSections={menuSections}
      roleLabel="Administrator"
      showRefresh={true}
      onRefresh={fetchEmployees}
    >
      <div className="max-w-[1400px] mx-auto pb-20">

        {/* 1. STATS CARDS */}
        <EmployeeStats
          total={stats.total}
          active={stats.active}
          onLeave={stats.onLeave}
          departments={stats.depts}
          isLoading={isLoading && employees.length === 0}
        />

        {/* 2. FILTERS & ACTIONS BAR */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-[400px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by name or NIP..."
              className="pl-9 bg-slate-50 border-slate-200"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[180px] bg-slate-50 border-slate-200">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] bg-slate-50 border-slate-200">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="on_leave">On Leave</SelectItem>
              </SelectContent>
            </Select>

            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shrink-0"
              onClick={handleAddNew}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Employee</span>
              <span className="sm:hidden">Add</span>
              <span className="sm:hidden">Add</span>
            </Button>

            <Button
              variant={showArchived ? "secondary" : "outline"}
              className="gap-2 shrink-0 bg-white border-slate-200"
              onClick={() => setShowArchived(!showArchived)}
              title={showArchived ? "Back to Active" : "View Archived"}
            >
              {showArchived ? <RotateCcw className="w-4 h-4 text-blue-600" /> : <Archive className="w-4 h-4 text-slate-500" />}
              {showArchived && <span className="hidden sm:inline text-blue-600">Archived</span>}
            </Button>
          </div>
        </div>

        {/* 3. TABLE */}
        <EmployeeTable
          data={employees}
          isLoading={isLoading}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onRestore={handleRestore}
          isArchivedView={showArchived}
          page={page}
          totalPages={totalPages}
          totalRecords={totalRecords}
          onPageChange={setPage}
        />
      </div>

      {/* MAIN DIALOG - ADD/EDIT EMPLOYEE */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? "Edit Employee" : "Add New Employee"}</DialogTitle>
            <DialogDescription>
              {editingEmployee ? "Update employee information and permissions." : "Fill in the details to create a new employee account."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="full_name" render={({ field }) => (
                  <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} placeholder="e.g. Budi Santoso" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input {...field} type="email" placeholder="email@company.com" disabled={!!editingEmployee} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              {!editingEmployee && (
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem><FormLabel>Password</FormLabel><FormControl><Input {...field} type="password" placeholder="Min. 6 characters" /></FormControl><FormMessage /></FormItem>
                )} />
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="department" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <Select onValueChange={(val) => { if (val === "__new__") setNewDepartment(""); field.onChange(val); }} value={field.value || ""}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select Department" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        <SelectItem value="__new__">+ Create New</SelectItem>
                      </SelectContent>
                    </Select>
                    {field.value === "__new__" && <Input placeholder="New Department Name" value={newDepartment} onChange={e => setNewDepartment(e.target.value)} className="mt-2" />}
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="position" render={({ field }) => (
                  <FormItem><FormLabel>Position</FormLabel><FormControl><Input {...field} placeholder="e.g. Senior Engineer" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input {...field} placeholder="08..." /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem>
                    <FormLabel>System Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="karyawan">Employee (Staff)</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="admin">Administrator</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : editingEmployee ? "Update Employee" : "Create Employee"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

    </EnterpriseLayout>
  );
};

export default KelolaKaryawan;