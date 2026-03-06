import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Users, Shield, Search, RefreshCw, UserCog,
  CheckCircle2, Crown, Eye, Settings2, SlidersHorizontal, Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
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
import EnterpriseLayout from "@/components/layout/EnterpriseLayout";
import { ADMIN_MENU_SECTIONS } from "@/config/menu";

// === TYPES ===
interface UserWithRole {
  user_id: string;
  role: string;
  profile?: {
    full_name: string | null;
    department: string | null;
    position: string | null;
  } | null;
  email?: string;
}

const KelolaRole = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [newRole, setNewRole] = useState<string>("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .order("role");

      if (rolesError) throw rolesError;

      const usersWithProfiles: UserWithRole[] = await Promise.all(
        (rolesData || []).map(async (roleData) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, department, position")
            .eq("user_id", roleData.user_id)
            .maybeSingle();

          return {
            user_id: roleData.user_id,
            role: roleData.role as string,
            profile,
          };
        })
      );

      try {
        const { data: employeesData } = await supabase.functions.invoke("list-employees");
        if (employeesData?.success && employeesData?.employees) {
          const emailMap: Record<string, string> = {};
          employeesData.employees.forEach((emp: { id: string; email: string }) => {
            emailMap[emp.id] = emp.email;
          });
          usersWithProfiles.forEach((user) => {
            user.email = emailMap[user.user_id] || undefined;
          });
        }
      } catch (e) { }

      setUsers(usersWithProfiles);
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal", description: "Tidak dapat memuat data user" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeRole = (user: UserWithRole, role: string) => {
    setSelectedUser(user);
    setNewRole(role);
    setIsDialogOpen(true);
  };

  const confirmRoleChange = async () => {
    if (!selectedUser || !newRole) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole as "admin" | "manager" | "karyawan" })
        .eq("user_id", selectedUser.user_id);

      if (error) throw error;
      toast({ title: "Role Berhasil Diotorisasi", description: `Hak akses ${selectedUser.profile?.full_name || "User"} berhasil dielevasi/diturunkan menjadi ${getRoleLabel(newRole)}.` });
      fetchUsers();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Otorisasi Ditolak", description: error.message || "Gagal mengubah role server-side." });
    } finally {
      setIsUpdating(false);
      setIsDialogOpen(false);
      setSelectedUser(null);
      setNewRole("");
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin": return "Administrator";
      case "manager": return "Department Lead";
      case "karyawan": return "General Staff";
      default: return role;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 rounded-full font-bold text-[11px] uppercase tracking-wider w-max">
            <Crown className="h-3.5 w-3.5" /> Admin
          </div>
        );
      case "manager":
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-full font-bold text-[11px] uppercase tracking-wider w-max">
            <Eye className="h-3.5 w-3.5" /> Manager
          </div>
        );
      case "karyawan":
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full font-bold text-[11px] uppercase tracking-wider w-max">
            <CheckCircle2 className="h-3.5 w-3.5" /> Staff
          </div>
        );
      default:
        return <Badge variant="secondary">{role}</Badge>;
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.profile?.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === "all" || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const stats = {
    total: users.length,
    admin: users.filter((u) => u.role === "admin").length,
    manager: users.filter((u) => u.role === "manager").length,
    karyawan: users.filter((u) => u.role === "karyawan").length,
  };

  // === RENDER ===
  return (
    <EnterpriseLayout
      title="Identity & Access"
      menuSections={ADMIN_MENU_SECTIONS}
      breadcrumbs={[
        { label: "Admin", href: "/admin/dashboard" },
        { label: "Identity & Role" },
      ]}
    >
      <div className="max-w-[1400px] mx-auto pb-32">
        {/* Superior Header */}
        <div className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-none mb-3">
              Identity Management
            </h1>
            <p className="text-base text-slate-500 dark:text-slate-400 font-medium max-w-2xl">
              Kontrol terpusat untuk autentikasi, otorisasi, dan elevasi hak akses matriks aplikasi di tingkat Enterprise.
            </p>
          </div>
        </div>

        {/* Cyber Security Metrix */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-[24px] p-5 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Shield className="w-16 h-16 text-slate-900 dark:text-white" />
            </div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Total Identity</p>
            <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{stats.total}</h3>
          </div>
          <div className="bg-red-500/5 dark:bg-red-500/10 backdrop-blur-xl border border-red-500/20 rounded-[24px] p-5 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Crown className="w-16 h-16 text-red-500" />
            </div>
            <p className="text-sm font-bold text-red-600 dark:text-red-400 mb-1">Tier 1: Admin</p>
            <h3 className="text-3xl font-black text-red-700 dark:text-red-300 tracking-tight">{stats.admin}</h3>
          </div>
          <div className="bg-blue-500/5 dark:bg-blue-500/10 backdrop-blur-xl border border-blue-500/20 rounded-[24px] p-5 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Eye className="w-16 h-16 text-blue-500" />
            </div>
            <p className="text-sm font-bold text-blue-600 dark:text-blue-400 mb-1">Tier 2: Leads</p>
            <h3 className="text-3xl font-black text-blue-700 dark:text-blue-300 tracking-tight">{stats.manager}</h3>
          </div>
          <div className="bg-emerald-500/5 dark:bg-emerald-500/10 backdrop-blur-xl border border-emerald-500/20 rounded-[24px] p-5 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Users className="w-16 h-16 text-emerald-500" />
            </div>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-1">Tier 3: Staff</p>
            <h3 className="text-3xl font-black text-emerald-700 dark:text-emerald-300 tracking-tight">{stats.karyawan}</h3>
          </div>
        </div>

        {/* Filter Area Glassmorphism */}
        <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-2xl border border-slate-200 dark:border-white/10 rounded-[24px] p-4 flex flex-col md:flex-row gap-4 justify-between items-center mb-6 shadow-sm">
          <div className="relative w-full md:max-w-[400px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Identitas pengguna, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 bg-white dark:bg-black/20 border-slate-200 dark:border-white/10 rounded-xl w-full focus-visible:ring-indigo-500/20 focus-visible:border-indigo-500/50"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="hidden md:flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-white/10">
              <SlidersHorizontal className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filter By Rule</span>
            </div>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-full md:w-[200px] h-12 bg-white dark:bg-black/20 border-slate-200 dark:border-white/10 rounded-xl focus:ring-indigo-500/20">
                <SelectValue placeholder="Semua Izin" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-white/10 shadow-2xl dark:bg-slate-900">
                <SelectItem value="all" className="rounded-xl py-3 cursor-pointer">Semua Akses</SelectItem>
                <SelectItem value="admin" className="rounded-xl py-3 cursor-pointer text-red-500">Tier 1: Admin</SelectItem>
                <SelectItem value="manager" className="rounded-xl py-3 cursor-pointer text-blue-500">Tier 2: Manager</SelectItem>
                <SelectItem value="karyawan" className="rounded-xl py-3 cursor-pointer text-emerald-500">Tier 3: Karyawan</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* IAM (Identity Access Management) List Canvas */}
        <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-[32px] overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-4" />
              <p className="font-medium animate-pulse">Menghubungkan Database Autentikasi...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-24">
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Shield className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Akses Ditolak / Tidak Ditemukan</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-sm mx-auto">
                Tidak ada identitas yang dikonfigurasi dengan izin yang Anda cari.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {filteredUsers.map((user) => (
                <div key={user.user_id} className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors group">
                  {/* Identity Info */}
                  <div className="flex items-center gap-4 min-w-[30%]">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-[16px] bg-gradient-to-br from-indigo-100 to-blue-100 dark:from-indigo-900/40 dark:to-blue-900/40 flex items-center justify-center border border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-400 font-bold text-xl shadow-sm group-hover:scale-105 transition-transform">
                        {user.profile?.full_name?.charAt(0)?.toUpperCase() || "X"}
                      </div>
                      {user.role === 'admin' && <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-sm"><Crown className="w-3 h-3 text-white" /></div>}
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{user.profile?.full_name || "Unknown Identity"}</h4>
                      <p className="text-[13px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">{user.email || "No Email Bind"}</p>
                    </div>
                  </div>

                  {/* Org Info */}
                  <div className="hidden md:flex flex-col min-w-[20%]">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Departemen / Posisi</span>
                    <p className="text-[14px] font-semibold text-slate-800 dark:text-slate-200">
                      {user.profile?.department || "Unassigned"}
                    </p>
                    <p className="text-[12px] text-slate-500 dark:text-slate-400">{user.profile?.position || "No Title"}</p>
                  </div>

                  {/* Current Role Badge */}
                  <div className="flex flex-col min-w-[15%]">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 hidden md:block">Current Tier</span>
                    {getRoleBadge(user.role)}
                  </div>

                  {/* Action Set Role */}
                  <div className="w-full md:w-[200px] flex-shrink-0 pt-4 md:pt-0 border-t border-slate-100 dark:border-white/5 md:border-0 mt-2 md:mt-0">
                    <Select
                      value={user.role}
                      onValueChange={(value) => handleChangeRole(user, value)}
                    >
                      <SelectTrigger className="w-full h-11 bg-slate-100 dark:bg-black/30 border-transparent hover:border-slate-300 dark:hover:border-white/20 rounded-xl font-semibold transition-all focus:ring-indigo-500/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-white/10 shadow-2xl dark:bg-slate-900">
                        <SelectItem value="admin" className="rounded-xl py-2.5 font-bold cursor-pointer text-red-500">Make Administrator</SelectItem>
                        <SelectItem value="manager" className="rounded-xl py-2.5 font-bold cursor-pointer text-blue-500">Make Department Lead</SelectItem>
                        <SelectItem value="karyawan" className="rounded-xl py-2.5 font-bold cursor-pointer text-emerald-500">Demote to Staff</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Auth Elevate Dialog */}
        <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <AlertDialogContent className="rounded-[32px] dark:bg-slate-900 border-white/10 shadow-2xl p-0 overflow-hidden sm:max-w-md">
            <div className="p-8">
              <AlertDialogHeader className="text-left mb-6">
                <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/20 mb-5">
                  <Lock className="w-7 h-7 text-indigo-500" />
                </div>
                <AlertDialogTitle className="text-2xl font-bold dark:text-white">Otorisasi Akses Baru?</AlertDialogTitle>
                <AlertDialogDescription className="text-[14px] text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                  Anda akan mengubah hak prerogatif akun <b>{selectedUser?.profile?.full_name}</b> dari <b>{getRoleLabel(selectedUser?.role || "")}</b> menuju level <b>{getRoleLabel(newRole)}</b>.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="bg-slate-100 dark:bg-black/20 rounded-2xl p-4 border border-slate-200 dark:border-white/5 mb-8">
                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Capability Impact:</h4>
                <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-200">
                  {newRole === 'admin' ? "Full Database & IAM access. Sangat berbahaya." :
                    newRole === 'manager' ? "Dapat melihat dan meninjau laporan kolektif cabang/departemen." :
                      "Dibatasi hanya untuk akses absensi pribadi dan jurnal."}
                </p>
              </div>

              <AlertDialogFooter className="flex-col sm:flex-row gap-3">
                <AlertDialogCancel disabled={isUpdating} className="mt-0 sm:flex-1 h-12 rounded-xl border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 font-bold">Abaikan</AlertDialogCancel>
                <AlertDialogAction onClick={confirmRoleChange} disabled={isUpdating} className="sm:flex-1 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-600/20">
                  {isUpdating ? "Menerapkan Otorisasi..." : "Setujui Elevasi Akses"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </EnterpriseLayout >
  );
};

export default KelolaRole;
