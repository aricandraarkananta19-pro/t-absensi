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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { exportToPDF, exportToExcel } from "@/lib/exportUtils";
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

const ManagerLaporan = () => {
  const navigate = useNavigate();
  const { settings, isLoading: settingsLoading } = useSystemSettings();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [employeeReports, setEmployeeReports] = useState<EmployeeReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    if (settingsLoading) return;

    fetchLeaveRequests();
    fetchEmployeeReports();

    // Realtime Subscriptions - DISABLED for stability
    /*
    const leaveChannel = supabase
      .channel("manager-leave-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "leave_requests" }, () => fetchLeaveRequests())
      .subscribe();

    const attendanceChannel = supabase
      .channel("manager-attendance-report-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, () => fetchEmployeeReports())
      .subscribe();

    return () => {
      supabase.removeChannel(leaveChannel);
      supabase.removeChannel(attendanceChannel);
    };
    */
    return () => { };
  }, [reportMonth, settingsLoading, settings]);

  const fetchLeaveRequests = async () => {
    const { data, error } = await supabase
      .from("leave_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      // Get karyawan user IDs (FR-01: Filter Role Wajib Absensi)
      const { data: karyawanRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ABSENSI_WAJIB_ROLE);

      const karyawanUserIds = new Set(karyawanRoles?.map(r => r.user_id) || []);

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
    setIsLoading(true);

    // Get karyawan user IDs
    const { data: karyawanRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ABSENSI_WAJIB_ROLE);

    const karyawanUserIds = new Set(karyawanRoles?.map(r => r.user_id) || []);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, department");

    if (!profiles) {
      setIsLoading(false);
      return;
    }

    // Filter only karyawan profiles
    const karyawanProfiles = profiles.filter(p => karyawanUserIds.has(p.user_id));

    const startOfMonth = new Date(`${reportMonth}-01`);

    // Handle missing or invalid attendanceStartDate
    let attendanceStartDate: Date;
    if (settings?.attendanceStartDate) {
      attendanceStartDate = new Date(settings.attendanceStartDate);
      attendanceStartDate.setHours(0, 0, 0, 0);
    } else {
      attendanceStartDate = startOfMonth;
    }

    const effectiveStartDate = startOfMonth > attendanceStartDate ? startOfMonth : attendanceStartDate;

    const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    if (settings?.attendanceStartDate && endOfMonth < attendanceStartDate) {
      setEmployeeReports(karyawanProfiles.map(profile => ({
        user_id: profile.user_id,
        full_name: profile.full_name,
        department: profile.department,
        total_attendance: 0,
        present_count: 0,
        late_count: 0,
        leave_count: 0,
      })));
      setIsLoading(false);
      return;
    }

    const reports: EmployeeReport[] = await Promise.all(
      karyawanProfiles.map(async (profile) => {
        const { data: attendance } = await supabase
          .from("attendance")
          .select("status")
          .eq("user_id", profile.user_id)
          .gte("clock_in", effectiveStartDate.toISOString())
          .lte("clock_in", endOfMonth.toISOString());

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
    setIsLoading(false);
  };

  const startOfSelectedMonth = new Date(`${reportMonth}-01`);
  const endOfSelectedMonth = new Date(startOfSelectedMonth.getFullYear(), startOfSelectedMonth.getMonth() + 1, 0);
  const attendanceStartDateObj = settings?.attendanceStartDate
    ? new Date(settings.attendanceStartDate)
    : startOfSelectedMonth;
  const isMonthBeforeStartDate = settings?.attendanceStartDate
    ? endOfSelectedMonth < attendanceStartDateObj
    : false;

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

  const employeeExportColumns = [
    { header: "No.", key: "no", width: 30 },
    { header: "Employee Name", key: "nama", width: 120 },
    { header: "Department", key: "departemen", width: 80 },
    { header: "Total Attendance", key: "total_hadir", width: 60 },
    { header: "On Time", key: "tepat_waktu", width: 50 },
    { header: "Late", key: "terlambat", width: 50 },
    { header: "Leave", key: "cuti", width: 40 },
  ];

  const getEmployeeExportData = () => {
    return filteredReports.map((emp, index) => ({
      no: index + 1,
      nama: emp.full_name || "-",
      departemen: emp.department || "-",
      total_hadir: emp.total_attendance,
      tepat_waktu: emp.present_count,
      terlambat: emp.late_count,
      cuti: emp.leave_count,
    }));
  };

  // English month label for report
  const monthLabelEnglish = new Date(reportMonth + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" });
  // Indonesian month label for UI
  const monthLabel = new Date(reportMonth + "-01").toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  const handleExportEmployeeExcel = () => {
    exportToExcel({
      title: "EMPLOYEE ATTENDANCE REPORT",
      subtitle: monthLabelEnglish,
      filename: `laporan-karyawan-${reportMonth}`,
      columns: employeeExportColumns,
      data: getEmployeeExportData(),
    });
    toast({ title: "Berhasil", description: "File Excel berhasil didownload" });
  };

  const handleExportEmployeePDF = async () => {
    await exportToPDF({
      title: "EMPLOYEE ATTENDANCE REPORT",
      subtitle: monthLabelEnglish,
      filename: `employee-attendance-report-${reportMonth}`,
      columns: employeeExportColumns,
      data: getEmployeeExportData(),
    });
    toast({ title: "Berhasil", description: "File PDF berhasil didownload" });
  };

  // Leave report export columns
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/manager")} className="rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info">
                  <BarChart3 className="h-5 w-5 text-info-foreground" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-foreground">Laporan</h1>
                  <p className="text-sm text-muted-foreground">Read-Only View</p>
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
                      <FileSpreadsheet className="h-4 w-4" />Export Excel
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportEmployeePDF} className="gap-2">
                      <FileText className="h-4 w-4" />Export PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {isMonthBeforeStartDate && (
              <Alert className="border-warning bg-warning/10">
                <Info className="h-4 w-4 text-warning" />
                <AlertDescription className="text-warning-foreground">
                  Bulan yang dipilih sebelum periode absensi aktif ({new Date(settings.attendanceStartDate).toLocaleDateString("id-ID")}). Data tidak tersedia.
                </AlertDescription>
              </Alert>
            )}

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg flex flex-col gap-1">
                  <span>Laporan Kehadiran - {monthLabel}</span>
                  {settings?.attendanceStartDate && (
                    <span className="text-sm font-normal text-muted-foreground">
                      Periode aktif mulai: {new Date(settings.attendanceStartDate).toLocaleDateString("id-ID")}
                    </span>
                  )}
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
                          <TableCell className="font-medium">{emp.full_name || "-"}</TableCell>
                          <TableCell className="hidden sm:table-cell">{emp.department || "-"}</TableCell>
                          <TableCell className="text-center font-semibold">{emp.total_attendance}</TableCell>
                          <TableCell className="text-center hidden md:table-cell text-success">{emp.present_count}</TableCell>
                          <TableCell className="text-center hidden md:table-cell text-warning">{emp.late_count}</TableCell>
                          <TableCell className="text-center">{emp.leave_count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leave" className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
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
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue placeholder="Filter status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
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

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg">Daftar Pengajuan Cuti (Read-Only)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  </div>
                ) : filteredRequests.length === 0 ? (
                  <div className="py-12 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground">Tidak Ada Data</h3>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama</TableHead>
                        <TableHead className="hidden sm:table-cell">Jenis</TableHead>
                        <TableHead>Tanggal</TableHead>
                        <TableHead className="hidden md:table-cell">Hari</TableHead>
                        <TableHead>Status</TableHead>
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
                          <TableCell className="hidden sm:table-cell">{getLeaveTypeLabel(request.leave_type)}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p>{new Date(request.start_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</p>
                              <p className="text-xs text-muted-foreground">s/d {new Date(request.end_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</p>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">{calculateDays(request.start_date, request.end_date)} hari</TableCell>
                          <TableCell>{getStatusBadge(request.status)}</TableCell>
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
    </div>
  );
};

export default ManagerLaporan;
