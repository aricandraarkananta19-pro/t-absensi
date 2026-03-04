
import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, FileText, Calendar as CalendarIcon, CheckCircle2, XCircle, Clock, Search, Users,
  Download, BarChart3, RefreshCw, FileSpreadsheet,
  AlertTriangle, CalendarDays, ChevronDown, Home, ChevronRightIcon,
  TrendingUp, UserCheck, UserX, Timer, Filter, LayoutGrid, LogIn, LogOut,
  Briefcase, MoreHorizontal, Printer
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { exportToPDF, exportToExcel } from "@/lib/exportUtils";
import { generateAttendanceExcel } from "@/lib/excelExport";
import { exportAttendanceExcel, exportAttendanceHRPDF, exportAttendanceManagementPDF, AttendanceReportData, AttendanceReportEmployee } from "@/lib/attendanceExportUtils";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useIsMobile } from "@/hooks/useIsMobile";
import { ABSENSI_WAJIB_ROLE, EXCLUDED_USER_NAMES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, isToday, addMonths, subDays, subMonths, setDate, startOfDay, endOfDay, differenceInMinutes, parse } from "date-fns";
import { id } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { generateAttendancePeriod, DailyAttendanceStatus } from "@/lib/attendanceGenerator";
import EnterpriseLayout from "@/components/layout/EnterpriseLayout";
import { AttendanceHistoryTable } from "@/components/attendance/AttendanceHistoryTable";
import { AttendanceCalendarView } from "@/components/attendance/AttendanceCalendarView";
import { MANAGER_MENU_SECTIONS } from "@/config/menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Talenta Brand Colors
const BRAND_COLORS = {
  blue: "#1A5BA8",
  lightBlue: "#00A0E3",
  green: "#7DC242",
};

// =============== SKELETON LOADER COMPONENT ===============
const SkeletonCard = () => (
  <Card className="border-slate-200 dark:border-slate-700 w-full bg-white dark:bg-slate-900 shadow-sm">
    <CardContent className="p-5">
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-16" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const SkeletonTable = () => (
  <Card className="border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
    <div className="bg-slate-50 dark:bg-slate-800 py-3 px-4 border-b">
      <Skeleton className="h-5 w-32" />
    </div>
    <CardContent className="p-0">
      <div className="p-4 space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

// =============== EMPTY STATE COMPONENT ===============
const EmptyState = ({ title, description, icon: Icon }: { title: string; description: string; icon: React.ElementType }) => (
  <div className="flex flex-col items-center justify-center py-16 px-4">
    <div className="h-20 w-20 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-6 border border-slate-200 dark:border-slate-700">
      <Icon className="h-10 w-10 text-slate-400" />
    </div>
    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{title}</h3>
    <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-sm">{description}</p>
  </div>
);

interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
  created_at: string;
  profile?: { full_name: string | null; department: string | null; };
}

interface EmployeeReport extends AttendanceReportEmployee {
  user_id: string;
  full_name: string | null;
  department: string | null;
  position: string | null; // Add position
  details: DailyAttendanceStatus[];
  lateMinutes: number; // Add total late minutes
  dailyStatus: Record<string, string>; // Key: "YYYY-MM-DD", Value: Status Code
}

interface AttendanceReportRpcDetail {
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  status: string;
  notes: string | null;
  isWeekend: boolean;
}

interface AttendanceReportRpcResponse {
  user_id: string;
  full_name: string | null;
  department: string | null;
  present: string | number;
  late: string | number;
  absent: string | number;
  leave: string | number;
  details: AttendanceReportRpcDetail[];
}

const ManagerLaporan = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings, isLoading: settingsLoading } = useSystemSettings();
  const isMobile = useIsMobile();

  // =============== STATE ===============
  const [searchParams, setSearchParams] = useSearchParams();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [employeeReports, setEmployeeReports] = useState<EmployeeReport[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("pending"); // For Leave Tab
  const [filterDepartment, setFilterDepartment] = useState("all");

  // Date Range State - Initialize from URL or default
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  // Modals
  const [dialogOpen, setDialogOpen] = useState(false); // Reject Reason Modal
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeReport | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState("excel");
  const [exportPeriodVal, setExportPeriodVal] = useState("");

  // ==========================================
  // DATE RANGE LOGIC (PERSISTENT & AUTO)
  // ==========================================

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
    if (range?.from) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set("from", format(range.from, "yyyy-MM-dd"));
      if (range.to) {
        newParams.set("to", format(range.to, "yyyy-MM-dd"));
      } else {
        newParams.delete("to");
      }
      setSearchParams(newParams, { replace: true });
    }
  };

  const availablePeriods = useMemo(() => {
    const periods = [];
    const today = new Date();

    for (let i = 0; i < 12; i++) {
      const date = subMonths(today, i);
      const monthName = format(date, "MMMM yyyy", { locale: id });

      const from = startOfDay(startOfMonth(date));
      const to = endOfDay(endOfMonth(date));

      periods.push({
        label: monthName,
        value: `${format(from, "yyyy-MM-dd")}_${format(to, "yyyy-MM-dd")}`,
        from,
        to
      });
    }
    return periods;
  }, []);

  const handlePeriodChange = (val: string) => {
    if (val === "custom") return;
    const [startStr, endStr] = val.split("_");
    const newRange = { from: new Date(startStr), to: new Date(endStr) };
    handleDateRangeChange(newRange);
  };

  useEffect(() => {
    if (dateRange?.from && dateRange?.to) {
      // Keeps export period val properly synced
      const syncedPeriod = availablePeriods.find(p => p.from.getTime() === dateRange.from?.getTime() && p.to?.getTime() === dateRange.to?.getTime());
      if (syncedPeriod) {
        setExportPeriodVal(syncedPeriod.value);
      } else {
        setExportPeriodVal("custom");
      }
      return;
    }
    if (settingsLoading) return;

    if (availablePeriods.length > 0) {
      const defaultPeriod = availablePeriods[0];
      setDateRange({ from: defaultPeriod.from, to: defaultPeriod.to });

      const newParams = new URLSearchParams(searchParams);
      newParams.set("from", format(defaultPeriod.from, "yyyy-MM-dd"));
      newParams.set("to", format(defaultPeriod.to, "yyyy-MM-dd"));
      setSearchParams(newParams, { replace: true });
    }
  }, [settingsLoading, searchParams, availablePeriods, dateRange]);

  const toTitleCase = (str: string | null): string => {
    if (!str) return "—";
    return str.toLowerCase().split(" ").map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(" ");
  };

  const fetchDepartments = async () => {
    const { data } = await supabase.from("profiles").select("department").not("department", "is", null);
    if (data) setDepartments([...new Set(data.map(d => d.department).filter(Boolean))] as string[]);
  };

  const fetchLeaveRequests = async () => {
    if (!dateRange?.from) return;
    const startDateStr = dateRange.from.toISOString();
    const endDateStr = (dateRange.to || dateRange.from).toISOString();
    const { data: karyawanRoles } = await supabase.from("user_roles").select("user_id").in("role", ABSENSI_WAJIB_ROLE);
    const karyawanUserIds = new Set(karyawanRoles?.map(r => r.user_id) || []);
    const { data } = await supabase.from("leave_requests")
      .select("*")
      .lte("start_date", endDateStr)
      .gte("end_date", startDateStr)
      .order("created_at", { ascending: false });

    if (data) {
      const karyawanRequests = data.filter(req => karyawanUserIds.has(req.user_id));
      const requestsWithProfiles = await Promise.all(
        karyawanRequests.map(async (request) => {
          const { data: profile } = await supabase.from("profiles").select("full_name, department").eq("user_id", request.user_id).maybeSingle();
          return { ...request, profile };
        })
      );
      setLeaveRequests(requestsWithProfiles);
    }
  };

  const calculateLateMinutes = (clockIn: string): number => {
    try {
      // Need to handle ISO string "2024-02-10T08:15:00+07:00"
      const clockInDate = new Date(clockIn);
      if (isNaN(clockInDate.getTime())) return 0;

      const clockInHour = clockInDate.getHours();
      const clockInMinute = clockInDate.getMinutes();
      const clockInTotalMinutes = clockInHour * 60 + clockInMinute;

      const [limitHour, limitMinute] = (settings.clockInStart || "08:00").split(":").map(Number);
      const limitTotalMinutes = limitHour * 60 + limitMinute;

      const diff = clockInTotalMinutes - limitTotalMinutes;
      return diff > 0 ? diff : 0;
    } catch (e) {
      console.error("Error calculating late minutes:", e);
      return 0;
    }
  };

  const fetchEmployeeReports = async () => {
    setIsLoading(true);

    if (!dateRange?.from) {
      setIsLoading(false);
      return;
    }

    const startDate = format(dateRange.from, 'yyyy-MM-dd');
    const endDate = format(dateRange.to || dateRange.from, 'yyyy-MM-dd');

    try {
      // 1. Fetch All Profiles & Roles to ensure everyone is listed
      const { data: roles } = await supabase.from("user_roles").select("user_id").in("role", ABSENSI_WAJIB_ROLE);

      const { data: allProfiles, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, full_name, department, position, created_at")
        .order("full_name");

      if (profileError) throw profileError;

      // Filter candidates: if roles exist, strictly filter. If no roles found (edge case), show all profiles.
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

      // 2. Fetch All Attendance
      const startStr = format(dateRange.from, 'yyyy-MM-dd');
      const endStr = format(dateRange.to || dateRange.from, 'yyyy-MM-dd');

      const { data: rangeAtt, error: attendanceError } = await supabase
        .from("attendance")
        .select("*")
        .gte("date", startStr)
        .lte("date", endStr);
      if (attendanceError) throw attendanceError;
      const allAttendance = rangeAtt;

      // 3. Fetch All Leaves
      const { data: allLeaves, error: leavesError } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("status", "approved")
        .lte("start_date", endDate)
        .gte("end_date", startDate);

      if (leavesError) throw leavesError;

      // 4. Map over ALL candidates to ensure no one is missing, using generateAttendancePeriod for accuracy
      const reports: EmployeeReport[] = candidates.map((emp) => {
        const empAttendance = allAttendance?.filter(a => a.user_id === emp.user_id) || [];
        const empLeaves = allLeaves?.filter(l => l.user_id === emp.user_id) || [];

        const details = generateAttendancePeriod(
          dateRange.from!,
          dateRange.to || dateRange.from!,
          empAttendance,
          empLeaves,
          emp.created_at
        );

        let totalLateMinutes = 0;
        let calcPresent = 0;
        let calcLate = 0;
        let calcAbsent = 0;
        let calcLeave = 0;

        details.forEach(det => {
          if (det.status === 'late' && det.clockIn) {
            totalLateMinutes += calculateLateMinutes(det.clockIn);
          }
          if (['present', 'early_leave'].includes(det.status)) calcPresent++;
          if (det.status === 'late') calcLate++;
          if (['absent', 'alpha'].includes(det.status)) calcAbsent++;
          if (['leave', 'permission', 'sick'].includes(det.status)) calcLeave++;
        });

        let remarks = "Kehadiran baik";
        if (calcAbsent > 2) remarks = "Perlu evaluasi kehadiran (Alpha > 2)";
        else if (calcLate > 4) remarks = "Sering terlambat";

        return {
          user_id: emp.user_id,
          full_name: emp.full_name,
          department: emp.department,
          position: emp.position || "Staf",
          present: calcPresent,
          late: calcLate,
          absent: calcAbsent,
          leave: calcLeave,
          details: details,
          remarks: remarks,
          lateMinutes: totalLateMinutes,
          absentDates: details.filter(x => ['absent', 'alpha'].includes(x.status)).map(x => x.date),
          lateDates: details.filter(x => x.status === 'late').map(x => x.date),
          leaveDates: details.filter(x => ['leave', 'permission', 'sick'].includes(x.status)).map(x => x.date),
          dailyStatus: details.reduce((acc, curr) => {
            let code = '-';
            if (curr.status === 'present') code = 'H';
            else if (curr.status === 'late') code = 'T';
            else if (curr.status === 'absent' || curr.status === 'alpha') code = 'A';
            else if (curr.status === 'leave') code = 'C';
            else if (curr.status === 'permission') code = 'I';
            else if (curr.status === 'sick') code = 'S';
            else if (curr.isWeekend) code = 'L';
            acc[curr.date] = code;
            return acc;
          }, {} as Record<string, string>)
        };
      });

      setEmployeeReports(reports);
    } catch (err) {
      const error = err as Error;
      console.error("Report Error:", error);
      toast({ variant: "destructive", title: "Gagal Memuat Laporan", description: error.message || "Unknown error" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (settingsLoading) return;
    fetchLeaveRequests();
    fetchDepartments();
    fetchEmployeeReports();
  }, [dateRange, settingsLoading]);

  // Realtime Subscriptions (Separate Effect to prevent re-subscribing on data updates)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleRealtimeUpdate = () => {
      // Simple debounce: wait 1000ms after last event before refetching
      // This prevents UI freeze during bulk inserts/updates
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        fetchLeaveRequests();
        fetchEmployeeReports();
      }, 1000);
    };

    const channelA = supabase.channel("leave-changes-report")
      .on("postgres_changes", { event: "*", schema: "public", table: "leave_requests" }, handleRealtimeUpdate)
      .subscribe();

    const channelB = supabase.channel("attendance-report-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, handleRealtimeUpdate)
      .subscribe();

    return () => {
      clearTimeout(timeoutId);
      supabase.removeChannel(channelA);
      supabase.removeChannel(channelB);
    };
  }, []);

  const filteredReports = employeeReports.filter((emp) => {
    const matchesSearch = emp.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.position?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = filterDepartment === "all" || emp.department === filterDepartment;
    return matchesSearch && matchesDept;
  });

  const summaryStats = useMemo(() => {
    const totalEmployees = employeeReports.length;

    return {
      totalEmployees,
      totalPresent: employeeReports.reduce((sum, e) => sum + e.present, 0) + employeeReports.reduce((sum, e) => sum + e.late, 0),
      totalAbsent: employeeReports.reduce((sum, e) => sum + e.absent, 0),
      totalLate: employeeReports.reduce((sum, e) => sum + e.late, 0),
      totalLateMinutes: employeeReports.reduce((sum, e) => sum + e.lateMinutes, 0),
      totalLeave: employeeReports.reduce((sum, e) => sum + e.leave, 0),
      waitingCheckIn: Math.max(0, employeeReports.length - (employeeReports.reduce((sum, e) => sum + (e.present > 0 ? 1 : 0), 0))) // Approx check
    };
  }, [employeeReports]);

  const dailyTrendData = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return [];
    const dataMap: Record<string, { date: string, hadir: number, terlambat: number, izin: number, absen: number }> = {};

    let curr = new Date(dateRange.from);
    while (curr <= dateRange.to) {
      const dateStr = format(curr, 'yyyy-MM-dd');
      dataMap[dateStr] = { date: format(curr, 'dd MMM'), hadir: 0, terlambat: 0, izin: 0, absen: 0 };
      curr = new Date(curr.getTime() + 86400000);
    }

    employeeReports.forEach(emp => {
      emp.details.forEach(d => {
        const dateKey = d.date; // yyyy-MM-dd
        if (dataMap[dateKey]) {
          if (d.status === 'present' || d.status === 'early_leave') dataMap[dateKey].hadir++;
          else if (d.status === 'late') dataMap[dateKey].terlambat++;
          else if (d.status === 'leave' || d.status === 'sick' || d.status === 'permission') dataMap[dateKey].izin++;
          else if (d.status === 'absent' || d.status === 'alpha') dataMap[dateKey].absen++;
        }
      });
    });

    return Object.values(dataMap);
  }, [employeeReports, dateRange]);

  const handleApprove = async (request: LeaveRequest) => {
    const { error } = await supabase.from("leave_requests").update({ status: "approved", approved_by: user?.id, approved_at: new Date().toISOString() }).eq("id", request.id);
    if (error) toast({ variant: "destructive", title: "Gagal", description: error.message });
    else { toast({ title: "Berhasil", description: "Pengajuan cuti disetujui" }); fetchLeaveRequests(); fetchEmployeeReports(); }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    const { error } = await supabase.from("leave_requests").update({ status: "rejected", approved_by: user?.id, approved_at: new Date().toISOString(), rejection_reason: rejectionReason }).eq("id", selectedRequest.id);
    if (error) toast({ variant: "destructive", title: "Gagal", description: error.message });
    else { toast({ title: "Berhasil", description: "Pengajuan cuti ditolak" }); setDialogOpen(false); setSelectedRequest(null); setRejectionReason(""); fetchLeaveRequests(); }
  };

  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const buildExportData = (): AttendanceReportData => ({
    period: dateRange?.from ? `${format(dateRange.from, 'd MMM yyyy')} - ${format(dateRange.to || dateRange.from, 'd MMM yyyy')}` : "Periode Custom",
    periodStart: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : "",
    periodEnd: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : "",
    totalEmployees: filteredReports.length,
    totalPresent: summaryStats.totalPresent,
    totalAbsent: summaryStats.totalAbsent,
    totalLate: summaryStats.totalLate,
    totalLeave: summaryStats.totalLeave,
    employees: filteredReports.map(emp => ({ ...emp, name: emp.full_name || '-' })),
    leaveRequests: leaveRequests.filter(r => r.status === "approved").map(req => ({
      name: req.profile?.full_name || "-",
      department: req.profile?.department || "-",
      type: req.leave_type,
      startDate: new Date(req.start_date).toLocaleDateString("id-ID"),
      endDate: new Date(req.end_date).toLocaleDateString("id-ID"),
      days: 1,
      status: "Disetujui"
    }))
  });

  const openExportSettings = () => {
    const currentPeriodVal = dateRange?.from && dateRange?.to ? `${format(dateRange.from, 'yyyy-MM-dd')}_${format(dateRange.to, 'yyyy-MM-dd')}` : "custom";
    const exists = availablePeriods.some(p => p.value === currentPeriodVal);
    setExportPeriodVal(exists ? currentPeriodVal : availablePeriods[0]?.value || "");
    setExportFormat("excel");
    setExportModalOpen(true);
  };

  const executeExport = async () => {
    if (!exportPeriodVal || exportPeriodVal === "custom") {
      toast({ variant: "destructive", title: "Gagal", description: "Pilih periode terlebih dahulu" });
      return;
    }

    const [startD, endD] = exportPeriodVal.split("_");
    // Get the accurate label from availablePeriods to avoid timezone shifts
    const selectedPeriodInfo = availablePeriods.find(p => p.value === exportPeriodVal);
    const periodStr = selectedPeriodInfo ? selectedPeriodInfo.label : format(new Date(`${startD}T12:00:00`), 'MMMM yyyy', { locale: id });

    if (exportFormat === "excel") {
      setIsExportingExcel(true);
      try {
        // Build dataset matching EXACTLY with the UI screen data
        const summaries = filteredReports.map(emp => {
          const totalWorkHours = emp.details.reduce((sum, d) => {
            if (!d.clockIn || !d.clockOut) return sum;
            const [ih, im] = d.clockIn.split(':').map(Number);
            const [oh, om] = d.clockOut.split(':').map(Number);
            const diffMins = (oh * 60 + om) - (ih * 60 + im);
            return diffMins > 0 ? sum + (diffMins / 60) : sum;
          }, 0);

          return {
            employeeName: emp.full_name || 'Unknown',
            department: emp.department || '-',
            totalPresent: emp.present,
            totalLate: emp.late,
            totalAbsent: emp.absent,
            totalLeave: emp.leave,
            totalMonthlyWorkHours: totalWorkHours,
            totalMonthlyOvertimeMins: 0
          };
        });

        const details = filteredReports.flatMap(emp =>
          emp.details.map(d => {
            let ExcelStatus = '-';
            if (['leave', 'sick', 'permission'].includes(d.status)) ExcelStatus = 'Cuti';
            else if (['absent', 'alpha'].includes(d.status)) ExcelStatus = 'Alpha';
            else if (d.status === 'late') ExcelStatus = 'Terlambat';
            else if (d.status === 'present' || d.status === 'early_leave') ExcelStatus = 'Hadir';

            if (d.isWeekend && !d.clockIn) ExcelStatus = 'Libur';

            let workHours = 0;
            if (d.clockIn && d.clockOut) {
              const [ih, im] = d.clockIn.split(':').map(Number);
              const [oh, om] = d.clockOut.split(':').map(Number);
              const diffMins = (oh * 60 + om) - (ih * 60 + im);
              workHours = diffMins > 0 ? diffMins / 60 : 0;
            }

            let lateMins = 0;
            if (d.status === 'late' && d.clockIn) {
              const [ih, im] = d.clockIn.split(':').map(Number);
              lateMins = Math.max(0, (ih * 60 + im) - (8 * 60 + 0));
            }

            return {
              employeeName: emp.full_name || 'Unknown',
              department: emp.department || '-',
              date: d.formattedDate,
              clockIn: d.clockIn || '-',
              clockOut: d.clockOut || '-',
              shift: 'Reguler 08:00 - 17:00',
              status: ExcelStatus as any,
              totalWorkHours: workHours,
              totalLateMins: lateMins,
              earlyLeaveMins: 0,
              overtimeMins: 0,
              device: 'Sistem' // General label for device
            };
          })
        );

        await generateAttendanceExcel({
          month: periodStr,
          companyName: 'PT. TALENTA TRAINCOM INDONESIA',
          summaries,
          details
        });

        toast({ title: "Berhasil", description: "Laporan Excel sinkron UI berhasil diunduh" });
        setExportModalOpen(false);
      } catch (error: any) {
        toast({ variant: "destructive", title: "Gagal", description: error.message || "Gagal mengunduh laporan Excel" });
      } finally {
        setIsExportingExcel(false);
      }
    } else if (exportFormat === "pdf_hr") {
      exportAttendanceHRPDF(buildExportData(), `laporan-hr-${format(new Date(), 'yyyy-MM-dd')}`);
      toast({ title: "Berhasil", description: "PDF HR diunduh" });
      setExportModalOpen(false);
    } else if (exportFormat === "pdf_manajemen") {
      exportAttendanceManagementPDF(buildExportData(), `laporan-manajemen-${format(new Date(), 'yyyy-MM-dd')}`);
      toast({ title: "Berhasil", description: "PDF Manajemen diunduh" });
      setExportModalOpen(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const pill = (bg: string, text: string, dot: string, label: string) => (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${bg} ${text}`}>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
        {label}
      </span>
    );
    if (status === "approved") return pill("bg-emerald-50 border-emerald-200", "text-emerald-700", "bg-emerald-500", "Disetujui");
    if (status === "rejected") return pill("bg-red-50 border-red-200", "text-red-700", "bg-red-500", "Ditolak");
    return pill("bg-amber-50 border-amber-200", "text-amber-700", "bg-amber-500", "Menunggu");
  };

  const getLeaveTypeLabel = (type: string) => type === "cuti" ? "Cuti Tahunan" : type === "sakit" ? "Sakit" : type === "izin" ? "Izin" : type;

  const customExportNode = (
    <Popover open={exportModalOpen} onOpenChange={setExportModalOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          className="h-9 gap-2 text-white shadow-sm bg-gradient-to-r from-blue-700 to-sky-600 hover:to-sky-700 flex border border-blue-600/50"
          onClick={() => {
            const currentPeriodVal = dateRange?.from && dateRange?.to ? `${format(dateRange.from, 'yyyy-MM-dd')}_${format(dateRange.to, 'yyyy-MM-dd')}` : "custom";
            const exists = availablePeriods.some(p => p.value === currentPeriodVal);
            setExportPeriodVal(exists ? currentPeriodVal : availablePeriods[0]?.value || "");
            setExportFormat("excel");
          }}
        >
          {isExportingExcel || isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {isExportingExcel || isLoading ? "Mengekspor..." : "Export Laporan"}
          <ChevronDown className="h-4 w-4 opacity-70 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[280px] p-4 bg-white dark:bg-slate-900 rounded-xl shadow-xl border-slate-100 dark:border-slate-800 z-[100]">
        <div className="space-y-4">
          <div className="space-y-1">
            <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100">Cetak Laporan</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">Pilih format laporan dan sinkronkan dengan periode yang Anda inginkan.</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">Pilih Format</label>
            <select
              className="flex h-9 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-600 outline-none"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
            >
              <option value="excel">Microsoft Excel (.xlsx)</option>
              <option value="pdf_hr">PDF - Rekap HR</option>
              <option value="pdf_manajemen">PDF - Manajemen</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">Periode Target</label>
            <select
              className="flex h-9 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-600 outline-none"
              value={exportPeriodVal}
              onChange={(e) => setExportPeriodVal(e.target.value)}
            >
              <option value="" disabled>Pilih Bulan</option>
              {availablePeriods.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <Button
            onClick={executeExport}
            disabled={isExportingExcel || !exportPeriodVal}
            className="w-full h-9 bg-blue-700 hover:bg-blue-800 text-white shadow-sm mt-2"
          >
            {isExportingExcel ? (
              <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Sedang Proses...</>
            ) : (
              <><Download className="h-4 w-4 mr-2" /> Download Laporan</>
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <EnterpriseLayout
      title="Laporan & Rekapitulasi Absensi"
      subtitle="Professional attendance reporting and analytics"
      menuSections={MANAGER_MENU_SECTIONS}
      roleLabel="Manager"
      customExportNode={customExportNode}
      breadcrumbs={[
        { label: "Manager", href: "/manager" },
        { label: "Laporan" },
      ]}
    >
      <div className="space-y-6 pb-20">

        {/* 1. Filter Bar for Period Selection */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 text-blue-600 p-2 rounded-xl">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Filter Tanggal & Bulan</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Laporan akan dimuat ulang sesuai periode yang Anda pilih</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Select
              value={exportPeriodVal}
              onValueChange={(val) => {
                setExportPeriodVal(val);
                handlePeriodChange(val);
              }}
            >
              <SelectTrigger className="w-full sm:w-[220px] h-10 font-bold bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl focus:ring-blue-500">
                <SelectValue placeholder="Pilih Periode/Bulan" />
              </SelectTrigger>
              <SelectContent>
                {availablePeriods.map((p, idx) => (
                  <SelectItem key={p.value} value={p.value} className={idx === 0 ? "font-semibold text-blue-700" : ""}>
                    {idx === 0 ? `📌 Bulan Ini (${p.label})` : idx === 1 ? `⏳ Bulan Lalu (${p.label})` : p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 1. Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Hadir Hari Ini / Total Kehadiran */}
          <Card className="border-slate-200/60 dark:border-slate-700/60 shadow-sm bg-white dark:bg-slate-900 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 rounded-2xl relative overflow-hidden group">
            <CardContent className="p-5 relative z-10">
              <div className="flex justify-between items-start mb-4">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">HADIR (Periode Ini)</div>
                <div className="h-8 w-8 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <UserCheck className="h-5 w-5" />
                </div>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{summaryStats.totalPresent}</span>
                <span className="text-sm text-slate-400 font-medium">/ {(dateRange?.to && dateRange?.from) ? Math.round(differenceInMinutes(dateRange.to, dateRange.from) / 1440 * summaryStats.totalEmployees) : '-'} Total</span>
              </div>
              <Progress value={75} className="h-1.5 bg-slate-100 dark:bg-slate-800/80" indicatorClassName="bg-blue-600" />
              <div className="flex justify-end mt-2 text-xs font-bold text-blue-600">
                92%
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Terlambat */}
          <Card className="border-slate-200/60 dark:border-slate-700/60 shadow-sm bg-white dark:bg-slate-900 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Timer className="h-24 w-24 text-amber-500" />
            </div>
            <CardContent className="p-5 relative z-10">
              <div className="flex justify-between items-start mb-4">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">TERLAMBAT</div>
                <div className="h-8 w-8 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Clock className="h-5 w-5" />
                </div>
              </div>
              <div className="flex items-baseline gap-3 mb-1">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{summaryStats.totalLate}</span>
                <Badge variant="secondary" className="bg-amber-50 dark:bg-amber-900/30 text-amber-600 hover:bg-amber-50 text-[10px] px-1.5 py-0 h-5">
                  <TrendingUp className="h-3 w-3 mr-1" /> +2
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Karyawan terlambat hadir</p>
              <div className="mt-3 inline-flex items-center text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded-md">
                Rata-rata {summaryStats.totalLate > 0 ? (summaryStats.totalLateMinutes / summaryStats.totalLate).toFixed(0) : 0} mnt / terlambat
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Izin / Sakit */}
          <Card className="border-slate-200/60 dark:border-slate-700/60 shadow-sm bg-white dark:bg-slate-900 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <FileText className="h-24 w-24 text-purple-500" />
            </div>
            <CardContent className="p-5 relative z-10">
              <div className="flex justify-between items-start mb-4">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">IZIN / SAKIT</div>
                <div className="h-8 w-8 rounded-full bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <FileText className="h-5 w-5" />
                </div>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{summaryStats.totalLeave}</span>
                <span className="text-sm text-slate-400 font-medium">Staf</span>
              </div>
              <div className="flex gap-2 mt-2">
                <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100 border-none">Sakit</Badge>
                <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 border-none">Izin</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Belum Absen */}
          <Card className="border-slate-200/60 dark:border-slate-700/60 shadow-sm bg-white dark:bg-slate-900 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <UserX className="h-24 w-24 text-red-500" />
            </div>
            <CardContent className="p-5 relative z-10">
              <div className="flex justify-between items-start mb-4">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">BELUM ABSEN</div>
                <div className="h-8 w-8 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
                  <UserX className="h-5 w-5" />
                </div>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{summaryStats.waitingCheckIn}</span>
                <span className="text-sm text-slate-400 font-medium">Staf</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Menunggu absensi masuk...</p>
            </CardContent>
          </Card>
        </div>

        {/* Trend Kehadiran Chart */}
        <Card className="border-slate-200/60 dark:border-slate-700/60 shadow-sm bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
          <CardContent className="p-5">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Tren Kehadiran Harian</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Visualisasi data absensi harian pada periode terpilih</p>
              </div>
              <div className="flex gap-4 text-xs font-semibold">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Hadir</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Terlambat</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400"></span> Alpha</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span> Cuti/Sakit</span>
              </div>
            </div>
            <div className="w-full h-[220px]">
              {dailyTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorHadir" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorTerlambat" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorIzin" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px', fontWeight: 600 }}
                      itemStyle={{ fontWeight: 700 }}
                    />
                    <Area type="monotone" dataKey="hadir" stackId="1" stroke="#10b981" strokeWidth={2} fill="url(#colorHadir)" />
                    <Area type="monotone" dataKey="terlambat" stackId="2" stroke="#f59e0b" strokeWidth={2} fill="url(#colorTerlambat)" />
                    <Area type="monotone" dataKey="izin" stackId="3" stroke="#a855f7" strokeWidth={2} fill="url(#colorIzin)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                  <BarChart3 className="w-10 h-10 mb-2 opacity-20" />
                  <span className="text-xs">Data tren belum tersedia</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 2. Main Content Card */}
        <Card className="border-slate-200/60 dark:border-slate-700/60 shadow-sm bg-white dark:bg-slate-900 rounded-2xl overflow-hidden min-h-[500px]">
          <div className="border-b border-slate-100 dark:border-slate-800 p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">Kehadiran Karyawan</h3>
              <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-700 border-blue-200">
                {filteredReports.length} Staff
              </Badge>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Filter className="h-4 w-4" />
                <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                  <SelectTrigger className="h-9 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:bg-slate-800 w-[180px]">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Departemen</SelectItem>
                    {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <CardContent className="p-0">
            {isLoading ? (
              <SkeletonTable />
            ) : filteredReports.length === 0 ? (
              <EmptyState title="Data Tidak Ditemukan" description="Coba sesuaikan filter atau rentang tanggal Anda." icon={Filter} />
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-50/50 dark:bg-slate-800/50">
                        <TableHead className="w-12 py-4 font-semibold text-xs uppercase text-slate-500 dark:text-slate-400 pl-4">No</TableHead>
                        <TableHead className="py-4 font-semibold text-xs uppercase text-slate-500 dark:text-slate-400">Detail Karyawan</TableHead>
                        <TableHead className="py-4 font-semibold text-xs uppercase text-slate-500 dark:text-slate-400 text-center">Total Hadir</TableHead>
                        <TableHead className="py-4 font-semibold text-xs uppercase text-slate-500 dark:text-slate-400 text-center">Terlambat (Menit)</TableHead>
                        <TableHead className="py-4 font-semibold text-xs uppercase text-slate-500 dark:text-slate-400 text-center">Status Cuti / Izin</TableHead>
                        <TableHead className="py-4 font-semibold text-xs uppercase text-slate-500 dark:text-slate-400 text-right pr-6">Tingkat Kehadiran</TableHead>
                        <TableHead className="py-4 font-semibold text-xs uppercase text-slate-500 dark:text-slate-400 text-center">Detail</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReports.map((emp, index) => {
                        const totalDays = emp.present + emp.late + emp.absent + emp.leave;
                        const attendancePercent = totalDays > 0 ? Math.round(((emp.present + emp.late) / totalDays) * 100) : 0;

                        // Badges logic for Leave/Permit
                        const sickCount = emp.details.filter(d => d.status === 'sick').length;
                        const permitCount = emp.details.filter(d => d.status === 'permission').length;
                        const leaveCount = emp.details.filter(d => d.status === 'leave').length;

                        return (
                          <TableRow key={emp.user_id} className="hover:bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800 transition-colors">
                            <TableCell className="text-slate-500 dark:text-slate-400 text-xs font-medium pl-4">{index + 1}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9 border border-slate-200 dark:border-slate-700">
                                  <AvatarImage src="" />
                                  <AvatarFallback className={cn(
                                    "text-xs font-bold",
                                    ['A', 'C', 'E'].includes(emp.full_name?.charAt(0) || '') ? "bg-blue-100 text-blue-600" :
                                      ['B', 'D', 'F'].includes(emp.full_name?.charAt(0) || '') ? "bg-amber-100 text-amber-600" :
                                        ['G', 'H', 'I'].includes(emp.full_name?.charAt(0) || '') ? "bg-purple-100 text-purple-600" : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300"
                                  )}>
                                    {emp.full_name?.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-semibold text-slate-900 dark:text-white text-sm">{emp.full_name}</div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400">{emp.department} • {emp.position || "Staff"}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-bold text-slate-900 dark:text-white">
                              <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800 font-mono text-base px-3 py-1">
                                {emp.present + emp.late}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {emp.lateMinutes > 0 ? (
                                <div className="inline-flex items-center gap-1 font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded text-xs">
                                  <Clock className="w-3 h-3" /> {emp.lateMinutes}m
                                </div>
                              ) : (
                                <span className="text-slate-400 text-xs">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex justify-center gap-1 flex-wrap">
                                {sickCount > 0 && <Badge variant="secondary" className="bg-purple-50 text-purple-600 border-purple-100">{sickCount} Sakit</Badge>}
                                {permitCount > 0 && <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-blue-100">{permitCount} Izin</Badge>}
                                {leaveCount > 0 && <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700">{leaveCount} Cuti</Badge>}
                                {sickCount === 0 && permitCount === 0 && leaveCount === 0 && <span className="text-slate-300 text-xs">-</span>}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-3 w-full pr-6 ml-auto">
                                <div className="flex flex-col items-end">
                                  <span className={cn(
                                    "text-sm font-bold",
                                    attendancePercent >= 90 ? "text-emerald-600" :
                                      attendancePercent >= 75 ? "text-blue-600" :
                                        attendancePercent >= 50 ? "text-amber-600" : "text-red-600"
                                  )}>{attendancePercent}%</span>
                                </div>
                                <div className="h-1.5 w-16 bg-slate-100 dark:bg-slate-800/80 rounded-full overflow-hidden">
                                  <div
                                    className={cn("h-full rounded-full transition-all",
                                      attendancePercent >= 90 ? "bg-emerald-500" :
                                        attendancePercent >= 75 ? "bg-blue-500" :
                                          attendancePercent >= 50 ? "bg-amber-500" : "bg-red-500"
                                    )}
                                    style={{ width: `${attendancePercent}%` }}
                                  />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Button variant="ghost" size="sm" onClick={() => { setSelectedEmployee(emp); setDetailModalOpen(true); }}>
                                <CalendarIcon className="h-4 w-4 text-blue-600" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Cards View */}
                <div className="md:hidden flex flex-col p-4 gap-4 bg-slate-50/50 dark:bg-slate-800/50">
                  {filteredReports.map((emp, index) => {
                    const totalDays = emp.present + emp.late + emp.absent + emp.leave;
                    const attendancePercent = totalDays > 0 ? Math.round(((emp.present + emp.late) / totalDays) * 100) : 0;

                    const sickCount = emp.details.filter(d => d.status === 'sick').length;
                    const permitCount = emp.details.filter(d => d.status === 'permission').length;
                    const leaveCount = emp.details.filter(d => d.status === 'leave').length;

                    return (
                      <div key={emp.user_id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-4 relative flex flex-col gap-4">
                        <div className="flex items-start justify-between">
                          <div className="flex gap-3">
                            <Avatar className="h-12 w-12 border border-slate-100 dark:border-slate-800 shadow-sm">
                              <AvatarImage src="" />
                              <AvatarFallback className={cn(
                                "text-sm font-bold",
                                ['A', 'C', 'E'].includes(emp.full_name?.charAt(0) || '') ? "bg-blue-100 text-blue-600" :
                                  ['B', 'D', 'F'].includes(emp.full_name?.charAt(0) || '') ? "bg-amber-100 text-amber-600" :
                                    ['G', 'H', 'I'].includes(emp.full_name?.charAt(0) || '') ? "bg-purple-100 text-purple-600" : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300"
                              )}>
                                {emp.full_name?.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h4 className="font-bold text-slate-900 dark:text-white text-sm">{emp.full_name}</h4>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium pb-1">{emp.department} • {emp.position || "Staff"}</p>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {sickCount > 0 && <Badge variant="secondary" className="bg-purple-50 text-purple-600 border-none text-[9px] h-4 leading-none">{sickCount} Sakit</Badge>}
                                {permitCount > 0 && <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-none text-[9px] h-4 leading-none">{permitCount} Izin</Badge>}
                                {leaveCount > 0 && <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-none text-[9px] h-4 leading-none">{leaveCount} Cuti</Badge>}
                                {sickCount === 0 && permitCount === 0 && leaveCount === 0 && <span className="text-slate-300 text-[10px]">-</span>}
                              </div>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedEmployee(emp); setDetailModalOpen(true); }} className="h-8 w-8 p-0 rounded-full hover:bg-blue-50">
                            <CalendarIcon className="h-4 w-4 text-blue-600" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-3 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-50">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Total Hadir</span>
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{emp.present + emp.late} hari</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Keterlambatan</span>
                            {emp.lateMinutes > 0 ? (
                              <span className="text-sm font-semibold text-amber-600 flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {emp.lateMinutes} min
                              </span>
                            ) : (
                              <span className="text-sm font-semibold text-slate-400">-</span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5 pt-1">
                          <div className="flex justify-between items-center text-[10px] font-bold tracking-wider">
                            <span className="text-slate-400">ATTENDANCE RATE</span>
                            <span className={cn(
                              attendancePercent >= 90 ? "text-emerald-600" :
                                attendancePercent >= 75 ? "text-blue-600" :
                                  attendancePercent >= 50 ? "text-amber-600" : "text-red-600"
                            )}>{attendancePercent}%</span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 dark:bg-slate-800/80 rounded-full overflow-hidden">
                            <div
                              className={cn("h-full rounded-full transition-all",
                                attendancePercent >= 90 ? "bg-emerald-500" :
                                  attendancePercent >= 75 ? "bg-blue-500" :
                                    attendancePercent >= 50 ? "bg-amber-500" : "bg-red-500"
                              )}
                              style={{ width: `${attendancePercent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex justify-between items-center">
              <span>Showing <strong>1</strong> to <strong>{Math.min(filteredReports.length, 10)}</strong> of <strong>{filteredReports.length}</strong> entries</span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="h-7 w-auto px-2 text-xs" disabled>Prev</Button>
                <Button variant="default" size="sm" className="h-7 w-7 p-0 text-xs bg-blue-600">1</Button>
                <Button variant="outline" size="sm" className="h-7 w-auto px-2 text-xs" disabled>Next</Button>
              </div>
            </div>
          </CardContent>
        </Card >
      </div >

      {/* DETAIL MODAL */}
      < Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen} >
        <DialogContent className="flex flex-col h-[90vh] max-w-5xl overflow-hidden p-0 gap-0 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="bg-white dark:bg-slate-900 p-6 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
            <DialogHeader className="hidden">
              <DialogTitle>Detail Kehadiran</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              {/* Left: Profile Info */}
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14 border-4 border-white shadow-sm ring-1 ring-slate-100">
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-blue-600 text-white text-xl font-bold">
                    {selectedEmployee?.full_name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">{selectedEmployee?.full_name}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">
                    {selectedEmployee?.department} • {selectedEmployee?.position || "Staf"}
                  </p>
                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <CalendarIcon className="w-3 h-3" />
                    <span>Periode: <b className="text-slate-600 dark:text-slate-300">{dateRange?.from ? format(dateRange.from, 'd MMMM yyyy', { locale: id }) : '-'}</b> s/d <b className="text-slate-600 dark:text-slate-300">{dateRange?.to ? format(dateRange.to, 'd MMMM yyyy', { locale: id }) : '-'}</b></span>
                  </div>
                </div>
              </div>

              {/* Center: View Toggle */}
              <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg">
                <button
                  onClick={() => setViewMode('list')}
                  className={cn("px-4 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-2", viewMode === 'list' ? "bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white")}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Harian
                </button>
                <button
                  onClick={() => setViewMode('calendar')}
                  className={cn("px-4 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-2", viewMode === 'calendar' ? "bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white")}
                >
                  <CalendarIcon className="w-3.5 h-3.5" />
                  Bulanan
                </button>
              </div>

              {/* Right: Stats Cards */}
              <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                <div className="flex flex-col items-center justify-center min-w-[80px] bg-emerald-50/80 border border-emerald-100 rounded-xl py-2 px-3">
                  <span className="text-2xl font-bold text-emerald-600 leading-none">{selectedEmployee?.present}</span>
                  <span className="text-[10px] font-bold text-emerald-600/60 uppercase mt-1">Hadir</span>
                </div>
                <div className="flex flex-col items-center justify-center min-w-[80px] bg-amber-50/80 border border-amber-100 rounded-xl py-2 px-3">
                  <span className="text-2xl font-bold text-amber-600 leading-none">{selectedEmployee?.late}</span>
                  <span className="text-[10px] font-bold text-amber-600/60 uppercase mt-1">Terlambat</span>
                </div>
                <div className="flex flex-col items-center justify-center min-w-[80px] bg-red-50/80 border border-red-100 rounded-xl py-2 px-3">
                  <span className="text-2xl font-bold text-red-600 leading-none">{selectedEmployee?.absent}</span>
                  <span className="text-[10px] font-bold text-red-600/60 uppercase mt-1">Alpha</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-50/30 p-0">
            {selectedEmployee && (
              viewMode === 'list' ? (
                <AttendanceHistoryTable
                  data={selectedEmployee.details}
                  isLoading={isLoading}
                />
              ) : (
                <AttendanceCalendarView
                  data={selectedEmployee.details}
                  currentMonth={dateRange?.from || new Date()}
                />
              )
            )}
          </div>
        </DialogContent>
      </Dialog >

    </EnterpriseLayout >
  );
};

export default ManagerLaporan;
