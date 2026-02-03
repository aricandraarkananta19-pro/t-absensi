import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Clock, Search, Calendar as CalendarIcon, Users, CheckCircle2,
  XCircle, AlertCircle, Download, FileSpreadsheet, FileText,
  LayoutDashboard, BarChart3, Building2, Key, Settings, Shield, Database,
  ChevronLeft, ChevronRight, LogIn, LogOut, Trash2
} from "lucide-react";
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
import { Pencil } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { exportToCSV } from "@/lib/exportUtils";
import { exportAttendanceExcel, exportAttendanceHRPDF, AttendanceReportData } from "@/lib/attendanceExportUtils";
import { generateAttendancePeriod } from "@/lib/attendanceGenerator";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import EnterpriseLayout from "@/components/layout/EnterpriseLayout";
import { ABSENSI_WAJIB_ROLE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";
import { startOfMonth, endOfMonth, format, addDays, subDays } from "date-fns";
import { id } from "date-fns/locale";
import { DateRange } from "react-day-picker";

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
}

const getTodayDate = () => {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
};

const RekapAbsensi = () => {
  const navigate = useNavigate();
  const { isLoading: settingsLoading, settings } = useSystemSettings();
  const isMobile = useIsMobile();

  const [dailyData, setDailyData] = useState<any[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);

  // Edit State
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    clock_in: "",
    clock_out: "",
    status: "",
    notes: ""
  });

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Delete State
  const [recordToDelete, setRecordToDelete] = useState<any | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // View Modes: Daily, Monthly, Range
  const [viewMode, setViewMode] = useState<"daily" | "monthly" | "range">("daily");

  // Date Filters
  const [filterDate, setFilterDate] = useState(getTodayDate());
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });

  const [totalEmployees, setTotalEmployees] = useState(0);

  // Menu sections
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
      const activeKaryawan = profilesData?.filter(p => karyawanUserIds.has(p.user_id)).sort((a, b) => (a.full_name || "").localeCompare(b.full_name || "")) || [];
      setTotalEmployees(activeKaryawan.length);

      // 3. Determine Date Range based on View Mode
      let start: Date, end: Date;

      if (viewMode === "daily") {
        start = new Date(filterDate);
        start.setHours(0, 0, 0, 0);
        end = new Date(filterDate);
        end.setHours(23, 59, 59, 999);
      } else if (viewMode === "monthly") {
        start = startOfMonth(selectedMonth);
        end = endOfMonth(selectedMonth);
      } else {
        // Range Mode
        start = dateRange?.from || new Date();
        start.setHours(0, 0, 0, 0);
        end = dateRange?.to || new Date();
        end.setHours(23, 59, 59, 999);
      }

      // 4. Query Attendance
      const { data: attendanceData, error: attendanceError } = await supabase
        .from("attendance")
        .select("*")
        .gte("clock_in", start.toISOString())
        .lte("clock_in", new Date(new Date(end).getTime() + 86400000).toISOString()); // Buffer for timezone

      if (attendanceError) throw attendanceError;

      // 5. Query Leaves
      const { data: leaveData, error: leaveError } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("status", "approved");

      if (leaveError) throw leaveError;

      // 6. Process Logic
      if (viewMode === "daily") {
        // Daily View Mapping
        const todayStr = getTodayDate();
        const merged = activeKaryawan.map(employee => {
          const record = attendanceData?.find(a => {
            if (!a.clock_in) return false;
            const rDate = new Date(a.clock_in).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
            return a.user_id === employee.user_id && rDate === filterDate;
          });

          // Accurate Status Logic
          let status = record?.status;

          if (!record) {
            const empJoin = employee.join_date ? new Date(employee.join_date).toISOString().split('T')[0] : '2000-01-01';
            if (filterDate < empJoin) status = 'future'; // Before join
            else if (filterDate > todayStr) status = 'future';
            else if (filterDate === todayStr) status = 'pending';
            else status = 'absent';
          } else {
            // Check for Not Clocked Out
            if (record.clock_in && !record.clock_out && filterDate === todayStr) {
              status = 'not_clocked_out';
            }
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

        // Sort: Active first (not_clocked_out > present > late > pending > absent)
        merged.sort((a, b) => {
          const getScore = (s: string) => {
            if (s === 'not_clocked_out') return 5;
            if (s === 'present' || s === 'late') return 4;
            if (s === 'pending') return 3;
            return 1;
          }
          return getScore(b.status) - getScore(a.status);
        });

        setDailyData(merged);

      } else {
        // Monthly OR Range View -> Aggregated Stats
        const stats: MonthlyStats[] = activeKaryawan.map(employee => {
          const empRecords = attendanceData?.filter(r => r.user_id === employee.user_id) || [];
          const empLeaves = leaveData?.filter(l => l.user_id === employee.user_id) || [];

          // Use Generator to fill blanks
          const normalized = generateAttendancePeriod(start, end, empRecords, empLeaves);

          const s: MonthlyStats = {
            user_id: employee.user_id,
            name: employee.full_name || "Unknown",
            department: employee.department || "-",
            present: 0, late: 0, early_leave: 0, absent: 0, leave: 0, total_attendance: 0,
            absentDates: [], lateDates: [], leaveDates: []
          };

          normalized.forEach(day => {
            // Ignore pre-join dates
            if (employee.join_date && new Date(day.date) < new Date(employee.join_date)) return;

            // Ignore pre-system start dates
            if (new Date(day.date) < new Date(settings.attendanceStartDate)) return;

            // Mapping Status Logic
            if (['present', 'late', 'early_leave'].includes(day.status)) {
              s.present++;
              s.total_attendance++;
            }

            if (day.status === 'late') {
              s.late++;
              s.lateDates.push(day.date);
            }
            if (day.status === 'early_leave') {
              s.early_leave++;
            }

            if (day.status === 'leave' || day.status === 'permission') {
              s.leave++;
              s.leaveDates.push(day.date);
            }
            else if ((day.status === 'absent' || day.status === 'alpha') && !day.isWeekend && day.status !== 'future') {
              s.absent++;
              s.absentDates.push(day.date);
            }
            // 'weekend' and 'future' ignored for stats
          });

          return s;
        });

        // Sort by Absent count (high to low) for manager attention, or Name
        stats.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

        setMonthlyStats(stats);
      }

    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setIsLoading(false);
    }
  }, [filterDate, selectedMonth, dateRange, viewMode]);

  // Realtime Subscription
  useEffect(() => {
    const channel = supabase
      .channel('realtime-attendance-rekap')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance' },
        () => {
          fetchAttendance();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAttendance]);

  useEffect(() => {
    if (!settingsLoading) fetchAttendance();
  }, [settingsLoading, fetchAttendance]);

  // Navigation Handlers
  const goToPrevious = () => {
    if (viewMode === "daily") {
      const d = new Date(filterDate); d.setDate(d.getDate() - 1);
      setFilterDate(d.toISOString().split("T")[0]);
    } else if (viewMode === "monthly") {
      setSelectedMonth(prev => { const d = new Date(prev); d.setMonth(d.getMonth() - 1); return d; });
    }
  };

  const goToNext = () => {
    if (viewMode === "daily") {
      const d = new Date(filterDate); d.setDate(d.getDate() + 1);
      setFilterDate(d.toISOString().split("T")[0]);
    } else if (viewMode === "monthly") {
      setSelectedMonth(prev => { const d = new Date(prev); d.setMonth(d.getMonth() + 1); return d; });
    }
  };

  const calculateDuration = (inTime: any, outTime: any) => {
    if (!inTime) return "-";
    if (!outTime) return "Berjalan"; // Ongoing
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

  // EDIT LOGIC
  const openEdit = (record: any) => {
    if (!record.id || record.id.toString().startsWith('virt')) {
      toast({ variant: "destructive", title: "Tidak ada data", description: "Karyawan ini belum absen, tidak bisa diedit." });
      return;
    }
    setEditingRecord(record);
    setEditForm({
      clock_in: record.clock_in ? new Date(record.clock_in).toISOString().slice(0, 16) : "",
      clock_out: record.clock_out ? new Date(record.clock_out).toISOString().slice(0, 16) : "",
      status: record.status || "present",
      notes: record.notes || ""
    });
    setIsEditOpen(true);
  };

  const handleUpdate = async () => {
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

      // Calculate Duration/Work Hours if both exist
      if (updateData.clock_in && updateData.clock_out) {
        const diff = new Date(updateData.clock_out).getTime() - new Date(updateData.clock_in).getTime();
        updateData.work_hours = parseFloat((diff / (1000 * 60 * 60)).toFixed(2));
      } else {
        updateData.work_hours = 0;
      }

      const { error } = await supabase
        .from('attendance')
        .update(updateData)
        .eq('id', editingRecord.id);

      if (error) throw error;

      // Manual Audit Log (since we are admin)
      await supabase.from("audit_logs").insert({
        user_id: user?.id,
        action: "ADMIN_UPDATE_ATTENDANCE",
        target_table: "attendance",
        target_id: editingRecord.id,
        description: `Admin edited attendance for ${editingRecord.name}. Status: ${updateData.status}`
      });

      toast({ title: "Berhasil Update", description: "Data absensi diperbarui." });
      setIsEditOpen(false);
      fetchAttendance();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Gagal Update", description: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  // DELETE LOGIC
  const openDelete = (record: any) => {
    if (!record.id || record.id.toString().startsWith('virt')) {
      toast({ variant: "destructive", title: "Tidak ada data", description: "Belum ada data absensi untuk dihapus." });
      return;
    }
    setRecordToDelete(record);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!recordToDelete) return;
    setIsLoading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;

      // Use count: 'exact' to verify deletion
      const { error, count } = await supabase
        .from('attendance')
        .delete({ count: 'exact' })
        .eq('id', recordToDelete.id);

      if (error) throw error;

      // If count is 0, it means RLS blocked it or record didn't exist
      if (count === 0) {
        throw new Error("Gagal menghapus. Anda mungkin tidak memiliki izin atau data sudah terhapus.");
      }

      // Audit Log
      if (user) {
        await supabase.from("audit_logs").insert({
          user_id: user.id,
          action: "ADMIN_DELETE_ATTENDANCE",
          target_table: "attendance",
          target_id: recordToDelete.id,
          description: `Admin deleted attendance record for ${recordToDelete.name} on ${recordToDelete.clock_in}`
        });
      }

      toast({ title: "Berhasil Dihapus", description: "Data absensi telah di-reset (dihapus)." });

      // Optimistic Update: Remove from local state immediately
      setDailyData(prev => prev.map(item => {
        if (item.id === recordToDelete.id) {
          // Return 'reset' state
          return {
            ...item,
            id: `virt-${item.user_id}`, // Convert back to virtual ID
            clock_in: null,
            clock_out: null,
            status: 'absent', // or 'pending' depending on date, default to absent for safety
            notes: null
          };
        }
        return item;
      }));

      setIsDeleteDialogOpen(false);
      fetchAttendance(); // Re-fetch to be sure
    } catch (e: any) {
      toast({ variant: "destructive", title: "Gagal Menghapus", description: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  // EXPORT
  const handleExport = (type: 'csv' | 'excel' | 'pdf') => {
    if (viewMode === 'monthly' || viewMode === 'range') {
      const reportTitle = viewMode === 'range'
        ? `Laporan_${dateRange?.from ? format(dateRange.from, 'dd-MM-yyyy') : ''}_sd_${dateRange?.to ? format(dateRange.to, 'dd-MM-yyyy') : ''}`
        : `Laporan_Bulanan_${format(selectedMonth, 'MMM_yyyy')}`;

      const reportData: AttendanceReportData = {
        period: viewMode === 'range' && dateRange?.from && dateRange?.to
          ? `${format(dateRange.from, 'dd MMM yyyy', { locale: id })} - ${format(dateRange.to, 'dd MMM yyyy', { locale: id })}`
          : format(selectedMonth, 'MMMM yyyy', { locale: id }),
        periodStart: viewMode === 'range' && dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : format(startOfMonth(selectedMonth), 'yyyy-MM-dd'),
        periodEnd: viewMode === 'range' && dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : format(endOfMonth(selectedMonth), 'yyyy-MM-dd'),
        totalEmployees: monthlyStats.length,
        totalPresent: monthlyStats.reduce((a, b) => a + b.present, 0),
        totalAbsent: monthlyStats.reduce((a, b) => a + b.absent, 0),
        totalLate: monthlyStats.reduce((a, b) => a + b.late, 0),
        totalLeave: 0,
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

      if (type === 'excel') exportAttendanceExcel(reportData, reportTitle);
      if (type === 'pdf') exportAttendanceHRPDF(reportData, reportTitle);
      if (type === 'csv') toast({ description: "CSV tersedia di mode Harian." });
    } else {
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
        title: `Laporan Harian ${filterDate}`,
        columns: [
          { header: "No", key: "No" },
          { header: "Nama", key: "Nama" },
          { header: "Departemen", key: "Departemen" },
          { header: "Masuk", key: "Masuk" },
          { header: "Keluar", key: "Keluar" },
          { header: "Durasi", key: "Durasi" },
          { header: "Status", key: "Status" },
          { header: "Keterangan", key: "Keterangan" },
        ],
        data: dataForExport,
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present": return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-0"><CheckCircle2 className="w-3 h-3 mr-1" />Hadir</Badge>;
      case "late": return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-0"><AlertCircle className="w-3 h-3 mr-1" />Terlambat</Badge>;
      case "absent":
      case "alpha": return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-0"><XCircle className="w-3 h-3 mr-1" />Alpha</Badge>;
      case "not_clocked_out": return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-0 animate-pulse"><Clock className="w-3 h-3 mr-1" />Belum Pulang</Badge>;
      case "pending": return <Badge variant="secondary" className="text-slate-500">Belum Hadir</Badge>;
      case "future": return <Badge variant="outline" className="text-slate-300">-</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Filter Data
  const filteredData = (viewMode === 'daily' ? dailyData : monthlyStats)
    .filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()));

  // ==========================================
  // UNIFIED VIEW (Responsive)
  // ==========================================
  return (
    <EnterpriseLayout
      title="Rekap Absensi"
      subtitle="Monitoring kehadiran karyawan realtime"
      menuSections={menuSections}
      roleLabel="Administrator"
      showRefresh={true}
      onRefresh={fetchAttendance}
    >
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Data Absensi</DialogTitle>
            <DialogDescription>
              Ubah data kehadiran untuk {editingRecord?.name}.
              Kosongkan Jam Keluar untuk mereset status "Belum Pulang".
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Jam Masuk</Label>
              <Input
                type="datetime-local"
                className="col-span-3"
                value={editForm.clock_in}
                onChange={e => setEditForm({ ...editForm, clock_in: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Jam Keluar</Label>
              <div className="col-span-3">
                <Input
                  type="datetime-local"
                  className="w-full mb-1"
                  value={editForm.clock_out}
                  onChange={e => setEditForm({ ...editForm, clock_out: e.target.value })}
                />
                <p className="text-[10px] text-slate-500">*Kosongkan untuk mengembalikan status "Sedang Bekerja"</p>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Status</Label>
              <div className="col-span-3">
                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">Hadir (Present)</SelectItem>
                    <SelectItem value="late">Terlambat (Late)</SelectItem>
                    <SelectItem value="early_leave">Pulang Awal</SelectItem>
                    <SelectItem value="absent">Alpha / Mangkir</SelectItem>
                    <SelectItem value="permission">Izin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Catatan</Label>
              <Textarea
                className="col-span-3"
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
              Anda akan menghapus data kehadiran untuk <b>{recordToDelete?.name}</b>.
              <br /><br />
              Tindakan ini akan <b>me-reset</b> status karyawan menjadi "Belum Hadir" untuk hari tersebut.
              Data yang dihapus tidak dapat dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Ya, Hapus Permanen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-4 md:space-y-6">
        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">

          {/* Top Row Mobile: View Mode & Export Icon */}
          <div className="flex items-center justify-between gap-4">
            {/* View Selector - Scrollable on mobile */}
            <div className="flex bg-slate-100 p-1 rounded-lg shrink-0 overflow-x-auto no-scrollbar w-full md:w-auto">
              {(['daily', 'monthly', 'range'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-md transition-all capitalize whitespace-nowrap flex-1 md:flex-none",
                    viewMode === m ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {m === 'range' ? 'Periode' : (m === 'daily' ? 'Harian' : 'Bulanan')}
                </button>
              ))}
            </div>

            {/* Mobile Export (Visible only on mobile) */}
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-10 w-10 border-slate-200">
                    <Download className="w-4 h-4 text-slate-600" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport('excel')}><FileSpreadsheet className="w-4 h-4 mr-2" />Excel Report</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('pdf')}><FileText className="w-4 h-4 mr-2" />PDF Report</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Date Picker Area */}
          <div className="flex-1 flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-4">
            {viewMode === 'range' ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full md:w-[280px] justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>{format(dateRange.from, "d MMM yyyy")} - {format(dateRange.to, "d MMM yyyy")}</>
                      ) : (
                        format(dateRange.from, "d MMM yyyy")
                      )
                    ) : (
                      <span>Pilih rentang tanggal</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            ) : (
              <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1 w-full md:w-auto">
                <Button variant="ghost" size="icon" onClick={goToPrevious} className="h-8 w-8"><ChevronLeft className="w-4 h-4" /></Button>
                <span className="flex-1 md:w-40 text-center font-semibold text-slate-700 text-sm">
                  {viewMode === 'daily' ? format(new Date(filterDate), 'dd MMM yyyy', { locale: id }) : format(selectedMonth, 'MMMM yyyy', { locale: id })}
                </span>
                <Button variant="ghost" size="icon" onClick={goToNext} className="h-8 w-8"><ChevronRight className="w-4 h-4" /></Button>
              </div>
            )}

            <div className="w-full md:ml-auto md:w-64 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="Cari nama karyawan..." className="pl-9 w-full" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>

            {/* Desktop Export Button */}
            <div className="hidden md:block">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="bg-blue-700 hover:bg-blue-800 gap-2"><Download className="w-4 h-4" /> Export</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport('excel')}><FileSpreadsheet className="w-4 h-4 mr-2" />Excel Report</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('pdf')}><FileText className="w-4 h-4 mr-2" />PDF Report</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Stats Summary (Monthly/Range Only) */}
        {viewMode !== 'daily' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardContent className="p-4 flex flex-col justify-center text-center md:text-left">
                <span className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase">Hadir</span>
                <span className="text-xl md:text-2xl font-bold text-green-600">{monthStatsTotal.present}</span>
              </CardContent>
            </Card>
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardContent className="p-4 flex flex-col justify-center text-center md:text-left">
                <span className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase">Terlambat</span>
                <span className="text-xl md:text-2xl font-bold text-amber-600">{monthStatsTotal.late}</span>
              </CardContent>
            </Card>
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardContent className="p-4 flex flex-col justify-center text-center md:text-left">
                <span className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase">Alpha</span>
                <span className="text-xl md:text-2xl font-bold text-red-600">{monthStatsTotal.absent}</span>
              </CardContent>
            </Card>
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardContent className="p-4 flex flex-col justify-center text-center md:text-left">
                <span className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase">Total Karyawan</span>
                <span className="text-xl md:text-2xl font-bold text-slate-800">{monthStatsTotal.employees}</span>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Desktop Table View */}
        <Card className="hidden md:block bg-white border-slate-200 shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Nama Karyawan</TableHead>
                <TableHead>Departemen</TableHead>
                {viewMode === 'daily' ? (
                  <>
                    <TableHead>Jam Masuk</TableHead>
                    <TableHead>Jam Keluar</TableHead>
                    <TableHead>Durasi</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]">Aksi</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead className="text-center">Hadir</TableHead>
                    <TableHead className="text-center">Terlambat</TableHead>
                    <TableHead className="text-center">Alpha</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.length > 0 ? filteredData.map((item, i) => (
                <TableRow key={i} className="hover:bg-slate-50 transition-colors">
                  <TableCell className="font-medium text-slate-700">{item.name}</TableCell>
                  <TableCell className="text-slate-500">{item.department}</TableCell>
                  {viewMode === 'daily' ? (
                    <>
                      <TableCell>
                        {(item as any).clock_in ? (
                          <div className="flex items-center gap-2 text-green-700 bg-green-50 w-fit px-2 py-1 rounded">
                            <LogIn className="w-3 h-3" />
                            {format(new Date((item as any).clock_in), 'HH:mm')}
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {(item as any).clock_out ? (
                          <div className="flex items-center gap-2 text-blue-700 bg-blue-50 w-fit px-2 py-1 rounded">
                            <LogOut className="w-3 h-3" />
                            {format(new Date((item as any).clock_out), 'HH:mm')}
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell>{calculateDuration((item as any).clock_in, (item as any).clock_out)}</TableCell>
                      <TableCell>{getStatusBadge((item as any).status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={() => openEdit(item)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => openDelete(item)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="text-center font-bold text-green-600">{(item as MonthlyStats).present}</TableCell>
                      <TableCell className="text-center font-bold text-amber-600">{(item as MonthlyStats).late}</TableCell>
                      <TableCell className="text-center font-bold text-red-600">{(item as MonthlyStats).absent}</TableCell>
                      <TableCell className="text-center font-medium">{(item as MonthlyStats).total_attendance}</TableCell>
                    </>
                  )}
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-slate-400">Tidak ada data untuk periode ini</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Mobile Card List View */}
        <div className="md:hidden space-y-4">
          {filteredData.length > 0 ? filteredData.map((item, i) => (
            <div key={i} className="bg-white rounded-[20px] p-4 shadow-sm border border-slate-100">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm">
                    {item.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 leading-tight">{item.name}</h3>
                    <p className="text-[11px] text-slate-500">{item.department}</p>
                  </div>
                </div>
                {viewMode === 'daily' && getStatusBadge((item as any).status)}
              </div>

              {viewMode === 'daily' ? (
                <div className="grid grid-cols-3 gap-2 bg-slate-50 rounded-xl p-3 text-xs mt-2">
                  <div className="text-center p-1">
                    <span className="block text-[10px] text-slate-400 mb-0.5">Masuk</span>
                    <span className="font-bold text-slate-800">{(item as any).clock_in ? format(new Date((item as any).clock_in), 'HH:mm') : '-'}</span>
                  </div>
                  <div className="text-center border-l border-slate-200 p-1">
                    <span className="block text-[10px] text-slate-400 mb-0.5">Pulang</span>
                    <span className="font-bold text-slate-800">{(item as any).clock_out ? format(new Date((item as any).clock_out), 'HH:mm') : '-'}</span>
                  </div>
                  <div className="text-center border-l border-slate-200 p-1">
                    <span className="block text-[10px] text-slate-400 mb-0.5">Durasi</span>
                    <span className="font-bold text-blue-600">{calculateDuration((item as any).clock_in, (item as any).clock_out)}</span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 text-center bg-slate-50 p-3 rounded-xl mt-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-green-600">{(item as MonthlyStats).present}</span>
                    <span className="text-[10px] text-slate-500">Hadir</span>
                  </div>
                  <div className="flex flex-col border-l border-slate-200">
                    <span className="text-sm font-bold text-amber-600">{(item as MonthlyStats).late}</span>
                    <span className="text-[10px] text-slate-500">Telat</span>
                  </div>
                  <div className="flex flex-col border-l border-slate-200">
                    <span className="text-sm font-bold text-red-600">{(item as MonthlyStats).absent}</span>
                    <span className="text-[10px] text-slate-500">Alpha</span>
                  </div>
                  <div className="flex flex-col border-l border-slate-200">
                    <span className="text-sm font-bold text-slate-800">{(item as MonthlyStats).total_attendance}</span>
                    <span className="text-[10px] text-slate-500">Total</span>
                  </div>
                </div>
              )}
            </div>
          )) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                <Search className="h-8 w-8 text-slate-300" />
              </div>
              <p className="text-slate-500 font-medium">Tidak ada data ditemukan</p>
              <p className="text-slate-400 text-xs mt-1">Coba ubah filter tanggal atau pencarian</p>
            </div>
          )}
        </div>

      </div>
    </EnterpriseLayout>
  );
};

export default RekapAbsensi;