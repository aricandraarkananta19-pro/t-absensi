import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, FileText, Calendar, CheckCircle2, XCircle,
  Clock, Search, Users, Download, BarChart3, RefreshCw, FileSpreadsheet, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { exportToCSV, exportToPDF, exportToExcel } from "@/lib/exportUtils";
import { useSystemSettings } from "@/hooks/useSystemSettings";

import { ABSENSI_WAJIB_ROLE } from "@/lib/constants";

interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
  created_at: string;
  profile?: {
    full_name: string | null;
    department: string | null;
  };
}

interface EmployeeReport {
  user_id: string;
  full_name: string | null;
  department: string | null;
  total_attendance: number;
  present_count: number;
  late_count: number;
  leave_count: number;
}

const Laporan = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useSystemSettings();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [employeeReports, setEmployeeReports] = useState<EmployeeReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("pending");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    fetchLeaveRequests();
    fetchEmployeeReports();

    // Setup realtime subscription for leave requests
    const leaveChannel = supabase
      .channel("leave-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leave_requests" },
        () => fetchLeaveRequests()
      )
      .subscribe();

    // Setup realtime subscription for attendance
    const attendanceChannel = supabase
      .channel("attendance-report-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance" },
        () => fetchEmployeeReports()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(leaveChannel);
      supabase.removeChannel(attendanceChannel);
    };
  }, [reportMonth]);

  const fetchLeaveRequests = async () => {
    // Get karyawan user IDs (FR-01: Filter Role Wajib Absensi)
    const { data: karyawanRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ABSENSI_WAJIB_ROLE);

    const karyawanUserIds = new Set(karyawanRoles?.map(r => r.user_id) || []);

    const { data, error } = await supabase
      .from("leave_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      // Filter only karyawan leave requests
      const karyawanRequests = data.filter(req => karyawanUserIds.has(req.user_id));

      const requestsWithProfiles = await Promise.all(
        karyawanRequests.map(async (request) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, department")
            .eq("user_id", request.user_id)
            .maybeSingle();
          return { ...request, profile };
        })
      );
      setLeaveRequests(requestsWithProfiles);
    }
    setIsLoading(false);
  };

  const fetchEmployeeReports = async () => {
    // Get karyawan user IDs
    const { data: karyawanRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ABSENSI_WAJIB_ROLE);

    const karyawanUserIds = new Set(karyawanRoles?.map(r => r.user_id) || []);

    // Get all profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, department");

    if (!profiles) return;

    // Filter only karyawan profiles
    const karyawanProfiles = profiles.filter(p => karyawanUserIds.has(p.user_id));

    // Get attendance for the selected month, but only from attendance start date
    const startOfMonth = new Date(`${reportMonth}-01`);
    const attendanceStartDate = new Date(settings.attendanceStartDate);
    attendanceStartDate.setHours(0, 0, 0, 0);

    // Use the later of startOfMonth or attendanceStartDate
    const effectiveStartDate = startOfMonth > attendanceStartDate ? startOfMonth : attendanceStartDate;

    const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    // If the entire month is before attendance start date, return empty reports
    if (endOfMonth < attendanceStartDate) {
      setEmployeeReports(karyawanProfiles.map(profile => ({
        user_id: profile.user_id,
        full_name: profile.full_name,
        department: profile.department,
        total_attendance: 0,
        present_count: 0,
        late_count: 0,
        leave_count: 0,
      })));
      return;
    }

    const reports: EmployeeReport[] = await Promise.all(
      karyawanProfiles.map(async (profile) => {
        // Get attendance count - only from effective start date
        const { data: attendance } = await supabase
          .from("attendance")
          .select("status")
          .eq("user_id", profile.user_id)
          .gte("clock_in", effectiveStartDate.toISOString())
          .lte("clock_in", endOfMonth.toISOString());

        // Get approved leave count - only from effective start date
        const { count: leaveCount } = await supabase
          .from("leave_requests")
          .select("*", { count: "exact", head: true })
          .eq("user_id", profile.user_id)
          .eq("status", "approved")
          .gte("start_date", effectiveStartDate.toISOString().split("T")[0])
          .lte("end_date", endOfMonth.toISOString().split("T")[0]);

        const presentCount = attendance?.filter(a => a.status === "present").length || 0;
        const lateCount = attendance?.filter(a => a.status === "late").length || 0;

        return {
          user_id: profile.user_id,
          full_name: profile.full_name,
          department: profile.department,
          total_attendance: attendance?.length || 0,
          present_count: presentCount,
          late_count: lateCount,
          leave_count: leaveCount || 0,
        };
      })
    );

    setEmployeeReports(reports);
  };

  // Check if selected month is before attendance start date
  const startOfSelectedMonth = new Date(`${reportMonth}-01`);
  const endOfSelectedMonth = new Date(startOfSelectedMonth.getFullYear(), startOfSelectedMonth.getMonth() + 1, 0);
  const attendanceStartDateObj = new Date(settings.attendanceStartDate);
  const isMonthBeforeStartDate = endOfSelectedMonth < attendanceStartDateObj;

  const handleApprove = async (request: LeaveRequest) => {
    const { error } = await supabase
      .from("leave_requests")
      .update({
        status: "approved",
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (error) {
      toast({ variant: "destructive", title: "Gagal", description: error.message });
    } else {
      toast({ title: "Berhasil", description: "Pengajuan cuti disetujui" });
      fetchLeaveRequests();
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;

    const { error } = await supabase
      .from("leave_requests")
      .update({
        status: "rejected",
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
        rejection_reason: rejectionReason,
      })
      .eq("id", selectedRequest.id);

    if (error) {
      toast({ variant: "destructive", title: "Gagal", description: error.message });
    } else {
      toast({ title: "Berhasil", description: "Pengajuan cuti ditolak" });
      setDialogOpen(false);
      setSelectedRequest(null);
      setRejectionReason("");
      fetchLeaveRequests();
    }
  };

  // Employee report export data
  const employeeExportColumns = [
    { header: "Nama", key: "nama", width: 120 },
    { header: "Departemen", key: "departemen", width: 80 },
    { header: "Total Hadir", key: "total_hadir", width: 50 },
    { header: "Tepat Waktu", key: "tepat_waktu", width: 50 },
    { header: "Terlambat", key: "terlambat", width: 50 },
    { header: "Cuti", key: "cuti", width: 40 },
  ];

  const getEmployeeExportData = () => {
    return filteredReports.map(emp => ({
      nama: emp.full_name || "-",
      departemen: emp.department || "-",
      total_hadir: emp.total_attendance,
      tepat_waktu: emp.present_count,
      terlambat: emp.late_count,
      cuti: emp.leave_count,
    }));
  };

  const monthLabel = new Date(reportMonth + "-01").toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  const handleExportEmployeeExcel = () => {
    exportToExcel({
      title: "Laporan Kehadiran Karyawan",
      subtitle: monthLabel,
      filename: `laporan-karyawan-${reportMonth}`,
      columns: employeeExportColumns,
      data: getEmployeeExportData(),
    });
    toast({ title: "Berhasil", description: "File Excel berhasil didownload" });
  };

  const handleExportEmployeePDF = () => {
    exportToPDF({
      title: "Laporan Kehadiran Karyawan",
      subtitle: monthLabel,
      filename: `laporan-karyawan-${reportMonth}`,
      columns: employeeExportColumns,
      data: getEmployeeExportData(),
    });
    toast({ title: "Berhasil", description: "File PDF berhasil didownload" });
  };

  // Leave report export data
  const leaveExportColumns = [
    { header: "Nama", key: "nama", width: 100 },
    { header: "Departemen", key: "departemen", width: 70 },
    { header: "Jenis", key: "jenis", width: 60 },
    { header: "Mulai", key: "mulai", width: 50 },
    { header: "Selesai", key: "selesai", width: 50 },
    { header: "Hari", key: "hari", width: 30 },
    { header: "Status", key: "status", width: 50 },
    { header: "Alasan", key: "alasan", width: 100 },
  ];

  const getLeaveStatusLabel = (status: string) => {
    switch (status) {
      case "approved": return "Disetujui";
      case "rejected": return "Ditolak";
      default: return "Menunggu";
    }
  };

  const getLeaveExportData = () => {
    return filteredRequests.map(req => ({
      nama: req.profile?.full_name || "-",
      departemen: req.profile?.department || "-",
      jenis: getLeaveTypeLabel(req.leave_type),
      mulai: new Date(req.start_date).toLocaleDateString("id-ID"),
      selesai: new Date(req.end_date).toLocaleDateString("id-ID"),
      hari: calculateDays(req.start_date, req.end_date),
      status: getLeaveStatusLabel(req.status),
      alasan: req.reason || "-",
    }));
  };

  const handleExportLeaveExcel = () => {
    exportToExcel({
      title: "Laporan Pengajuan Cuti",
      subtitle: `Per tanggal ${new Date().toLocaleDateString("id-ID")}`,
      filename: `laporan-cuti-${new Date().toISOString().split("T")[0]}`,
      columns: leaveExportColumns,
      data: getLeaveExportData(),
    });
    toast({ title: "Berhasil", description: "File Excel berhasil didownload" });
  };

  const handleExportLeavePDF = () => {
    exportToPDF({
      title: "Laporan Pengajuan Cuti",
      subtitle: `Per tanggal ${new Date().toLocaleDateString("id-ID")}`,
      filename: `laporan-cuti-${new Date().toISOString().split("T")[0]}`,
      columns: leaveExportColumns,
      data: getLeaveExportData(),
      orientation: "landscape",
    });
    toast({ title: "Berhasil", description: "File PDF berhasil didownload" });
  };

  // Export per employee leave summary
  const getEmployeeLeaveExportColumns = () => [
    { header: "Nama", key: "nama", width: 120 },
    { header: "Departemen", key: "departemen", width: 80 },
    { header: "Total Cuti Diajukan", key: "total_diajukan", width: 60 },
    { header: "Cuti Disetujui", key: "disetujui", width: 60 },
    { header: "Cuti Ditolak", key: "ditolak", width: 60 },
    { header: "Cuti Menunggu", key: "menunggu", width: 60 },
    { header: "Total Hari Disetujui", key: "total_hari", width: 60 },
    { header: "Sisa Cuti", key: "sisa_cuti", width: 50 },
  ];

  const getEmployeeLeaveExportData = () => {
    // Group leave requests by employee
    const employeeLeaveMap = new Map<string, {
      full_name: string | null;
      department: string | null;
      total: number;
      approved: number;
      rejected: number;
      pending: number;
      totalApprovedDays: number;
    }>();

    leaveRequests.forEach(req => {
      const existing = employeeLeaveMap.get(req.user_id) || {
        full_name: req.profile?.full_name || null,
        department: req.profile?.department || null,
        total: 0,
        approved: 0,
        rejected: 0,
        pending: 0,
        totalApprovedDays: 0,
      };

      existing.total += 1;
      if (req.status === "approved") {
        existing.approved += 1;
        existing.totalApprovedDays += calculateDays(req.start_date, req.end_date);
      } else if (req.status === "rejected") {
        existing.rejected += 1;
      } else {
        existing.pending += 1;
      }

      employeeLeaveMap.set(req.user_id, existing);
    });

    return Array.from(employeeLeaveMap.values()).map(emp => ({
      nama: emp.full_name || "-",
      departemen: emp.department || "-",
      total_diajukan: emp.total,
      disetujui: emp.approved,
      ditolak: emp.rejected,
      menunggu: emp.pending,
      total_hari: emp.totalApprovedDays,
      sisa_cuti: Math.max(0, settings.maxLeaveDays - emp.totalApprovedDays),
    }));
  };

  const handleExportEmployeeLeaveExcel = () => {
    exportToExcel({
      title: "Laporan Cuti Per Karyawan",
      subtitle: `Per tanggal ${new Date().toLocaleDateString("id-ID")} - Jatah Cuti: ${settings.maxLeaveDays} hari`,
      filename: `laporan-cuti-per-karyawan-${new Date().toISOString().split("T")[0]}`,
      columns: getEmployeeLeaveExportColumns(),
      data: getEmployeeLeaveExportData(),
    });
    toast({ title: "Berhasil", description: "File Excel laporan cuti per karyawan berhasil didownload" });
  };

  const handleExportEmployeeLeavePDF = () => {
    exportToPDF({
      title: "Laporan Cuti Per Karyawan",
      subtitle: `Per tanggal ${new Date().toLocaleDateString("id-ID")} - Jatah Cuti: ${settings.maxLeaveDays} hari`,
      filename: `laporan-cuti-per-karyawan-${new Date().toISOString().split("T")[0]}`,
      columns: getEmployeeLeaveExportColumns(),
      data: getEmployeeLeaveExportData(),
      orientation: "landscape",
    });
    toast({ title: "Berhasil", description: "File PDF laporan cuti per karyawan berhasil didownload" });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-success text-success-foreground gap-1"><CheckCircle2 className="h-3 w-3" />Disetujui</Badge>;
      case "rejected":
        return <Badge className="bg-destructive text-destructive-foreground gap-1"><XCircle className="h-3 w-3" />Ditolak</Badge>;
      default:
        return <Badge className="bg-warning text-warning-foreground gap-1"><Clock className="h-3 w-3" />Menunggu</Badge>;
    }
  };

  const getLeaveTypeLabel = (type: string) => {
    switch (type) {
      case "cuti": return "Cuti Tahunan";
      case "sakit": return "Sakit";
      case "izin": return "Izin";
      default: return type;
    }
  };

  const calculateDays = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const filteredRequests = leaveRequests.filter((req) => {
    const matchesSearch = req.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "all" || req.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const filteredReports = employeeReports.filter((emp) =>
    emp.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    pending: leaveRequests.filter(r => r.status === "pending").length,
    approved: leaveRequests.filter(r => r.status === "approved").length,
    rejected: leaveRequests.filter(r => r.status === "rejected").length,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info">
                  <BarChart3 className="h-5 w-5 text-info-foreground" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-foreground">Laporan</h1>
                  <p className="text-sm text-muted-foreground">Generate laporan karyawan & cuti</p>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => { fetchLeaveRequests(); fetchEmployeeReports(); }} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="employees" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="employees" className="gap-2">
              <Users className="h-4 w-4" />
              Laporan Karyawan
            </TabsTrigger>
            <TabsTrigger value="leave" className="gap-2">
              <FileText className="h-4 w-4" />
              Pengajuan Cuti
            </TabsTrigger>
          </TabsList>

          {/* Employee Reports Tab */}
          <TabsContent value="employees" className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Cari nama atau departemen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Input
                  type="month"
                  value={reportMonth}
                  onChange={(e) => setReportMonth(e.target.value)}
                  className="w-auto"
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="gap-2">
                      <Download className="h-4 w-4" />
                      <span className="hidden sm:inline">Export</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleExportEmployeeExcel} className="gap-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      Export Excel
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportEmployeePDF} className="gap-2">
                      <FileText className="h-4 w-4" />
                      Export PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Warning if month is before start date */}
            {isMonthBeforeStartDate && (
              <Alert className="border-warning bg-warning/10">
                <Info className="h-4 w-4 text-warning" />
                <AlertDescription className="text-warning-foreground">
                  Bulan yang dipilih sebelum periode absensi aktif ({new Date(settings.attendanceStartDate).toLocaleDateString("id-ID")}).
                  Data tidak tersedia.
                </AlertDescription>
              </Alert>
            )}

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg flex flex-col gap-1">
                  <span>Laporan Kehadiran - {new Date(reportMonth + "-01").toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    Periode aktif mulai: {new Date(settings.attendanceStartDate).toLocaleDateString("id-ID")}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  </div>
                ) : filteredReports.length === 0 ? (
                  <div className="py-12 text-center">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground">Tidak Ada Data</h3>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama</TableHead>
                        <TableHead className="hidden sm:table-cell">Departemen</TableHead>
                        <TableHead className="text-center">Total Hadir</TableHead>
                        <TableHead className="text-center hidden md:table-cell">Tepat Waktu</TableHead>
                        <TableHead className="text-center hidden md:table-cell">Terlambat</TableHead>
                        <TableHead className="text-center">Cuti</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReports.map((emp) => (
                        <TableRow key={emp.user_id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-xs font-medium text-primary">
                                  {emp.full_name?.charAt(0)?.toUpperCase() || "?"}
                                </span>
                              </div>
                              <span className="font-medium">{emp.full_name || "-"}</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {emp.department ? (
                              <Badge variant="outline">{emp.department}</Badge>
                            ) : "-"}
                          </TableCell>
                          <TableCell className="text-center font-bold text-foreground">
                            {emp.total_attendance}
                          </TableCell>
                          <TableCell className="text-center hidden md:table-cell text-success font-medium">
                            {emp.present_count}
                          </TableCell>
                          <TableCell className="text-center hidden md:table-cell text-warning font-medium">
                            {emp.late_count}
                          </TableCell>
                          <TableCell className="text-center text-info font-medium">
                            {emp.leave_count}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Leave Requests Tab */}
          <TabsContent value="leave" className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="border-border">
                <CardContent className="pt-4 pb-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-warning">{stats.pending}</p>
                    <p className="text-xs text-muted-foreground">Menunggu</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="pt-4 pb-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-success">{stats.approved}</p>
                    <p className="text-xs text-muted-foreground">Disetujui</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="pt-4 pb-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-destructive">{stats.rejected}</p>
                    <p className="text-xs text-muted-foreground">Ditolak</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Cari nama karyawan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua</SelectItem>
                    <SelectItem value="pending">Menunggu</SelectItem>
                    <SelectItem value="approved">Disetujui</SelectItem>
                    <SelectItem value="rejected">Ditolak</SelectItem>
                  </SelectContent>
                </Select>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <Download className="h-4 w-4" />
                      <span className="hidden sm:inline">Export</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleExportLeaveExcel} className="gap-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      Export Semua Cuti (Excel)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportLeavePDF} className="gap-2">
                      <FileText className="h-4 w-4" />
                      Export Semua Cuti (PDF)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportEmployeeLeaveExcel} className="gap-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      Export Per Karyawan (Excel)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportEmployeeLeavePDF} className="gap-2">
                      <FileText className="h-4 w-4" />
                      Export Per Karyawan (PDF)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Leave Requests Table */}
            <Card className="border-border">
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  </div>
                ) : filteredRequests.length === 0 ? (
                  <div className="py-12 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground">Tidak Ada Pengajuan</h3>
                    <p className="text-muted-foreground">Belum ada pengajuan cuti</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Karyawan</TableHead>
                        <TableHead>Jenis</TableHead>
                        <TableHead className="hidden sm:table-cell">Tanggal</TableHead>
                        <TableHead className="hidden md:table-cell">Alasan</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[120px]">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{request.profile?.full_name || "-"}</p>
                              <p className="text-xs text-muted-foreground">{request.profile?.department || "-"}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{getLeaveTypeLabel(request.leave_type)}</Badge>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              {new Date(request.start_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                              {" - "}
                              {new Date(request.end_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                              <Badge variant="secondary" className="ml-1 text-xs">
                                {calculateDays(request.start_date, request.end_date)}h
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[200px] truncate">
                            {request.reason || "-"}
                          </TableCell>
                          <TableCell>{getStatusBadge(request.status)}</TableCell>
                          <TableCell>
                            {request.status === "pending" && (
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-success hover:text-success hover:bg-success/10"
                                  onClick={() => handleApprove(request)}
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    setSelectedRequest(request);
                                    setDialogOpen(true);
                                  }}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Reject Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tolak Pengajuan</DialogTitle>
              <DialogDescription>
                Berikan alasan penolakan untuk {selectedRequest?.profile?.full_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                placeholder="Alasan penolakan..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                  Batal
                </Button>
                <Button variant="destructive" className="flex-1" onClick={handleReject}>
                  Tolak
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default Laporan;