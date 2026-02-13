import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Users, Shield, Search, RefreshCw, UserCog,
  CheckCircle2, Crown, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

    // Realtime Subscriptions - DISABLED for stability
    /*
    const channel = supabase
      .channel("role-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_roles" },
        () => fetchUsers()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    */
    return () => { };
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      // Get all user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .order("role");

      if (rolesError) throw rolesError;

      // Get profiles for each user
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

      // Try to get emails from edge function
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
      } catch (e) {
      }

      setUsers(usersWithProfiles);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Tidak dapat memuat data user",
      });
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

      toast({
        title: "Berhasil",
        description: `Role ${selectedUser.profile?.full_name || "User"} berhasil diubah menjadi ${getRoleLabel(newRole)}`,
      });

      fetchUsers();
    } catch (error: any) {
      console.error("Error updating role:", error);
      toast({
        variant: "destructive",
        title: "Gagal",
        description: error.message || "Tidak dapat mengubah role",
      });
    } finally {
      setIsUpdating(false);
      setIsDialogOpen(false);
      setSelectedUser(null);
      setNewRole("");
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin": return "Admin";
      case "manager": return "Manager";
      case "karyawan": return "Karyawan";
      default: return role;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return (
          <Badge className="bg-destructive text-destructive-foreground gap-1">
            <Crown className="h-3 w-3" />
            Admin
          </Badge>
        );
      case "manager":
        return (
          <Badge className="bg-info text-info-foreground gap-1">
            <Eye className="h-3 w-3" />
            Manager
          </Badge>
        );
      case "karyawan":
        return (
          <Badge className="bg-success text-success-foreground gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Karyawan
          </Badge>
        );
      default:
        return <Badge variant="secondary">{role}</Badge>;
    }
  };

  const getRoleDescription = (role: string) => {
    switch (role) {
      case "admin": return "Akses penuh ke semua fitur";
      case "manager": return "Akses read-only ke laporan";
      case "karyawan": return "Akses absensi pribadi";
      default: return "";
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

  return (
    <EnterpriseLayout
      title="Kelola Role"
      subtitle="Atur hak akses user"
      roleLabel="Administrator"
      showExport={false}
      menuSections={ADMIN_MENU_SECTIONS}
    >
      <div className="pb-8">

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <Card className="border-border">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">Total User</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                    <Crown className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-destructive">{stats.admin}</p>
                    <p className="text-xs text-muted-foreground">Admin</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center">
                    <Eye className="h-5 w-5 text-info" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-info">{stats.manager}</p>
                    <p className="text-xs text-muted-foreground">Manager</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-success">{stats.karyawan}</p>
                    <p className="text-xs text-muted-foreground">Karyawan</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Role Info */}
          <Card className="border-border mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Informasi Role</CardTitle>
              <CardDescription>Penjelasan hak akses untuk setiap role</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Crown className="h-5 w-5 text-destructive" />
                    <span className="font-semibold text-foreground">Admin</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Akses penuh: kelola karyawan, absensi, laporan, pengaturan, reset data, dan kelola role user.
                  </p>
                </div>
                <div className="p-4 rounded-lg border border-info/30 bg-info/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="h-5 w-5 text-info" />
                    <span className="font-semibold text-foreground">Manager</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Akses read-only: lihat rekap absensi, laporan, dan export data. Tidak dapat mengubah data.
                  </p>
                </div>
                <div className="p-4 rounded-lg border border-success/30 bg-success/5">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <span className="font-semibold text-foreground">Karyawan</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Akses pribadi: absensi, riwayat absensi, profil, dan pengajuan cuti untuk diri sendiri.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari nama, departemen, atau email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Role</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="karyawan">Karyawan</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Users Table */}
          <Card className="border-border">
            <div className="overflow-x-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-12 text-center">
                  <UserCog className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground">Tidak Ada Data</h3>
                  <p className="text-muted-foreground">Tidak ditemukan user dengan kriteria tersebut</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead className="hidden sm:table-cell">Email</TableHead>
                      <TableHead className="hidden md:table-cell">Departemen</TableHead>
                      <TableHead>Role Saat Ini</TableHead>
                      <TableHead>Ubah Role</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.user_id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{user.profile?.full_name || "Tanpa Nama"}</p>
                            <p className="text-xs text-muted-foreground">{user.profile?.position || "-"}</p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span className="text-sm">{user.email || "-"}</span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {user.profile?.department || "-"}
                        </TableCell>
                        <TableCell>{getRoleBadge(user.role)}</TableCell>
                        <TableCell>
                          <Select
                            value={user.role}
                            onValueChange={(value) => handleChangeRole(user, value)}
                          >
                            <SelectTrigger className="w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">
                                <div className="flex items-center gap-2">
                                  <Crown className="h-3 w-3 text-destructive" />
                                  Admin
                                </div>
                              </SelectItem>
                              <SelectItem value="manager">
                                <div className="flex items-center gap-2">
                                  <Eye className="h-3 w-3 text-info" />
                                  Manager
                                </div>
                              </SelectItem>
                              <SelectItem value="karyawan">
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 className="h-3 w-3 text-success" />
                                  Karyawan
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </Card>
        </main>

        {/* Confirmation Dialog */}
        <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Konfirmasi Perubahan Role</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>
                    Anda akan mengubah role <strong>{selectedUser?.profile?.full_name || "User"}</strong> dari{" "}
                    <strong>{getRoleLabel(selectedUser?.role || "")}</strong> menjadi{" "}
                    <strong>{getRoleLabel(newRole)}</strong>.
                  </p>
                  <div className="p-3 rounded-lg bg-muted">
                    <p className="text-sm font-medium">Hak akses baru:</p>
                    <p className="text-sm text-muted-foreground">{getRoleDescription(newRole)}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Perubahan akan langsung berlaku setelah user login ulang.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isUpdating}>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={confirmRoleChange} disabled={isUpdating}>
                {isUpdating ? "Menyimpan..." : "Ya, Ubah Role"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </EnterpriseLayout>
  );
};

export default KelolaRole;
