import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Clock, Search, Calendar as CalendarIcon, Users, CheckCircle2,
  XCircle, AlertCircle, Download, FileSpreadsheet, FileText,
  LayoutDashboard, BarChart3, Building2, Key, Settings, Shield, Database,
  ChevronLeft, ChevronRight, LogIn, LogOut, Trash2, Filter, RefreshCw
} from "lucide-react";
import { ADMIN_MENU_SECTIONS } from "@/config/menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { exportToCSV } from "@/lib/exportUtils";
import { exportAttendanceExcel, exportAttendanceHRPDF, AttendanceReportData } from "@/lib/attendanceExportUtils";
import { generateAttendancePeriod } from "@/lib/attendanceGenerator";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import EnterpriseLayout from "@/components/layout/EnterpriseLayout";
import { ABSENSI_WAJIB_ROLE, EXCLUDED_USER_NAMES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";
import { startOfMonth, endOfMonth, format, addDays, subDays, getDaysInMonth, getDate, isSameMonth, startOfDay, endOfDay } from "date-fns";
import { id } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import StatCard from "@/components/ui/stat-card"; // Reusing generic stat card if avail, or build custom

interface MonthlyStats {
  user_id: string;
  name: string;
  department: string;
  present: number;
  late: number;
  early_leave: number;
  absent: number;
  total_attendance: number;
  absentDates: string[];
  lateDates: string[];
  leaveDates: string[];
  leave: number;
  details: any[]; // Stores daily status objects
}

const getTodayDate = () => {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
};

const RekapAbsensi = () => {
  const navigate = useNavigate();
  const { isLoading: settingsLoading, settings } = useSystemSettings();
  const isMobile = useIsMobile();

  // State
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [isDetailedView, setIsDetailedView] = useState(true);

  // Loading & Search & Filter
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [departments, setDepartments] = useState<string[]>([]);

  // Edit State
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    clock_in: "",
    clock_out: "",
    status: "",
    notes: ""
  });

  // Delete State
  const [recordToDelete, setRecordToDelete] = useState<any | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // View Modes
  const [viewMode, setViewMode] = useState<"daily" | "monthly" | "range">("daily");

  // Date Filters
  const [filterDate, setFilterDate] = useState(getTodayDate());
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });

  // Calculate Start/End based on view mode (Memoized)
  const queryRange = useMemo(() => {
    let start: Date, end: Date;
    if (viewMode === "range") {
      start = startOfDay(dateRange?.from || new Date());
      end = endOfDay(dateRange?.to || new Date());
    } else if (viewMode === "monthly") {
      start = startOfMonth(selectedMonth);
      end = endOfMonth(selectedMonth);
    } else {
      // Daily: Create Strict Jakarta Range
      // filterDate is "YYYY-MM-DD"
      // Start: YYYY-MM-DDT00:00:00+07:00
      // End: YYYY-MM-DDT23:59:59.999+07:00
      const startStr = `${filterDate}T00:00:00+07:00`;
      const endStr = `${filterDate}T23:59:59.999+07:00`;
      start = new Date(startStr);
      end = new Date(endStr);
    }
    return { start, end };
  }, [viewMode, dateRange, selectedMonth, filterDate]);

  const [allMonthData, setAllMonthData] = useState<any[]>([]);

  // Helpers
  const formatTime = (isoString: string | null) => {
    if (!isoString) return "-";
    return format(new Date(isoString), "HH:mm");
  };

  const calculateDuration = (inTime: any, outTime: any) => {
    if (!inTime) return "-";
    if (!outTime) return "Berjalan";
    const ms = new Date(outTime).getTime() - new Date(inTime).getTime();
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}j ${m}m`;
  };

  // 1. Fetch Data
  const fetchAttendance = useCallback(async () => {
    setIsLoading(true);
    try {
      // A. Get Target Employees (Profiles)
      const { data: roles } = await supabase.from("user_roles").select("user_id").in("role", ABSENSI_WAJIB_ROLE);

      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, department, join_date")
        .order("full_name");

      let activeKaryawan = allProfiles || [];

      // Filter by role if roles exist
      if (roles && roles.length > 0) {
        const roleIds = new Set(roles.map(r => r.user_id));
        activeKaryawan = activeKaryawan.filter(p => roleIds.has(p.user_id));
      }

      // Filter Excluded Users
      activeKaryawan = activeKaryawan.filter(p => {
        if (!p.full_name) return true;
        const nameLower = p.full_name.toLowerCase();
        return !EXCLUDED_USER_NAMES.some(excluded => nameLower.includes(excluded.toLowerCase()));
      });

      // Extract departments
      const depts = Array.from(new Set(activeKaryawan.map(p => p.department).filter(Boolean))) as string[];
      setDepartments(depts);

      // B. Fetch Attendance Data
      const { start, end } = queryRange;

      const { data: attendanceData, error: attendanceError } = await supabase
        .from("attendance")
        .select("*")
        .is("deleted_at", null)
        .gte("clock_in", start.toISOString())
        .lte("clock_in", end.toISOString()); // Strict range

      if (attendanceError) throw attendanceError;
      setAllMonthData(attendanceData || []);

      // C. Fetch Leaves
      const { data: leaveData } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("status", "approved")
        // Optimization: filter by date in DB if possible, but local filter ok for small datasets
        .gte("end_date", start.toISOString())
        .lte("start_date", end.toISOString());

      // D. Process Monthly Stats Matrix
      const stats: MonthlyStats[] = activeKaryawan.map(employee => {
        const empRecords = attendanceData?.filter(r => r.user_id === employee.user_id) || [];
        const empLeaves = leaveData?.filter(l => l.user_id === employee.user_id) || [];

        // Generate daily details using shared logic
        const normalized = generateAttendancePeriod(start, end, empRecords, empLeaves, employee.join_date);

        const s: MonthlyStats = {
          user_id: employee.user_id,
          name: employee.full_name || "Unknown",
          department: employee.department || "-",
          present: 0, late: 0, early_leave: 0, absent: 0, leave: 0, total_attendance: 0,
          absentDates: [], lateDates: [], leaveDates: [],
          details: normalized
        };

        // Aggregation Logic (Inclusive: Late & Early Leave count as Present)
        normalized.forEach(day => {
          // Skip days before join date
          if (employee.join_date && day.date < employee.join_date) return;
          // Skip days before system start date
          if (settings.attendanceStartDate && day.date < settings.attendanceStartDate) return;

          // Inclusive Present Logic
          if (['present', 'late', 'early_leave'].includes(day.status)) {
            s.present++;
            s.total_attendance++;
          }

          // Specific Counters
          if (day.status === 'late') { s.late++; s.lateDates.push(day.date); }
          if (day.status === 'early_leave') { s.early_leave++; }

          if (['leave', 'permission', 'sick'].includes(day.status)) { s.leave++; s.leaveDates.push(day.date); }
          else if (['absent', 'alpha'].includes(day.status) && !day.isWeekend && day.status !== 'future') {
            s.absent++; s.absentDates.push(day.date);
          }
        });

        return s;
      });

      setMonthlyStats(stats);

    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Gagal memuat data", description: err.message });
    } finally {
      setIsLoading(false);
    }
  }, [queryRange, settings.attendanceStartDate]);

  // 2. Process Daily Data View
  useEffect(() => {
    if (viewMode !== 'daily') return;

    // Filter monthlyStats.details for the specific 'filterDate'
    // This is much more reliable than trying to match raw attendance records manually
    // because monthlyStats.details has already passed through the 'generateAttendancePeriod' logic

    if (monthlyStats.length === 0 && !isLoading) return; // Wait for data

    const processedDaily = monthlyStats.map(emp => {
      // Find the specific day detail
      const dayDetail = emp.details.find(d => d.date === filterDate);

      // Fallback if date out of range of current monthlyStats (shouldn't happen if queryRange is correct)
      if (!dayDetail) return null;

      return {
        id: dayDetail.recordId || `virt-${emp.user_id}`,
        user_id: emp.user_id,
        name: emp.name,
        department: emp.department,
        clock_in: dayDetail.clockIn,
        clock_out: dayDetail.clockOut,
        status: dayDetail.status,
        notes: dayDetail.notes
      };
    }).filter(Boolean) as any[];

    // Sort: Late/Present first, then Absent
    processedDaily.sort((a, b) => {
      const score = (s: string) => {
        if (['present', 'late', 'early_leave', 'not_clocked_out'].includes(s)) return 2;
        if (['leave', 'permission', 'sick'].includes(s)) return 1;
        return 0; // absent/alpha
      }
      return score(b.status) - score(a.status);
    });

    setDailyData(processedDaily);

  }, [viewMode, filterDate, monthlyStats]);


  // Initial Load
  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  // Derived Stats for UI
  const currentStats = useMemo(() => {
    const dataSource = viewMode === 'daily' ? dailyData : monthlyStats;
    const filtered = dataSource.filter(d => {
      const matchSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchDept = departmentFilter === 'all' || d.department === departmentFilter;
      return matchSearch && matchDept;
    });

    // Calculate totals based on view mode
    if (viewMode === 'daily') {
      return {
        filtered,
        totalPresent: filtered.filter(d => ['present', 'late', 'early_leave'].includes(d.status)).length,
        totalLate: filtered.filter(d => d.status === 'late').length,
        totalAbsent: filtered.filter(d => ['absent', 'alpha'].includes(d.status)).length,
        totalLeave: filtered.filter(d => ['leave', 'permission', 'sick'].includes(d.status)).length
      };
    } else {
      return {
        filtered,
        totalPresent: filtered.reduce((acc, curr) => acc + curr.present, 0),
        totalLate: filtered.reduce((acc, curr) => acc + curr.late, 0),
        totalAbsent: filtered.reduce((acc, curr) => acc + curr.absent, 0),
        totalLeave: filtered.reduce((acc, curr) => acc + curr.leave, 0)
      };
    }
  }, [dailyData, monthlyStats, searchQuery, departmentFilter, viewMode]);


  // Handlers
  const handleUpdate = async () => { /* ... Keep existing update logic ... */
    if (!editingRecord) return;
    setIsLoading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;

      const updateData: any = {
        clock_in: editForm.clock_in ? new Date(editForm.clock_in).toISOString() : null,
        clock_out: editForm.clock_out ? new Date(editForm.clock_out).toISOString() : null,
        status: editForm.status,
        notes: editForm.notes
      };

      // Calculate Work Hours
      if (updateData.clock_in && updateData.clock_out) {
        const diff = new Date(updateData.clock_out).getTime() - new Date(updateData.clock_in).getTime();
        updateData.work_hours = parseFloat((diff / (1000 * 60 * 60)).toFixed(2));
      } else {
        updateData.work_hours = 0;
      }

      // Check if it's a virtual record (create new) or existing (update)
      if (editingRecord.id.toString().startsWith('virt')) {
        // INSERT
        const { error } = await supabase.from('attendance').insert({
          user_id: editingRecord.user_id,
          ...updateData,
          date: filterDate // Important for virtual records
        });
        if (error) throw error;
      } else {
        // UPDATE
        const { error } = await supabase.from('attendance').update(updateData).eq('id', editingRecord.id);
        if (error) throw error;
      }

      toast({ title: "Berhasil", description: "Data absensi diperbarui." });
      setIsEditOpen(false);
      fetchAttendance();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Gagal", description: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => { /* ... Keep existing delete logic ... */
    if (!recordToDelete) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.from('attendance').delete().eq('id', recordToDelete.id); // Hard delete or soft delete?
      // Code used soft delete before: .update({ deleted_at: ... })
      // Let's stick to soft delete
      await supabase.from('attendance').update({ deleted_at: new Date().toISOString() }).eq('id', recordToDelete.id);

      toast({ title: "Dihapus", description: "Data absensi di-reset." });
      setIsDeleteDialogOpen(false);
      fetchAttendance();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Gagal", description: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Nav Handlers
  const goToPrevious = () => {
    if (viewMode === "daily") {
      const d = new Date(filterDate); d.setDate(d.getDate() - 1);
      setFilterDate(format(d, "yyyy-MM-dd")); // Use yyyy-MM-dd format for consistency
    } else {
      setSelectedMonth(prev => subDays(prev, 30)); // Rough month nav
    }
  };

  const goToNext = () => {
    if (viewMode === "daily") {
      const d = new Date(filterDate); d.setDate(d.getDate() + 1);
      setFilterDate(format(d, "yyyy-MM-dd"));
    } else {
      setSelectedMonth(prev => addDays(prev, 30));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present": return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-0"><CheckCircle2 className="w-3 h-3 mr-1" />Hadir</Badge>;
      case "late": return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-0"><AlertCircle className="w-3 h-3 mr-1" />Terlambat</Badge>;
      case "early_leave": return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200 border-0"><Clock className="w-3 h-3 mr-1" />Pulang Cepat</Badge>;
      case "absent":
      case "alpha": return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-0"><XCircle className="w-3 h-3 mr-1" />Alpha</Badge>;
      case "leave": return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200 border-0"><FileText className="w-3 h-3 mr-1" />Cuti</Badge>;
      case "permission": return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-0"><FileText className="w-3 h-3 mr-1" />Izin</Badge>;
      case "sick": return <Badge className="bg-pink-100 text-pink-700 hover:bg-pink-200 border-0"><FileText className="w-3 h-3 mr-1" />Sakit</Badge>;
      case "not_clocked_out": return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300 border animate-pulse"><Clock className="w-3 h-3 mr-1" />Belum Pulang</Badge>;
      default: return <Badge variant="outline" className="text-slate-400 border-slate-200">-</Badge>;
    }
  };

  return (
    <EnterpriseLayout
      title="Rekap Absensi"
      subtitle="Manajemen dan monitoring data kehadiran"
      menuSections={ADMIN_MENU_SECTIONS}
      roleLabel="Administrator"
      showRefresh={false}
    >
      {/* Main Content */}
      <div className="space-y-6">

        {/* 1. Header & Filters Card */}
        <Card className="border-slate-200 shadow-sm bg-white">
          <div className="p-4 flex flex-col lg:flex-row gap-4 justify-between lg:items-center">

            {/* View Switcher */}
            <div className="flex bg-slate-100 p-1 rounded-lg shrink-0 w-fit">
              {(['daily', 'monthly', 'range'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-md transition-all capitalize",
                    viewMode === m ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {m === 'range' ? 'Periode' : (m === 'daily' ? 'Harian' : 'Bulanan')}
                </button>
              ))}
            </div>

            {/* Date Navigation */}
            <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
              {viewMode === 'range' ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" className="h-9 w-[240px] justify-start text-left font-normal bg-white border border-slate-200">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? <>{format(dateRange.from, "d MMM yyyy", { locale: id })} - {format(dateRange.to, "d MMM yyyy", { locale: id })}</> : format(dateRange.from, "d MMM yyyy", { locale: id })
                      ) : <span>Pilih Tanggal</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
                  </PopoverContent>
                </Popover>
              ) : (
                <>
                  <Button variant="ghost" size="icon" onClick={goToPrevious} className="h-8 w-8 hover:bg-white hover:shadow-sm"><ChevronLeft className="w-4 h-4" /></Button>
                  <span className="font-semibold text-slate-700 text-sm min-w-[140px] text-center">
                    {viewMode === 'daily' ? format(new Date(filterDate), 'EEEE, d MMM yyyy', { locale: id }) : format(selectedMonth, 'MMMM yyyy', { locale: id })}
                  </span>
                  <Button variant="ghost" size="icon" onClick={goToNext} className="h-8 w-8 hover:bg-white hover:shadow-sm"><ChevronRight className="w-4 h-4" /></Button>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 w-full lg:w-auto">
              <Button variant="outline" size="sm" onClick={() => fetchAttendance()} disabled={isLoading} className="gap-2">
                <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
                Sync
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 gap-2">
                    <Download className="w-3.5 h-3.5" /> Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => toast({ title: "Coming Soon", description: "Fitur export dalam pengembangan" })}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Filters */}
          <div className="px-4 pb-4 flex flex-col sm:flex-row gap-3 border-t border-slate-50 pt-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Cari karyawan..."
                className="pl-9 bg-slate-50 border-slate-200"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[200px] bg-slate-50 border-slate-200">
                <Filter className="w-3.5 h-3.5 mr-2 text-slate-400" />
                <SelectValue placeholder="Semua Departemen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Departemen</SelectItem>
                {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* 2. Stat Cards Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <Card className="bg-white border-slate-200 shadow-sm p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase">Hadir</p>
              <p className="text-xl font-bold text-slate-900">{currentStats.totalPresent}</p>
            </div>
          </Card>
          <Card className="bg-white border-slate-200 shadow-sm p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase">Terlambat</p>
              <p className="text-xl font-bold text-slate-900">{currentStats.totalLate}</p>
            </div>
          </Card>
          <Card className="bg-white border-slate-200 shadow-sm p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center text-red-600">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase">Alpha</p>
              <p className="text-xl font-bold text-slate-900">{currentStats.totalAbsent}</p>
            </div>
          </Card>
          <Card className="bg-white border-slate-200 shadow-sm p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase">Cuti / Izin</p>
              <p className="text-xl font-bold text-slate-900">{currentStats.totalLeave}</p>
            </div>
          </Card>
        </div>

        {/* 3. Data Table */}
        <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[50px] font-bold text-slate-600">No</TableHead>
                  <TableHead className="font-bold text-slate-600">Karyawan</TableHead>
                  <TableHead className="font-bold text-slate-600">Departemen</TableHead>
                  {viewMode === 'daily' ? (
                    <>
                      <TableHead className="font-bold text-slate-600 text-center">Jam Masuk</TableHead>
                      <TableHead className="font-bold text-slate-600 text-center">Jam Keluar</TableHead>
                      <TableHead className="font-bold text-slate-600 text-center">Durasi</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead className="font-bold text-slate-600 text-center">Hadir</TableHead>
                      <TableHead className="font-bold text-slate-600 text-center">Terlambat</TableHead>
                      <TableHead className="font-bold text-slate-600 text-center">Alpha</TableHead>
                    </>
                  )}
                  <TableHead className="font-bold text-slate-600 text-center">Status</TableHead>
                  <TableHead className="font-bold text-slate-600 text-end">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><div className="h-4 w-4 bg-slate-100 rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 w-32 bg-slate-100 rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 w-20 bg-slate-100 rounded animate-pulse" /></TableCell>
                      <TableCell colSpan={4}><div className="h-4 w-full bg-slate-100 rounded animate-pulse" /></TableCell>
                    </TableRow>
                  ))
                ) : currentStats.filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-slate-500">
                      Tidak ada data absensi untuk periode ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  currentStats.filtered.map((row: any, i) => (
                    <TableRow key={row.user_id} className="hover:bg-slate-50/50">
                      <TableCell className="text-slate-500 text-xs">{i + 1}</TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-800 text-sm">{row.name}</div>
                        <div className="text-[10px] text-slate-400">ID: {row.user_id.substring(0, 6)}</div>
                      </TableCell>
                      <TableCell className="text-slate-500 text-xs">{row.department}</TableCell>

                      {viewMode === 'daily' ? (
                        <>
                          <TableCell className="text-center font-mono text-xs text-slate-600">{formatTime(row.clock_in)}</TableCell>
                          <TableCell className="text-center font-mono text-xs text-slate-600">{formatTime(row.clock_out)}</TableCell>
                          <TableCell className="text-center text-xs text-slate-500">{calculateDuration(row.clock_in, row.clock_out)}</TableCell>
                          <TableCell className="text-center">
                            {getStatusBadge(row.status)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-blue-600" onClick={() => { setEditingRecord(row); setEditForm({ clock_in: row.clock_in ? new Date(row.clock_in).toISOString().slice(0, 16) : '', clock_out: row.clock_out ? new Date(row.clock_out).toISOString().slice(0, 16) : '', status: row.status || 'present', notes: row.notes || '' }); setIsEditOpen(true); }}>
                                <Settings className="w-4 h-4" />
                              </Button>
                              {row.id && !row.id.toString().startsWith('virt') && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-red-600" onClick={() => { setRecordToDelete(row); setIsDeleteDialogOpen(true); }}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-center font-bold text-slate-700">{row.present}</TableCell>
                          <TableCell className="text-center font-medium text-amber-600">{row.late}</TableCell>
                          <TableCell className="text-center font-medium text-red-600">{row.absent}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={cn("text-xs",
                              (row.present / (row.present + row.absent || 1)) >= 0.9 ? "text-emerald-600 bg-emerald-50" :
                                (row.present / (row.present + row.absent || 1)) >= 0.7 ? "text-blue-600 bg-blue-50" : "text-amber-600 bg-amber-50"
                            )}>
                              {Math.round((row.present / ((row.present + row.absent + row.leave) || 1)) * 100)}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" className="h-8 text-xs text-blue-600" onClick={() => navigate(`/admin/laporan`)}>
                              Detail
                            </Button>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Data Absensi</DialogTitle>
            <DialogDescription>
              Ubah data kehadiran untuk <b>{editingRecord?.name}</b> pada tanggal {viewMode === 'daily' ? format(new Date(filterDate), 'd MMM yyyy') : 'terpilih'}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Status Kehadiran</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Hadir (Present)</SelectItem>
                  <SelectItem value="late">Terlambat (Late)</SelectItem>
                  <SelectItem value="early_leave">Pulang Awal</SelectItem>
                  <SelectItem value="permission">Izin</SelectItem>
                  <SelectItem value="sick">Sakit</SelectItem>
                  <SelectItem value="absent">Alpha</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Jam Masuk</Label>
                <Input
                  type="datetime-local"
                  value={editForm.clock_in}
                  onChange={e => setEditForm({ ...editForm, clock_in: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Jam Keluar</Label>
                <Input
                  type="datetime-local"
                  value={editForm.clock_out}
                  onChange={e => setEditForm({ ...editForm, clock_out: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Catatan</Label>
              <Textarea
                value={editForm.notes}
                onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Batal</Button>
            <Button onClick={handleUpdate}>Simpan Perubahan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">Hapus Data Absensi?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini akan menghapus data kehadiran untuk <b>{recordToDelete?.name}</b> secara permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </EnterpriseLayout>
  );
};

export default RekapAbsensi;
