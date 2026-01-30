import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Clock, Search, Calendar, Users, CheckCircle2,
  XCircle, AlertCircle, Download, RotateCw, FileSpreadsheet, FileText,
  LayoutDashboard, BarChart3, Building2, Key, Settings, Shield, Database,
  Timer, CalendarClock, ChevronLeft, ChevronRight, Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { exportToCSV } from "@/lib/exportUtils";
import { exportAttendanceExcel, exportAttendanceHRPDF, AttendanceReportData, EmployeeAttendance } from "@/lib/attendanceExportUtils";
import { generateAttendancePeriod } from "@/lib/attendanceGenerator";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import EnterpriseLayout from "@/components/layout/EnterpriseLayout";
import { ABSENSI_WAJIB_ROLE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { startOfMonth, endOfMonth, isAfter, format } from "date-fns";
import { id } from "date-fns/locale";

// Talenta Brand Colors
const BRAND_COLORS = {
  blue: "#1A5BA8",
  lightBlue: "#00A0E3",
  green: "#7DC242",
};

interface MonthlyStats {
  user_id: string;
  name: string;
  department: string;
  present: number;
  late: number;
  early_leave: number;
  absent: number;
  total_attendance: number;
  // Detail Arrays for Export
  absentDates: string[];
  lateDates: string[];
  leaveDates: string[]; // Placeholder for now
}

const getTodayDate = () => {
  // Jakarta Timezone Date
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
};

const RekapAbsensi = () => {
  const navigate = useNavigate();
  const { isLoading: settingsLoading } = useSystemSettings();

  const [dailyData, setDailyData] = useState<any[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDate, setFilterDate] = useState(getTodayDate());
  const [viewMode, setViewMode] = useState<"daily" | "monthly">("daily");
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [isPeriodLocked, setIsPeriodLocked] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Menu sections for sidebar
  const menuSections = [
    {
      title: "Menu Utama",
      items: [
        { icon: LayoutDashboard, title: "Dashboard", href: "/dashboard" },
        { icon: Users, title: "Kelola Karyawan", href: "/admin/karyawan" },
        { icon: Clock, title: "Rekap Absensi", href: "/admin/absensi" },
        { icon: BarChart3, title: "Laporan", href: "/admin/laporan" },
      ],
    },
    {
      title: "Pengaturan",
      items: [
        { icon: Building2, title: "Departemen", href: "/admin/departemen" },
        { icon: Shield, title: "Kelola Role", href: "/admin/role" },
        { icon: Key, title: "Reset Password", href: "/admin/reset-password" },
        { icon: Settings, title: "Pengaturan", href: "/admin/pengaturan" },
        { icon: Database, title: "Export Database", href: "/admin/export-database" },
      ],
    },
  ];

  const fetchAttendance = useCallback(async () => {
    setIsLoading(true);

    try {
      // 1. Get Karyawan IDs
      const { data: karyawanRoles } = await supabase.from("user_roles").select("user_id").in("role", ABSENSI_WAJIB_ROLE);
      const karyawanUserIds = new Set(karyawanRoles?.map(r => r.user_id) || []);

      // 2. Get Profiles
      const { data: profilesData } = await supabase.from("profiles").select("user_id, full_name, department, join_date");
      const activeKaryawan = profilesData?.filter(p => karyawanUserIds.has(p.user_id)) || [];
      setTotalEmployees(activeKaryawan.length);

      // 3. Date Range
      let start, end;
      if (viewMode === "daily") {
        start = new Date(filterDate);
        start.setHours(0, 0, 0, 0);
        end = new Date(filterDate);
        end.setHours(23, 59, 59, 999);
      } else {
        start = startOfMonth(selectedMonth);
        end = endOfMonth(selectedMonth);
      }

      // 4. Fetch Records
      const { data: attendanceData, error } = await supabase
        .from("attendance")
        .select("*")
        .gte("clock_in", start.toISOString())
        .lte("clock_in", end.toISOString())
        .order("clock_in", { ascending: false });

      if (error) throw error;

      // 5. Process
      if (viewMode === "daily") {
        const todayStr = getTodayDate();
        const merged = activeKaryawan.map(employee => {
          const record = attendanceData?.find(a => {
            // Safe date check
            if (!a.clock_in) return false;
            const rDate = new Date(a.clock_in).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
            return a.user_id === employee.user_id && rDate === filterDate;
          });

          // Fallback status logic for single day
          let status = record?.status;
          if (!record) {
            if (filterDate > todayStr) status = 'future';
            else if (filterDate === todayStr) status = 'pending';
            else status = 'absent';
          }

          return {
            id: record?.id || `virt-${employee.user_id}`,
            user_id: employee.user_id,
            name: employee.full_name || "Unknown",
            department: employee.department || "-",
            clock_in: record?.clock_in || null,
            clock_out: record?.clock_out || null,
            status: status,
            notes: record?.notes || null
          };
        });

        // Sort: Present first
        merged.sort((a, b) => (b.clock_in ? 1 : 0) - (a.clock_in ? 1 : 0));
        setDailyData(merged);

      } else {
        // MONTHLY AGGREGATION using generateAttendancePeriod
        const stats: MonthlyStats[] = activeKaryawan.map(employee => {
          const empRecords = attendanceData?.filter(r => r.user_id === employee.user_id) || [];
          const normalized = generateAttendancePeriod(start, end, empRecords);

          const s: MonthlyStats = {
            user_id: employee.user_id,
            name: employee.full_name || "Unknown",
            department: employee.department || "-",
            present: 0, late: 0, early_leave: 0, absent: 0, total_attendance: 0,
            absentDates: [], lateDates: [], leaveDates: []
          };

          normalized.forEach(day => {
            if (day.status === 'present') { s.present++; s.total_attendance++; }
            else if (day.status === 'late') { s.late++; s.total_attendance++; s.lateDates.push(day.date); }
            else if (day.status === 'early_leave') { s.early_leave++; s.total_attendance++; }
            else if ((day.status === 'absent' || day.status === 'alpha') && !day.isWeekend && day.status !== 'future') {
              // Only count absent if it's strictly absent (not weekend/future)
              s.absent++;
              s.absentDates.push(day.date);
            }
          });

          return s;
        });
        setMonthlyStats(stats);
      }

      setLastUpdated(new Date());

    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setIsLoading(false);
    }
  }, [filterDate, selectedMonth, viewMode]);

  useEffect(() => {
    if (!settingsLoading) fetchAttendance();
  }, [settingsLoading, fetchAttendance]);

  // Sync is mostly redundant now but useful for hard-refreshing or debugging
  const handleSyncAbsence = () => fetchAttendance();

  const goToPrevious = () => {
    if (viewMode === "daily") {
      const d = new Date(filterDate); d.setDate(d.getDate() - 1);
      setFilterDate(d.toISOString().split("T")[0]);
    } else {
      setSelectedMonth(prev => { const d = new Date(prev); d.setMonth(d.getMonth() - 1); return d; });
    }
  };
  const goToNext = () => {
    if (viewMode === "daily") {
      const d = new Date(filterDate); d.setDate(d.getDate() + 1);
      setFilterDate(d.toISOString().split("T")[0]);
    } else {
      setSelectedMonth(prev => { const d = new Date(prev); d.setMonth(d.getMonth() + 1); return d; });
    }
  };

  const calculateDuration = (inTime: any, outTime: any) => {
    if (!inTime || !outTime) return "-";
    const ms = new Date(outTime).getTime() - new Date(inTime).getTime();
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}j ${m}m`;
  };

  const monthStatsTotal = {
    employees: monthlyStats.length,
    present: monthlyStats.reduce((acc, curr) => acc + curr.present, 0),
    late: monthlyStats.reduce((acc, curr) => acc + curr.late, 0),
    absent: monthlyStats.reduce((acc, curr) => acc + curr.absent, 0),
  };

  // EXPORT
  const handleExport = (type: 'csv' | 'excel' | 'pdf') => {
    if (dailyData.length === 0 && monthlyStats.length === 0) return;

    if (viewMode === 'monthly') {
      // Use SPECIALIZED Export
      const reportData: AttendanceReportData = {
        period: format(selectedMonth, 'MMMM yyyy', { locale: id }),
        periodStart: format(startOfMonth(selectedMonth), 'yyyy-MM-dd'),
        periodEnd: format(endOfMonth(selectedMonth), 'yyyy-MM-dd'),
        totalEmployees: monthlyStats.length,
        totalPresent: monthlyStats.reduce((a, b) => a + b.present, 0),
        totalAbsent: monthlyStats.reduce((a, b) => a + b.absent, 0),
        totalLate: monthlyStats.reduce((a, b) => a + b.late, 0),
        totalLeave: 0, // Need Leave logic separately if implemented
        employees: monthlyStats.map(m => ({
          name: m.name,
          department: m.department,
          present: m.present,
          absent: m.absent,
          late: m.late,
          leave: 0,
          absentDates: m.absentDates,
          lateDates: m.lateDates,
          leaveDates: [],
          remarks: ""
        })),
        leaveRequests: []
      };

      if (type === 'excel') exportAttendanceExcel(reportData, `Laporan_Bulanan_${format(selectedMonth, 'MMM_yyyy')}`);
      if (type === 'pdf') exportAttendanceHRPDF(reportData, `Laporan_Bulanan_${format(selectedMonth, 'MMM_yyyy')}`);
      if (type === 'csv') toast({ description: "CSV tersedia di mode Harian." });
    } else {
      // DAILY EXPORT (Simple)
      const dataForExport = dailyData.map((d, i) => ({
        No: i + 1,
        Nama: d.name,
        Departemen: d.department,
        Masuk: d.clock_in ? format(new Date(d.clock_in), 'HH:mm') : '-',
        Keluar: d.clock_out ? format(new Date(d.clock_out), 'HH:mm') : '-',
        Durasi: calculateDuration(d.clock_in, d.clock_out),
        Status: d.status,
        Keterangan: d.notes || '-'
      }));

      if (type === 'csv') exportToCSV({
        filename: `Absensi_Harian_${filterDate}`,
        data: dataForExport,
      });
      else toast({ description: "Gunakan Mode Bulanan untuk Laporan Lengkap PDF/Excel" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present": return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-0"><CheckCircle2 className="w-3 h-3 mr-1" />Hadir</Badge>;
      case "late": return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-0"><AlertCircle className="w-3 h-3 mr-1" />Terlambat</Badge>;
      case "absent":
      case "alpha": return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-0"><XCircle className="w-3 h-3 mr-1" />Alpha</Badge>;
      case "pending": return <Badge variant="secondary" className="text-slate-500">Belum Hadir</Badge>;
      case "future": return <Badge variant="outline" className="text-slate-300">-</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Filter
  const filteredData = viewMode === 'daily'
    ? dailyData.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : monthlyStats.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <EnterpriseLayout
      title="Rekap Absensi"
      subtitle={viewMode === 'daily' ? format(new Date(filterDate), 'dd MMMM yyyy', { locale: id }) : format(selectedMonth, 'MMMM yyyy', { locale: id })}
      menuSections={menuSections}
      roleLabel="Administrator"
      showRefresh={true}
      onRefresh={fetchAttendance}
    >
      {/* Controls Area */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white shadow-sm border-slate-200">
          <CardContent className="p-4 flex flex-col gap-2">
            <div className="flex justify-between items-center bg-slate-100 p-1 rounded-lg">
              <button onClick={() => setViewMode('daily')} className={cn("flex-1 text-xs font-medium py-1.5 rounded-md transition-all", viewMode === 'daily' ? "bg-white shadow text-slate-900" : "text-slate-500")}>Harian</button>
              <button onClick={() => setViewMode('monthly')} className={cn("flex-1 text-xs font-medium py-1.5 rounded-md transition-all", viewMode === 'monthly' ? "bg-white shadow text-slate-900" : "text-slate-500")}>Bulanan</button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <Button variant="ghost" size="icon" onClick={goToPrevious}><ChevronLeft className="w-4 h-4" /></Button>
              <span className="text-sm font-semibold text-slate-700">
                {viewMode === 'daily' ? format(new Date(filterDate), 'dd MMM yyyy', { locale: id }) : format(selectedMonth, 'MMMM yyyy', { locale: id })}
              </span>
              <Button variant="ghost" size="icon" onClick={goToNext}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm border-slate-200 md:col-span-2">
          <CardContent className="p-4 flex items-center justify-between h-full">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="Cari karyawan..." className="pl-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="bg-blue-700 hover:bg-blue-800 gap-2"><Download className="w-4 h-4" /> Export</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('excel')}><FileSpreadsheet className="w-4 h-4 mr-2" />Excel (Lengkap)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('pdf')}><FileText className="w-4 h-4 mr-2" />PDF (Lengkap)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('csv')}><FileText className="w-4 h-4 mr-2" />CSV (Simple)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardContent>
        </Card>
      </div>

      {/* Stats Grid */}
      {viewMode === 'monthly' && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card className="bg-white shadow-sm"><CardContent className="p-4"><p className="text-xs text-slate-500">Total Karyawan</p><p className="text-2xl font-bold text-slate-800">{monthStatsTotal.employees}</p></CardContent></Card>
          <Card className="bg-white shadow-sm"><CardContent className="p-4"><p className="text-xs text-slate-500">Hadir</p><p className="text-2xl font-bold text-green-600">{monthStatsTotal.present}</p></CardContent></Card>
          <Card className="bg-white shadow-sm"><CardContent className="p-4"><p className="text-xs text-slate-500">Terlambat</p><p className="text-2xl font-bold text-amber-600">{monthStatsTotal.late}</p></CardContent></Card>
          <Card className="bg-white shadow-sm"><CardContent className="p-4"><p className="text-xs text-slate-500">Alpha</p><p className="text-2xl font-bold text-red-600">{monthStatsTotal.absent}</p></CardContent></Card>
        </div>
      )}

      {/* Data Table */}
      <Card className="shadow-sm border-slate-200 bg-white">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Nama</TableHead>
                <TableHead>Departemen</TableHead>
                {viewMode === 'daily' ? (
                  <>
                    <TableHead>Jam Masuk</TableHead>
                    <TableHead>Jam Keluar</TableHead>
                    <TableHead>Durasi</TableHead>
                    <TableHead>Status</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead className="text-center">Hadir</TableHead>
                    <TableHead className="text-center">Terlambat</TableHead>
                    <TableHead className="text-center">Alpha</TableHead>
                    <TableHead className="text-center">Total Hari</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.length > 0 ? filteredData.map((item, i) => (
                <TableRow key={i} className="hover:bg-slate-50">
                  <TableCell className="font-medium text-slate-700">{item.name}</TableCell>
                  <TableCell className="text-slate-500">{item.department}</TableCell>
                  {viewMode === 'daily' ? (
                    <>
                      <TableCell>{item.clock_in ? format(new Date(item.clock_in), 'HH:mm') : '-'}</TableCell>
                      <TableCell>{item.clock_out ? format(new Date(item.clock_out), 'HH:mm') : '-'}</TableCell>
                      <TableCell>{calculateDuration(item.clock_in, item.clock_out)}</TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="text-center text-green-600 font-bold">{(item as MonthlyStats).present}</TableCell>
                      <TableCell className="text-center text-amber-600 font-bold">{(item as MonthlyStats).late}</TableCell>
                      <TableCell className="text-center text-red-600 font-bold">{(item as MonthlyStats).absent}</TableCell>
                      <TableCell className="text-center font-medium">{(item as MonthlyStats).total_attendance}</TableCell>
                    </>
                  )}
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={6} className="h-24 text-center text-slate-400">Tidak ada data</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </EnterpriseLayout>
  );
};

export default RekapAbsensi;