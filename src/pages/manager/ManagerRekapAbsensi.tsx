import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Clock, Search, Calendar, Users, CheckCircle2,
  XCircle, AlertCircle, Download, RefreshCw, FileSpreadsheet, FileText, Info,
  LayoutDashboard, BarChart3, FileCheck, Timer, CalendarClock, ChevronLeft,
  ChevronRight, Activity, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { exportToCSV, exportToPDF, exportToExcel } from "@/lib/exportUtils";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import EnterpriseLayout from "@/components/layout/EnterpriseLayout";
import { ABSENSI_WAJIB_ROLE } from "@/lib/constants";
import { cn } from "@/lib/utils";

// Talenta Brand Colors
const BRAND_COLORS = {
  blue: "#1A5BA8",
  lightBlue: "#00A0E3",
  green: "#7DC242",
};

interface AttendanceRecord {
  id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  status: string;
  profile?: {
    full_name: string | null;
    department: string | null;
  };
}

// Helper to get yesterday's date
const getYesterdayDate = () => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().split("T")[0];
};

// Helper to find the most recent date with data
const findMostRecentDataDate = async (karyawanUserIds: Set<string>, maxDaysBack: number = 30): Promise<string | null> => {
  // Start from i=0 to include today in the search
  for (let i = 0; i <= maxDaysBack; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    // Use local YYYY-MM-DD to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const startOfDay = new Date(dateStr);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateStr);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch ALL attendance records for this day (no limit) to properly check for karyawan
    const { data, error } = await supabase
      .from("attendance")
      .select("id, user_id")
      .gte("clock_in", startOfDay.toISOString())
      .lte("clock_in", endOfDay.toISOString());

    if (!error && data && data.length > 0) {
      // Check if ANY of this data belongs to karyawan
      const hasKaryawanData = data.some(record => karyawanUserIds.has(record.user_id));
      if (hasKaryawanData) {
        return dateStr;
      }
    }
  }
  return null;
};

const ManagerRekapAbsensi = () => {
  const navigate = useNavigate();
  const { settings, isLoading: settingsLoading } = useSystemSettings();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDate, setFilterDate] = useState(getYesterdayDate());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [dayLeavesCount, setDayLeavesCount] = useState(0);
  const [isSearchingData, setIsSearchingData] = useState(false);

  // Menu sections for sidebar
  const menuSections = [
    {
      title: "Menu Utama",
      items: [
        { icon: LayoutDashboard, title: "Dashboard", href: "/manager" },
        { icon: Clock, title: "Rekap Absensi", href: "/manager/absensi" },
        { icon: BarChart3, title: "Laporan", href: "/manager/laporan" },
        { icon: FileCheck, title: "Kelola Cuti", href: "/manager/cuti" },
      ],
    },
  ];

  // Fetch attendance data
  const fetchAttendance = useCallback(async () => {
    setIsLoading(true);

    // Get karyawan user IDs
    const { data: karyawanRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ABSENSI_WAJIB_ROLE);

    const karyawanUserIds = new Set(karyawanRoles?.map(r => r.user_id) || []);

    // Get total employees count
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("user_id");

    const karyawanProfiles = profilesData?.filter(p => karyawanUserIds.has(p.user_id)) || [];
    setTotalEmployees(karyawanProfiles.length);

    // Check if filter date is before attendance start date
    const filterDateObj = new Date(filterDate);

    // Safe null check for settings.attendanceStartDate
    if (settings?.attendanceStartDate) {
      const startDateObj = new Date(settings.attendanceStartDate);
      startDateObj.setHours(0, 0, 0, 0);

      if (filterDateObj < startDateObj) {
        setAttendance([]);
        setIsLoading(false);
        return;
      }
    }

    const startOfDay = new Date(filterDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(filterDate);
    endOfDay.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .gte("clock_in", startOfDay.toISOString())
      .lte("clock_in", endOfDay.toISOString())
      .order("clock_in", { ascending: false });

    if (!error && data) {
      const karyawanData = data.filter(record => karyawanUserIds.has(record.user_id));

      const attendanceWithProfiles = await Promise.all(
        karyawanData.map(async (record) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, department")
            .eq("user_id", record.user_id)
            .maybeSingle();
          return { ...record, profile };
        })
      );
      setAttendance(attendanceWithProfiles);
    }

    // Fetch approved leaves for filterDate
    const { data: leaveData } = await supabase
      .from("leave_requests")
      .select("user_id")
      .eq("status", "approved")
      .lte("start_date", filterDate)
      .gte("end_date", filterDate);

    const leavesCount = leaveData?.filter(l => karyawanUserIds.has(l.user_id)).length || 0;

    setTotalEmployees(prev => {
      // HACK: Store leaves count in a temp state or just calculate stats here?
      // Better to use a state for stats or derived it.
      // Since stats is derived from `attendance` state in render, I need `leavesCount` in state.
      return prev;
    });
    setDayLeavesCount(leavesCount);

    setLastUpdated(new Date());
    setIsLoading(false);
  }, [filterDate, settings?.attendanceStartDate]);

  // Auto-find data on mount
  useEffect(() => {
    const initializeData = async () => {
      if (settingsLoading) return;

      setIsSearchingData(true);

      const { data: karyawanRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ABSENSI_WAJIB_ROLE);
      const karyawanUserIds = new Set(karyawanRoles?.map(r => r.user_id) || []);

      const recentDate = await findMostRecentDataDate(karyawanUserIds);

      if (recentDate) {
        setFilterDate(recentDate);
      } else {
        setFilterDate(getYesterdayDate());
      }

      setIsSearchingData(false);
    };

    initializeData();
  }, [settingsLoading]);

  useEffect(() => {
    if (!settingsLoading && !isSearchingData) {
      fetchAttendance();
    }

    const channel = supabase
      .channel("manager-attendance-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, () => fetchAttendance())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filterDate, settingsLoading, isSearchingData, fetchAttendance]);

  // Navigation helpers
  const goToPreviousDay = () => {
    const date = new Date(filterDate);
    date.setDate(date.getDate() - 1);
    setFilterDate(date.toISOString().split("T")[0]);
  };

  const goToNextDay = () => {
    const date = new Date(filterDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    date.setDate(date.getDate() + 1);
    if (date <= today) {
      setFilterDate(date.toISOString().split("T")[0]);
    }
  };

  const goToToday = () => {
    setFilterDate(new Date().toISOString().split("T")[0]);
  };

  const isBeforeStartDate = new Date(filterDate) < new Date(settings.attendanceStartDate);
  const isToday = filterDate === new Date().toISOString().split("T")[0];
  const isYesterday = filterDate === getYesterdayDate();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return (
          <Badge
            className="border-0 text-xs font-medium gap-1"
            style={{ backgroundColor: `${BRAND_COLORS.green}15`, color: BRAND_COLORS.green }}
          >
            <CheckCircle2 className="h-3 w-3" />
            Hadir
          </Badge>
        );
      case "late":
        return (
          <Badge className="bg-amber-50 text-amber-600 border-0 text-xs font-medium gap-1">
            <AlertCircle className="h-3 w-3" />
            Terlambat
          </Badge>
        );
      case "early_leave":
        return (
          <Badge
            className="border-0 text-xs font-medium gap-1"
            style={{ backgroundColor: `${BRAND_COLORS.lightBlue}15`, color: BRAND_COLORS.lightBlue }}
          >
            <Clock className="h-3 w-3" />
            Pulang Awal
          </Badge>
        );
      default:
        return <Badge variant="secondary" className="text-xs">{status}</Badge>;
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  const formatShortDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  };

  const calculateDuration = (clockIn: string, clockOut: string | null) => {
    if (!clockOut) return "-";
    const diffMs = new Date(clockOut).getTime() - new Date(clockIn).getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}j ${minutes}m`;
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "present": return "Hadir";
      case "late": return "Terlambat";
      case "early_leave": return "Pulang Awal";
      default: return status;
    }
  };

  const exportColumns = [
    { header: "Nama", key: "nama", width: 100 },
    { header: "Departemen", key: "departemen", width: 80 },
    { header: "Clock In", key: "clock_in", width: 50 },
    { header: "Clock Out", key: "clock_out", width: 50 },
    { header: "Durasi", key: "durasi", width: 40 },
    { header: "Status", key: "status", width: 50 },
  ];

  const getExportData = () => {
    return filteredAttendance.map(record => ({
      nama: record.profile?.full_name || "-",
      departemen: record.profile?.department || "-",
      clock_in: formatTime(record.clock_in),
      clock_out: record.clock_out ? formatTime(record.clock_out) : "-",
      durasi: calculateDuration(record.clock_in, record.clock_out),
      status: getStatusLabel(record.status),
    }));
  };

  const handleExportExcel = () => {
    exportToExcel({
      title: "Rekap Absensi",
      subtitle: formatDate(filterDate),
      filename: `rekap-absensi-${filterDate}`,
      columns: exportColumns,
      data: getExportData(),
    });
    toast({ title: "Berhasil", description: "File Excel berhasil didownload" });
  };

  const handleExportPDF = () => {
    exportToPDF({
      title: "Rekap Absensi",
      subtitle: formatDate(filterDate),
      filename: `rekap-absensi-${filterDate}`,
      columns: exportColumns,
      data: getExportData(),
      orientation: "landscape",
    });
    toast({ title: "Berhasil", description: "File PDF berhasil didownload" });
  };

  const filteredAttendance = attendance.filter((record) => {
    const matchesSearch = record.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.profile?.department?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "all" || record.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: attendance.length,
    present: attendance.filter(a => ["present", "late", "early_leave"].includes(a.status)).length,
    late: attendance.filter(a => a.status === "late").length,
    earlyLeave: attendance.filter(a => a.status === "early_leave").length,
    // Fix: Absent = Total - Present - Leaves
    absent: Math.max(0, totalEmployees - attendance.length - dayLeavesCount),
    leaves: dayLeavesCount
  };

  const attendanceRate = totalEmployees > 0 ? Math.round((stats.total / totalEmployees) * 100) : 0;

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n.charAt(0)).slice(0, 2).join("").toUpperCase();
  };

  return (
    <EnterpriseLayout
      title="Rekap Absensi"
      subtitle={formatDate(filterDate)}
      menuSections={menuSections}
      roleLabel="Manager"
      showRefresh={true}
      onRefresh={fetchAttendance}
      refreshInterval={60}
    >
      {/* Read-Only Notice */}
      <div
        className="mb-6 p-4 rounded-2xl border flex items-center gap-4"
        style={{
          backgroundColor: `${BRAND_COLORS.lightBlue}08`,
          borderColor: `${BRAND_COLORS.lightBlue}30`
        }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
          style={{
            background: `linear-gradient(135deg, ${BRAND_COLORS.lightBlue} 0%, ${BRAND_COLORS.blue} 100%)`
          }}
        >
          <Eye className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-slate-800">Mode Read-Only</p>
          <p className="text-sm text-slate-600">
            Sebagai Manager, Anda dapat melihat dan mengexport data kehadiran.
          </p>
        </div>
      </div>

      {/* Date Navigation Bar */}
      <div className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Date Selector */}
        <div
          className="p-4 rounded-2xl border flex items-center gap-4"
          style={{
            backgroundColor: `${BRAND_COLORS.blue}08`,
            borderColor: `${BRAND_COLORS.blue}25`
          }}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm"
            style={{
              background: `linear-gradient(135deg, ${BRAND_COLORS.blue} 0%, ${BRAND_COLORS.lightBlue} 100%)`
            }}
          >
            <CalendarClock className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm text-slate-600 whitespace-nowrap">Tanggal Rekap</p>
              {isToday && (
                <Badge variant="secondary" className="text-xs px-2 py-0 h-5 bg-slate-100 text-slate-600 font-normal shrink-0">
                  Hari Ini
                </Badge>
              )}
              {isYesterday && !isToday && (
                <Badge variant="secondary" className="text-xs px-2 py-0 h-5 bg-slate-100 text-slate-600 font-normal shrink-0">
                  Kemarin
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={goToPreviousDay}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-[130px] h-8 text-sm font-medium shrink-0"
                max={new Date().toISOString().split("T")[0]}
              />
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={goToNextDay} disabled={isToday}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              {!isToday && (
                <Button variant="outline" size="sm" onClick={goToToday} className="text-xs shrink-0 whitespace-nowrap px-2 ml-1 h-8">
                  Hari Ini
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Attendance Rate */}
        <div
          className="p-4 rounded-2xl border flex items-center gap-4"
          style={{
            backgroundColor: `${BRAND_COLORS.green}08`,
            borderColor: `${BRAND_COLORS.green}25`
          }}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm"
            style={{
              background: `linear-gradient(135deg, ${BRAND_COLORS.green} 0%, #8BC34A 100%)`
            }}
          >
            <Activity className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-slate-600">Tingkat Kehadiran</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold" style={{ color: BRAND_COLORS.green }}>
                {attendanceRate}%
              </span>
              <span className="text-sm text-slate-500">
                ({stats.total}/{totalEmployees})
              </span>
            </div>
          </div>
        </div>

        {/* Last Updated */}
        <div
          className="p-4 rounded-2xl border flex items-center gap-4"
          style={{
            backgroundColor: `${BRAND_COLORS.lightBlue}08`,
            borderColor: `${BRAND_COLORS.lightBlue}25`
          }}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm"
            style={{
              background: `linear-gradient(135deg, ${BRAND_COLORS.lightBlue} 0%, ${BRAND_COLORS.blue} 100%)`
            }}
          >
            <Timer className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-slate-600">Data Real-time</p>
            <p className="text-base font-semibold text-slate-800">
              {lastUpdated?.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) || "-"}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAttendance}
            className="gap-1"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Warning if date is before start date */}
      {isBeforeStartDate && (
        <div
          className="mb-6 p-4 rounded-2xl border flex items-center gap-4"
          style={{ backgroundColor: "#FEF3C7", borderColor: "#FCD34D" }}
        >
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <Info className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="font-semibold text-amber-800">Periode Belum Aktif</p>
            <p className="text-sm text-amber-700">
              Tanggal yang dipilih sebelum periode absensi aktif ({new Date(settings.attendanceStartDate).toLocaleDateString("id-ID")}).
            </p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${BRAND_COLORS.blue}15` }}
              >
                <Users className="h-5 w-5" style={{ color: BRAND_COLORS.blue }} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
                <p className="text-xs text-slate-500">Total Hadir</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${BRAND_COLORS.green}15` }}
              >
                <CheckCircle2 className="h-5 w-5" style={{ color: BRAND_COLORS.green }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: BRAND_COLORS.green }}>{stats.present}</p>
                <p className="text-xs text-slate-500">Tepat Waktu</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-500">{stats.late}</p>
                <p className="text-xs text-slate-500">Terlambat</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${BRAND_COLORS.lightBlue}15` }}
              >
                <Clock className="h-5 w-5" style={{ color: BRAND_COLORS.lightBlue }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: BRAND_COLORS.lightBlue }}>{stats.earlyLeave}</p>
                <p className="text-xs text-slate-500">Pulang Awal</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center">
                <FileCheck className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-500">{stats.leaves}</p>
                <p className="text-xs text-slate-500">Cuti/Izin</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-500">{stats.absent}</p>
                <p className="text-xs text-slate-500">Alpha</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Export */}
      <Card className="border-slate-200 shadow-sm bg-white mb-6">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Cari nama atau departemen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 border-slate-200"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-[150px] border-slate-200">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="present">Hadir</SelectItem>
                  <SelectItem value="late">Terlambat</SelectItem>
                  <SelectItem value="early_leave">Pulang Awal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="gap-2 text-white"
                  style={{ backgroundColor: BRAND_COLORS.blue }}
                >
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportExcel} className="gap-2">
                  <FileSpreadsheet className="h-4 w-4" style={{ color: BRAND_COLORS.green }} />
                  Export Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF} className="gap-2">
                  <FileText className="h-4 w-4" style={{ color: "#EF4444" }} />
                  Export PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Link to="/manager/laporan">
              <Button
                variant="outline"
                className="gap-2 border-slate-200"
              >
                <BarChart3 className="h-4 w-4" style={{ color: BRAND_COLORS.blue }} />
                Laporan Bulanan
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-slate-800">
                Daftar Kehadiran
              </CardTitle>
              <CardDescription className="text-sm">
                {filteredAttendance.length} karyawan ditemukan
              </CardDescription>
            </div>
            {isYesterday && (
              <Badge
                className="text-white border-0"
                style={{ backgroundColor: BRAND_COLORS.green }}
              >
                Data Kemarin
              </Badge>
            )}
            {isToday && (
              <Badge
                className="text-white border-0"
                style={{ backgroundColor: BRAND_COLORS.lightBlue }}
              >
                Data Hari Ini
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading || isSearchingData ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredAttendance.length === 0 ? (
            <div className="py-16 text-center">
              <div
                className="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: `${BRAND_COLORS.blue}10` }}
              >
                <Clock className="h-10 w-10" style={{ color: `${BRAND_COLORS.blue}50` }} />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-1">Tidak Ada Data</h3>
              <p className="text-slate-500 text-sm max-w-md mx-auto">
                Belum ada absensi untuk tanggal {formatShortDate(filterDate)}.
                {!isToday && " Coba pilih tanggal lain atau gunakan tombol navigasi."}
              </p>
              {!isToday && (
                <div className="flex justify-center gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={goToPreviousDay}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Hari Sebelumnya
                  </Button>
                  <Button
                    size="sm"
                    onClick={goToToday}
                    style={{ backgroundColor: BRAND_COLORS.blue }}
                    className="text-white"
                  >
                    Hari Ini
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="font-semibold text-slate-700">Karyawan</TableHead>
                  <TableHead className="font-semibold text-slate-700 hidden sm:table-cell">Departemen</TableHead>
                  <TableHead className="font-semibold text-slate-700">Clock In</TableHead>
                  <TableHead className="font-semibold text-slate-700">Clock Out</TableHead>
                  <TableHead className="font-semibold text-slate-700 hidden md:table-cell">Durasi</TableHead>
                  <TableHead className="font-semibold text-slate-700">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAttendance.map((record, index) => (
                  <TableRow
                    key={record.id}
                    className={cn(
                      "hover:bg-slate-50 transition-colors",
                      index === 0 && "bg-gradient-to-r from-green-50/30 to-transparent"
                    )}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div
                          className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold text-white shadow-sm"
                          style={{
                            background: `linear-gradient(135deg, ${BRAND_COLORS.blue} 0%, ${BRAND_COLORS.green} 100%)`
                          }}
                        >
                          {getInitials(record.profile?.full_name || "?")}
                        </div>
                        <span className="font-medium text-slate-800">
                          {record.profile?.full_name || "-"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-slate-500">
                      {record.profile?.department || "-"}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium" style={{ color: BRAND_COLORS.green }}>
                        {formatTime(record.clock_in)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={record.clock_out ? "font-medium" : "text-slate-400"} style={record.clock_out ? { color: BRAND_COLORS.lightBlue } : {}}>
                        {record.clock_out ? formatTime(record.clock_out) : "-"}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-slate-500">
                      {calculateDuration(record.clock_in, record.clock_out)}
                    </TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </EnterpriseLayout>
  );
};

export default ManagerRekapAbsensi;
