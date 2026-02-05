import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Users, Clock, Key, Settings, ChevronRight, LogOut,
  BarChart3, FileText, Calendar, Building2, Shield,
  CheckCircle2, AlertCircle, UserCheck, UserX, TrendingUp, RefreshCw,
  Download, Bell, MoreVertical, ArrowUpRight, Briefcase, FolderOpen, TrendingDown, Menu
} from "lucide-react";
import BottomNavigation from "@/components/layout/BottomNavigation";
import MiniSidebar from "@/components/layout/MiniSidebar";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from "recharts";
import logoImage from "@/assets/logo.png";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { ABSENSI_WAJIB_ROLE } from "@/lib/constants";

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

// Enterprise color palette - Talenta Traincom Blue/Green Theme
const COLORS = {
  primary: "#0066b3",        // Talenta Blue
  primaryLight: "#00aaff",
  primaryDark: "#004080",
  accent: "#7dc242",         // Talenta Green
  accentLight: "#a5d76e",
  accentDark: "#5aa530",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  info: "#3B82F6",
  slate: "#64748B",
  background: "#F8FAFC",
  card: "#FFFFFF",
  border: "#E2E8F0",
};

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
    newEmployeesThisMonth: 0,
  });
  const [recentAttendance, setRecentAttendance] = useState<Array<{
    id: string;
    full_name: string;
    clock_in: string;
    status: string;
  }>>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [departmentData, setDepartmentData] = useState<Array<{ name: string; value: number; color: string }>>([]);
  const [attendanceBreakdown, setAttendanceBreakdown] = useState({ onTime: 0, late: 0, earlyLeave: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [nextRefresh, setNextRefresh] = useState(AUTO_REFRESH_INTERVAL / 1000);
  const [announcements] = useState([
    { id: 1, title: "Rapat Umum Perusahaan", date: "5 Des 2025 - 15.00", type: "event" },
    { id: 2, title: "Batas Waktu Review Kinerja", date: "15 Des 2025", type: "deadline" },
    { id: 3, title: "Kebijakan Kesehatan Kantor Baru", date: "Berlaku 1 Nov 2025", type: "policy" },
    { id: 4, title: "Pelatihan Sistem HR Baru", date: "22 Des 2025 - 10.00", type: "training" },
    { id: 5, title: "Workshop Keberagaman & Inklusi", date: "24 Des 2025 - 13.00", type: "event" },
  ]);

  // Fetch all dashboard data in parallel for faster loading
  const fetchAllData = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      // Get karyawan user IDs (FR-01: Filter Role Wajib Absensi)
      const { data: karyawanRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ABSENSI_WAJIB_ROLE);
      const karyawanUserIds = new Set(karyawanRoles?.map(r => r.user_id) || []);

      // Run all fetches in parallel
      await Promise.all([
        fetchStats(karyawanUserIds),
        fetchRecentAttendance(karyawanUserIds),
        fetchWeeklyTrend(karyawanUserIds),
        fetchMonthlyTrend(karyawanUserIds),
        fetchDepartmentDistribution(karyawanUserIds),
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
    /* 
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
    */
  }, [settingsLoading, fetchAllData]);

  // Auto refresh every minute
  useEffect(() => {
    /*
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
    */
  }, [fetchAllData]);

  const handleManualRefresh = () => {
    fetchAllData(false);
    setNextRefresh(AUTO_REFRESH_INTERVAL / 1000);
    toast({
      title: "Data diperbarui",
      description: "Dashboard telah di-refresh",
    });
  };

  const fetchDepartmentDistribution = async (karyawanUserIds: Set<string>) => {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, department");

    if (profiles) {
      const karyawanProfiles = profiles.filter(p => karyawanUserIds.has(p.user_id));
      const deptCounts: Record<string, number> = {};

      karyawanProfiles.forEach(p => {
        const dept = p.department || "Others";
        deptCounts[dept] = (deptCounts[dept] || 0) + 1;
      });

      const colors = [
        "#0066b3", // Blue
        "#F59E0B", // Amber/Orange
        "#10B981", // Emerald 
        "#EC4899", // Pink
        "#8B5CF6", // Purple
        "#06B6D4", // Cyan
        "#EF4444", // Red
        "#64748B"  // Slate
      ];
      const deptData = Object.entries(deptCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, value], index) => ({
          name,
          value,
          color: colors[index % colors.length],
        }));

      setDepartmentData(deptData);
    }
  };

  const fetchStats = async (karyawanUserIds: Set<string>) => {
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
      supabase.from("profiles").select("user_id, created_at"),
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

    // FR-02: Total Karyawan Aktif (Karyawan Only)
    const karyawanProfiles = profilesResult.data?.filter(p => karyawanUserIds.has(p.user_id)) || [];
    const totalEmployees = karyawanProfiles.length;

    // New employees this month
    const newEmployeesThisMonth = karyawanProfiles.filter(p => {
      const created = new Date(p.created_at);
      return created >= startOfMonth && created <= endOfMonth;
    }).length;

    // FR-03: Hadir Hari Ini (Karyawan Only)
    const karyawanTodayAttendance = todayAttendanceResult.data?.filter(a => karyawanUserIds.has(a.user_id)) || [];
    const presentToday = karyawanTodayAttendance.length;
    const lateToday = karyawanTodayAttendance.filter(a => a.status === "late").length;
    const earlyLeaveToday = karyawanTodayAttendance.filter(a => a.status === "early_leave").length;
    const onTimeToday = presentToday - lateToday - earlyLeaveToday;

    // FR-04: Tidak Hadir (Karyawan Only)
    const absentToday = Math.max(0, totalEmployees - presentToday);

    const uniqueDepartments = new Set(departmentsResult.data?.map(d => d.department).filter(Boolean));
    const karyawanPendingLeaves = pendingLeavesResult.data?.filter(l => karyawanUserIds.has(l.user_id)) || [];
    const karyawanApprovedLeaves = approvedLeavesResult.data?.filter(l => karyawanUserIds.has(l.user_id)) || [];
    const karyawanMonthAttendance = monthAttendanceResult.data?.filter(a => karyawanUserIds.has(a.user_id)) || [];

    const workDaysThisMonth = getWorkDaysInMonth(today.getFullYear(), today.getMonth());
    const expectedAttendance = totalEmployees * workDaysThisMonth;
    const attendanceRate = expectedAttendance > 0
      ? Math.round((karyawanMonthAttendance.length / expectedAttendance) * 100)
      : 0;

    setStats({
      totalEmployees,
      presentToday,
      lateToday,
      absentToday,
      departments: uniqueDepartments.size,
      pendingLeave: karyawanPendingLeaves.length,
      approvedLeaveThisMonth: karyawanApprovedLeaves.length,
      attendanceThisMonth: karyawanMonthAttendance.length,
      attendanceRate: Math.min(100, attendanceRate),
      newEmployeesThisMonth,
    });

    setAttendanceBreakdown({
      onTime: onTimeToday,
      late: lateToday,
      earlyLeave: earlyLeaveToday,
    });
  };

  const fetchWeeklyTrend = async (karyawanUserIds: Set<string>) => {
    const today = new Date();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    // Get last 12 months data
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    const [profilesResult, attendanceResult] = await Promise.all([
      supabase.from("profiles").select("user_id"),
      supabase.from("attendance").select("user_id, status, clock_in")
        .gte("clock_in", startOfYear.toISOString())
        .lte("clock_in", endOfToday.toISOString()),
    ]);

    const karyawanProfiles = profilesResult.data?.filter(p => karyawanUserIds.has(p.user_id)) || [];
    const totalEmployees = karyawanProfiles.length;
    const allAttendance = attendanceResult.data?.filter(a => karyawanUserIds.has(a.user_id)) || [];

    const weekData: WeeklyData[] = [];

    // Get last 12 months
    for (let i = 11; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

      const monthAttendance = allAttendance.filter(a => {
        const clockIn = new Date(a.clock_in);
        return clockIn >= monthStart && clockIn <= monthEnd;
      });

      const presentCount = monthAttendance.filter(a => a.status === "present").length;
      const lateCount = monthAttendance.filter(a => a.status === "late").length;

      // Calculate percentage for visualization
      const workDays = getWorkDaysInMonth(date.getFullYear(), date.getMonth());
      const expected = totalEmployees * workDays;
      const percentage = expected > 0 ? Math.round(((presentCount + lateCount) / expected) * 100) : 0;

      weekData.push({
        day: monthNames[date.getMonth()],
        hadir: Math.min(100, percentage),
        terlambat: lateCount,
        tidakHadir: Math.max(0, 100 - percentage),
      });
    }

    setWeeklyData(weekData);
  };

  const fetchMonthlyTrend = async (karyawanUserIds: Set<string>) => {
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const endOfYear = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    // Fetch all year attendance in one query
    const { data: yearAttendance } = await supabase
      .from("attendance")
      .select("user_id, status, clock_in")
      .gte("clock_in", startOfYear.toISOString())
      .lte("clock_in", endOfYear.toISOString());

    const allAttendance = yearAttendance?.filter(a => karyawanUserIds.has(a.user_id)) || [];
    const monthData: MonthlyData[] = [];

    for (let month = 0; month <= today.getMonth(); month++) {
      const monthStart = new Date(today.getFullYear(), month, 1);
      const monthEnd = new Date(today.getFullYear(), month + 1, 0, 23, 59, 59, 999);

      const monthAttendance = allAttendance.filter(a => {
        const clockIn = new Date(a.clock_in);
        return clockIn >= monthStart && clockIn <= monthEnd;
      });

      const presentCount = monthAttendance.filter(a => a.status === "present").length;
      const lateCount = monthAttendance.filter(a => a.status === "late").length;

      monthData.push({
        week: monthNames[month],
        hadir: presentCount + lateCount,
        terlambat: lateCount,
      });
    }

    setMonthlyData(monthData);
  };

  const fetchRecentAttendance = async (karyawanUserIds: Set<string>) => {
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
      const karyawanData = attendanceResult.data.filter(a => karyawanUserIds.has(a.user_id));

      const attendanceWithNames = karyawanData.slice(0, 5).map(record => ({
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
        return <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs font-medium">Hadir</Badge>;
      case "late":
        return <Badge className="bg-amber-100 text-amber-700 border-0 text-xs font-medium">Terlambat</Badge>;
      case "absent":
        return <Badge className="bg-red-100 text-red-700 border-0 text-xs font-medium">Tidak Hadir</Badge>;
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
      color: "bg-violet-100 text-violet-600",
    },
    {
      icon: Clock,
      title: "Rekap Absensi",
      description: "Lihat semua data kehadiran",
      href: "/admin/absensi",
      color: "bg-blue-100 text-blue-600",
    },
    {
      icon: BarChart3,
      title: "Laporan",
      description: "Laporan kehadiran karyawan",
      href: "/admin/laporan",
      color: "bg-emerald-100 text-emerald-600",
    },
    {
      icon: Building2,
      title: "Departemen",
      description: "Kelola struktur organisasi",
      href: "/admin/departemen",
      color: "bg-amber-100 text-amber-600",
    },
    {
      icon: Shield,
      title: "Kelola Role",
      description: "Atur hak akses user",
      href: "/admin/role",
      color: "bg-purple-100 text-purple-600",
    },
    {
      icon: Key,
      title: "Reset Password",
      description: "Reset password karyawan",
      href: "/admin/reset-password",
      color: "bg-rose-100 text-rose-600",
    },
    {
      icon: Settings,
      title: "Pengaturan",
      description: "Konfigurasi sistem",
      href: "/admin/pengaturan",
      color: "bg-slate-100 text-slate-600",
    },
  ];

  const currentMonth = new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3">
          <p className="font-semibold text-slate-900 mb-1">{label}</p>
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

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name.split(" ").map(n => n.charAt(0)).slice(0, 2).join("").toUpperCase();
  };

  // Heatmap data for attendance
  const getHeatmapData = () => {
    const hours = ["09:00", "08:30", "08:00", "07:30"];
    const months = ["Jan", "Feb", "Mar", "Apr", "Mei"];
    return { hours, months };
  };

  const heatmapData = getHeatmapData();

  return (
    <div className="min-h-screen bg-slate-50 pb-20 lg:pb-0">
      {/* ===== MOBILE BOTTOM NAVIGATION ===== */}
      <BottomNavigation />

      {/* ===== TABLET MINI SIDEBAR ===== */}
      <MiniSidebar
        userInitials={getInitials(user?.user_metadata?.full_name || "Admin")}
        onLogout={handleLogout}
      />

      {/* ===== DESKTOP SIDEBAR - Dark Navy Theme ===== */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-slate-900 z-50 hidden lg:flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#0066b3] to-[#00aaff] flex items-center justify-center shadow-lg shadow-blue-500/25">
              <img src={logoImage} alt="Logo" className="h-6 w-6 object-contain" />
            </div>
            <div>
              <h1 className="font-bold text-white">Talenta</h1>
              <p className="text-xs text-slate-400">Enterprise HRIS</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-3">Menu Utama</p>
          <div className="space-y-1">
            <Link
              to="/dashboard"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gradient-to-r from-[#0066b3]/20 to-[#7dc242]/10 text-white font-medium transition-all border border-[#0066b3]/30"
            >
              <BarChart3 className="h-5 w-5 text-[#00aaff]" />
              <span>Dashboard</span>
            </Link>
            {menuItems.slice(0, 3).map((item) => (
              <Link
                key={item.title}
                to={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
              >
                <item.icon className="h-5 w-5" />
                <span>{item.title}</span>
              </Link>
            ))}
          </div>

          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-3 px-3">Pengaturan</p>
          <div className="space-y-1">
            {menuItems.slice(3).map((item) => (
              <Link
                key={item.title}
                to={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
              >
                <item.icon className="h-5 w-5" />
                <span>{item.title}</span>
              </Link>
            ))}
          </div>
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#0066b3] to-[#7dc242] flex items-center justify-center shadow-md">
              <span className="text-sm font-semibold text-white">
                {getInitials(user?.user_metadata?.full_name || "Admin")}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {user?.user_metadata?.full_name || "Administrator"}
              </p>
              <p className="text-xs text-slate-400">Administrator</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <main className="md:ml-16 lg:ml-64 transition-all duration-300">
        {/* Header - Responsive */}
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
          <div className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              {/* Left side - Title (hidden on mobile, show simplified) */}
              <div className="flex-1 min-w-0">
                {/* Mobile: Show avatar with greeting */}
                <div className="flex items-center gap-3 sm:hidden">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#0066b3] to-[#7dc242] flex items-center justify-center shadow-md">
                    <span className="text-sm font-semibold text-white">
                      {getInitials(user?.user_metadata?.full_name || "Admin")}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Selamat datang,</p>
                    <p className="text-base font-semibold text-slate-900 truncate">
                      {user?.user_metadata?.full_name || "Administrator"}
                    </p>
                  </div>
                </div>

                {/* Tablet & Desktop: Show full title */}
                <div className="hidden sm:block">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Dashboard</h1>
                  <p className="text-slate-500 text-sm mt-0.5 hidden md:block">Ringkasan aktivitas & kinerja karyawan</p>
                </div>
              </div>

              {/* Right side - Actions */}
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Mobile: Notification Bell */}
                <Button variant="ghost" size="icon" className="h-10 w-10 sm:hidden text-slate-500">
                  <Bell className="h-5 w-5" />
                </Button>

                {/* Tablet+: Refresh indicator */}
                <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
                  <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
                  <span className="hidden md:inline">Refresh otomatis: {nextRefresh}d</span>
                  <span className="md:hidden">{nextRefresh}d</span>
                </div>

                {/* Export Button */}
                <Button
                  onClick={handleManualRefresh}
                  size="sm"
                  className="bg-gradient-to-r from-[#0066b3] to-[#00aaff] hover:from-[#0055a3] hover:to-[#0099ee] text-white gap-2 shadow-lg shadow-blue-500/25 hover:shadow-xl transition-all h-9 sm:h-10 px-3 sm:px-4"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Ekspor</span>
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Content - Responsive padding */}
        <div className="p-4 sm:p-6 lg:p-8">
          {/* KPI Summary Cards - Responsive Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5 mb-6 sm:mb-8">
            {isLoading ? (
              [...Array(4)].map((_, i) => (
                <Card key={i} className="border-slate-200 shadow-sm">
                  <CardContent className="p-6">
                    <Skeleton className="h-4 w-24 mb-3" />
                    <Skeleton className="h-8 w-20 mb-2" />
                    <Skeleton className="h-3 w-32" />
                  </CardContent>
                </Card>
              ))
            ) : (
              <>
                {/* Total Employees - Blue Top Border */}
                <Card className="border-0 shadow-md hover:shadow-lg transition-all bg-white md:bg-white/90 md:backdrop-blur-lg overflow-hidden relative md:border md:border-white/30 md:shadow-xl">
                  <div className="h-1 bg-gradient-to-r from-[#0066b3] to-[#00aaff]" />
                  {/* Faded Background Icon */}
                  <Users className="absolute right-4 top-8 h-20 w-20 sm:h-24 sm:w-24 text-[#0066b3]/10" />
                  <CardContent className="p-4 sm:p-6 relative z-10">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500">Total Karyawan</p>
                        <div className="mt-2 flex items-baseline gap-2">
                          <span className="text-3xl font-bold text-slate-900">{stats.totalEmployees.toLocaleString()}</span>
                          <span className="text-sm text-slate-500">Orang</span>
                        </div>
                        {/* Trend Label */}
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                            <TrendingUp className="h-3 w-3" />
                            +{stats.newEmployeesThisMonth} bulan ini
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">Dari {stats.departments} departemen</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Lihat Detail</DropdownMenuItem>
                          <DropdownMenuItem>Ekspor Data</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>

                {/* Attendance Today - Green Top Border */}
                <Card className="border-0 shadow-md hover:shadow-lg transition-all bg-white md:bg-white/90 md:backdrop-blur-lg overflow-hidden relative md:border md:border-white/30 md:shadow-xl">
                  <div className="h-1 bg-gradient-to-r from-[#7dc242] to-[#5aa530]" />
                  {/* Faded Background Icon */}
                  <UserCheck className="absolute right-4 top-8 h-20 w-20 sm:h-24 sm:w-24 text-[#7dc242]/10" />
                  <CardContent className="p-4 sm:p-6 relative z-10">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500">Kehadiran Hari Ini</p>
                        <div className="mt-2 flex items-baseline gap-2">
                          <span className="text-3xl font-bold text-emerald-600">
                            {stats.totalEmployees > 0 ? Math.round((stats.presentToday / stats.totalEmployees) * 100) : 0}%
                          </span>
                          <span className="text-sm text-slate-500">Hadir</span>
                        </div>
                        {/* Trend Label */}
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                            <TrendingUp className="h-3 w-3" />
                            +5% dari kemarin
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{stats.presentToday} dari {stats.totalEmployees} karyawan</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Lihat Detail</DropdownMenuItem>
                          <DropdownMenuItem>Ekspor Data</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>

                {/* Pending Leave Requests - Amber Top Border */}
                <Card className="border-0 shadow-md hover:shadow-lg transition-all bg-white md:bg-white/90 md:backdrop-blur-lg overflow-hidden relative md:border md:border-white/30 md:shadow-xl">
                  <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
                  {/* Faded Background Icon */}
                  <Calendar className="absolute right-4 top-8 h-20 w-20 sm:h-24 sm:w-24 text-amber-500/10" />
                  <CardContent className="p-4 sm:p-6 relative z-10">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500">Pengajuan Cuti Tertunda</p>
                        <div className="mt-2 flex items-baseline gap-2">
                          <span className="text-3xl font-bold text-amber-600">{stats.pendingLeave}</span>
                          <span className="text-sm text-slate-500">Orang</span>
                        </div>
                        {/* Trend Label */}
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">
                            <AlertCircle className="h-3 w-3" />
                            Perlu tindakan segera
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{stats.approvedLeaveThisMonth} disetujui bulan ini</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Lihat Semua</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>

                {/* Work Journal - Purple Top Border */}
                <Card className="border-0 shadow-md hover:shadow-lg transition-all bg-white md:bg-white/90 md:backdrop-blur-lg overflow-hidden relative md:border md:border-white/30 md:shadow-xl">
                  <div className="h-1 bg-gradient-to-r from-purple-500 to-indigo-500" />
                  {/* Faded Background Icon */}
                  <Briefcase className="absolute right-4 top-8 h-20 w-20 sm:h-24 sm:w-24 text-purple-500/10" />
                  <CardContent className="p-4 sm:p-6 relative z-10">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500">Jurnal Kerja</p>
                        <div className="mt-2 flex items-baseline gap-2">
                          <span className="text-3xl font-bold text-purple-600">85%</span>
                          <span className="text-sm text-slate-500">Terkirim</span>
                        </div>
                        {/* Trend Label */}
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-xs font-medium">
                            <CheckCircle2 className="h-3 w-3" />
                            On-target hari ini
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">10 jurnal perlu review</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Lihat Jurnal</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Attendance Chart - Takes 2/3 width */}
            <Card className="lg:col-span-2 border-slate-200 shadow-md bg-white">
              <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <CardTitle className="text-lg font-bold text-slate-900">Statistik Kehadiran</CardTitle>
                  <CardDescription>Tren kehadiran karyawan dalam 12 bulan terakhir</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline" className="gap-1.5 font-normal">
                    <div className="h-2 w-2 rounded-full bg-[#10B981]" />
                    Hadir
                  </Badge>
                  <Badge variant="outline" className="gap-1.5 font-normal">
                    <div className="h-2 w-2 rounded-full bg-[#F59E0B]" />
                    Terlambat
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="h-[300px] w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={weeklyData}
                      margin={{
                        top: 10,
                        right: 10,
                        left: 0,
                        bottom: 0,
                      }}
                    >
                      <defs>
                        <linearGradient id="colorHadir" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.1} />
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis
                        dataKey="day"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#64748B' }}
                        dy={10}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#64748B' }}
                        tickFormatter={(value) => `${value}%`}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="hadir"
                        stroke="#10B981"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorHadir)"
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity / Department Stats - Takes 1/3 width */}
            <Card className="border-slate-200 shadow-md bg-white flex flex-col">
              <CardHeader className="pb-2 border-b border-slate-100">
                <CardTitle className="text-lg font-bold text-slate-900">Distribusi Departemen</CardTitle>
                <CardDescription>Komposisi tim berdasarkan divisi</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 p-6 flex items-center justify-center">
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={departmentData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {departmentData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="circle"
                        formatter={(value, entry: any) => (
                          <span className="text-xs text-slate-600 font-medium ml-1">{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Attendance Cards */}
            <Card className="border-slate-200 shadow-md bg-white">
              <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <CardTitle className="text-lg font-bold text-slate-900">Aktivitas Absensi Terbaru</CardTitle>
                  <CardDescription>5 karyawan terakhir yang melakukan clock-in</CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => navigate('/admin/absensi')}>
                  Lihat Semua <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-6 space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                        <Skeleton className="h-8 w-16 rounded-full" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {recentAttendance.length > 0 ? (
                      recentAttendance.map((record) => (
                        <div key={record.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-medium border border-slate-200">
                              {getInitials(record.full_name)}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{record.full_name}</p>
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Clock className="h-3 w-3" />
                                {formatTime(record.clock_in)}
                              </div>
                            </div>
                          </div>
                          {getStatusBadge(record.status)}
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-slate-500">
                        <UserX className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                        <p>Belum ada data absensi hari ini</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Announcements / Upcoming Events */}
            <Card className="border-slate-200 shadow-md bg-white">
              <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <CardTitle className="text-lg font-bold text-slate-900">Pengumuman & Acara</CardTitle>
                  <CardDescription>Agenda penting perusahaan</CardDescription>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {announcements.map((item) => (
                    <div key={item.id} className="p-4 flex gap-4 hover:bg-slate-50 transition-colors group cursor-pointer">
                      <div className={`
                        flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center border
                        ${item.type === 'event' ? 'bg-blue-50 border-blue-100 text-blue-600' :
                          item.type === 'deadline' ? 'bg-red-50 border-red-100 text-red-600' :
                            item.type === 'training' ? 'bg-purple-50 border-purple-100 text-purple-600' :
                              'bg-emerald-50 border-emerald-100 text-emerald-600'}
                      `}>
                        <span className="text-xs font-bold uppercase">{item.date.split(" ")[1]}</span>
                        <span className="text-lg font-bold leading-none">{item.date.split(" ")[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 group-hover:text-[#0066b3] transition-colors">{item.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{item.date}</p>
                        <div className="mt-1.5 flex gap-2">
                          <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal bg-white">
                            {item.type === 'event' ? 'Acara' :
                              item.type === 'deadline' ? 'Tenggat' :
                                item.type === 'training' ? 'Training' : 'Kebijakan'}
                          </Badge>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-slate-500 self-center" />
                    </div>
                  ))}
                </div>
              </CardContent>
              <div className="p-3 border-t border-slate-100 bg-slate-50/50">
                <Button variant="ghost" size="sm" className="w-full text-slate-500 hover:text-[#0066b3] text-xs">
                  Lihat Semua Pengumuman
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
