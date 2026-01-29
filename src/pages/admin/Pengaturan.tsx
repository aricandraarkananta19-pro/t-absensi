import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Settings, Clock, Building2, Bell, Shield, Save, Trash2, AlertTriangle, Loader2, CalendarDays, Download, FileSpreadsheet, Database, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { exportToExcel } from "@/lib/exportUtils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const Pengaturan = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState({
    companyName: "PT. Talenta Traincom Indonesia",
    clockInStart: "08:00",
    clockInEnd: "09:00",
    clockOutStart: "17:00",
    clockOutEnd: "18:00",
    lateThreshold: "09:00",
    enableLocationTracking: true,
    enableNotifications: true,
    requirePhotoOnClockIn: false,
    autoClockOut: false,
    autoClockOutTime: "22:00",
    maxLeaveDays: 12,
    attendanceStartDate: new Date().toISOString().split("T")[0],
  });

  const [isResetting, setIsResetting] = useState(false);
  const [isResettingLeave, setIsResettingLeave] = useState(false);
  const [isResettingAll, setIsResettingAll] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [originalStartDate, setOriginalStartDate] = useState("");
  const [newStartDate, setNewStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [isStartingNewPeriod, setIsStartingNewPeriod] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("key, value");

      if (error) throw error;

      // Fetch active attendance period
      const { data: periodData } = await supabase
        .from("attendance_periods")
        .select("start_date")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .maybeSingle();

      if (data) {
        const settingsMap: Record<string, string> = {};
        data.forEach((item: { key: string; value: string }) => {
          settingsMap[item.key] = item.value;
        });

        const activeStartDate = periodData?.start_date || settingsMap.attendance_start_date || new Date().toISOString().split("T")[0];

        setSettings({
          companyName: settingsMap.company_name || "PT. Talenta Traincom Indonesia",
          clockInStart: settingsMap.clock_in_start || "08:00",
          clockInEnd: settingsMap.clock_in_end || "09:00",
          clockOutStart: settingsMap.clock_out_start || "17:00",
          clockOutEnd: settingsMap.clock_out_end || "18:00",
          lateThreshold: settingsMap.late_threshold || "09:00",
          enableLocationTracking: settingsMap.enable_location_tracking === "true",
          enableNotifications: settingsMap.enable_notifications === "true",
          requirePhotoOnClockIn: settingsMap.require_photo_on_clock_in === "true",
          autoClockOut: settingsMap.auto_clock_out === "true",
          autoClockOutTime: settingsMap.auto_clock_out_time || "22:00",
          maxLeaveDays: parseInt(settingsMap.max_leave_days) || 12,
          attendanceStartDate: activeStartDate,
        });
        setOriginalStartDate(activeStartDate);
        // Initialize newStartDate with current active date for better UX (or today)
        setNewStartDate(new Date().toISOString().split("T")[0]);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartNewPeriod = async () => {
    setIsStartingNewPeriod(true);
    try {
      // 1. Deactivate old periods
      await supabase
        .from("attendance_periods")
        .update({ is_active: false })
        .eq("is_active", true);

      // 2. Create new period
      const { error } = await supabase
        .from("attendance_periods")
        .insert({
          start_date: newStartDate,
          is_active: true
        });

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Periode absensi baru telah dimulai."
      });

      // Update local state without full reload
      setSettings(prev => ({ ...prev, attendanceStartDate: newStartDate }));
      setOriginalStartDate(newStartDate);

      // Also update system settings for backward compatibility if desired, 
      // but we should primarily rely on attendance_periods now.
      await supabase
        .from("system_settings")
        .update({ value: newStartDate })
        .eq("key", "attendance_start_date");

    } catch (error: any) {
      console.error("Error starting new period:", error);
      toast({
        variant: "destructive",
        title: "Gagal",
        description: error.message || "Gagal memulai periode baru"
      });
    } finally {
      setIsStartingNewPeriod(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates = [
        { key: "company_name", value: settings.companyName },
        { key: "clock_in_start", value: settings.clockInStart },
        { key: "clock_in_end", value: settings.clockInEnd },
        { key: "clock_out_start", value: settings.clockOutStart },
        { key: "clock_out_end", value: settings.clockOutEnd },
        { key: "late_threshold", value: settings.lateThreshold },
        { key: "enable_location_tracking", value: settings.enableLocationTracking.toString() },
        { key: "enable_notifications", value: settings.enableNotifications.toString() },
        { key: "require_photo_on_clock_in", value: settings.requirePhotoOnClockIn.toString() },
        { key: "auto_clock_out", value: settings.autoClockOut.toString() },
        { key: "auto_clock_out_time", value: settings.autoClockOutTime },
        { key: "max_leave_days", value: settings.maxLeaveDays.toString() },
        { key: "attendance_start_date", value: settings.attendanceStartDate },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from("system_settings")
          .update({ value: update.value })
          .eq("key", update.key);

        if (error) throw error;
      }

      toast({
        title: "Pengaturan Tersimpan",
        description: "Konfigurasi sistem telah diperbarui dan akan diterapkan",
      });
    } catch (error: any) {
      console.error("Error saving settings:", error);
      toast({
        variant: "destructive",
        title: "Gagal Menyimpan",
        description: error.message || "Terjadi kesalahan saat menyimpan pengaturan",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Backup all attendance data
  const handleBackupAttendance = async () => {
    setIsBackingUp(true);
    try {
      // Fetch all attendance with profiles
      const { data: attendanceData, error: attError } = await supabase
        .from("attendance")
        .select("*")
        .order("clock_in", { ascending: false });

      if (attError) throw attError;

      // Fetch profiles for mapping
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, department");

      const profileMap: Record<string, { full_name: string | null; department: string | null }> = {};
      profiles?.forEach(p => {
        profileMap[p.user_id] = { full_name: p.full_name, department: p.department };
      });

      // Prepare attendance export data
      const attendanceExportData = attendanceData?.map(record => ({
        tanggal: new Date(record.clock_in).toLocaleDateString("id-ID"),
        nama: profileMap[record.user_id]?.full_name || "-",
        departemen: profileMap[record.user_id]?.department || "-",
        clock_in: new Date(record.clock_in).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        clock_out: record.clock_out ? new Date(record.clock_out).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-",
        status: record.status === "present" ? "Hadir" : record.status === "late" ? "Terlambat" : record.status === "early_leave" ? "Pulang Awal" : record.status,
        lokasi_masuk: record.clock_in_location || "-",
        lokasi_pulang: record.clock_out_location || "-",
      })) || [];

      // Export attendance
      exportToExcel({
        title: "Backup Data Absensi",
        subtitle: `Diexport pada ${new Date().toLocaleDateString("id-ID")} ${new Date().toLocaleTimeString("id-ID")}`,
        filename: `backup-absensi-${new Date().toISOString().split("T")[0]}`,
        columns: [
          { header: "Tanggal", key: "tanggal", width: 60 },
          { header: "Nama", key: "nama", width: 100 },
          { header: "Departemen", key: "departemen", width: 80 },
          { header: "Clock In", key: "clock_in", width: 50 },
          { header: "Clock Out", key: "clock_out", width: 50 },
          { header: "Status", key: "status", width: 60 },
          { header: "Lokasi Masuk", key: "lokasi_masuk", width: 100 },
          { header: "Lokasi Pulang", key: "lokasi_pulang", width: 100 },
        ],
        data: attendanceExportData,
      });

      toast({
        title: "Backup Berhasil",
        description: `${attendanceExportData.length} data absensi berhasil dibackup`,
      });
    } catch (error: any) {
      console.error("Backup error:", error);
      toast({
        variant: "destructive",
        title: "Gagal Backup",
        description: error.message || "Terjadi kesalahan saat backup data",
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  // Backup all leave requests
  const handleBackupLeave = async () => {
    setIsBackingUp(true);
    try {
      const { data: leaveData, error: leaveError } = await supabase
        .from("leave_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (leaveError) throw leaveError;

      // Fetch profiles for mapping
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, department");

      const profileMap: Record<string, { full_name: string | null; department: string | null }> = {};
      profiles?.forEach(p => {
        profileMap[p.user_id] = { full_name: p.full_name, department: p.department };
      });

      const leaveExportData = leaveData?.map(record => ({
        tanggal_pengajuan: new Date(record.created_at).toLocaleDateString("id-ID"),
        nama: profileMap[record.user_id]?.full_name || "-",
        departemen: profileMap[record.user_id]?.department || "-",
        jenis: record.leave_type === "cuti" ? "Cuti Tahunan" : record.leave_type === "sakit" ? "Sakit" : record.leave_type === "izin" ? "Izin" : record.leave_type,
        mulai: new Date(record.start_date).toLocaleDateString("id-ID"),
        selesai: new Date(record.end_date).toLocaleDateString("id-ID"),
        status: record.status === "approved" ? "Disetujui" : record.status === "rejected" ? "Ditolak" : "Menunggu",
        alasan: record.reason || "-",
      })) || [];

      exportToExcel({
        title: "Backup Data Cuti",
        subtitle: `Diexport pada ${new Date().toLocaleDateString("id-ID")} ${new Date().toLocaleTimeString("id-ID")}`,
        filename: `backup-cuti-${new Date().toISOString().split("T")[0]}`,
        columns: [
          { header: "Tanggal Pengajuan", key: "tanggal_pengajuan", width: 70 },
          { header: "Nama", key: "nama", width: 100 },
          { header: "Departemen", key: "departemen", width: 80 },
          { header: "Jenis", key: "jenis", width: 60 },
          { header: "Mulai", key: "mulai", width: 60 },
          { header: "Selesai", key: "selesai", width: 60 },
          { header: "Status", key: "status", width: 50 },
          { header: "Alasan", key: "alasan", width: 120 },
        ],
        data: leaveExportData,
      });

      toast({
        title: "Backup Berhasil",
        description: `${leaveExportData.length} data cuti berhasil dibackup`,
      });
    } catch (error: any) {
      console.error("Backup error:", error);
      toast({
        variant: "destructive",
        title: "Gagal Backup",
        description: error.message || "Terjadi kesalahan saat backup data",
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  // Backup all data
  const handleBackupAll = async () => {
    await handleBackupAttendance();
    await handleBackupLeave();
  };

  // Check if start date has changed
  const hasStartDateChanged = settings.attendanceStartDate !== originalStartDate;

  const handleResetAttendance = async () => {
    setIsResetting(true);
    try {
      const { error: attendanceError } = await supabase
        .from("attendance")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (attendanceError) throw attendanceError;

      toast({
        title: "Reset Berhasil",
        description: "Seluruh data absensi telah dihapus.",
      });
    } catch (error: any) {
      console.error("Reset error:", error);
      toast({
        variant: "destructive",
        title: "Gagal Reset",
        description: error.message || "Terjadi kesalahan saat mereset data absensi",
      });
    } finally {
      setIsResetting(false);
    }
  };

  const handleResetLeave = async () => {
    setIsResettingLeave(true);
    try {
      const { error: leaveError } = await supabase
        .from("leave_requests")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (leaveError) throw leaveError;

      toast({
        title: "Reset Berhasil",
        description: "Seluruh data pengajuan cuti telah dihapus.",
      });
    } catch (error: any) {
      console.error("Reset leave error:", error);
      toast({
        variant: "destructive",
        title: "Gagal Reset",
        description: error.message || "Terjadi kesalahan saat mereset data cuti",
      });
    } finally {
      setIsResettingLeave(false);
    }
  };

  const handleResetAll = async () => {
    setIsResettingAll(true);
    try {
      // Delete attendance
      const { error: attendanceError } = await supabase
        .from("attendance")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (attendanceError) throw attendanceError;

      // Delete leave requests
      const { error: leaveError } = await supabase
        .from("leave_requests")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (leaveError) throw leaveError;

      toast({
        title: "Reset Berhasil",
        description: "Seluruh data absensi dan cuti telah dihapus. Sistem siap untuk data baru.",
      });
    } catch (error: any) {
      console.error("Reset all error:", error);
      toast({
        variant: "destructive",
        title: "Gagal Reset",
        description: error.message || "Terjadi kesalahan saat mereset data",
      });
    } finally {
      setIsResettingAll(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Settings className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Pengaturan</h1>
                <p className="text-sm text-muted-foreground">Konfigurasi sistem</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Company Info */}
          <Card className="border-border animate-fade-in">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">Informasi Perusahaan</CardTitle>
                  <CardDescription>Pengaturan dasar perusahaan</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Nama Perusahaan</Label>
                <Input
                  id="companyName"
                  value={settings.companyName}
                  onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Attendance Period */}
          <Card className="border-primary/30 animate-fade-in bg-primary/5" style={{ animationDelay: "0.05s" }}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <CalendarDays className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">Periode Absensi Aktif</CardTitle>
                  <CardDescription>Atur periode aktif untuk laporan dan rekap</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* Active Period Display */}
              <div className="p-4 bg-background border rounded-lg shadow-sm">
                <Label className="text-muted-foreground mb-2 block">Periode Aktif Saat Ini</Label>
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  <span className="text-xl font-bold">
                    {new Date(settings.attendanceStartDate).toLocaleDateString("id-ID", {
                      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                    })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Laporan dan rekap saat ini menampilkan data mulai dari tanggal ini.
                </p>
              </div>

              <Separator />

              {/* Backup Section */}
              <div className="p-4 rounded-lg border border-warning/30 bg-warning/5">
                <div className="flex items-start gap-3">
                  <Database className="h-5 w-5 text-warning mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-foreground mb-1">Backup Data</p>
                    <p className="text-sm text-muted-foreground mb-3">
                      Sangat disarankan untuk membackup data sebelum memulai periode baru.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBackupAttendance}
                        disabled={isBackingUp}
                        className="gap-2"
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        Backup Absensi
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBackupLeave}
                        disabled={isBackingUp}
                        className="gap-2"
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        Backup Cuti
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleBackupAll}
                        disabled={isBackingUp}
                        className="gap-2"
                      >
                        <Download className="h-4 w-4" />
                        {isBackingUp ? "Memproses..." : "Backup Semua"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Start New Period */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-base font-semibold">Mulai Periode Baru</Label>
                  <p className="text-sm text-muted-foreground">
                    Pilih tanggal mulai untuk periode baru.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="space-y-2 w-full sm:w-auto">
                    <Label htmlFor="newStartDate">Tanggal Mulai Baru</Label>
                    <Input
                      id="newStartDate"
                      type="date"
                      value={newStartDate}
                      onChange={(e) => setNewStartDate(e.target.value)}
                      className="w-full sm:w-[200px]"
                    />
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button className="gap-2 w-full sm:w-auto" disabled={isStartingNewPeriod}>
                        <RefreshCw className="h-4 w-4" />
                        {isStartingNewPeriod ? "Memproses..." : "Terapkan Periode Baru"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Konfirmasi Periode Baru</AlertDialogTitle>
                        <AlertDialogDescription>
                          Anda akan mengubah awal periode absensi menjadi <strong>{new Date(newStartDate).toLocaleDateString("id-ID")}</strong>.
                          <br /><br />
                          Data periode sebelumnya akan tetap tersimpan di database, namun laporan aktif akan direset mulai tanggal ini.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleStartNewPeriod}>Ya, Terapkan</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Work Hours */}
          <Card className="border-border animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-accent" />
                <div>
                  <CardTitle className="text-lg">Jam Kerja</CardTitle>
                  <CardDescription>Pengaturan waktu absensi</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Clock In Mulai</Label>
                  <Input
                    type="time"
                    value={settings.clockInStart}
                    onChange={(e) => setSettings({ ...settings, clockInStart: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Clock In Selesai</Label>
                  <Input
                    type="time"
                    value={settings.clockInEnd}
                    onChange={(e) => setSettings({ ...settings, clockInEnd: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Clock Out Mulai</Label>
                  <Input
                    type="time"
                    value={settings.clockOutStart}
                    onChange={(e) => setSettings({ ...settings, clockOutStart: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Clock Out Selesai</Label>
                  <Input
                    type="time"
                    value={settings.clockOutEnd}
                    onChange={(e) => setSettings({ ...settings, clockOutEnd: e.target.value })}
                  />
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Batas Waktu Terlambat</Label>
                <Input
                  type="time"
                  value={settings.lateThreshold}
                  onChange={(e) => setSettings({ ...settings, lateThreshold: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Karyawan yang clock-in setelah waktu ini dianggap terlambat
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Features */}
          <Card className="border-border animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-info" />
                <div>
                  <CardTitle className="text-lg">Fitur</CardTitle>
                  <CardDescription>Aktifkan atau nonaktifkan fitur</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Tracking Lokasi</p>
                  <p className="text-sm text-muted-foreground">Rekam lokasi GPS saat absensi</p>
                </div>
                <Switch
                  checked={settings.enableLocationTracking}
                  onCheckedChange={(checked) => setSettings({ ...settings, enableLocationTracking: checked })}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Foto saat Clock In</p>
                  <p className="text-sm text-muted-foreground">Wajib foto selfie saat absensi</p>
                </div>
                <Switch
                  checked={settings.requirePhotoOnClockIn}
                  onCheckedChange={(checked) => setSettings({ ...settings, requirePhotoOnClockIn: checked })}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Auto Clock Out</p>
                  <p className="text-sm text-muted-foreground">Otomatis clock out jika lupa</p>
                </div>
                <Switch
                  checked={settings.autoClockOut}
                  onCheckedChange={(checked) => setSettings({ ...settings, autoClockOut: checked })}
                />
              </div>
              {settings.autoClockOut && (
                <div className="space-y-2 pl-4 border-l-2 border-border">
                  <Label>Waktu Auto Clock Out</Label>
                  <Input
                    type="time"
                    value={settings.autoClockOutTime}
                    onChange={(e) => setSettings({ ...settings, autoClockOutTime: e.target.value })}
                    className="max-w-[150px]"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Leave Settings */}
          <Card className="border-border animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-warning" />
                <div>
                  <CardTitle className="text-lg">Cuti</CardTitle>
                  <CardDescription>Pengaturan cuti tahunan</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Jatah Cuti Tahunan (hari)</Label>
                <Input
                  type="number"
                  value={settings.maxLeaveDays}
                  onChange={(e) => setSettings({ ...settings, maxLeaveDays: parseInt(e.target.value) })}
                  className="max-w-[150px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone - Reset Attendance */}
          <Card className="border-destructive/50 animate-fade-in" style={{ animationDelay: "0.4s" }}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div>
                  <CardTitle className="text-lg text-destructive">Zona Berbahaya</CardTitle>
                  <CardDescription>Tindakan yang tidak dapat dibatalkan</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Reset Absensi */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                <div>
                  <p className="font-medium text-foreground">Reset Data Absensi</p>
                  <p className="text-sm text-muted-foreground">
                    Hapus seluruh data absensi saja.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="gap-2 border-destructive/50 text-destructive hover:bg-destructive/10" disabled={isResetting}>
                      <Trash2 className="h-4 w-4" />
                      Reset Absensi
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        Konfirmasi Reset Data Absensi
                      </AlertDialogTitle>
                      <AlertDialogDescription asChild>
                        <div className="space-y-2">
                          <p>Tindakan ini akan menghapus <strong>seluruh data absensi</strong>.</p>
                          <p className="mt-4 font-semibold text-destructive">
                            Apakah Anda yakin ingin melanjutkan?
                          </p>
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleResetAttendance}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={isResetting}
                      >
                        {isResetting ? "Mereset..." : "Ya, Reset Absensi"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              {/* Reset Cuti */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                <div>
                  <p className="font-medium text-foreground">Reset Data Cuti</p>
                  <p className="text-sm text-muted-foreground">
                    Hapus seluruh data pengajuan cuti.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="gap-2 border-destructive/50 text-destructive hover:bg-destructive/10" disabled={isResettingLeave}>
                      <Trash2 className="h-4 w-4" />
                      Reset Cuti
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        Konfirmasi Reset Data Cuti
                      </AlertDialogTitle>
                      <AlertDialogDescription asChild>
                        <div className="space-y-2">
                          <p>Tindakan ini akan menghapus <strong>seluruh data pengajuan cuti</strong>.</p>
                          <p className="mt-4 font-semibold text-destructive">
                            Apakah Anda yakin ingin melanjutkan?
                          </p>
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleResetLeave}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={isResettingLeave}
                      >
                        {isResettingLeave ? "Mereset..." : "Ya, Reset Cuti"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              {/* Reset Semua Data Demo */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-destructive bg-destructive/10">
                <div>
                  <p className="font-medium text-foreground">Reset Semua Data Demo</p>
                  <p className="text-sm text-muted-foreground">
                    Hapus data absensi DAN cuti sekaligus. Data karyawan tetap aman.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="gap-2" disabled={isResettingAll}>
                      <Trash2 className="h-4 w-4" />
                      Reset Semua
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        Konfirmasi Reset Semua Data Demo
                      </AlertDialogTitle>
                      <AlertDialogDescription asChild>
                        <div className="space-y-2">
                          <p>Tindakan ini akan:</p>
                          <ul className="list-disc list-inside space-y-1 text-sm">
                            <li>Menghapus <strong>seluruh data absensi</strong></li>
                            <li>Menghapus <strong>seluruh data pengajuan cuti</strong></li>
                          </ul>
                          <p className="mt-3">Tindakan ini <strong>tidak akan</strong> menghapus:</p>
                          <ul className="list-disc list-inside space-y-1 text-sm">
                            <li>Data karyawan</li>
                            <li>Pengaturan sistem</li>
                          </ul>
                          <p className="mt-4 font-semibold text-destructive">
                            Apakah Anda yakin ingin melanjutkan? Tindakan ini tidak dapat dibatalkan.
                          </p>
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleResetAll}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={isResettingAll}
                      >
                        {isResettingAll ? "Mereset..." : "Ya, Reset Semua Data"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <Button onClick={handleSave} className="w-full gap-2" size="lg" disabled={isSaving || isLoading}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? "Menyimpan..." : "Simpan Pengaturan"}
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Pengaturan;
