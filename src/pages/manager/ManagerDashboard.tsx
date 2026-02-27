import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Users, Clock, LogOut, BarChart3, Calendar, Building2, FileCheck
} from "lucide-react";
import logoImage from "@/assets/logo.png";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { ABSENSI_WAJIB_ROLE } from "@/lib/constants";

const ManagerDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { settings, isLoading: settingsLoading } = useSystemSettings();
  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    absentToday: 0,
    departments: 0,
  });

  useEffect(() => {
    if (!settingsLoading) {
      fetchStats();
    }

    // Realtime subscription - DISABLED for stability (enterprise requirement)
    // Data refreshes only on: page load, manual refresh
    // Setup realtime subscription for attendance
    const attendanceChannel = supabase
      .channel("manager-dashboard-attendance-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance" },
        () => fetchStats()
      )
      .subscribe();

    // Setup realtime subscription for profiles
    const profilesChannel = supabase
      .channel("manager-dashboard-profiles-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => fetchStats()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(attendanceChannel);
      supabase.removeChannel(profilesChannel);
    };
  }, [settingsLoading, settings.attendanceStartDate]);

  const fetchStats = async () => {
    // Get karyawan user IDs (FR-01: Filter Role Wajib Absensi)
    const { data: karyawanRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ABSENSI_WAJIB_ROLE);

    const karyawanUserIds = new Set(karyawanRoles?.map(r => r.user_id) || []);

    // Get total employees (karyawan only)
    const { count: totalEmployees } = await supabase
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .in("role", ABSENSI_WAJIB_ROLE);

    // Get today's attendance (karyawan only) - Jakarta Timezone
    const now = new Date();
    const jakartaDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    const year = jakartaDate.getFullYear();
    const month = String(jakartaDate.getMonth() + 1).padStart(2, '0');
    const day = String(jakartaDate.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    const startDate = new Date(settings.attendanceStartDate);
    startDate.setHours(0, 0, 0, 0);

    let presentToday = 0;

    // Compare dates (ignoring time)
    const isAfterStart = jakartaDate >= startDate;

    if (isAfterStart) {
      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("user_id")
        .gte("clock_in", `${todayStr}T00:00:00+07:00`)
        .lte("clock_in", `${todayStr}T23:59:59+07:00`);

      // Filter for karyawan only
      const karyawanAttendance = attendanceData?.filter(a => karyawanUserIds.has(a.user_id)) || [];
      presentToday = karyawanAttendance.length;
    }

    // Get unique departments (karyawan only)
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, department")
      .not("department", "is", null);

    const karyawanProfiles = profiles?.filter(p => karyawanUserIds.has(p.user_id)) || [];
    const uniqueDepartments = new Set(karyawanProfiles.map(p => p.department).filter(Boolean));

    setStats({
      totalEmployees: totalEmployees || 0,
      presentToday: presentToday,
      absentToday: Math.max(0, (totalEmployees || 0) - presentToday),
      departments: uniqueDepartments.size,
    });
  };

  const handleLogout = async () => {
    await signOut();
    toast({
      title: "Logout berhasil",
      description: "Sampai jumpa kembali!",
    });
    navigate("/auth");
  };

  // Manager menu
  const menuItems = [
    {
      icon: Clock,
      title: "Rekap Absensi",
      description: "Lihat semua data kehadiran",
      href: "/manager/absensi",
      color: "bg-accent/10 text-accent",
    },
    {
      icon: BarChart3,
      title: "Laporan",
      description: "Lihat laporan karyawan & cuti",
      href: "/manager/laporan",
      color: "bg-info/10 text-info",
    },
    {
      icon: FileCheck,
      title: "Kelola Cuti",
      description: "Approve/reject pengajuan cuti",
      href: "/manager/cuti",
      color: "bg-success/10 text-success",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-24 items-center justify-center">
                <img src={logoImage} alt="Logo" className="h-full w-auto object-contain" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-foreground">Manager Panel</h1>
                  <Badge className="bg-info text-info-foreground">Manager</Badge>
                </div>
                <p className="text-sm text-muted-foreground">Talenta Digital Attendance</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-foreground">
                  {user?.user_metadata?.full_name || "Manager"}
                </p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8 animate-fade-in">
          <h2 className="text-xl font-semibold text-foreground">
            Dashboard Manager
          </h2>
          <p className="text-muted-foreground">Lihat ringkasan dan laporan absensi karyawan (Read-Only)</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-background via-background/90 to-primary/10 shadow-[0_0_15px_hsl(var(--primary)/0.15)] hover:shadow-[0_0_25px_hsl(var(--primary)/0.3)] hover:border-primary/50 transition-all duration-500 animate-fade-in group">
            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardContent className="pt-6 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">Total Karyawan (Wajib Absensi)</p>
                  <div className="text-3xl font-bold text-foreground drop-shadow-sm">{stats.totalEmployees}</div>
                </div>
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-[0_0_10px_hsl(var(--primary)/0.2)]">
                  <Users className="h-6 w-6 text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden border-success/20 bg-gradient-to-br from-background via-background/90 to-success/10 shadow-[0_0_15px_hsl(var(--success)/0.15)] hover:shadow-[0_0_25px_hsl(var(--success)/0.3)] hover:border-success/50 transition-all duration-500 animate-fade-in group" style={{ animationDelay: "0.1s" }}>
            <div className="absolute inset-0 bg-success/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardContent className="pt-6 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground group-hover:text-success transition-colors">Hadir Hari Ini</p>
                  <div className="text-3xl font-bold text-success drop-shadow-sm">{stats.presentToday}</div>
                </div>
                <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-[0_0_10px_hsl(var(--success)/0.2)]">
                  <Clock className="h-6 w-6 text-success drop-shadow-[0_0_8px_hsl(var(--success)/0.5)]" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden border-warning/20 bg-gradient-to-br from-background via-background/90 to-warning/10 shadow-[0_0_15px_hsl(var(--warning)/0.15)] hover:shadow-[0_0_25px_hsl(var(--warning)/0.3)] hover:border-warning/50 transition-all duration-500 animate-fade-in group" style={{ animationDelay: "0.2s" }}>
            <div className="absolute inset-0 bg-warning/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardContent className="pt-6 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground group-hover:text-warning transition-colors">Tidak Hadir</p>
                  <div className="text-3xl font-bold text-warning drop-shadow-sm">{stats.absentToday}</div>
                </div>
                <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-[0_0_10px_hsl(var(--warning)/0.2)]">
                  <Calendar className="h-6 w-6 text-warning drop-shadow-[0_0_8px_hsl(var(--warning)/0.5)]" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden border-info/20 bg-gradient-to-br from-background via-background/90 to-info/10 shadow-[0_0_15px_hsl(var(--info)/0.15)] hover:shadow-[0_0_25px_hsl(var(--info)/0.3)] hover:border-info/50 transition-all duration-500 animate-fade-in group" style={{ animationDelay: "0.3s" }}>
            <div className="absolute inset-0 bg-info/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardContent className="pt-6 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground group-hover:text-info transition-colors">Departemen</p>
                  <div className="text-3xl font-bold text-info drop-shadow-sm">{stats.departments}</div>
                </div>
                <div className="h-12 w-12 rounded-xl bg-info/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-[0_0_10px_hsl(var(--info)/0.2)]">
                  <Building2 className="h-6 w-6 text-info drop-shadow-[0_0_8px_hsl(var(--info)/0.5)]" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Info Card */}
        <div className="mb-6 p-4 rounded-lg bg-info/10 border border-info/30">
          <p className="text-sm text-info-foreground">
            <strong>Mode Read-Only:</strong> Sebagai Manager, Anda hanya dapat melihat data tanpa melakukan perubahan.
          </p>
        </div>

        {/* Menu Grid */}
        <h3 className="mb-4 text-lg font-semibold text-foreground">Menu Manager</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {menuItems.map((item, index) => (
            <Link
              key={item.title}
              to={item.href}
              className="block animate-fade-in"
              style={{ animationDelay: `${(index + 4) * 0.1}s` }}
            >
              <Card className="group h-full relative overflow-hidden border-border/50 bg-gradient-to-br from-card via-card to-muted/30 transition-all duration-500 hover:border-primary/50 hover:shadow-[0_0_25px_hsl(var(--primary)/0.15)] hover:-translate-y-1">
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <CardHeader className="pb-3 relative z-10">
                  <div className={`mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-background border border-border shadow-sm group-hover:scale-110 transition-all duration-500 ${item.color}`}>
                    <item.icon className="h-7 w-7 drop-shadow-sm" />
                  </div>
                  <CardTitle className="flex items-center justify-between text-xl font-bold group-hover:text-primary transition-colors">
                    {item.title}
                  </CardTitle>
                  <CardDescription className="text-sm mt-1">{item.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-12">
        <div className="container mx-auto px-4 py-4">
          <p className="text-center text-sm text-muted-foreground">
            © 2025 Talenta Digital Attendance System. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default ManagerDashboard;
