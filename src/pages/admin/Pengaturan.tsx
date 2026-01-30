import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Building2, Clock, MapPin, CalendarDays,
  ShieldAlert, Save, RotateCcw, Download, Trash2,
  ChevronRight, Settings, Smartphone, Bell, Database,
  FileText, Briefcase, Info
} from "lucide-react";
import { useSystemSettings, SystemSettings } from "@/hooks/useSystemSettings";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
import { toast } from "@/hooks/use-toast";
import { exportToExcel } from "@/lib/exportUtils";
import EnterpriseLayout from "@/components/layout/EnterpriseLayout";

// ==========================================
// TYPES & CONSTANTS
// ==========================================
type SettingsSection =
  | "general"
  | "schedule"
  | "attendance"
  | "leaves"
  | "system";

const SECTIONS: { id: SettingsSection; label: string; icon: any; description: string }[] = [
  { id: "general", label: "Profil Perusahaan", icon: Building2, description: "Nama dan identitas perusahaan" },
  { id: "schedule", label: "Jam Kerja & Shift", icon: Clock, description: "Jadwal kerja dan batas keterlambatan" },
  { id: "attendance", label: "Aturan Absensi", icon: MapPin, description: "Lokasi, foto, dan validasi" },
  { id: "leaves", label: "Cuti & Izin", icon: CalendarDays, description: "Kuota dan aturan cuti" },
  { id: "system", label: "Sistem & Data", icon: Database, description: "Backup, reset, dan periode sistem" },
];

const Pengaturan = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings, isLoading, updateSettings } = useSystemSettings();
  const isMobile = useIsMobile();

  // Local state for form handling (optimistic UI foundation)
  const [formData, setFormData] = useState<SystemSettings>(settings);
  const [activeSection, setActiveSection] = useState<SettingsSection>("general");
  const [activeMobileSheet, setActiveMobileSheet] = useState<SettingsSection | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetType, setResetType] = useState<"attendance" | "leaves" | "all">("attendance");
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  // Sync with fetched settings
  useEffect(() => {
    // Only update if not currently editing (to avoid overwrite) or on initial load
    // Actually simplicity: Update formData when settings load, unless dirty? 
    // For now, simple sync.
    if (!hasChanges) {
      setFormData(settings);
    }
  }, [settings, hasChanges]);

  // Check logic
  const handleChange = (key: keyof SystemSettings, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  // Prevent accidental navigation
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = "Perubahan belum disimpan. Yakin ingin keluar?";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasChanges]);

  // Keyboard shortcut (Ctrl+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (hasChanges) {
          setShowSaveConfirm(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasChanges]);

  // ==========================================
  // SAVE / UPDATE LOGIC
  // ==========================================
  const executeSave = async () => {
    setIsSaving(true);
    setShowSaveConfirm(false);
    try {
      // Validation Logic
      if (formData.companyName.length < 3) throw new Error("Nama perusahaan minimal 3 karakter");
      // Time validation logic...

      // 1. Update System Settings
      await updateSettings(formData);

      // 2. Update Active Period (Manually enforce consistency)
      if (formData.attendanceStartDate !== settings.attendanceStartDate) {
        const { data: activePeriod } = await supabase
          .from("attendance_periods")
          .select("id")
          .eq("is_active", true)
          .maybeSingle();

        if (activePeriod) {
          await supabase
            .from("attendance_periods")
            .update({ start_date: formData.attendanceStartDate })
            .eq("id", activePeriod.id);
        }
      }

      toast({
        title: "Pengaturan Disimpan",
        description: "Perubahan telah diterapkan ke sistem.",
      });
      setHasChanges(false);
      setActiveMobileSheet(null);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal Menyimpan",
        description: error.message || "Terjadi kesalahan.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = () => {
    // ALWAYS require confirmation
    setShowSaveConfirm(true);
  };

  const handleCancel = () => {
    setFormData(settings);
    setHasChanges(false);
    setActiveMobileSheet(null);
  };

  // ==========================================
  // BACKUP & RESET LOGIC
  // ==========================================
  const logAuditAction = async (action: string, description: string) => {
    if (!user) return;
    try {
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action,
        target_table: "system_settings",
        description,
      });
    } catch (e) {
      console.error("Audit log failed", e);
    }
  };

  const handleBackupAttendance = async () => {
    setIsSaving(true);
    try {
      toast({ title: "Backup Absensi", description: "Sedang memproses data..." });

      const { data: attendanceData, error } = await supabase
        .from("attendance")
        .select("*")
        .order("clock_in", { ascending: false });

      if (error) throw error;

      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, department");
      const profileMap: Record<string, any> = {};
      profiles?.forEach((p: any) => profileMap[p.user_id] = p);

      const exportData = attendanceData.map(r => ({
        tanggal: new Date(r.clock_in).toLocaleDateString("id-ID"),
        nama: profileMap[r.user_id]?.full_name || "-",
        departemen: profileMap[r.user_id]?.department || "-",
        clock_in: new Date(r.clock_in).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        clock_out: r.clock_out ? new Date(r.clock_out).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-",
        status: r.status,
        lokasi: r.clock_in_location || "-"
      }));

      exportToExcel({
        title: "Backup Data Absensi",
        subtitle: `Diexport pada ${new Date().toLocaleString("id-ID")}`,
        filename: `backup-absensi-${new Date().toISOString().split('T')[0]}`,
        columns: [
          { header: "Tanggal", key: "tanggal", width: 15 },
          { header: "Nama", key: "nama", width: 25 },
          { header: "Departemen", key: "departemen", width: 15 },
          { header: "Clock In", key: "clock_in", width: 10 },
          { header: "Clock Out", key: "clock_out", width: 10 },
          { header: "Status", key: "status", width: 15 },
          { header: "Lokasi", key: "lokasi", width: 30 },
        ],
        data: exportData
      });

      await logAuditAction("BACKUP_ATTENDANCE", "Backup data absensi");
      toast({ title: "Selesai", description: `${exportData.length} data berhasil diunduh.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Gagal Backup", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetAttendance = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("attendance")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Safe delete all

      if (error) throw error;

      await logAuditAction("RESET_ATTENDANCE", "Reset semua data absensi");
      toast({ title: "Reset Berhasil", description: "Semua data absensi telah dihapus selamanya." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Gagal Reset", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetLeave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("leave_requests")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (error) throw error;

      await logAuditAction("RESET_LEAVE", "Reset semua data cuti");
      toast({ title: "Reset Berhasil", description: "Semua data pengajuan cuti telah dihapus." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Gagal Reset", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  // ==========================================
  // RENDER SECTIONS
  // ==========================================
  const renderGeneralSettings = () => (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Identitas Perusahaan</CardTitle>
          <CardDescription>Informasi yang tampil di laporan dan aplikasi karyawan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nama Perusahaan</Label>
            <Input
              value={formData.companyName}
              onChange={(e) => handleChange("companyName", e.target.value)}
              placeholder="PT. Contoh Indonesia"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderScheduleSettings = () => (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Jadwal Kerja Normal</CardTitle>
          <CardDescription>Pengaturan jam masuk dan pulang standar.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Jam Masuk (Mulai)</Label>
              <Input type="time" value={formData.clockInStart} onChange={(e) => handleChange("clockInStart", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Jam Masuk (Selesai)</Label>
              <Input type="time" value={formData.clockInEnd} onChange={(e) => handleChange("clockInEnd", e.target.value)} />
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Jam Pulang (Mulai)</Label>
              <Input type="time" value={formData.clockOutStart} onChange={(e) => handleChange("clockOutStart", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Jam Pulang (Selesai)</Label>
              <Input type="time" value={formData.clockOutEnd} onChange={(e) => handleChange("clockOutEnd", e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Toleransi & Lainnya</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Batas Keterlambatan</Label>
            <Input type="time" value={formData.lateThreshold} onChange={(e) => handleChange("lateThreshold", e.target.value)} />
            <p className="text-xs text-slate-500">Lewat dari jam ini dianggap "Terlambat".</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderAttendanceSettings = () => (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Validasi Kehadiran</CardTitle>
          <CardDescription>Persyaratan untuk melakukan absensi.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Wajib Foto Selfie</Label>
              <p className="text-sm text-slate-500">Karyawan wajib menyertakan foto saat clock-in.</p>
            </div>
            <Switch
              checked={formData.requirePhotoOnClockIn}
              onCheckedChange={(c) => handleChange("requirePhotoOnClockIn", c)}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Pelacakan Lokasi (GPS)</Label>
              <p className="text-sm text-slate-500">Hanya izinkan absen di radius kantor.</p>
            </div>
            <Switch
              checked={formData.enableLocationTracking}
              onCheckedChange={(c) => handleChange("enableLocationTracking", c)}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Auto Clock-Out</Label>
              <p className="text-sm text-slate-500">Otomatis pulang jika lupa absen hingga jam tertentu.</p>
            </div>
            <Switch
              checked={formData.autoClockOut}
              onCheckedChange={(c) => handleChange("autoClockOut", c)}
            />
          </div>
          {formData.autoClockOut && (
            <div className="pl-4 border-l-2 border-slate-100">
              <Label>Waktu Eksekusi</Label>
              <Input
                type="time"
                className="w-32 mt-1"
                value={formData.autoClockOutTime}
                onChange={(e) => handleChange("autoClockOutTime", e.target.value)}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderLeavesSettings = () => (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle>Kuota Cuti Tahunan</CardTitle>
        <CardDescription>Jatah standar per karyawan per tahun.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label>Jumlah Hari</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              className="w-24"
              value={formData.maxLeaveDays}
              onChange={(e) => handleChange("maxLeaveDays", parseInt(e.target.value) || 0)}
            />
            <span className="text-sm text-slate-500">hari / tahun</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderSystemSettings = () => (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-sm border-l-4 border-l-blue-600">
        <CardHeader>
          <CardTitle>Tanggal Mulai Absensi (Periode Aktif)</CardTitle>
          <CardDescription>Absensi karyawan dihitung mulai dari tanggal ini.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Tanggal Mulai</Label>
            <div className="relative">
              <Input
                type="date"
                value={formData.attendanceStartDate}
                onChange={(e) => handleChange("attendanceStartDate", e.target.value)}
                className="pl-10"
              />
              <CalendarDays className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
            <p className="text-xs text-amber-600 flex items-center gap-1 mt-2">
              <Info className="w-3 h-3" /> Perubahan akan mempengaruhi perhitungan semua laporan & dashboard
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-100 bg-red-50/10 shadow-sm">
        <CardHeader>
          <CardTitle className="text-red-700 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5" /> Zona Bahaya
          </CardTitle>
          <CardDescription>Hati-hati, tindakan ini tidak dapat dibatalkan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => { setResetType("attendance"); setResetDialogOpen(true); }}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset Data Absensi
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => { setResetType("leaves"); setResetDialogOpen(true); }}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset Data Cuti
          </Button>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Backup Data</CardTitle>
          <CardDescription>Unduh data untuk arsip.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full justify-start hover:bg-slate-50" onClick={handleBackupAttendance}>
            <Download className="w-4 h-4 mr-2" />
            Download Backup Absensi (.xlsx)
          </Button>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">Konfirmasi Reset {resetType === 'attendance' ? 'Absensi' : 'Data'}</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini akan <b>MENGHAPUS SELURUH data {resetType === 'attendance' ? 'absensi' : 'data'}</b> dari database.
              Data yang dihapus tidak dapat dikembalikan. Pastikan Anda sudah melakukan backup.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (resetType === 'attendance') handleResetAttendance();
                if (resetType === 'leaves') handleResetLeave();
                setResetDialogOpen(false);
              }}
            >
              Ya, Hapus Permanen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>

      </AlertDialog>

    </div>
  );

  const getContent = (section: SettingsSection) => {
    switch (section) {
      case 'general': return renderGeneralSettings();
      case 'schedule': return renderScheduleSettings();
      case 'attendance': return renderAttendanceSettings();
      case 'leaves': return renderLeavesSettings();
      case 'system': return renderSystemSettings();
      default: return null;
    }
  };

  // ==========================================
  // VIEW: MOBILE
  // ==========================================
  if (isMobile) {
    return (
      <div className="min-h-screen bg-slate-50 pb-safe">
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 h-[52px] px-4 flex items-center justify-between pt-safe">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/dashboard")} className="p-2 -ml-2 rounded-full active:bg-slate-100">
              <ArrowLeft className="w-6 h-6 text-slate-900" />
            </button>
            <h1 className="text-base font-semibold text-slate-900">Pengaturan</h1>
          </div>
          {/* Global Save Bar handles actions now */}
        </header>

        <div className="px-4 py-4 space-y-4 mt-[52px]">
          {SECTIONS.map((section) => (
            <div
              key={section.id}
              onClick={() => setActiveMobileSheet(section.id)}
              className="bg-white rounded-[20px] p-4 shadow-sm border border-slate-100 flex items-center justify-between active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${activeMobileSheet === section.id ? 'bg-primary text-white' : 'bg-slate-50 text-slate-600'}`}>
                  <section.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{section.label}</h3>
                  <p className="text-xs text-slate-500 line-clamp-1">{section.description}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300" />
            </div>
          ))}
        </div>

        {/* Mobile Edit Sheet */}
        <Sheet open={!!activeMobileSheet} onOpenChange={(open) => !open && setActiveMobileSheet(null)}>
          <SheetContent side="bottom" className="h-[90vh] rounded-t-[20px] p-0 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
              <h2 className="font-semibold text-lg">{SECTIONS.find(s => s.id === activeMobileSheet)?.label}</h2>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setActiveMobileSheet(null)}>Tutup</Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving}>Simpan</Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4">
              {activeMobileSheet && getContent(activeMobileSheet)}
            </div>
          </SheetContent>
        </Sheet>

        {/* Global Save Action Bar (Mobile) */}
        <div className={`fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50 transition-transform duration-300 ${hasChanges ? 'translate-y-0' : 'translate-y-full'}`}>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 border-slate-300 text-slate-700" onClick={handleCancel}>Batalkan</Button>
            <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-md" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "..." : "Simpan"}
            </Button>
          </div>
        </div>
        {/* Global Save Confirmation Dialog (Mobile) */}
        <AlertDialog open={showSaveConfirm} onOpenChange={setShowSaveConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Konfirmasi Simpan Perubahan</AlertDialogTitle>
              <AlertDialogDescription>
                {formData.attendanceStartDate !== settings.attendanceStartDate ? (
                  <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-amber-800 mb-3 text-sm">
                    <b>PERINGATAN:</b> Tanggal Mulai Absensi berubah! <br />
                    Ini akan memicu perhitungan ulang pada seluruh laporan.
                  </div>
                ) : (
                  <p className="mb-3">Anda akan menyimpan perubahan pengaturan sistem.</p>
                )}
                <p>Pastikan data yang dimasukkan sudah benar. Apakah Anda yakin melakukan update?</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Periksa Lagi</AlertDialogCancel>
              <AlertDialogAction onClick={executeSave} className="bg-primary hover:bg-primary/90">
                Ya, Simpan
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ==========================================
  // VIEW: DESKTOP
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-50/50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/dashboard")} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-bold text-xl text-slate-800">Pengaturan Sistem</h1>
              <p className="text-xs text-slate-500">Konfigurasi & Parameter Aplikasi</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Global Save Bar handles actions */}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <aside className="w-full lg:w-64 flex-shrink-0 space-y-2">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left ${activeSection === section.id
                  ? 'bg-white shadow-sm border border-slate-200 text-primary font-medium ring-1 ring-primary/5'
                  : 'text-slate-600 hover:bg-white hover:shadow-sm'
                  }`}
              >
                <section.icon className={`w-5 h-5 ${activeSection === section.id ? 'text-primary' : 'text-slate-400'}`} />
                <span className="text-sm">{section.label}</span>
              </button>
            ))}
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {getContent(activeSection)}
          </main>
        </div>
        {/* Global Save Action Bar (Desktop) */}
        <div className={`fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50 transition-transform duration-300 ${hasChanges ? 'translate-y-0' : 'translate-y-full'}`}>
          <div className="container mx-auto flex items-center justify-between max-w-5xl">
            <div className="hidden md:flex flex-col">
              <span className="text-sm font-bold text-slate-800">Perubahan belum disimpan</span>
              <span className="text-xs text-slate-500">Pastikan Anda menyimpan konfigurasi sebelum keluar.</span>
            </div>
            <div className="flex gap-3 w-full md:w-auto">
              <Button variant="outline" className="flex-1 md:flex-none border-slate-300 text-slate-700" onClick={handleCancel}>Batalkan</Button>
              <Button className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white shadow-md" onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </div>
          </div>
        </div>

        {/* Global Save Confirmation Dialog (Desktop) */}
        <AlertDialog open={showSaveConfirm} onOpenChange={setShowSaveConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Konfirmasi Simpan Perubahan</AlertDialogTitle>
              <AlertDialogDescription>
                {formData.attendanceStartDate !== settings.attendanceStartDate ? (
                  <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-amber-800 mb-3">
                    <b>PERINGATAN:</b> Tanggal Mulai Absensi berubah! <br />
                    Ini akan memicu perhitungan ulang pada seluruh laporan.
                  </div>
                ) : (
                  <p className="mb-3">Anda akan menyimpan perubahan pengaturan sistem.</p>
                )}
                <p>Pastikan data yang dimasukkan sudah benar. Apakah Anda yakin melakukan update?</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Periksa Lagi</AlertDialogCancel>
              <AlertDialogAction onClick={executeSave} className="bg-primary hover:bg-primary/90">
                Ya, Simpan
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default Pengaturan;
