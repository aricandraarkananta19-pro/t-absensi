
import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import {
    ArrowLeft, FileText, Calendar as CalendarIcon, CheckCircle2, XCircle, Clock, Search, Users,
    Download, BarChart3, RefreshCw, FileSpreadsheet,
    AlertTriangle, CalendarDays, ChevronDown, Home, ChevronRightIcon,
    TrendingUp, UserCheck, UserX, Timer, Filter, LayoutGrid, LogIn, LogOut,
    Briefcase, MoreHorizontal, Printer
} from "lucide-react";
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
import { ADMIN_MENU_SECTIONS } from "@/config/menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Talenta Brand Colors
const BRAND_COLORS = {
    blue: "#1A5BA8",
    lightBlue: "#00A0E3",
    green: "#7DC242",
};

// =============== SKELETON LOADER COMPONENT ===============
const SkeletonCard = () => (
    <Card className="border-slate-200 w-full bg-white shadow-sm">
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
    <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
        <div className="bg-slate-50 py-3 px-4 border-b">
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
        <div className="h-20 w-20 rounded-2xl bg-slate-50 flex items-center justify-center mb-6 border border-slate-200">
            <Icon className="h-10 w-10 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-500 text-center max-w-sm">{description}</p>
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

const LaporanKehadiran = () => {
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
    const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
        const fromParam = searchParams.get("from");
        const toParam = searchParams.get("to");
        if (fromParam && toParam) {
            return { from: new Date(fromParam), to: new Date(toParam) };
        }
        return undefined; // Will be set by effect
    });

    // Modals
    const [dialogOpen, setDialogOpen] = useState(false); // Reject Reason Modal
    const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
    const [rejectionReason, setRejectionReason] = useState("");

    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<EmployeeReport | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

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
        const cutoffDay = settings?.attendanceStartDate ? parseInt(settings.attendanceStartDate.split('-')[2]) : 1;
        const isStandard = cutoffDay === 1;

        for (let i = 0; i < 12; i++) {
            const date = subMonths(today, i);
            const monthName = format(date, "MMMM yyyy", { locale: id });

            let from: Date, to: Date;

            if (isStandard) {
                from = startOfDay(startOfMonth(date));
                to = endOfDay(endOfMonth(date));
            } else {
                const endOfPeriod = setDate(date, cutoffDay - 1);
                const startOfPeriod = setDate(subMonths(date, 1), cutoffDay);
                from = startOfDay(startOfPeriod);
                to = endOfDay(endOfPeriod);
            }

            periods.push({
                label: monthName,
                value: `${format(from, "yyyy-MM-dd")}_${format(to, "yyyy-MM-dd")}`,
                from,
                to
            });
        }
        return periods;
    }, [settings?.attendanceStartDate]);

    const handlePeriodChange = (val: string) => {
        if (val === "custom") return;
        const [startStr, endStr] = val.split("_");
        const newRange = { from: new Date(startStr), to: new Date(endStr) };
        handleDateRangeChange(newRange);
    };

    useEffect(() => {
        if (dateRange?.from && dateRange?.to) return;

        if (!settingsLoading && settings?.attendanceStartDate) {
            const hasUrlParams = searchParams.get("from") && searchParams.get("to");
            if (!hasUrlParams) {
                const activeStart = new Date(settings.attendanceStartDate);
                if (activeStart.toString() === 'Invalid Date') return;
                const activeEnd = subDays(addMonths(activeStart, 1), 1);
                const newRange = { from: activeStart, to: activeEnd };
                setDateRange(newRange);
                const newParams = new URLSearchParams(searchParams);
                newParams.set("from", format(activeStart, "yyyy-MM-dd"));
                newParams.set("to", format(activeEnd, "yyyy-MM-dd"));
                setSearchParams(newParams, { replace: true });
            }
        } else if (!settingsLoading && !settings?.attendanceStartDate && !dateRange) {
            const now = new Date();
            setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
        }
    }, [settingsLoading, settings?.attendanceStartDate, searchParams, dateRange]);

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
                .select("user_id, full_name, department, position")
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

            // 2. Fetch Attendance Report Data (RPC)
            const { data, error } = await supabase.rpc('get_attendance_report', {
                p_start_date: startDate,
                p_end_date: endDate,
                p_department: 'all'
            });

            if (error) throw error;

            // Debugging for Elia
            if (data) {
                const elia = (data as AttendanceReportRpcResponse[]).find(d => d.full_name?.toLowerCase().includes('elia'));
                if (elia) {
                    console.log("DEBUG ELIA:", elia);
                    console.log("DEBUG ELIA DETAILS:", elia.details);
                }
            }

            // 3. Merge Data (Candidates + RPC Result)
            const rpcMap = new Map((data as AttendanceReportRpcResponse[] || []).map(d => [d.user_id, d]));

            // Map over ALL candidates to ensure no one is missing
            const reports: EmployeeReport[] = candidates.map((emp) => {
                const d = rpcMap.get(emp.user_id);

                if (d) {
                    let remarks = "Kehadiran baik";
                    const absentCount = Number(d.absent);
                    const lateCount = Number(d.late);
                    if (absentCount > 2) remarks = "Perlu evaluasi kehadiran (Alpha > 2)";
                    else if (lateCount > 4) remarks = "Sering terlambat";

                    let totalLateMinutes = 0;

                    // Recalculate counts from details to ensure accuracy and mutual exclusivity
                    let calcPresent = 0;
                    let calcLate = 0;
                    let calcAbsent = 0;
                    let calcLeave = 0;

                    const details: DailyAttendanceStatus[] = (d.details || []).map((det) => {
                        // Calculate Late Mins per Day
                        if (det.status === 'late' && det.clockIn) {
                            totalLateMinutes += calculateLateMinutes(det.clockIn);
                        }

                        // Count statuses (Exclusive logic: Late counts ONLY as Late, not Present)
                        if (['present', 'early_leave'].includes(det.status)) calcPresent++;

                        // Track specific negative statuses separately
                        if (det.status === 'late') calcLate++;

                        if (['absent', 'alpha'].includes(det.status)) calcAbsent++;
                        else if (['leave', 'permission', 'sick'].includes(det.status)) calcLeave++;

                        return {
                            date: det.date,
                            formattedDate: format(new Date(det.date), 'd MMMM yyyy', { locale: id }),
                            dayName: format(new Date(det.date), 'EEEE', { locale: id }),
                            status: det.status,
                            clockIn: det.clockIn,
                            clockOut: det.clockOut,
                            recordId: null,
                            notes: det.notes,
                            isWeekend: det.isWeekend
                        };
                    });

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
                }

                // If no usage data, return Empty Employee Record
                return {
                    user_id: emp.user_id,
                    full_name: emp.full_name,
                    department: emp.department,
                    position: emp.position || "Staf",
                    present: 0,
                    late: 0,
                    absent: 0, // Could be total working days if we wanted strict correctness
                    leave: 0,
                    details: [],
                    remarks: "Belum ada data",
                    lateMinutes: 0,
                    absentDates: [],
                    lateDates: [],
                    leaveDates: [],
                    dailyStatus: {}
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
        const totalPresent = employeeReports.reduce((sum, e) => sum + (isToday(new Date()) ? e.present > 0 ? 1 : 0 : e.present), 0); // Simplified for "Today" Card logic if needed, but here stick to period totals

        // For "Hadir Hari Ini" Card specifically, we need today's present count.
        // But since this is a REPORT over a PERIOD, "Hadir Hari Ini" might be misleading if period is last month.
        // However, the DESIGN usually implies specific context.
        // I'll calculate totals for the PERIOD, but title them appropriately.
        // "Hadir Hari Ini" implies Today.
        // If the user selected a past period, maybe show "Total Hadir (Periode)".
        // I will stick to "Total Kehadiran" to be safe for any period.

        return {
            totalEmployees,
            totalPresent: employeeReports.reduce((sum, e) => sum + e.present + e.late, 0),
            totalAbsent: employeeReports.reduce((sum, e) => sum + e.absent, 0),
            totalLate: employeeReports.reduce((sum, e) => sum + e.late, 0),
            totalLateMinutes: employeeReports.reduce((sum, e) => sum + e.lateMinutes, 0),
            totalLeave: employeeReports.reduce((sum, e) => sum + e.leave, 0),
            waitingCheckIn: employeeReports.filter(e => {
                // Determine if 'waiting' status (future/no record today)
                const todayRecord = e.details.find(d => isToday(new Date(d.date)));
                return !todayRecord?.clockIn && !todayRecord?.isWeekend;
            }).length // Approx logic for "Belum Absen" today
        };
    }, [employeeReports]);

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

    const handleExportMultiSheetExcel = () => { exportAttendanceExcel(buildExportData(), `laporan-kehadiran-${format(new Date(), 'yyyy-MM-dd')}`); toast({ title: "Berhasil", description: "Excel diunduh" }); };
    const handleExportHRPDF = () => { exportAttendanceHRPDF(buildExportData(), `laporan-hr-${format(new Date(), 'yyyy-MM-dd')}`); toast({ title: "Berhasil", description: "PDF HR diunduh" }); };
    const handleExportManagementPDF = () => { exportAttendanceManagementPDF(buildExportData(), `laporan-manajemen-${format(new Date(), 'yyyy-MM-dd')}`); toast({ title: "Berhasil", description: "PDF Manajemen diunduh" }); };

    const getStatusBadge = (status: string) => {
        if (status === "approved") return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="h-3 w-3 mr-1" />Disetujui</Badge>;
        if (status === "rejected") return <Badge className="bg-red-100 text-red-700 border-red-200"><XCircle className="h-3 w-3 mr-1" />Ditolak</Badge>;
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200"><Clock className="h-3 w-3 mr-1" />Menunggu</Badge>;
    };

    const getLeaveTypeLabel = (type: string) => type === "cuti" ? "Cuti Tahunan" : type === "sakit" ? "Sakit" : type === "izin" ? "Izin" : type;

    return (
        <EnterpriseLayout
            title="Laporan & Rekapitulasi Absensi"
            subtitle="Professional attendance reporting and analytics"
            menuSections={ADMIN_MENU_SECTIONS}
            roleLabel="Administrator"
            showExport={false}
        >
            <div className="space-y-8 pb-20">
                {/* 1. Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Card 1: Hadir Hari Ini / Total Kehadiran */}
                    <Card className="border-none shadow-sm bg-white hover:shadow-md transition-all rounded-xl relative overflow-hidden group">
                        <CardContent className="p-5 relative z-10">
                            <div className="flex justify-between items-start mb-4">
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">HADIR (Periode Ini)</div>
                                <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                    <UserCheck className="h-5 w-5" />
                                </div>
                            </div>
                            <div className="flex items-baseline gap-2 mb-2">
                                <span className="text-3xl font-bold text-slate-900">{summaryStats.totalPresent}</span>
                                <span className="text-sm text-slate-400 font-medium">/ {(dateRange?.to && dateRange?.from) ? (differenceInMinutes(dateRange.to, dateRange.from) / 1440 * summaryStats.totalEmployees).toFixed(0) : '-'} Total</span>
                            </div>
                            <Progress value={75} className="h-1.5 bg-slate-100" indicatorClassName="bg-blue-600" />
                            <div className="flex justify-end mt-2 text-xs font-bold text-blue-600">
                                {/* Percentage placeholder */}
                                92%
                            </div>
                        </CardContent>
                    </Card>

                    {/* Card 2: Terlambat */}
                    <Card className="border-none shadow-sm bg-white hover:shadow-md transition-all rounded-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Timer className="h-24 w-24 text-amber-500" />
                        </div>
                        <CardContent className="p-5 relative z-10">
                            <div className="flex justify-between items-start mb-4">
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">TERLAMBAT</div>
                                <div className="h-8 w-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
                                    <Clock className="h-5 w-5" />
                                </div>
                            </div>
                            <div className="flex items-baseline gap-3 mb-1">
                                <span className="text-3xl font-bold text-slate-900">{summaryStats.totalLate}</span>
                                <Badge variant="secondary" className="bg-amber-50 text-amber-600 hover:bg-amber-50 text-[10px] px-1.5 py-0 h-5">
                                    <TrendingUp className="h-3 w-3 mr-1" /> +2
                                </Badge>
                            </div>
                            <p className="text-xs text-slate-500">Employees arrived late</p>
                            <div className="mt-3 inline-flex items-center text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
                                Avg {summaryStats.totalLate > 0 ? (summaryStats.totalLateMinutes / summaryStats.totalLate).toFixed(0) : 0} mins / late
                            </div>
                        </CardContent>
                    </Card>

                    {/* Card 3: Izin / Sakit */}
                    <Card className="border-none shadow-sm bg-white hover:shadow-md transition-all rounded-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <FileText className="h-24 w-24 text-purple-500" />
                        </div>
                        <CardContent className="p-5 relative z-10">
                            <div className="flex justify-between items-start mb-4">
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">IZIN / SAKIT</div>
                                <div className="h-8 w-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                                    <FileText className="h-5 w-5" />
                                </div>
                            </div>
                            <div className="flex items-baseline gap-2 mb-2">
                                <span className="text-3xl font-bold text-slate-900">{summaryStats.totalLeave}</span>
                                <span className="text-sm text-slate-400 font-medium">Staff</span>
                            </div>
                            <div className="flex gap-2 mt-2">
                                <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-none">3 Sick</Badge>
                                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none">2 Permit</Badge>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Card 4: Belum Absen */}
                    <Card className="border-none shadow-sm bg-white hover:shadow-md transition-all rounded-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <UserX className="h-24 w-24 text-red-500" />
                        </div>
                        <CardContent className="p-5 relative z-10">
                            <div className="flex justify-between items-start mb-4">
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">BELUM ABSEN</div>
                                <div className="h-8 w-8 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                                    <UserX className="h-5 w-5" />
                                </div>
                            </div>
                            <div className="flex items-baseline gap-2 mb-2">
                                <span className="text-3xl font-bold text-slate-900">{summaryStats.waitingCheckIn}</span>
                                <span className="text-sm text-slate-400 font-medium">Staff</span>
                            </div>
                            <p className="text-xs text-slate-500">Waiting for check-in...</p>
                        </CardContent>
                    </Card>
                </div>

                {/* 2. Main Content Card */}
                <Card className="border-none shadow-sm bg-white rounded-xl overflow-hidden min-h-[500px]">
                    <div className="border-b border-slate-100 p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-lg text-slate-900">Kehadiran Karyawan</h3>
                            <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-700 border-blue-200">
                                {filteredReports.length} Staff
                            </Badge>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                <Filter className="h-4 w-4" />
                                <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                                    <SelectTrigger className="h-9 border-slate-200 bg-white hover:bg-slate-50 w-[180px]">
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
                            <EmptyState title="No Data Found" description="Try adjusting your filters or date range." icon={Filter} />
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                                            <TableHead className="w-12 py-4 font-semibold text-xs uppercase text-slate-500 pl-4">No</TableHead>
                                            <TableHead className="py-4 font-semibold text-xs uppercase text-slate-500">Employee Details</TableHead>
                                            <TableHead className="py-4 font-semibold text-xs uppercase text-slate-500 text-center">Total Hadir</TableHead>
                                            <TableHead className="py-4 font-semibold text-xs uppercase text-slate-500 text-center">Terlambat (Menit)</TableHead>
                                            <TableHead className="py-4 font-semibold text-xs uppercase text-slate-500 text-center">Status Cuti / Izin</TableHead>
                                            <TableHead className="py-4 font-semibold text-xs uppercase text-slate-500 text-right pr-6">Attendance Rate</TableHead>
                                            <TableHead className="py-4 font-semibold text-xs uppercase text-slate-500 text-center">Detail</TableHead>
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
                                                <TableRow key={emp.user_id} className="hover:bg-slate-50 border-b border-slate-100 transition-colors">
                                                    <TableCell className="text-slate-500 text-xs font-medium pl-4">{index + 1}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <Avatar className="h-9 w-9 border border-slate-200">
                                                                <AvatarImage src="" />
                                                                <AvatarFallback className={cn(
                                                                    "text-xs font-bold",
                                                                    ['A', 'C', 'E'].includes(emp.full_name?.charAt(0) || '') ? "bg-blue-100 text-blue-600" :
                                                                        ['B', 'D', 'F'].includes(emp.full_name?.charAt(0) || '') ? "bg-amber-100 text-amber-600" :
                                                                            ['G', 'H', 'I'].includes(emp.full_name?.charAt(0) || '') ? "bg-purple-100 text-purple-600" : "bg-slate-100 text-slate-600"
                                                                )}>
                                                                    {emp.full_name?.charAt(0).toUpperCase()}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div>
                                                                <div className="font-semibold text-slate-900 text-sm">{emp.full_name}</div>
                                                                <div className="text-xs text-slate-500">{emp.department} • {emp.position || "Staff"}</div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center font-bold text-slate-900">
                                                        <Badge variant="outline" className="bg-slate-50 font-mono text-base px-3 py-1">
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
                                                            {leaveCount > 0 && <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-slate-200">{leaveCount} Cuti</Badge>}
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
                                                            <div className="h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden">
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
                        )}
                        <div className="p-4 border-t border-slate-100 text-xs text-slate-500 flex justify-between items-center">
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
                <DialogContent className="flex flex-col h-[90vh] max-w-5xl overflow-hidden p-0 gap-0 bg-slate-50/50">
                    <div className="bg-white p-6 border-b border-slate-100 flex-shrink-0">
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
                                    <h3 className="text-xl font-bold text-slate-900">{selectedEmployee?.full_name}</h3>
                                    <p className="text-sm text-slate-500 font-medium mb-1">
                                        {selectedEmployee?.department} • {selectedEmployee?.position || "Staf"}
                                    </p>
                                    <div className="text-xs text-slate-400 flex items-center gap-1.5">
                                        <CalendarIcon className="w-3 h-3" />
                                        <span>Periode: <b className="text-slate-600">{dateRange?.from ? format(dateRange.from, 'd MMMM yyyy', { locale: id }) : '-'}</b> s/d <b className="text-slate-600">{dateRange?.to ? format(dateRange.to, 'd MMMM yyyy', { locale: id }) : '-'}</b></span>
                                    </div>
                                </div>
                            </div>

                            {/* Center: View Toggle */}
                            <div className="flex bg-slate-100 p-1 rounded-lg">
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={cn("px-4 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-2", viewMode === 'list' ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-900")}
                                >
                                    <FileText className="w-3.5 h-3.5" />
                                    Harian
                                </button>
                                <button
                                    onClick={() => setViewMode('calendar')}
                                    className={cn("px-4 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-2", viewMode === 'calendar' ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-900")}
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

export default LaporanKehadiran;
