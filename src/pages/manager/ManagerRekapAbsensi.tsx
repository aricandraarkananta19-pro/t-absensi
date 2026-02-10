import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Clock, Search, Calendar, Users, CheckCircle2,
  XCircle, AlertCircle, Download, RefreshCw, FileSpreadsheet, FileText, Info,
  LayoutDashboard, BarChart3, FileCheck, Timer, CalendarClock, ChevronLeft,
  ChevronRight, Activity, Eye, Filter
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
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import EnterpriseLayout from "@/components/layout/EnterpriseLayout";
import { MANAGER_MENU_SECTIONS } from "@/config/menu";
import { ABSENSI_WAJIB_ROLE, EXCLUDED_USER_NAMES } from "@/lib/constants";
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
  clock_in: string | null;
  clock_out: string | null;
  status: string;
  profile: {
    full_name: string | null;
    department: string | null;
  };
  notes?: string;
}

// Helper to get yesterday's date
const getYesterdayDate = () => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().split("T")[0];
};

const ManagerRekapAbsensi = () => {
  const navigate = useNavigate();
  const { settings, isLoading: settingsLoading } = useSystemSettings();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split("T")[0]); // Default Today

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    present: 0,
    late: 0,
    earlyLeave: 0,
    absent: 0,
    leaves: 0
  });

  // Menu sections for sidebar
  const menuSections = MANAGER_MENU_SECTIONS;

  // New Fetch Logic
  const fetchAttendance = useCallback(async () => {
    setIsLoading(true);

    try {
      // 1. Fetch Target Employees (Karyawan)
      const { data: roles } = await supabase.from("user_roles").select("user_id").in("role", ABSENSI_WAJIB_ROLE);
      const { data: allProfiles } = await supabase.from("profiles").select("user_id, full_name, department, join_date").order("full_name");

      let candidates = allProfiles || [];
      if (roles && roles.length > 0) {
        const roleIds = new Set(roles.map(r => r.user_id));
        candidates = candidates.filter(p => roleIds.has(p.user_id));
      }

      // Filter Excluded Users
      candidates = candidates.filter(p => {
        if (!p.full_name) return true;
        const nameLower = p.full_name.toLowerCase();
        return !EXCLUDED_USER_NAMES.some(excluded => nameLower.includes(excluded.toLowerCase()));
      });

      setTotalEmployees(candidates.length);

      // 2. Fetch Attendance for Date
      // Use full day range in UTC covering Jakarta Day (UTC+7)
      // filterDate is "YYYY-MM-DD"
      // Start: YYYY-MM-DDT00:00:00+07:00
      // End: YYYY-MM-DDT23:59:59.999+07:00
      const startIso = `${filterDate}T00:00:00+07:00`;
      const endIso = `${filterDate}T23:59:59.999+07:00`;

      // Convert to Date objects to get UTC equivalent for query
      const startUtc = new Date(startIso).toISOString();
      const endUtc = new Date(endIso).toISOString();

      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("*")
        .is("deleted_at", null)
        .gte("clock_in", startUtc)
        .lte("clock_in", endUtc);

      // 3. Fetch Leaves
      const { data: leaveData } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("status", "approved")
        .lte("start_date", filterDate)
        .gte("end_date", filterDate);

      // 4. Merge
      const merged: AttendanceRecord[] = candidates.map(emp => {
        // Check Attendance
        const att = attendanceData?.find(a => a.user_id === emp.user_id);
        // Check Leave
        const leave = leaveData?.find(l => l.user_id === emp.user_id);

        let status = 'absent';
        let clock_in = null;
        let clock_out = null;
        let notes = '';
        let id = `virt-${emp.user_id}`;

        if (att) {
          status = att.status;
          clock_in = att.clock_in;
          clock_out = att.clock_out;
          notes = att.notes;
          id = att.id;

          // Fix: if status is present but no clock out and it's today -> not_clocked_out logic handled by status badge usually
        } else if (leave) {
          status = leave.leave_type === 'sick' ? 'sick' : 'leave';
          // Map permission if needed
        } else {
          // Logic for absent vs future vs weekend
          // Simplification: default absent.
          // Ideally check if weekend.
          const d = new Date(filterDate);
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          if (isWeekend) status = 'weekend';

          // If joining in future
          if (emp.join_date && emp.join_date > filterDate) status = 'future';
        }

        return {
          id,
          user_id: emp.user_id,
          clock_in,
          clock_out,
          status,
          profile: { full_name: emp.full_name, department: emp.department },
          notes
        };
      });

      // Calculate Stats
      const newStats = {
        total: merged.length,
        present: merged.filter(m => ['present', 'late', 'early_leave'].includes(m.status)).length,
        late: merged.filter(m => m.status === 'late').length,
        earlyLeave: merged.filter(m => m.status === 'early_leave').length,
        absent: merged.filter(m => ['absent', 'alpha'].includes(m.status)).length,
        leaves: merged.filter(m => ['leave', 'sick', 'permission'].includes(m.status)).length
      };

      setStats(newStats);
      setAttendance(merged);
      setLastUpdated(new Date());

    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Gagal memuat data" });
    } finally {
      setIsLoading(false);
    }
  }, [filterDate]);


  // Auto-fetch on mount and date change
  useEffect(() => {
    if (!settingsLoading) fetchAttendance();
  }, [settingsLoading, fetchAttendance]);


  // Navigation helpers
  const goToPreviousDay = () => {
    const date = new Date(filterDate);
    date.setDate(date.getDate() - 1);
    setFilterDate(date.toISOString().split("T")[0]);
  };

  const goToNextDay = () => {
    const date = new Date(filterDate);
    date.setDate(date.getDate() + 1);
    setFilterDate(date.toISOString().split("T")[0]);
  };

  const goToToday = () => {
    setFilterDate(new Date().toISOString().split("T")[0]);
  };

  const isBeforeStartDate = settings?.attendanceStartDate && new Date(filterDate) < new Date(settings.attendanceStartDate);
  const isToday = filterDate === new Date().toISOString().split("T")[0];
  const isYesterday = filterDate === getYesterdayDate();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present": return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-0"><CheckCircle2 className="w-3 h-3 mr-1" />Hadir</Badge>;
      case "late": return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-0"><AlertCircle className="w-3 h-3 mr-1" />Terlambat</Badge>;
      case "early_leave": return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200 border-0"><Clock className="w-3 h-3 mr-1" />Pulang Cepat</Badge>;
      case "absent":
      case "alpha": return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-0"><XCircle className="w-3 h-3 mr-1" />Alpha</Badge>;
      case "leave": return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200 border-0"><FileText className="w-3 h-3 mr-1" />Cuti</Badge>;
      case "sick": return <Badge className="bg-pink-100 text-pink-700 hover:bg-pink-200 border-0"><FileText className="w-3 h-3 mr-1" />Sakit</Badge>;
      case "weekend": return <Badge variant="outline" className="text-slate-400">Libur</Badge>;
      case "future": return <Badge variant="outline" className="text-slate-300">-</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return "-";
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

  const calculateDuration = (clockIn: string | null, clockOut: string | null) => {
    if (!clockIn || !clockOut) return "-";
    const diffMs = new Date(clockOut).getTime() - new Date(clockIn).getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}j ${minutes}m`;
  };

  const filteredAttendance = attendance.filter((record) => {
    const matchesSearch = record.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.profile?.department?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "all" || record.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const attendanceRate = totalEmployees > 0 ? Math.round((stats.present / totalEmployees) * 100) : 0;

  // Export functions reusing logic
  const exportColumns = [
    { header: "Nama", key: "nama", width: 100 },
    { header: "Departemen", key: "departemen", width: 80 },
    { header: "Clock In", key: "clock_in", width: 50 },
    { header: "Clock Out", key: "clock_out", width: 50 },
    { header: "Status", key: "status", width: 50 },
  ];

  const getExportData = () => {
    return filteredAttendance.map(record => ({
      nama: record.profile?.full_name || "-",
      departemen: record.profile?.department || "-",
      clock_in: formatTime(record.clock_in),
      clock_out: formatTime(record.clock_out),
      status: record.status,
    }));
  };

  return (
    <EnterpriseLayout
      title="Rekap Absensi"
      subtitle={formatDate(filterDate)}
      menuSections={menuSections}
      roleLabel="Manager"
      showRefresh={true}
      onRefresh={fetchAttendance}
      refreshInterval={0}
    >
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
              {isToday && <Badge variant="secondary" className="text-xs px-2 py-0 h-5">Hari Ini</Badge>}
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
                ({stats.present}/{totalEmployees})
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
          <Button variant="outline" size="sm" onClick={fetchAttendance} className="gap-1">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard icon={Users} label="Total Karyawan" value={totalEmployees} colorClass="text-blue-600" bgClass="bg-blue-50" />
        <StatCard icon={CheckCircle2} label="Hadir" value={stats.present} colorClass="text-emerald-600" bgClass="bg-emerald-50" />
        <StatCard icon={AlertCircle} label="Terlambat" value={stats.late} colorClass="text-amber-600" bgClass="bg-amber-50" />
        <StatCard icon={Clock} label="Pulang Awal" value={stats.earlyLeave} colorClass="text-orange-600" bgClass="bg-orange-50" />
        <StatCard icon={FileCheck} label="Cuti/Izin" value={stats.leaves} colorClass="text-purple-600" bgClass="bg-purple-50" />
        <StatCard icon={XCircle} label="Alpha" value={stats.absent} colorClass="text-red-600" bgClass="bg-red-50" />
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
                  <SelectItem value="absent">Alpha</SelectItem>
                  <SelectItem value="leave">Cuti/Izin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="gap-2 text-white" style={{ backgroundColor: BRAND_COLORS.blue }}>
                    <Download className="h-4 w-4" /> Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => exportToExcel({ title: "Rekap", filename: "rekap", columns: exportColumns, data: getExportData() })}>Excel</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead className="font-semibold text-slate-700">Karyawan</TableHead>
                <TableHead className="font-semibold text-slate-700 hidden sm:table-cell">Departemen</TableHead>
                <TableHead className="font-semibold text-slate-700 text-center">Clock In</TableHead>
                <TableHead className="font-semibold text-slate-700 text-center">Clock Out</TableHead>
                <TableHead className="font-semibold text-slate-700 text-center hidden md:table-cell">Durasi</TableHead>
                <TableHead className="font-semibold text-slate-700 text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-12 w-full" /></TableCell></TableRow>)
              ) : filteredAttendance.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-slate-500">Tidak ada data.</TableCell>
                </TableRow>
              ) : (
                filteredAttendance.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">{row.profile.full_name}</div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-slate-500">{row.profile.department}</TableCell>
                    <TableCell className="text-center text-sm font-mono">{formatTime(row.clock_in)}</TableCell>
                    <TableCell className="text-center text-sm font-mono">{formatTime(row.clock_out)}</TableCell>
                    <TableCell className="text-center hidden md:table-cell text-sm">{calculateDuration(row.clock_in, row.clock_out)}</TableCell>
                    <TableCell className="text-center">{getStatusBadge(row.status)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </EnterpriseLayout>
  );
};

// Simple Stat Card Component inline
function StatCard({ icon: Icon, label, value, colorClass, bgClass }: any) {
  return (
    <Card className="border-slate-200 shadow-sm bg-white">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-3">
          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", bgClass)}>
            <Icon className={cn("h-5 w-5", colorClass)} />
          </div>
          <div>
            <p className={cn("text-2xl font-bold", colorClass)}>{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ManagerRekapAbsensi;
