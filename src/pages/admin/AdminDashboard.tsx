import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  Users, Clock, Key, Settings, ChevronRight, LogOut, 
  BarChart3, FileText, Calendar, Building2, Shield,
  CheckCircle2, AlertCircle, UserCheck, UserX, TrendingUp, RefreshCw
} from "lucide-react";
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell 
} from "recharts";
import logoImage from "@/assets/logo.png";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSystemSettings } from "@/hooks/useSystemSettings";

const AUTO_REFRESH_INTERVAL = 60000; // 1 minute

interface WeeklyData {
  day: string;
  hadir: number;
  terlambat: number;
  tidakHadir: number;
}

interface MonthlyData {
  week: string;
  hadir: number;
  terlambat: number;
}

const AdminDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { settings, isLoading: settingsLoading } = useSystemSettings();
  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    lateToday: 0,
    absentToday: 0,
    departments: 0,
    pendingLeave: 0,
    approvedLeaveThisMonth: 0,
    attendanceThisMonth: 0,
    attendanceRate: 0,
  });
  const [recentAttendance, setRecentAttendance] = useState<Array<{
    id: string;
    full_name: string;
    clock_in: string;
    status: string;
  }>>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
const [statusDistribution, setStatusDistribution] = useState<Array<{ name: string; value: number; color: string }>>([]);
  const [attendanceBreakdown, setAttendanceBreakdown] = useState({ onTime: 0, late: 0, earlyLeave: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [nextRefresh, setNextRefresh] = useState(AUTO_REFRESH_INTERVAL / 1000);

  // Fetch all dashboard data in parallel for faster loading
  const fetchAllData = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      // Get admin user IDs once and reuse
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      const adminUserIds = new Set(adminRoles?.map(r => r.user_id) || []);

      // Run all fetches in parallel
      await Promise.all([
        fetchStats(adminUserIds),
        fetchRecentAttendance(adminUserIds),
        fetchWeeklyTrend(adminUserIds),
        fetchMonthlyTrend(adminUserIds),
      ]);
      setLastRefresh(new Date());
    } finally {
      setIsLoading(false);
    }
  }, [settings.attendanceStartDate]);

  useEffect(() => {
    if (!settingsLoading) {
      fetchAllData(true);
    }

    // Setup realtime subscriptions
    const attendanceChannel = supabase
      .channel("dashboard-attendance-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance" },
        () => fetchAllData(false)
      )
      .subscribe();

    const profilesChannel = supabase
      .channel("dashboard-profiles-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => fetchAllData(false)
      )
      .subscribe();

    const leaveChannel = supabase
      .channel("dashboard-leave-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leave_requests" },
        () => fetchAllData(false)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(attendanceChannel);
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(leaveChannel);
    };
  }, [settingsLoading, fetchAllData]);

  // Auto refresh every minute
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      fetchAllData(false);
    }, AUTO_REFRESH_INTERVAL);

    // Countdown timer
    const countdownInterval = setInterval(() => {
      setNextRefresh(prev => (prev <= 1 ? AUTO_REFRESH_INTERVAL / 1000 : prev - 1));
    }, 1000);

    return () => {
      clearInterval(refreshInterval);
      clearInterval(countdownInterval);
    };
  }, [fetchAllData]);

  const handleManualRefresh = () => {
    fetchAllData(false);
    setNextRefresh(AUTO_REFRESH_INTERVAL / 1000);
    toast({
      title: "Data diperbarui",
      description: "Dashboard telah di-refresh",
    });
  };

  const fetchStats = async (adminUserIds: Set<string>) => {
    const today = new Date();
    const startOfTodayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const endOfTodayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const startDate = new Date(settings.attendanceStartDate);
    startDate.setHours(0, 0, 0, 0);

    // Fetch all data in parallel
    const [
      profilesResult,
      todayAttendanceResult,
      departmentsResult,
      pendingLeavesResult,
      approvedLeavesResult,
      monthAttendanceResult,
    ] = await Promise.all([
      supabase.from("profiles").select("user_id"),
      today >= startDate
        ? supabase.from("attendance").select("user_id, status")
            .gte("clock_in", startOfTodayLocal.toISOString())
            .lte("clock_in", endOfTodayLocal.toISOString())
        : Promise.resolve({ data: [] }),
      supabase.from("profiles").select("department").not("department", "is", null),
      supabase.from("leave_requests").select("user_id").eq("status", "pending"),
      supabase.from("leave_requests").select("user_id")
        .eq("status", "approved")
        .gte("start_date", startOfMonth.toISOString().split("T")[0])
        .lte("end_date", endOfMonth.toISOString().split("T")[0]),
      supabase.from("attendance").select("user_id")
        .gte("clock_in", startOfMonth.toISOString())
        .lte("clock_in", endOfMonth.toISOString()),
    ]);

    const nonAdminProfiles = profilesResult.data?.filter(p => !adminUserIds.has(p.user_id)) || [];
    const totalEmployees = nonAdminProfiles.length;

    const nonAdminTodayAttendance = todayAttendanceResult.data?.filter(a => !adminUserIds.has(a.user_id)) || [];
    const presentToday = nonAdminTodayAttendance.length;
    const lateToday = nonAdminTodayAttendance.filter(a => a.status === "late").length;
    const earlyLeaveToday = nonAdminTodayAttendance.filter(a => a.status === "early_leave").length;
    // "Hadir tepat waktu" = semua yang hadir dikurangi yang terlambat dan pulang awal
    const onTimeToday = presentToday - lateToday - earlyLeaveToday;
    const absentToday = Math.max(0, totalEmployees - presentToday);

    const uniqueDepartments = new Set(departmentsResult.data?.map(d => d.department).filter(Boolean));
    const nonAdminPendingLeaves = pendingLeavesResult.data?.filter(l => !adminUserIds.has(l.user_id)) || [];
    const nonAdminApprovedLeaves = approvedLeavesResult.data?.filter(l => !adminUserIds.has(l.user_id)) || [];
    const nonAdminMonthAttendance = monthAttendanceResult.data?.filter(a => !adminUserIds.has(a.user_id)) || [];

    const workDaysThisMonth = getWorkDaysInMonth(today.getFullYear(), today.getMonth());
    const expectedAttendance = totalEmployees * workDaysThisMonth;
    const attendanceRate = expectedAttendance > 0 
      ? Math.round((nonAdminMonthAttendance.length / expectedAttendance) * 100) 
      : 0;

    setStats({
      totalEmployees,
      presentToday,
      lateToday,
      absentToday,
      departments: uniqueDepartments.size,
      pendingLeave: nonAdminPendingLeaves.length,
      approvedLeaveThisMonth: nonAdminApprovedLeaves.length,
      attendanceThisMonth: nonAdminMonthAttendance.length,
      attendanceRate: Math.min(100, attendanceRate),
    });

    // Update status distribution for TODAY (synced with stats cards)
    // Hadir = semua yang absen (termasuk terlambat dan pulang awal)
    // Total should equal totalEmployees: presentToday + absentToday
    setStatusDistribution([
      { name: "Hadir", value: presentToday, color: "hsl(158, 64%, 42%)" },
      { name: "Tidak Hadir", value: absentToday, color: "hsl(215, 16%, 47%)" },
    ]);

    // Store breakdown for tooltip
    setAttendanceBreakdown({
      onTime: onTimeToday,
      late: lateToday,
      earlyLeave: earlyLeaveToday,
    });
  };

  const fetchWeeklyTrend = async (adminUserIds: Set<string>) => {
    const today = new Date();
    const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    
    // Get total employees and all attendance for last 7 days in parallel
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    const [profilesResult, attendanceResult] = await Promise.all([
      supabase.from("profiles").select("user_id"),
      supabase.from("attendance").select("user_id, status, clock_in")
        .gte("clock_in", sevenDaysAgo.toISOString())
        .lte("clock_in", endOfToday.toISOString()),
    ]);

    const nonAdminProfiles = profilesResult.data?.filter(p => !adminUserIds.has(p.user_id)) || [];
    const totalEmployees = nonAdminProfiles.length;
    const allAttendance = attendanceResult.data?.filter(a => !adminUserIds.has(a.user_id)) || [];

    const weekData: WeeklyData[] = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayAttendance = allAttendance.filter(a => a.clock_in.startsWith(dateStr));
      const presentCount = dayAttendance.filter(a => a.status === "present").length;
      const lateCount = dayAttendance.filter(a => a.status === "late").length;
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      weekData.push({
        day: dayNames[dayOfWeek],
        hadir: presentCount,
        terlambat: lateCount,
        tidakHadir: isWeekend ? 0 : Math.max(0, totalEmployees - presentCount - lateCount),
      });
    }
    
    setWeeklyData(weekData);
  };

  const fetchMonthlyTrend = async (adminUserIds: Set<string>) => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    // Fetch all month attendance in one query
    const { data: monthAttendance } = await supabase
      .from("attendance")
      .select("user_id, status, clock_in")
      .gte("clock_in", startOfMonth.toISOString())
      .lte("clock_in", endOfMonth.toISOString());

    const allAttendance = monthAttendance?.filter(a => !adminUserIds.has(a.user_id)) || [];
    const monthData: MonthlyData[] = [];
    
    for (let week = 0; week < 4; week++) {
      const weekStart = new Date(startOfMonth);
      weekStart.setDate(startOfMonth.getDate() + (week * 7));
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      
      if (weekStart > today) break;
      
      const weekAttendance = allAttendance.filter(a => {
        const clockIn = new Date(a.clock_in);
        return clockIn >= weekStart && clockIn <= weekEnd;
      });
      
      const presentCount = weekAttendance.filter(a => a.status === "present").length;
      const lateCount = weekAttendance.filter(a => a.status === "late").length;
      
      monthData.push({
        week: `Minggu ${week + 1}`,
        hadir: presentCount,
        terlambat: lateCount,
      });
    }
    
    setMonthlyData(monthData);
  };

  const fetchRecentAttendance = async (adminUserIds: Set<string>) => {
    const today = new Date();
    const startOfTodayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const endOfTodayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    // Fetch attendance and all profiles in parallel
    const [attendanceResult, profilesResult] = await Promise.all([
      supabase.from("attendance")
        .select("id, user_id, clock_in, status")
        .gte("clock_in", startOfTodayLocal.toISOString())
        .lte("clock_in", endOfTodayLocal.toISOString())
        .order("clock_in", { ascending: false })
        .limit(10),
      supabase.from("profiles").select("user_id, full_name"),
    ]);

    if (attendanceResult.data) {
      const profileMap = new Map(profilesResult.data?.map(p => [p.user_id, p.full_name]) || []);
      const nonAdminData = attendanceResult.data.filter(a => !adminUserIds.has(a.user_id));
      
      const attendanceWithNames = nonAdminData.slice(0, 5).map(record => ({
        id: record.id,
        full_name: profileMap.get(record.user_id) || "Unknown",
        clock_in: record.clock_in,
        status: record.status,
      }));
      setRecentAttendance(attendanceWithNames);
    }
  };

  const getWorkDaysInMonth = (year: number, month: number) => {
    const date = new Date(year, month, 1);
    let workDays = 0;
    while (date.getMonth() === month) {
      const dayOfWeek = date.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) workDays++;
      date.setDate(date.getDate() + 1);
    }
    return workDays;
  };

  const handleLogout = async () => {
    await signOut();
    toast({
      title: "Logout berhasil",
      description: "Sampai jumpa kembali!",
    });
    navigate("/auth");
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return <Badge className="bg-success/20 text-success border-0 text-xs">Hadir</Badge>;
      case "late":
        return <Badge className="bg-warning/20 text-warning border-0 text-xs">Terlambat</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">{status}</Badge>;
    }
  };

  const menuItems = [
    {
      icon: Users,
      title: "Kelola Karyawan",
      description: "Tambah, edit, hapus data karyawan",
      href: "/admin/karyawan",
      color: "bg-primary/10 text-primary",
    },
    {
      icon: Clock,
      title: "Rekap Absensi",
      description: "Lihat semua data kehadiran",
      href: "/admin/absensi",
      color: "bg-accent/10 text-accent",
    },
    {
      icon: BarChart3,
      title: "Laporan",
      description: "Generate laporan karyawan",
      href: "/admin/laporan",
      color: "bg-info/10 text-info",
    },
    {
      icon: Building2,
      title: "Departemen",
      description: "Kelola struktur organisasi",
      href: "/admin/departemen",
      color: "bg-warning/10 text-warning",
    },
    {
      icon: Shield,
      title: "Kelola Role",
      description: "Atur hak akses user",
      href: "/admin/role",
      color: "bg-purple-500/10 text-purple-500",
    },
    {
      icon: Key,
      title: "Reset Password",
      description: "Reset password karyawan",
      href: "/admin/reset-password",
      color: "bg-destructive/10 text-destructive",
    },
    {
      icon: Settings,
      title: "Pengaturan",
      description: "Konfigurasi sistem",
      href: "/admin/pengaturan",
      color: "bg-muted-foreground/10 text-muted-foreground",
    },
  ];

  const currentMonth = new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg shadow-lg p-3">
          <p className="font-medium text-foreground mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const isHadir = data.name === "Hadir";
      
      return (
        <div className="bg-card border border-border rounded-lg shadow-lg p-3 min-w-[140px]">
          <p className="font-medium text-foreground mb-2" style={{ color: data.payload.color }}>
            {data.name}: {data.value}
          </p>
          {isHadir && (
            <div className="space-y-1 pt-1 border-t border-border">
              <p className="text-xs text-muted-foreground font-medium">Detail:</p>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-success" />
                <span className="text-xs text-foreground">Tepat Waktu: {attendanceBreakdown.onTime}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-warning" />
                <span className="text-xs text-foreground">Terlambat: {attendanceBreakdown.late}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-orange-500" />
                <span className="text-xs text-foreground">Pulang Awal: {attendanceBreakdown.earlyLeave}</span>
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

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
                  <h1 className="text-xl font-bold text-foreground">Admin Panel</h1>
                  <Badge className="bg-primary text-primary-foreground">Admin</Badge>
                </div>
                <p className="text-sm text-muted-foreground">Talenta Digital Attendance</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-foreground">
                  {user?.user_metadata?.full_name || "Administrator"}
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
        <div className="mb-8 animate-fade-in flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Dashboard Administrator
            </h2>
            <p className="text-muted-foreground">Kelola semua aspek sistem karyawan dan absensi</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-xs text-muted-foreground hidden sm:block">
              <p>Update terakhir: {lastRefresh.toLocaleTimeString("id-ID")}</p>
              <p>Auto refresh: {nextRefresh}s</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={isLoading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>

        {/* Primary Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          {isLoading ? (
            <>
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="border-border">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <Skeleton className="h-12 w-12 rounded-lg" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          ) : (
            <>
              <Card className="border-border animate-fade-in">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Karyawan</p>
                      <div className="text-3xl font-bold text-foreground">{stats.totalEmployees}</div>
                      <p className="text-xs text-muted-foreground mt-1">Aktif terdaftar</p>
                    </div>
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-border animate-fade-in" style={{ animationDelay: "0.1s" }}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Hadir Hari Ini</p>
                      <div className="text-3xl font-bold text-success">{stats.presentToday}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {stats.lateToday > 0 && <span className="text-warning">{stats.lateToday} terlambat</span>}
                        {stats.lateToday === 0 && "Tepat waktu semua"}
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center">
                      <UserCheck className="h-6 w-6 text-success" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-border animate-fade-in" style={{ animationDelay: "0.2s" }}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Tidak Hadir</p>
                      <div className="text-3xl font-bold text-warning">{stats.absentToday}</div>
                      <p className="text-xs text-muted-foreground mt-1">Belum absen hari ini</p>
                    </div>
                    <div className="h-12 w-12 rounded-lg bg-warning/10 flex items-center justify-center">
                      <UserX className="h-6 w-6 text-warning" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-border animate-fade-in" style={{ animationDelay: "0.3s" }}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Pengajuan Cuti</p>
                      <div className="text-3xl font-bold text-info">{stats.pendingLeave}</div>
                      <p className="text-xs text-muted-foreground mt-1">Menunggu persetujuan</p>
                    </div>
                    <div className="h-12 w-12 rounded-lg bg-info/10 flex items-center justify-center">
                      <FileText className="h-6 w-6 text-info" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Charts Section */}
        <div className="grid gap-4 lg:grid-cols-2 mb-6">
          {/* Weekly Trend Chart */}
          <Card className="border-border animate-fade-in" style={{ animationDelay: "0.4s" }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Tren Kehadiran Mingguan
              </CardTitle>
              <CardDescription>7 hari terakhir</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorHadir" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(158, 64%, 42%)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(158, 64%, 42%)" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorTerlambat" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                    <XAxis 
                      dataKey="day" 
                      tick={{ fontSize: 12, fill: "hsl(215, 16%, 47%)" }}
                      axisLine={{ stroke: "hsl(214, 32%, 91%)" }}
                    />
                    <YAxis 
                      tick={{ fontSize: 12, fill: "hsl(215, 16%, 47%)" }}
                      axisLine={{ stroke: "hsl(214, 32%, 91%)" }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey="hadir" 
                      stroke="hsl(158, 64%, 42%)" 
                      fillOpacity={1} 
                      fill="url(#colorHadir)" 
                      name="Hadir"
                      strokeWidth={2}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="terlambat" 
                      stroke="hsl(38, 92%, 50%)" 
                      fillOpacity={1} 
                      fill="url(#colorTerlambat)" 
                      name="Terlambat"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-2">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-success" />
                  <span className="text-xs text-muted-foreground">Hadir</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-warning" />
                  <span className="text-xs text-muted-foreground">Terlambat</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Trend Chart */}
          <Card className="border-border animate-fade-in" style={{ animationDelay: "0.5s" }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-info" />
                Tren Kehadiran Bulanan
              </CardTitle>
              <CardDescription>{currentMonth}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                    <XAxis 
                      dataKey="week" 
                      tick={{ fontSize: 12, fill: "hsl(215, 16%, 47%)" }}
                      axisLine={{ stroke: "hsl(214, 32%, 91%)" }}
                    />
                    <YAxis 
                      tick={{ fontSize: 12, fill: "hsl(215, 16%, 47%)" }}
                      axisLine={{ stroke: "hsl(214, 32%, 91%)" }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar 
                      dataKey="hadir" 
                      fill="hsl(158, 64%, 42%)" 
                      name="Hadir" 
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar 
                      dataKey="terlambat" 
                      fill="hsl(38, 92%, 50%)" 
                      name="Terlambat" 
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-2">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-success" />
                  <span className="text-xs text-muted-foreground">Hadir</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-warning" />
                  <span className="text-xs text-muted-foreground">Terlambat</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Stats */}
        <div className="grid gap-4 lg:grid-cols-3 mb-8">
          {/* Attendance Rate Card */}
          <Card className="border-border animate-fade-in" style={{ animationDelay: "0.6s" }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Tingkat Kehadiran
              </CardTitle>
              <CardDescription>{currentMonth}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-end justify-between">
                  <span className="text-4xl font-bold text-foreground">{stats.attendanceRate}%</span>
                  <span className="text-sm text-muted-foreground">{stats.attendanceThisMonth} kehadiran</span>
                </div>
                <Progress value={stats.attendanceRate} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Target: 95%</span>
                  <span>{stats.attendanceRate >= 95 ? "✓ Tercapai" : "Belum tercapai"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status Distribution */}
          <Card className="border-border animate-fade-in" style={{ animationDelay: "0.7s" }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-accent" />
                Distribusi Status
              </CardTitle>
              <CardDescription>7 hari terakhir</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[120px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={50}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 mt-2">
                {statusDistribution.map((item, index) => (
                  <div key={index} className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-muted-foreground">{item.name}: {item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Attendance Card */}
          <Card className="border-border animate-fade-in" style={{ animationDelay: "0.8s" }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-accent" />
                Absensi Terbaru
              </CardTitle>
              <CardDescription>Hari ini</CardDescription>
            </CardHeader>
            <CardContent>
              {recentAttendance.length === 0 ? (
                <div className="text-center py-4">
                  <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Belum ada absensi hari ini</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentAttendance.map((record) => (
                    <div key={record.id} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-medium text-primary">
                            {record.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-foreground truncate max-w-[100px]">
                          {record.full_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{formatTime(record.clock_in)}</span>
                        {getStatusBadge(record.status)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Menu Grid */}
        <h3 className="mb-4 text-lg font-semibold text-foreground">Menu Admin</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {menuItems.map((item, index) => (
            <Link
              key={item.title}
              to={item.href}
              className="block animate-fade-in"
              style={{ animationDelay: `${(index + 9) * 0.1}s` }}
            >
              <Card className="group h-full border-border transition-all duration-300 hover:border-primary/30 hover:shadow-lg">
                <CardHeader className="pb-3">
                  <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-lg ${item.color}`}>
                    <item.icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="flex items-center justify-between text-lg">
                    {item.title}
                    <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </CardTitle>
                  <CardDescription>{item.description}</CardDescription>
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

export default AdminDashboard;
