import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Clock, Search, Calendar, Users, CheckCircle2,
  XCircle, AlertCircle, Download, RefreshCw, FileSpreadsheet, FileText, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { exportToCSV, exportToPDF, exportToExcel } from "@/lib/exportUtils";
import { useSystemSettings } from "@/hooks/useSystemSettings";

interface AttendanceRecord {
  id: string;
  user_id: string;
  clock_in: string;
  clock_in_location: string | null;
  clock_out: string | null;
  clock_out_location: string | null;
  status: string;
  profile?: {
    full_name: string | null;
    department: string | null;
  };
}

const RekapAbsensi = () => {
  const navigate = useNavigate();
  const { settings } = useSystemSettings();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    fetchAttendance();

    // Setup realtime subscription
    const channel = supabase
      .channel("attendance-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance" },
        () => {
          fetchAttendance();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filterDate]);

  const fetchAttendance = async () => {
    setIsLoading(true);

    // Check if filter date is before attendance start date
    const filterDateObj = new Date(filterDate);
    const startDateObj = new Date(settings.attendanceStartDate);
    startDateObj.setHours(0, 0, 0, 0);

    if (filterDateObj < startDateObj) {
      // Date is before attendance start date, show empty
      setAttendance([]);
      setIsLoading(false);
      return;
    }

    // Get admin user IDs to exclude
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    const adminUserIds = new Set(adminRoles?.map(r => r.user_id) || []);

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
      // Filter out admin attendance records
      const nonAdminData = data.filter(record => !adminUserIds.has(record.user_id));

      const attendanceWithProfiles = await Promise.all(
        nonAdminData.map(async (record) => {
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
    setIsLoading(false);
  };

  // Check if selected date is before attendance start date
  const isBeforeStartDate = new Date(filterDate) < new Date(settings.attendanceStartDate);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return <Badge className="bg-success text-success-foreground gap-1"><CheckCircle2 className="h-3 w-3" />Hadir</Badge>;
      case "late":
        return <Badge className="bg-warning text-warning-foreground gap-1"><AlertCircle className="h-3 w-3" />Terlambat</Badge>;
      case "early_leave":
        return <Badge className="bg-info text-info-foreground gap-1"><Clock className="h-3 w-3" />Pulang Awal</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
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

  const calculateDuration = (clockIn: string, clockOut: string | null) => {
    if (!clockOut) return "-";
    const start = new Date(clockIn);
    const end = new Date(clockOut);
    const diffMs = end.getTime() - start.getTime();
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

  const getExportData = () => {
    return filteredAttendance.map(record => ({
      nama: record.profile?.full_name || "-",
      departemen: record.profile?.department || "-",
      clock_in: formatTime(record.clock_in),
      clock_out: record.clock_out ? formatTime(record.clock_out) : "-",
      lokasi_masuk: record.clock_in_location || "-",
      lokasi_pulang: record.clock_out_location || "-",
      durasi: calculateDuration(record.clock_in, record.clock_out),
      status: getStatusLabel(record.status),
    }));
  };

  const exportColumns = [
    { header: "Nama", key: "nama", width: 120 },
    { header: "Departemen", key: "departemen", width: 80 },
    { header: "Clock In", key: "clock_in", width: 60 },
    { header: "Clock Out", key: "clock_out", width: 60 },
    { header: "Lokasi Masuk", key: "lokasi_masuk", width: 100 },
    { header: "Lokasi Pulang", key: "lokasi_pulang", width: 100 },
    { header: "Durasi", key: "durasi", width: 50 },
    { header: "Status", key: "status", width: 60 },
  ];

  const handleExportCSV = () => {
    exportToCSV({
      title: "Rekap Absensi",
      subtitle: formatDate(filterDate),
      filename: `rekap-absensi-${filterDate}`,
      columns: exportColumns,
      data: getExportData(),
    });
    toast({ title: "Berhasil", description: "File CSV berhasil didownload" });
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
    present: attendance.filter(a => a.status === "present").length,
    late: attendance.filter(a => a.status === "late").length,
    earlyLeave: attendance.filter(a => a.status === "early_leave").length,
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
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                  <Clock className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-foreground">Rekap Absensi</h1>
                  <p className="text-sm text-muted-foreground">Data kehadiran realtime</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchAttendance} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Export</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportExcel} className="gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    Export Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportCSV} className="gap-2">
                    <FileText className="h-4 w-4" />
                    Export CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportPDF} className="gap-2">
                    <FileText className="h-4 w-4" />
                    Export PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Date Display */}
        <div className="mb-4">
          <p className="text-lg font-medium text-foreground">{formatDate(filterDate)}</p>
        </div>

        {/* Warning if date is before start date */}
        {isBeforeStartDate && (
          <Alert className="mb-6 border-warning bg-warning/10">
            <Info className="h-4 w-4 text-warning" />
            <AlertDescription className="text-warning-foreground">
              Tanggal yang dipilih sebelum periode absensi aktif ({new Date(settings.attendanceStartDate).toLocaleDateString("id-ID")}).
              Data tidak tersedia.
            </AlertDescription>
          </Alert>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <Card className="border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-success">{stats.present}</p>
                  <p className="text-xs text-muted-foreground">Hadir</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-warning">{stats.late}</p>
                  <p className="text-xs text-muted-foreground">Terlambat</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-info">{stats.earlyLeave}</p>
                  <p className="text-xs text-muted-foreground">Pulang Awal</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
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
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-auto"
            />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="present">Hadir</SelectItem>
                <SelectItem value="late">Terlambat</SelectItem>
                <SelectItem value="early_leave">Pulang Awal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <Card className="border-border">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : filteredAttendance.length === 0 ? (
              <div className="py-12 text-center">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground">Tidak Ada Data</h3>
                <p className="text-muted-foreground">Belum ada absensi untuk tanggal ini</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead className="hidden sm:table-cell">Departemen</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead className="hidden md:table-cell">Durasi</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAttendance.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-medium text-primary">
                              {record.profile?.full_name?.charAt(0)?.toUpperCase() || "?"}
                            </span>
                          </div>
                          <span className="font-medium">{record.profile?.full_name || "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {record.profile?.department || "-"}
                      </TableCell>
                      <TableCell className="text-success font-medium">
                        {formatTime(record.clock_in)}
                      </TableCell>
                      <TableCell className={record.clock_out ? "text-info font-medium" : "text-muted-foreground"}>
                        {record.clock_out ? formatTime(record.clock_out) : "-"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
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
      </main>
    </div>
  );
};

export default RekapAbsensi;