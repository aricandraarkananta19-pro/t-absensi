import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
    ArrowLeft, FileText, Calendar, CheckCircle2, XCircle, Clock, Search, Users,
    Download, BarChart3, RefreshCw, FileSpreadsheet, Building2,
    AlertTriangle, CalendarDays, ChevronDown, ChevronRight, Home, ChevronRightIcon,
    TrendingUp, UserCheck, UserX, Timer, Briefcase, Filter, LayoutGrid, LayoutDashboard, Key, Settings, Shield, Database, Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { exportToPDF, exportToExcel } from "@/lib/exportUtils";
import { exportAttendanceExcel, exportAttendanceHRPDF, exportAttendanceManagementPDF, AttendanceReportData } from "@/lib/attendanceExportUtils";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { ABSENSI_WAJIB_ROLE } from "@/lib/constants";
import EnterpriseLayout from "@/components/layout/EnterpriseLayout";
import { cn } from "@/lib/utils";

// Talenta Brand Colors
const BRAND_COLORS = {
    blue: "#1A5BA8",
    lightBlue: "#00A0E3",
    green: "#7DC242",
};


// =============== SKELETON LOADER COMPONENT ===============
const SkeletonCard = () => (
    <Card className="border-slate-200/60">
        <CardContent className="p-5">
            <div className="flex items-center gap-4">
                <Skeleton className="h-14 w-14 rounded-xl" />
                <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                </div>
            </div>
            <div className="grid grid-cols-4 gap-3 mt-5">
                {[1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className="h-20 rounded-lg" />
                ))}
            </div>
        </CardContent>
    </Card>
);

const SkeletonTable = () => (
    <Card className="border-slate-200/60 overflow-hidden">
        <div className="bg-slate-900 py-3 px-4">
            <Skeleton className="h-5 w-32 bg-slate-700" />
        </div>
        <CardContent className="p-0">
            <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="flex items-center gap-4">
                        <Skeleton className="h-4 w-8" />
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-12" />
                        <Skeleton className="h-4 w-12" />
                        <Skeleton className="h-4 w-12" />
                        <Skeleton className="h-4 w-12" />
                        <Skeleton className="h-8 w-24" />
                        <Skeleton className="h-4 w-20" />
                    </div>
                ))}
            </div>
        </CardContent>
    </Card>
);

// =============== EMPTY STATE COMPONENT ===============
const EmptyState = ({ title, description, icon: Icon }: { title: string; description: string; icon: React.ElementType }) => (
    <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center mb-6 border border-slate-200/60">
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

interface EmployeeReport {
    user_id: string;
    full_name: string | null;
    department: string | null;
    reporting_period: string;
    present_count: number;
    absent_count: number;
    late_count: number;
    leave_count: number;
    absent_dates: string[];
    late_dates: string[];
    leave_dates: string[];
    remarks: string;
}

const LaporanKehadiran = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { settings, isLoading: settingsLoading } = useSystemSettings();

    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
    const [employeeReports, setEmployeeReports] = useState<EmployeeReport[]>([]);
    const [departments, setDepartments] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterStatus, setFilterStatus] = useState("pending");
    const [filterDepartment, setFilterDepartment] = useState("all");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
    const [rejectionReason, setRejectionReason] = useState("");
    const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<EmployeeReport | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    // Helper: Convert string to Title Case
    const toTitleCase = (str: string | null): string => {
        if (!str) return "—";
        return str.toLowerCase().split(" ").map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(" ");
    };

    // Helper: Format placeholder for empty fields
    const formatField = (value: string | null, placeholder = "—"): string => {
        return value && value.trim() !== "" ? value : placeholder;
    };

    // Wait for settings to load before fetching data
    useEffect(() => {
        if (settingsLoading) return;

        fetchLeaveRequests();
        fetchEmployeeReports();
        fetchDepartments();

        const leaveChannel = supabase
            .channel("leave-changes-report")
            .on("postgres_changes", { event: "*", schema: "public", table: "leave_requests" }, () => { fetchLeaveRequests(); fetchEmployeeReports(); })
            .subscribe();

        const attendanceChannel = supabase
            .channel("attendance-report-changes")
            .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, () => fetchEmployeeReports())
            .subscribe();

        return () => { supabase.removeChannel(leaveChannel); supabase.removeChannel(attendanceChannel); };
    }, [reportMonth, settingsLoading, settings]);

    const fetchDepartments = async () => {
        const { data } = await supabase.from("profiles").select("department").not("department", "is", null);
        if (data) setDepartments([...new Set(data.map(d => d.department).filter(Boolean))] as string[]);
    };

    const fetchLeaveRequests = async () => {
        const { data: karyawanRoles } = await supabase.from("user_roles").select("user_id").in("role", ABSENSI_WAJIB_ROLE);
        const karyawanUserIds = new Set(karyawanRoles?.map(r => r.user_id) || []);
        const { data } = await supabase.from("leave_requests").select("*").order("created_at", { ascending: false });
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
        setIsLoading(false);
    };

    const fetchEmployeeReports = async () => {
        setIsLoading(true);

        const { data: karyawanRoles } = await supabase.from("user_roles").select("user_id").in("role", ABSENSI_WAJIB_ROLE);
        const karyawanUserIds = new Set(karyawanRoles?.map(r => r.user_id) || []);
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, department");
        if (!profiles) {
            setIsLoading(false);
            return;
        }

        const karyawanProfiles = profiles.filter(p => karyawanUserIds.has(p.user_id));
        const startOfMonth = new Date(`${reportMonth}-01`);

        // Handle missing or invalid attendanceStartDate - default to start of month
        let attendanceStartDate: Date;
        if (settings?.attendanceStartDate) {
            attendanceStartDate = new Date(settings.attendanceStartDate);
            attendanceStartDate.setHours(0, 0, 0, 0);
        } else {
            // Default to start of this month if settings not available
            attendanceStartDate = startOfMonth;
        }

        const effectiveStartDate = startOfMonth > attendanceStartDate ? startOfMonth : attendanceStartDate;
        const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);

        const reportingPeriod = startOfMonth.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

        const getWorkDays = (start: Date, end: Date): Date[] => {
            const days: Date[] = [];
            const current = new Date(start);
            while (current <= end) {
                if (current.getDay() !== 0 && current.getDay() !== 6) days.push(new Date(current));
                current.setDate(current.getDate() + 1);
            }
            return days;
        };

        const workDays = getWorkDays(effectiveStartDate, endOfMonth);

        if (endOfMonth < attendanceStartDate) {
            setEmployeeReports(karyawanProfiles.map(p => ({
                user_id: p.user_id, full_name: p.full_name, department: p.department,
                reporting_period: reportingPeriod, present_count: 0, absent_count: 0, late_count: 0, leave_count: 0,
                absent_dates: [], late_dates: [], leave_dates: [], remarks: "Periode sebelum tanggal aktif"
            })));
            return;
        }

        const getLeaveDates = (leaveStart: string, leaveEnd: string, periodStart: Date, periodEnd: Date): string[] => {
            const dates: string[] = [];
            const start = new Date(leaveStart);
            const end = new Date(leaveEnd);
            const overlapStart = start > periodStart ? start : periodStart;
            const overlapEnd = end < periodEnd ? end : periodEnd;
            if (overlapStart > overlapEnd) return dates;
            const current = new Date(overlapStart);
            while (current <= overlapEnd) {
                if (current.getDay() !== 0 && current.getDay() !== 6) dates.push(current.toISOString().split("T")[0]);
                current.setDate(current.getDate() + 1);
            }
            return dates;
        };

        const reports: EmployeeReport[] = await Promise.all(
            karyawanProfiles.map(async (profile) => {
                const { data: attendance } = await supabase.from("attendance").select("status, clock_in")
                    .eq("user_id", profile.user_id)
                    .gte("clock_in", effectiveStartDate.toISOString())
                    .lte("clock_in", endOfMonth.toISOString());

                // AUTO-SYNC: Fetch ALL approved leave requests for this period
                const { data: approvedLeaves } = await supabase.from("leave_requests")
                    .select("start_date, end_date, leave_type")
                    .eq("user_id", profile.user_id)
                    .eq("status", "approved")
                    .lte("start_date", endOfMonth.toISOString().split("T")[0])
                    .gte("end_date", effectiveStartDate.toISOString().split("T")[0]);

                const attendedDates = new Set<string>();
                const lateDates: string[] = [];
                const presentDates: string[] = [];

                attendance?.forEach(a => {
                    const dateStr = new Date(a.clock_in).toISOString().split("T")[0];
                    attendedDates.add(dateStr);
                    if (a.status === "late") lateDates.push(dateStr);
                    else if (a.status === "present") presentDates.push(dateStr);
                });

                // AUTO-SYNC: Get all leave dates from approved requests
                const allLeaveDates: string[] = [];
                approvedLeaves?.forEach(leave => {
                    allLeaveDates.push(...getLeaveDates(leave.start_date, leave.end_date, effectiveStartDate, endOfMonth));
                });
                const leaveDatesSet = new Set(allLeaveDates);

                // Calculate absent dates (workdays without attendance AND without approved leave)
                const absentDates: string[] = [];
                const today = new Date(); today.setHours(0, 0, 0, 0);
                workDays.forEach(day => {
                    const dateStr = day.toISOString().split("T")[0];
                    if (!attendedDates.has(dateStr) && !leaveDatesSet.has(dateStr) && day < today) {
                        absentDates.push(dateStr);
                    }
                });

                // Generate remarks
                let remarks = "";
                if (absentDates.length > 3) remarks = "Perlu evaluasi kehadiran";
                else if (lateDates.length > 5) remarks = "Sering terlambat";
                else if (absentDates.length === 0 && lateDates.length === 0) remarks = "Kehadiran baik";

                return {
                    user_id: profile.user_id,
                    full_name: profile.full_name,
                    department: profile.department,
                    reporting_period: reportingPeriod,
                    present_count: presentDates.length + lateDates.length,
                    absent_count: absentDates.length,
                    late_count: lateDates.length,
                    leave_count: allLeaveDates.length,
                    absent_dates: absentDates,
                    late_dates: lateDates,
                    leave_dates: allLeaveDates,
                    remarks,
                };
            })
        );
        setEmployeeReports(reports);
        setLastUpdated(new Date());
        setIsLoading(false);
    };

    // Safe date calculations with null check
    const attendanceStartDateObj = settings?.attendanceStartDate
        ? new Date(settings.attendanceStartDate)
        : new Date(`${reportMonth}-01`);
    const startOfSelectedMonth = new Date(`${reportMonth}-01`);
    const endOfSelectedMonth = new Date(startOfSelectedMonth.getFullYear(), startOfSelectedMonth.getMonth() + 1, 0);
    const isMonthBeforeStartDate = settings?.attendanceStartDate
        ? endOfSelectedMonth < attendanceStartDateObj
        : false;

    const summaryStats = useMemo(() => ({
        totalEmployees: employeeReports.length,
        totalPresent: employeeReports.reduce((sum, e) => sum + e.present_count, 0),
        totalAbsent: employeeReports.reduce((sum, e) => sum + e.absent_count, 0),
        totalLate: employeeReports.reduce((sum, e) => sum + e.late_count, 0),
        totalLeave: employeeReports.reduce((sum, e) => sum + e.leave_count, 0),
    }), [employeeReports]);

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

    const toggleRowExpand = (userId: string) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(userId)) newExpanded.delete(userId);
        else newExpanded.add(userId);
        setExpandedRows(newExpanded);
    };

    // Format dates for display: "3, 7, 12 Januari 2026"
    const formatDatesForDisplay = (dates: string[]): string => {
        if (dates.length === 0) return "—";
        const monthYear = new Date(reportMonth + "-01");
        const monthName = monthYear.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
        const dayNumbers = dates.map(d => new Date(d).getDate()).sort((a, b) => a - b);
        if (dayNumbers.length <= 6) return dayNumbers.join(", ") + " " + monthName;
        return dayNumbers.slice(0, 5).join(", ") + ` (+${dayNumbers.length - 5}) ${monthName}`;
    };

    // Combine all attendance details for display
    const formatAttendanceDetails = (emp: EmployeeReport): string => {
        const parts: string[] = [];
        if (emp.absent_dates.length > 0) parts.push(`Tidak Hadir: ${formatDatesForDisplay(emp.absent_dates)}`);
        if (emp.late_dates.length > 0) parts.push(`Terlambat: ${formatDatesForDisplay(emp.late_dates)}`);
        if (emp.leave_dates.length > 0) parts.push(`Cuti: ${formatDatesForDisplay(emp.leave_dates)}`);
        return parts.length > 0 ? parts.join(" | ") : "Tidak ada catatan";
    };

    const monthLabelIndonesian = new Date(reportMonth + "-01").toLocaleDateString("id-ID", { month: "long", year: "numeric" });

    // Export columns - NEW STRUCTURE
    const employeeExportColumns = [
        { header: "No.", key: "no", width: 25 },
        { header: "Nama Karyawan", key: "nama", width: 120 },
        { header: "Departemen", key: "departemen", width: 80 },
        { header: "Hadir", key: "hadir", width: 40 },
        { header: "Tidak Hadir", key: "tidak_hadir", width: 50 },
        { header: "Cuti", key: "cuti", width: 35 },
        { header: "Terlambat", key: "terlambat", width: 45 },
        { header: "Detail Kehadiran", key: "detail", width: 180 },
        { header: "Keterangan", key: "keterangan", width: 100 },
    ];

    const filteredReports = employeeReports.filter((emp) => {
        const matchesSearch = emp.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || emp.department?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesDept = filterDepartment === "all" || emp.department === filterDepartment;
        return matchesSearch && matchesDept;
    });

    const getEmployeeExportData = () => filteredReports.map((emp, index) => ({
        no: index + 1,
        nama: emp.full_name || "-",
        departemen: emp.department || "-",
        hadir: emp.present_count,
        tidak_hadir: emp.absent_count,
        cuti: emp.leave_count,
        terlambat: emp.late_count,
        detail: formatAttendanceDetails(emp),
        keterangan: emp.remarks || "-",
    }));

    // Build export data structure
    const buildExportData = (): AttendanceReportData => ({
        period: monthLabelIndonesian,
        periodStart: reportMonth,
        periodEnd: reportMonth,
        totalEmployees: filteredReports.length,
        totalPresent: summaryStats.totalPresent,
        totalAbsent: summaryStats.totalAbsent,
        totalLeave: summaryStats.totalLeave,
        totalLate: summaryStats.totalLate,
        employees: filteredReports.map(emp => ({
            name: emp.full_name || "-",
            department: emp.department || "-",
            present: emp.present_count,
            absent: emp.absent_count,
            leave: emp.leave_count,
            late: emp.late_count,
            absentDates: emp.absent_dates,
            lateDates: emp.late_dates,
            leaveDates: emp.leave_dates,
            remarks: emp.remarks || "",
        })),
        leaveRequests: leaveRequests.filter(r => r.status === "approved").map(req => ({
            name: req.profile?.full_name || "-",
            department: req.profile?.department || "-",
            type: getLeaveTypeLabel(req.leave_type),
            startDate: new Date(req.start_date).toLocaleDateString("id-ID"),
            endDate: new Date(req.end_date).toLocaleDateString("id-ID"),
            days: calculateDays(req.start_date, req.end_date),
            status: "Disetujui",
        })),
    });

    // Export: Multi-sheet Excel (4 sheets)
    const handleExportMultiSheetExcel = () => {
        exportAttendanceExcel(buildExportData(), `laporan-kehadiran-lengkap-${reportMonth}`);
        toast({ title: "Berhasil", description: "Excel multi-sheet berhasil diunduh (4 lembar kerja)" });
    };

    // Export: HR PDF (Detailed)
    const handleExportHRPDF = async () => {
        await exportAttendanceHRPDF(buildExportData(), `laporan-kehadiran-hr-${reportMonth}`);
        toast({ title: "Berhasil", description: "PDF HR (detail) berhasil diunduh" });
    };

    // Export: Management PDF (Executive Summary)
    const handleExportManagementPDF = async () => {
        await exportAttendanceManagementPDF(buildExportData(), `ringkasan-kehadiran-manajemen-${reportMonth}`);
        toast({ title: "Berhasil", description: "PDF Ringkasan Manajemen berhasil diunduh" });
    };

    // Legacy exports (simple)
    const handleExportEmployeeExcel = () => {
        exportToExcel({ title: "LAPORAN KEHADIRAN KARYAWAN", subtitle: `Periode: ${monthLabelIndonesian} | Total: ${filteredReports.length} Karyawan`, filename: `laporan-kehadiran-${reportMonth}`, columns: employeeExportColumns, data: getEmployeeExportData() });
        toast({ title: "Berhasil", description: "Excel berhasil diunduh" });
    };

    const handleExportEmployeePDF = async () => {
        await exportToPDF({ title: "LAPORAN KEHADIRAN KARYAWAN", subtitle: `Periode: ${monthLabelIndonesian} | Total: ${filteredReports.length} Karyawan`, filename: `laporan-kehadiran-${reportMonth}`, columns: employeeExportColumns, data: getEmployeeExportData(), orientation: "landscape" });
        toast({ title: "Berhasil", description: "PDF berhasil diunduh" });
    };

    // Leave tab helpers
    const filteredRequests = leaveRequests.filter((req) => {
        const matchesSearch = req.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = filterStatus === "all" || req.status === filterStatus;
        const matchesDept = filterDepartment === "all" || req.profile?.department === filterDepartment;
        return matchesSearch && matchesStatus && matchesDept;
    });

    const leaveStats = { pending: leaveRequests.filter(r => r.status === "pending").length, approved: leaveRequests.filter(r => r.status === "approved").length, rejected: leaveRequests.filter(r => r.status === "rejected").length };

    const getLeaveTypeLabel = (type: string) => type === "cuti" ? "Cuti Tahunan" : type === "sakit" ? "Sakit" : type === "izin" ? "Izin" : type;
    const getLeaveStatusLabel = (status: string) => status === "approved" ? "Disetujui" : status === "rejected" ? "Ditolak" : "Menunggu";
    const calculateDays = (start: string, end: string) => Math.ceil(Math.abs(new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const getStatusBadge = (status: string) => {
        if (status === "approved") return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="h-3 w-3 mr-1" />Disetujui</Badge>;
        if (status === "rejected") return <Badge className="bg-red-100 text-red-700 border-red-200"><XCircle className="h-3 w-3 mr-1" />Ditolak</Badge>;
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200"><Clock className="h-3 w-3 mr-1" />Menunggu</Badge>;
    };

    const leaveExportColumns = [
        { header: "Karyawan", key: "nama", width: 100 }, { header: "Departemen", key: "departemen", width: 70 },
        { header: "Jenis", key: "jenis", width: 60 }, { header: "Mulai", key: "mulai", width: 50 },
        { header: "Selesai", key: "selesai", width: 50 }, { header: "Hari", key: "hari", width: 30 },
        { header: "Status", key: "status", width: 50 }, { header: "Alasan", key: "alasan", width: 100 },
    ];

    const getLeaveExportData = () => filteredRequests.map(req => ({
        nama: req.profile?.full_name || "-", departemen: req.profile?.department || "-",
        jenis: getLeaveTypeLabel(req.leave_type), mulai: new Date(req.start_date).toLocaleDateString("id-ID"),
        selesai: new Date(req.end_date).toLocaleDateString("id-ID"), hari: calculateDays(req.start_date, req.end_date),
        status: getLeaveStatusLabel(req.status), alasan: req.reason || "-",
    }));

    const handleExportLeaveExcel = () => { exportToExcel({ title: "Laporan Pengajuan Cuti", subtitle: `Per tanggal ${new Date().toLocaleDateString("id-ID")}`, filename: `laporan-cuti-${new Date().toISOString().split("T")[0]}`, columns: leaveExportColumns, data: getLeaveExportData() }); toast({ title: "Berhasil", description: "Excel berhasil diunduh" }); };
    const handleExportLeavePDF = () => { exportToPDF({ title: "Laporan Pengajuan Cuti", subtitle: `Per tanggal ${new Date().toLocaleDateString("id-ID")}`, filename: `laporan-cuti-${new Date().toISOString().split("T")[0]}`, columns: leaveExportColumns, data: getLeaveExportData(), orientation: "landscape" }); toast({ title: "Berhasil", description: "PDF berhasil diunduh" }); };

    return (
        <div className="min-h-screen bg-slate-50 print:bg-white">
            {/* Header with Talenta Brand */}
            <header
                className="sticky top-0 z-50 border-b shadow-sm print:static print:bg-white print:shadow-none"
                style={{
                    background: `linear-gradient(135deg, ${BRAND_COLORS.blue} 0%, ${BRAND_COLORS.lightBlue} 100%)`
                }}
            >
                <div className="container mx-auto px-4 lg:px-8">
                    {/* Top Bar with Breadcrumbs */}
                    <div className="flex items-center justify-between py-2 border-b border-white/10 print:hidden">
                        <nav className="flex items-center gap-2 text-sm">
                            <Link to="/dashboard" className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors">
                                <Home className="h-3.5 w-3.5" />
                                <span>Dashboard</span>
                            </Link>
                            <ChevronRightIcon className="h-3.5 w-3.5 text-white/50" />
                            <span className="text-white/80">Admin</span>
                            <ChevronRightIcon className="h-3.5 w-3.5 text-white/50" />
                            <span className="text-white font-medium">Laporan Kehadiran</span>
                        </nav>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-white/60">Live data</span>
                            <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                        </div>
                    </div>

                    {/* Main Header */}
                    <div className="flex items-center justify-between py-4">
                        <div className="flex items-center gap-4">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate("/dashboard")}
                                className="rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all print:hidden"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 shadow-lg">
                                    <BarChart3 className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-white tracking-tight">Laporan Kehadiran</h1>
                                    <p className="text-sm text-white/70">Laporan Bulanan • {monthLabelIndonesian}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 print:hidden">
                            {/* Date Picker */}
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70 pointer-events-none" />
                                <Input
                                    type="month"
                                    value={reportMonth}
                                    onChange={(e) => setReportMonth(e.target.value)}
                                    className="pl-10 w-44 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white focus:ring-white/20 rounded-xl"
                                />
                            </div>

                            {/* Export Button */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button className="bg-white hover:bg-white/90 gap-2 shadow-md transition-all rounded-xl px-5" style={{ color: BRAND_COLORS.blue }}>
                                        <Download className="h-4 w-4" />
                                        <span className="hidden sm:inline font-medium">Ekspor</span>
                                        <ChevronDown className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-72 p-2 bg-white border border-slate-200 shadow-xl rounded-xl">
                                    <DropdownMenuLabel className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Laporan Lengkap</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={handleExportMultiSheetExcel} className="gap-3 cursor-pointer rounded-lg p-3 hover:bg-slate-50">
                                        <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                                            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                                        </div>
                                        <div className="flex-1">
                                            <span className="font-semibold text-slate-900">Excel Multi-Sheet</span>
                                            <p className="text-xs text-slate-500">4 lembar kerja lengkap</p>
                                        </div>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={handleExportHRPDF} className="gap-3 cursor-pointer rounded-lg p-3 hover:bg-slate-50">
                                        <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center">
                                            <FileText className="h-5 w-5 text-blue-600" />
                                        </div>
                                        <div className="flex-1">
                                            <span className="font-semibold text-slate-900">PDF HR Detail</span>
                                            <p className="text-xs text-slate-500">Laporan lengkap untuk arsip</p>
                                        </div>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={handleExportManagementPDF} className="gap-3 cursor-pointer rounded-lg p-3 hover:bg-slate-50">
                                        <div className="h-9 w-9 rounded-lg bg-purple-100 flex items-center justify-center">
                                            <FileText className="h-5 w-5 text-purple-600" />
                                        </div>
                                        <div className="flex-1">
                                            <span className="font-semibold text-slate-900">PDF Eksekutif</span>
                                            <p className="text-xs text-slate-500">Ringkasan untuk manajemen</p>
                                        </div>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="my-2" />
                                    <DropdownMenuLabel className="text-xs uppercase tracking-wider text-slate-400">Format Sederhana</DropdownMenuLabel>
                                    <div className="flex gap-2">
                                        <DropdownMenuItem onClick={handleExportEmployeePDF} className="flex-1 gap-2 cursor-pointer rounded-lg p-2.5 hover:bg-slate-50 justify-center">
                                            <FileText className="h-4 w-4 text-red-500" />
                                            <span className="text-sm">PDF</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={handleExportEmployeeExcel} className="flex-1 gap-2 cursor-pointer rounded-lg p-2.5 hover:bg-slate-50 justify-center">
                                            <FileSpreadsheet className="h-4 w-4 text-green-500" />
                                            <span className="text-sm">Excel</span>
                                        </DropdownMenuItem>
                                    </div>
                                </DropdownMenuContent>
                            </DropdownMenu>

                            {/* Refresh Button */}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => { fetchLeaveRequests(); fetchEmployeeReports(); }}
                                className="rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
                            >
                                <RefreshCw className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 lg:px-8 py-8">
                <Tabs defaultValue="attendance" className="space-y-6">
                    {/* Modern Tab Switcher with Talenta Brand */}
                    <TabsList
                        className="inline-flex h-12 items-center rounded-xl p-1.5 shadow-md print:hidden"
                        style={{ backgroundColor: BRAND_COLORS.blue }}
                    >
                        <TabsTrigger value="attendance" className="px-6 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-slate-800 text-white/80 font-medium transition-all">
                            <BarChart3 className="h-4 w-4 mr-2" />Laporan Kehadiran
                        </TabsTrigger>
                        <TabsTrigger value="leave" className="px-6 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-slate-800 text-white/80 font-medium transition-all">
                            <CalendarDays className="h-4 w-4 mr-2" />Pengajuan Cuti
                        </TabsTrigger>
                    </TabsList>

                    {/* ATTENDANCE TAB */}
                    <TabsContent value="attendance" className="space-y-6">
                        {/* Show skeleton while loading */}
                        {isLoading ? (
                            <div className="space-y-6">
                                <SkeletonCard />
                                <SkeletonTable />
                            </div>
                        ) : (
                            <>
                                {/* Stats Cards with Talenta Brand Colors */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {/* Total Employees Card */}
                                    <Card className="border-slate-200 shadow-sm bg-white">
                                        <CardContent className="p-5">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-medium text-slate-500 mb-1">Total Karyawan</p>
                                                    <p className="text-3xl font-bold text-slate-800">{summaryStats.totalEmployees}</p>
                                                </div>
                                                <div
                                                    className="h-12 w-12 rounded-xl flex items-center justify-center"
                                                    style={{ backgroundColor: `${BRAND_COLORS.blue}15` }}
                                                >
                                                    <Users className="h-6 w-6" style={{ color: BRAND_COLORS.blue }} />
                                                </div>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-3">Periode: {monthLabelIndonesian}</p>
                                        </CardContent>
                                    </Card>

                                    {/* Hadir Card */}
                                    <Card className="border-slate-200 shadow-sm bg-white">
                                        <CardContent className="p-5">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-medium text-slate-500 mb-1">Total Kehadiran</p>
                                                    <p className="text-3xl font-bold" style={{ color: BRAND_COLORS.green }}>{summaryStats.totalPresent}</p>
                                                </div>
                                                <div
                                                    className="h-12 w-12 rounded-xl flex items-center justify-center"
                                                    style={{ backgroundColor: `${BRAND_COLORS.green}15` }}
                                                >
                                                    <UserCheck className="h-6 w-6" style={{ color: BRAND_COLORS.green }} />
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-3">
                                                <TrendingUp className="h-3.5 w-3.5" style={{ color: BRAND_COLORS.green }} />
                                                <span className="text-xs font-medium" style={{ color: BRAND_COLORS.green }}>Kehadiran tercatat</span>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Tidak Hadir Card */}
                                    <Card className="border-slate-200 shadow-sm bg-white">
                                        <CardContent className="p-5">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-medium text-slate-500 mb-1">Tidak Hadir</p>
                                                    <p className="text-3xl font-bold text-red-500">{summaryStats.totalAbsent}</p>
                                                </div>
                                                <div className="h-12 w-12 rounded-xl bg-red-50 flex items-center justify-center">
                                                    <UserX className="h-6 w-6 text-red-500" />
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-3">
                                                <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                                                <span className="text-xs text-red-500 font-medium">Perlu perhatian</span>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Terlambat Card */}
                                    <Card className="border-slate-200 shadow-sm bg-white">
                                        <CardContent className="p-5">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-medium text-slate-500 mb-1">Keterlambatan</p>
                                                    <p className="text-3xl font-bold text-amber-500">{summaryStats.totalLate}</p>
                                                </div>
                                                <div className="h-12 w-12 rounded-xl bg-amber-50 flex items-center justify-center">
                                                    <Timer className="h-6 w-6 text-amber-500" />
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-3">
                                                <Clock className="h-3.5 w-3.5 text-amber-500" />
                                                <span className="text-xs text-amber-500 font-medium">Tercatat terlambat</span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Filter Card */}
                                <Card className="border-0 shadow-md print:hidden bg-white">
                                    <CardContent className="p-4">
                                        <div className="flex flex-col lg:flex-row gap-4">
                                            <div className="relative flex-1">
                                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                                <Input
                                                    placeholder="Cari nama atau departemen..."
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    className="pl-10 bg-slate-50 border-slate-200 focus:bg-white focus:border-violet-500 rounded-xl transition-all"
                                                />
                                            </div>
                                            <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                                                <SelectTrigger className="w-[200px] bg-slate-50 border-slate-200 rounded-xl">
                                                    <Filter className="h-4 w-4 mr-2 text-slate-400" />
                                                    <SelectValue placeholder="Departemen" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    <SelectItem value="all">Semua Departemen</SelectItem>
                                                    {departments.map(dept => (<SelectItem key={dept} value={dept}>{dept}</SelectItem>))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </CardContent>
                                </Card>

                                {isMonthBeforeStartDate && (
                                    <Alert className="border-amber-200 bg-amber-50/50 rounded-xl">
                                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                                        <AlertDescription className="text-amber-800">
                                            Bulan yang dipilih sebelum periode absensi aktif. Data tidak tersedia.
                                        </AlertDescription>
                                    </Alert>
                                )}

                                {/* Main Table - Enterprise Style */}
                                <Card className="border-0 shadow-lg overflow-hidden bg-white rounded-xl">
                                    <CardHeader className="bg-slate-900 py-4 px-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <LayoutGrid className="h-5 w-5 text-violet-400" />
                                                <CardTitle className="text-base font-semibold text-white">Data Kehadiran Karyawan</CardTitle>
                                            </div>
                                            <Badge className="bg-white/10 text-white border-0 font-medium">
                                                {filteredReports.length} Karyawan
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        {filteredReports.length === 0 ? (
                                            <EmptyState
                                                icon={Users}
                                                title="Belum Ada Data Kehadiran"
                                                description="Data kehadiran untuk periode ini belum tersedia. Pilih periode lain atau tunggu data masuk."
                                            />
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="bg-slate-50 border-b border-slate-200">
                                                            <TableHead className="w-10"></TableHead>
                                                            <TableHead className="font-semibold text-slate-700">Nama Karyawan</TableHead>
                                                            <TableHead className="font-semibold text-slate-700">Departemen</TableHead>
                                                            <TableHead className="font-semibold text-slate-700 text-center">Hadir</TableHead>
                                                            <TableHead className="font-semibold text-slate-700 text-center">Tidak Hadir</TableHead>
                                                            <TableHead className="font-semibold text-slate-700 text-center">Cuti</TableHead>
                                                            <TableHead className="font-semibold text-slate-700 text-center">Terlambat</TableHead>
                                                            <TableHead className="font-semibold text-slate-700">Detail Kehadiran</TableHead>
                                                            <TableHead className="font-semibold text-slate-700">Keterangan</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {filteredReports.map((emp, index) => (
                                                            <Collapsible key={emp.user_id} asChild>
                                                                <>
                                                                    <TableRow className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-slate-100 border-b border-slate-200 cursor-pointer`} onClick={() => toggleRowExpand(emp.user_id)}>
                                                                        <TableCell className="w-10"><CollapsibleTrigger asChild><Button variant="ghost" size="sm" className="h-6 w-6 p-0"><ChevronRight className={`h-4 w-4 text-slate-500 transition-transform ${expandedRows.has(emp.user_id) ? 'rotate-90' : ''}`} /></Button></CollapsibleTrigger></TableCell>
                                                                        <TableCell className="font-medium text-slate-900">{toTitleCase(emp.full_name)}</TableCell>
                                                                        <TableCell className="text-slate-700">{formatField(emp.department, "Belum Ditentukan")}</TableCell>
                                                                        <TableCell className="text-center font-semibold text-emerald-700">{emp.present_count}</TableCell>
                                                                        <TableCell className="text-center"><span className={`font-semibold ${emp.absent_count > 0 ? 'text-red-700' : 'text-slate-500'}`}>{emp.absent_count}</span></TableCell>
                                                                        <TableCell className="text-center font-semibold text-slate-600">{emp.leave_count}</TableCell>
                                                                        <TableCell className="text-center"><span className={`font-semibold ${emp.late_count > 0 ? 'text-amber-700' : 'text-slate-500'}`}>{emp.late_count}</span></TableCell>
                                                                        <TableCell className="text-sm">
                                                                            {emp.absent_count === 0 && emp.late_count === 0 && emp.leave_count === 0 ? (
                                                                                <span className="text-slate-400 italic">Tidak ada catatan</span>
                                                                            ) : (
                                                                                <Button
                                                                                    variant="outline"
                                                                                    size="sm"
                                                                                    className="h-7 text-xs border-slate-300 hover:bg-slate-100 gap-1.5"
                                                                                    onClick={(e) => { e.stopPropagation(); setSelectedEmployee(emp); setDetailModalOpen(true); }}
                                                                                >
                                                                                    <FileText className="h-3.5 w-3.5" />
                                                                                    Lihat Detail
                                                                                </Button>
                                                                            )}
                                                                        </TableCell>
                                                                        <TableCell className="text-sm text-slate-600">{formatField(emp.remarks, "—")}</TableCell>
                                                                    </TableRow>
                                                                    {expandedRows.has(emp.user_id) && (
                                                                        <TableRow className="bg-slate-50 border-b border-slate-300">
                                                                            <TableCell colSpan={9} className="p-0">
                                                                                <CollapsibleContent>
                                                                                    <div className="p-4 bg-slate-50">
                                                                                        <p className="text-sm font-semibold text-slate-700 mb-3">Detail Kehadiran - {emp.full_name}</p>
                                                                                        <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
                                                                                            <Table>
                                                                                                <TableHeader><TableRow className="bg-slate-100"><TableHead className="font-semibold text-slate-700 w-32">Tanggal</TableHead><TableHead className="font-semibold text-slate-700 w-28">Status</TableHead><TableHead className="font-semibold text-slate-700">Keterangan</TableHead></TableRow></TableHeader>
                                                                                                <TableBody>
                                                                                                    {emp.absent_dates.map((d, i) => (<TableRow key={`abs-${i}`}><TableCell className="text-sm">{new Date(d).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}</TableCell><TableCell><span className="text-xs font-medium px-2 py-1 rounded bg-red-50 text-red-700">Tidak Hadir</span></TableCell><TableCell className="text-sm text-slate-600">—</TableCell></TableRow>))}
                                                                                                    {emp.leave_dates.map((d, i) => (<TableRow key={`lv-${i}`}><TableCell className="text-sm">{new Date(d).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}</TableCell><TableCell><span className="text-xs font-medium px-2 py-1 rounded bg-slate-100 text-slate-700">Cuti</span></TableCell><TableCell className="text-sm text-slate-600">Cuti Disetujui</TableCell></TableRow>))}
                                                                                                    {emp.late_dates.map((d, i) => (<TableRow key={`lt-${i}`}><TableCell className="text-sm">{new Date(d).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}</TableCell><TableCell><span className="text-xs font-medium px-2 py-1 rounded bg-amber-50 text-amber-700">Terlambat</span></TableCell><TableCell className="text-sm text-slate-600">—</TableCell></TableRow>))}
                                                                                                    {emp.absent_dates.length === 0 && emp.leave_dates.length === 0 && emp.late_dates.length === 0 && (<TableRow><TableCell colSpan={3} className="text-center text-slate-500 py-4">Kehadiran sempurna</TableCell></TableRow>)}
                                                                                                </TableBody>
                                                                                            </Table>
                                                                                        </div>
                                                                                    </div>
                                                                                </CollapsibleContent>
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    )}
                                                                </>
                                                            </Collapsible>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </TabsContent>

                    {/* LEAVE TAB */}
                    <TabsContent value="leave" className="space-y-5">
                        <div className="grid grid-cols-3 gap-4">
                            <Card className="border-amber-300 bg-amber-50"><CardContent className="p-4"><div className="text-center"><p className="text-2xl font-bold text-amber-700">{leaveStats.pending}</p><p className="text-sm text-amber-600 font-medium">Menunggu</p></div></CardContent></Card>
                            <Card className="border-emerald-300 bg-emerald-50"><CardContent className="p-4"><div className="text-center"><p className="text-2xl font-bold text-emerald-700">{leaveStats.approved}</p><p className="text-sm text-emerald-600 font-medium">Disetujui</p></div></CardContent></Card>
                            <Card className="border-red-300 bg-red-50"><CardContent className="p-4"><div className="text-center"><p className="text-2xl font-bold text-red-700">{leaveStats.rejected}</p><p className="text-sm text-red-600 font-medium">Ditolak</p></div></CardContent></Card>
                        </div>

                        <Card className="border-slate-300">
                            <CardContent className="p-4">
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input placeholder="Cari nama karyawan..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 border-slate-300" /></div>
                                    <div className="flex gap-3">
                                        <Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger className="w-[150px] border-slate-300"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">Semua</SelectItem><SelectItem value="pending">Menunggu</SelectItem><SelectItem value="approved">Disetujui</SelectItem><SelectItem value="rejected">Ditolak</SelectItem></SelectContent></Select>
                                        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="gap-2 border-slate-300"><Download className="h-4 w-4" />Ekspor</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={handleExportLeaveExcel} className="gap-2 cursor-pointer"><FileSpreadsheet className="h-4 w-4 text-emerald-600" />Excel</DropdownMenuItem><DropdownMenuItem onClick={handleExportLeavePDF} className="gap-2 cursor-pointer"><FileText className="h-4 w-4 text-red-600" />PDF</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-slate-300 overflow-hidden">
                            <CardContent className="p-0">
                                {isLoading ? (<div className="flex items-center justify-center py-16"><div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-600 border-t-transparent" /></div>
                                ) : filteredRequests.length === 0 ? (<div className="py-16 text-center"><FileText className="h-14 w-14 text-slate-300 mx-auto mb-4" /><h3 className="text-lg font-medium text-slate-700">Tidak Ada Pengajuan Cuti</h3></div>
                                ) : (
                                    <Table>
                                        <TableHeader><TableRow className="bg-slate-100 border-b border-slate-300"><TableHead className="font-bold text-slate-800">Karyawan</TableHead><TableHead className="font-bold text-slate-800">Jenis</TableHead><TableHead className="font-bold text-slate-800 hidden sm:table-cell">Periode</TableHead><TableHead className="font-bold text-slate-800 hidden md:table-cell">Alasan</TableHead><TableHead className="font-bold text-slate-800">Status</TableHead><TableHead className="font-bold text-slate-800 w-[120px]">Aksi</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {filteredRequests.map((request, index) => (
                                                <TableRow key={request.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-slate-100 border-b border-slate-200`}>
                                                    <TableCell><div><p className="font-medium text-slate-900">{request.profile?.full_name || "-"}</p><p className="text-xs text-slate-500">{request.profile?.department || "-"}</p></div></TableCell>
                                                    <TableCell className="text-sm text-slate-700">{getLeaveTypeLabel(request.leave_type)}</TableCell>
                                                    <TableCell className="hidden sm:table-cell text-sm text-slate-600"><div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-slate-400" />{new Date(request.start_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} – {new Date(request.end_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}<span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{calculateDays(request.start_date, request.end_date)}h</span></div></TableCell>
                                                    <TableCell className="hidden md:table-cell text-sm text-slate-600 max-w-[200px] truncate">{request.reason || "-"}</TableCell>
                                                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                                                    <TableCell>{request.status === "pending" && (<div className="flex gap-1"><Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-50" onClick={() => handleApprove(request)}><CheckCircle2 className="h-4 w-4" /></Button><Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600 hover:bg-red-50" onClick={() => { setSelectedRequest(request); setDialogOpen(true); }}><XCircle className="h-4 w-4" /></Button></div>)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle className="text-slate-900">Tolak Pengajuan Cuti</DialogTitle><DialogDescription className="text-slate-500">Berikan alasan penolakan untuk <span className="font-medium text-slate-700">{selectedRequest?.profile?.full_name}</span>.</DialogDescription></DialogHeader>
                    <div className="space-y-4 mt-4">
                        <Textarea placeholder="Masukkan alasan penolakan..." value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={4} className="border-slate-300" />
                        <div className="flex justify-end gap-3"><Button variant="outline" onClick={() => setDialogOpen(false)} className="border-slate-300">Batal</Button><Button onClick={handleReject} className="bg-red-600 hover:bg-red-700 text-white">Tolak Pengajuan</Button></div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Attendance Detail Modal */}
            <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden">
                    <DialogHeader className="pb-4 border-b border-slate-200">
                        <DialogTitle className="text-slate-900 flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-slate-600" />
                            Detail Kehadiran
                        </DialogTitle>
                        <DialogDescription className="text-slate-500">
                            {selectedEmployee && (
                                <span>
                                    <span className="font-medium text-slate-700">{toTitleCase(selectedEmployee.full_name)}</span>
                                    {selectedEmployee.department && (
                                        <span className="text-slate-400"> • {selectedEmployee.department}</span>
                                    )}
                                    <span className="text-slate-400"> • Periode: {monthLabelIndonesian}</span>
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedEmployee && (
                        <div className="overflow-y-auto max-h-[55vh] pr-2">
                            {/* Summary Stats */}
                            <div className="grid grid-cols-4 gap-3 mb-5">
                                <div className="text-center p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                                    <p className="text-xl font-bold text-emerald-700">{selectedEmployee.present_count}</p>
                                    <p className="text-xs text-emerald-600 font-medium">Hadir</p>
                                </div>
                                <div className="text-center p-3 rounded-lg bg-red-50 border border-red-200">
                                    <p className="text-xl font-bold text-red-700">{selectedEmployee.absent_count}</p>
                                    <p className="text-xs text-red-600 font-medium">Tidak Hadir</p>
                                </div>
                                <div className="text-center p-3 rounded-lg bg-slate-100 border border-slate-300">
                                    <p className="text-xl font-bold text-slate-700">{selectedEmployee.leave_count}</p>
                                    <p className="text-xs text-slate-600 font-medium">Cuti</p>
                                </div>
                                <div className="text-center p-3 rounded-lg bg-amber-50 border border-amber-200">
                                    <p className="text-xl font-bold text-amber-700">{selectedEmployee.late_count}</p>
                                    <p className="text-xs text-amber-600 font-medium">Terlambat</p>
                                </div>
                            </div>

                            {/* Detailed Table */}
                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-100">
                                            <TableHead className="font-semibold text-slate-700 w-36">Tanggal</TableHead>
                                            <TableHead className="font-semibold text-slate-700 w-28">Status</TableHead>
                                            <TableHead className="font-semibold text-slate-700">Keterangan</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {/* Absent Dates */}
                                        {selectedEmployee.absent_dates.map((date, i) => (
                                            <TableRow key={`absent-${i}`} className="border-b border-slate-100">
                                                <TableCell className="text-sm">
                                                    {new Date(date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short", year: "numeric" })}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-red-100 text-red-700">
                                                        <XCircle className="h-3 w-3" />
                                                        Tidak Hadir
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-sm text-slate-600">Tidak ada catatan kehadiran</TableCell>
                                            </TableRow>
                                        ))}

                                        {/* Leave Dates */}
                                        {selectedEmployee.leave_dates.map((date, i) => (
                                            <TableRow key={`leave-${i}`} className="border-b border-slate-100">
                                                <TableCell className="text-sm">
                                                    {new Date(date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short", year: "numeric" })}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-200 text-slate-700">
                                                        <CalendarDays className="h-3 w-3" />
                                                        Cuti
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-sm text-slate-600">Cuti yang disetujui</TableCell>
                                            </TableRow>
                                        ))}

                                        {/* Late Dates */}
                                        {selectedEmployee.late_dates.map((date, i) => (
                                            <TableRow key={`late-${i}`} className="border-b border-slate-100">
                                                <TableCell className="text-sm">
                                                    {new Date(date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short", year: "numeric" })}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
                                                        <Clock className="h-3 w-3" />
                                                        Terlambat
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-sm text-slate-600">Keterlambatan tercatat</TableCell>
                                            </TableRow>
                                        ))}

                                        {/* Empty State */}
                                        {selectedEmployee.absent_dates.length === 0 &&
                                            selectedEmployee.leave_dates.length === 0 &&
                                            selectedEmployee.late_dates.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={3} className="text-center py-8 text-slate-500">
                                                        <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                                                        Kehadiran sempurna, tidak ada catatan
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Remarks */}
                            {selectedEmployee.remarks && (
                                <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <p className="text-xs font-medium text-slate-500 mb-1">Keterangan:</p>
                                    <p className="text-sm text-slate-700">{selectedEmployee.remarks}</p>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex justify-end pt-4 border-t border-slate-200">
                        <Button variant="outline" onClick={() => setDetailModalOpen(false)} className="border-slate-300">
                            Tutup
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <style>{`@media print { .print\\:hidden { display: none !important; } .print\\:static { position: static !important; } .print\\:bg-white { background-color: white !important; } table { font-size: 10pt !important; } th, td { padding: 6px 8px !important; } }`}</style>
        </div>
    );
};

export default LaporanKehadiran;
