import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock, ArrowLeft, MapPin, CheckCircle2, XCircle,
  LogIn, LogOut, Calendar, Timer, Fingerprint, FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useIsMobile } from "@/hooks/useIsMobile";
import MobileNavigation from "@/components/MobileNavigation";
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
import { JournalEntryModal } from "@/components/journal/JournalEntryModal";


interface AttendanceRecord {
  id: string;
  clock_in: string;
  clock_out: string | null;
  clock_in_location: string | null;
  clock_out_location: string | null;
  status: string;
}

const AbsensiKaryawan = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useSystemSettings();
  const isMobile = useIsMobile();
  const [isLoading, setIsLoading] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [recentLogs, setRecentLogs] = useState<AttendanceRecord[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [location, setLocation] = useState<string | null>(null);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);

  // Safe Clock Out State
  const [showClockOutConfirm, setShowClockOutConfirm] = useState(false);
  const [isEarlyLeave, setIsEarlyLeave] = useState(false);
  const [workDurationHours, setWorkDurationHours] = useState(0);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Get user location
  useEffect(() => {
    if (settings.enableLocationTracking && navigator.geolocation) {
      setLocation("Mencari lokasi akurat...");
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          setCoordinates({ lat, lng });

          try {
            // Using reverse geocoding to get human readable address
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
            const data = await res.json();

            if (data && data.address) {
              const addr = data.address;
              // Build a decent readable string, e.g., "Mandiri Residence, Sidoarjo, Jawa Timur"
              const localArea = addr.residential || addr.suburb || addr.village || addr.neighbourhood || addr.road || "";
              const city = addr.city || addr.town || addr.county || addr.municipality || "";
              const state = addr.state || "";

              const locationParts = [localArea, city, state].filter(Boolean);

              if (locationParts.length > 0) {
                setLocation(locationParts.join(", "));
              } else {
                setLocation(data.display_name.split(",").slice(0, 3).join(",")); // Fallback to display name short
              }
            } else {
              setLocation(`${lat.toFixed(5)}, ${lng.toFixed(5)}`); // Fallback to coords
            }
          } catch (error) {
            console.error("Geocoding failed:", error);
            setLocation(`${lat.toFixed(5)}, ${lng.toFixed(5)}`); // Fallback to coords
          }
        },
        () => {
          setLocation("Lokasi tidak tersedia (Izin ditolak)");
          setCoordinates(null);
        }
      );
    } else if (!settings.enableLocationTracking) {
      setLocation("Tracking lokasi dinonaktifkan");
      setCoordinates(null);
    }
  }, [settings.enableLocationTracking]);


  // Fetch today's attendance
  useEffect(() => {
    if (user) {
      fetchTodayAttendance();

      // Setup realtime subscription - DISABLED for stability
      /*
      const channel = supabase
        .channel("my-attendance-changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "attendance", filter: `user_id=eq.${user.id}` },
          () => fetchTodayAttendance()
        )
        .subscribe();
      */

      return () => {
        // supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchTodayAttendance = async () => {
    if (!user) return;

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    // Strategy: Try date column first, then fallback to clock_in range
    let todayData: AttendanceRecord | null = null;

    // 1. Try by date column
    const { data: byDate, error: dateErr } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", todayStr)
      .maybeSingle();

    if (!dateErr && byDate) {
      todayData = byDate;
    } else {
      // 2. Fallback: by clock_in timestamp range (for records without date column)
      const startOfDay = `${todayStr}T00:00:00`;
      const endOfDay = `${todayStr}T23:59:59`;

      const { data: byRange } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", user.id)
        .gte("clock_in", startOfDay)
        .lte("clock_in", endOfDay)
        .maybeSingle();

      if (byRange) {
        todayData = byRange;
      }
    }

    setTodayAttendance(todayData);

    // Fetch recent logs
    const { data: recentData, error: recentError } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", user.id)
      .order("clock_in", { ascending: false })
      .limit(10);

    if (!recentError && recentData) {
      setRecentLogs(recentData);
    }
  };

  const handleClockIn = async () => {
    if (!user) return;

    // Validate location
    if (settings.enableLocationTracking && !coordinates) {
      toast({ variant: "destructive", title: "Lokasi Belum Terdeteksi", description: "Mohon tunggu hingga indikator lokasi muncul." });
      return;
    }

    setIsLoading(true);

    try {
      // 1. Try Edge Function First
      const { data, error } = await supabase.functions.invoke("clock-in", {
        body: {
          location: settings.enableLocationTracking ? location : null,
          latitude: settings.enableLocationTracking ? coordinates?.lat : null,
          longitude: settings.enableLocationTracking ? coordinates?.lng : null,
        },
      });

      if (!error && data?.success) {
        toast({ title: "Clock In Berhasil", description: `Anda masuk pada ${new Date(data.server_time).toLocaleTimeString("id-ID")}` });
        fetchTodayAttendance();
        return;
      }

      // If edge function returned a business error (like "already clocked in"), show it directly
      if (data?.error) {
        toast({ variant: "destructive", title: "Gagal Clock In", description: data.error });
        fetchTodayAttendance(); // Refresh to show existing record
        return;
      }

      // Network/server error - try fallback
      throw error || new Error("Edge Function Failed");

    } catch (edgeError) {
      console.warn("Edge Function Clock-In failed, attempting direct DB fallback...", edgeError);

      try {
        // 2. Direct DB Fallback
        const now = new Date();
        const limitTime = new Date();
        const [limitH, limitM] = (settings.clockInStart || "08:00").split(":").map(Number);
        limitTime.setHours(limitH, limitM, 0, 0);

        let status = "present";
        if (now > limitTime) status = "late";

        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        const { error: dbError } = await supabase.from("attendance").insert({
          user_id: user.id,
          date: todayStr,
          clock_in: now.toISOString(),
          clock_in_location: location,
          status: status,
        });

        if (dbError) {
          // Handle duplicate constraint gracefully
          if (dbError.message?.includes("duplicate") || dbError.message?.includes("unique")) {
            toast({ variant: "destructive", title: "Sudah Clock In", description: "Anda sudah melakukan Clock In hari ini." });
            fetchTodayAttendance();
            return;
          }
          throw dbError;
        }

        toast({ title: "Clock In Berhasil (Offline Mode)", description: "Absensi tersimpan." });
        fetchTodayAttendance();

      } catch (finalError: any) {
        toast({
          variant: "destructive",
          title: "Gagal Clock In",
          description: finalError.message || "Gagal menghubungi server.",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const [showJournalModal, setShowJournalModal] = useState(false);

  const initiateClockOut = () => {
    if (!todayAttendance) return;

    // Check for Early Leave
    // Assuming settings.clockOutStart is "17:00"
    const [targetHour, targetMinute] = settings.clockOutStart.split(':').map(Number);
    const now = new Date();
    const targetTime = new Date();
    targetTime.setHours(targetHour, targetMinute, 0, 0);

    const isEarly = now < targetTime;
    setIsEarlyLeave(isEarly);

    // Calculate duration for context
    const clockInTime = new Date(todayAttendance.clock_in);
    const durationMs = now.getTime() - clockInTime.getTime();
    setWorkDurationHours(durationMs / (1000 * 60 * 60));

    setShowClockOutConfirm(true);
  };

  const handleProceedToJournal = () => {
    setShowClockOutConfirm(false);
    // If worked less than 5 minutes, likely a mistake/test, skip journal
    if (workDurationHours < 0.08) {
      confirmClockOut();
      return;
    }
    setShowJournalModal(true);
  };

  const confirmClockOut = async (journalContent?: string) => {
    setShowClockOutConfirm(false);
    setShowJournalModal(false);
    if (!user || !todayAttendance) return;
    setIsLoading(true);

    try {
      // 1. Try Edge Function First
      const { data, error } = await supabase.functions.invoke("clock-out", {
        body: {
          location: settings.enableLocationTracking ? location : null,
          latitude: settings.enableLocationTracking ? coordinates?.lat : null,
          longitude: settings.enableLocationTracking ? coordinates?.lng : null,
        },
      });

      if (!error && data?.success) {
        toast({ title: "Clock Out Berhasil", description: `Anda pulang pada ${new Date().toLocaleTimeString("id-ID")}` });
        // Handle Journal
        if (journalContent) {
          await saveJournal(todayAttendance.id, journalContent);
        }
        fetchTodayAttendance();
        return;
      }

      throw error || new Error(data?.error || "Edge Function Clock-Out Failed");

    } catch (edgeError) {
      console.warn("Edge Function Clock-Out failed, attempting direct DB fallback...", edgeError);

      try {
        // 2. Direct DB Fallback
        const now = new Date();
        const { error: dbError } = await supabase
          .from("attendance")
          .update({
            clock_out: now.toISOString(),
            clock_out_location: location,
            // We don't change status on clock out usually, unless early leave logic needs to run.
            // For fallback, we keep it simple to ensure data is saved.
          })
          .eq("id", todayAttendance.id);

        if (dbError) throw dbError;

        toast({ title: "Clock Out Berhasil (Offline Mode)", description: "Absensi pulang tersimpan." });

        // Handle Journal with FALLBACK ID (todayAttendance.id is reliable here as it exists)
        if (journalContent) {
          await saveJournal(todayAttendance.id, journalContent);
        }

        fetchTodayAttendance();

      } catch (finalError: any) {
        toast({
          variant: "destructive",
          title: "Gagal Clock Out",
          description: finalError.message || "Gagal menyimpan data.",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const saveJournal = async (attendanceId: string, content: string) => {
    try {
      const { error: journalError } = await supabase.from('work_journals').insert({
        user_id: user?.id,
        attendance_id: attendanceId,
        date: new Date().toISOString().split('T')[0],
        // Title column does not exist in DB yet. Merging or skipping.
        content: content,
        duration: Math.round(workDurationHours * 60),
        obstacles: 'General', // Match JurnalSaya.tsx schema which uses obstacles for category content
        work_result: 'completed',
        mood: '😊',
        verification_status: 'submitted'
      } as any); // Cast as any to bypass strict type check if schema mismatch exists temporarily

      if (journalError) {
        console.error("Journal Save Error:", journalError);
        toast({ variant: "destructive", title: "Gagal Simpan Jurnal", description: "Absensi sukses, tapi jurnal gagal: " + journalError.message });
      } else {
        toast({ title: "Jurnal Tersimpan", description: "Catatan kerja Anda telah disimpan." });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const formatDurationHrsMins = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatTimeShort = (date: Date) => {
    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getWorkDuration = () => {
    if (!todayAttendance) return null;

    const clockIn = new Date(todayAttendance.clock_in);
    const clockOut = todayAttendance.clock_out
      ? new Date(todayAttendance.clock_out)
      : currentTime;

    const diffMs = clockOut.getTime() - clockIn.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}j ${minutes}m`;
  };

  const calculateDuration = (inTime: string, outTime: string | null) => {
    if (!outTime) return "-";
    const start = new Date(inTime);
    const end = new Date(outTime);
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const getStatusBadge = (status: string) => {
    const pill = (bg: string, text: string, dot: string, label: string) => (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${bg} ${text}`}>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
        {label}
      </span>
    );
    switch (status) {
      case "present": return pill("bg-emerald-50 border-emerald-200", "text-emerald-700", "bg-emerald-500", "Hadir");
      case "late": return pill("bg-amber-50 border-amber-200", "text-amber-700", "bg-amber-500", "Terlambat");
      case "early_leave": return pill("bg-orange-50 border-orange-200", "text-orange-700", "bg-orange-500", "Pulang Awal");
      default: return <span className="text-[11px] text-slate-400">{status}</span>;
    }
  };

  // Render logic is now unified below


  // ==========================================
  // UNIFIED RESPONSIVE VIEW (Mobile, Tablet, Desktop)
  // ==========================================
  // Replaces separate mobile/desktop views with a fluid, adaptive design

  return (
    <>
      {/* DESKTOP VIEW */}
      <div className="hidden md:flex min-h-screen bg-slate-50/50 text-slate-900 font-['Inter',sans-serif] flex-col overflow-x-hidden relative">

        {/* Background Graphic Abstract - Subtle SaaS Effect */}
        <div className="absolute top-0 right-0 -z-10 w-[80vw] h-[60vh] bg-blue-100/40 rounded-full blur-[100px] pointer-events-none opacity-80 transform translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 left-0 -z-10 w-[60vw] h-[50vh] bg-emerald-100/40 rounded-full blur-[100px] pointer-events-none opacity-80 transform -translate-x-1/2 translate-y-1/2"></div>

        {/* Header - Non-sticky, spacious, safe-area aware */}
        <header className="relative z-20 w-full px-6 pb-6 pt-[calc(1.5rem+env(safe-area-inset-top))] flex items-center justify-between">
          <button
            onClick={() => navigate("/dashboard")}
            className="group flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-white/70 hover:bg-white backdrop-blur-md border border-white/40 shadow-sm transition-all active:scale-95"
          >
            <ArrowLeft className="h-5 w-5 text-slate-700 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-semibold text-slate-700 hidden sm:inline">Kembali</span>
          </button>

          {/* Location Badge */}
          <div className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/70 backdrop-blur-md border border-white/40 shadow-sm">
            <MapPin className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-semibold text-slate-700 max-w-[200px] truncate">
              {location || "Mengecek lokasi..."}
            </span>
          </div>
        </header>

        {/* Main Content - Fluid Grid Layout with more breathing room */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-6 lg:px-12 pb-12 lg:pb-32 flex flex-col justify-center">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-32 items-center">

            {/* Left Column: Clock & Status */}
            <div className="flex flex-col items-center justify-center text-center space-y-8 lg:space-y-12 animate-fade-in-up">

              {/* Date & Time */}
              <div className="space-y-2 relative z-10 text-slate-900">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-white/40 border border-white/60 backdrop-blur-md shadow-sm">
                  <Calendar className="h-4 w-4 text-slate-600" />
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    {formatDate(currentTime)}
                  </p>
                </div>
                <div className="relative">
                  <h1 className="text-[64px] sm:text-[80px] lg:text-[100px] font-sans font-extrabold tracking-tighter leading-none tabular-nums drop-shadow-sm text-slate-800">
                    {formatTime(currentTime)}
                  </h1>
                  <p className="text-slate-500 text-sm sm:text-base font-medium tracking-widest uppercase mt-2">Waktu Indonesia Barat</p>
                </div>
              </div>

              {/* Status Visualization */}
              <div className="relative group cursor-default">
                {/* Background Glow */}
                <div className={`absolute inset-0 rounded-full blur-[80px] opacity-40 transition-colors duration-700
                ${!todayAttendance ? 'bg-indigo-500' : !todayAttendance.clock_out ? 'bg-emerald-500' : 'bg-slate-500'}
              `} />

                <div className={`
                relative w-64 h-64 sm:w-72 sm:h-72 lg:w-80 lg:h-80 rounded-[40px] flex flex-col items-center justify-center gap-4 
                bg-white/70 backdrop-blur-xl border border-white/70 shadow-2xl transition-all duration-500
                ${!todayAttendance ? 'shadow-indigo-500/10' : !todayAttendance.clock_out ? 'shadow-emerald-500/20' : 'shadow-slate-500/10'}
              `}>
                  {!todayAttendance ? (
                    <>
                      <Fingerprint className="h-16 w-16 text-slate-300" />
                      <span className="text-xl sm:text-2xl font-bold text-slate-700">Belum Masuk</span>
                    </>
                  ) : !todayAttendance.clock_out ? (
                    <>
                      <div className="absolute inset-0 border-[3px] border-emerald-400/50 rounded-[40px] animate-pulse-slow" />
                      <Timer className="h-16 w-16 text-emerald-500" />
                      <div className="text-center">
                        <span className="block text-xl sm:text-2xl font-extrabold text-emerald-700">Sedang Bekerja</span>
                        <span className="text-sm sm:text-base font-semibold text-emerald-600/80 mt-1">{formatTimeShort(new Date(todayAttendance.clock_in))}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-16 w-16 text-slate-400" />
                      <div className="text-center">
                        <span className="block text-xl sm:text-2xl font-extrabold text-slate-700">Selesai</span>
                        <div className="mt-2 text-sm px-4 py-1.5 bg-slate-100 rounded-full text-slate-600 font-semibold border border-slate-200">
                          {getWorkDuration()} kerja
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

            </div>

            {/* Right Column: Actions & Summary */}
            <div className="w-full max-w-md mx-auto flex flex-col gap-6 lg:gap-8 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>

              {/* Shift Info Card */}
              <div className="bg-white/70 backdrop-blur-md border border-white/40 rounded-[24px] p-6 lg:p-8 hover:shadow-md transition-all shadow-sm vibe-glass-card">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Jadwal Shift
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 rounded-xl bg-slate-50/50 border border-slate-100">
                    <span className="text-slate-500 text-xs font-semibold uppercase tracking-wide">Wajib Masuk</span>
                    <span className="font-mono font-bold text-slate-800 text-lg">{settings.clockInStart} - {settings.clockInEnd}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 rounded-xl bg-slate-50/50 border border-slate-100">
                    <span className="text-slate-500 text-xs font-semibold uppercase tracking-wide">Wajib Pulang</span>
                    <span className="font-mono font-bold text-slate-800 text-lg">{settings.clockOutStart} - {settings.clockOutEnd}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons - No Sticky, Conveniently Placed */}
              <div className="space-y-4">
                {!todayAttendance ? (
                  <button
                    onClick={handleClockIn}
                    disabled={isLoading}
                    className="w-full h-20 sm:h-24 rounded-[24px] bg-slate-900 hover:bg-slate-800 active:scale-95 transition-all duration-300 flex items-center justify-between px-8 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] group"
                  >
                    <div className="flex flex-col items-start">
                      <span className="text-xl sm:text-2xl font-extrabold text-white">Clock In</span>
                      <span className="text-slate-300 text-sm sm:text-base font-medium">Catat kehadiran hari ini</span>
                    </div>
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/10 flex items-center justify-center group-hover:rotate-12 transition-transform border border-white/20">
                      {isLoading ? <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <LogIn className="h-6 w-6 sm:h-7 sm:w-7 text-white" />}
                    </div>
                  </button>
                ) : todayAttendance && todayAttendance.clock_out ? (
                  <div className="w-full h-20 sm:h-24 rounded-[24px] bg-gradient-to-r from-emerald-50 to-emerald-100/50 border border-emerald-200 flex flex-col items-center justify-center gap-1 shadow-sm text-emerald-800 pointer-events-none">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                      <span className="text-lg sm:text-lg font-bold">Kehadiran Berhasil Dicatat</span>
                    </div>
                    <span className="text-xs sm:text-sm font-medium text-emerald-600/80">Terima kasih atas kerja keras Anda, sampai jumpa besok! 👋</span>
                  </div>
                ) : (
                  <button
                    onClick={initiateClockOut}
                    disabled={isLoading}
                    className="w-full h-20 sm:h-24 rounded-[24px] bg-white hover:bg-slate-50 active:scale-95 transition-all duration-300 flex items-center justify-between px-8 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.1)] border border-slate-200 group"
                  >
                    <div className="flex flex-col items-start">
                      <span className="text-xl sm:text-2xl font-extrabold text-slate-800">Clock Out</span>
                      <span className="text-slate-500 text-sm sm:text-base font-medium">Akhiri sesi via jurnal</span>
                    </div>
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-slate-100 flex items-center justify-center group-hover:rotate-12 transition-transform border border-slate-200">
                      {isLoading ? <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" /> : <LogOut className="h-6 w-6 sm:h-7 sm:w-7 text-slate-600" />}
                    </div>
                  </button>
                )}
              </div>

              {/* Today's Summary */}
              {todayAttendance && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/70 backdrop-blur-md rounded-2xl p-4 border border-white/40 text-center shadow-sm vibe-glass-card">
                    <p className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">Waktu Masuk</p>
                    <p className="text-xl sm:text-2xl font-sans tracking-tight font-extrabold text-slate-800">
                      {formatTimeShort(new Date(todayAttendance.clock_in))}
                    </p>
                  </div>
                  <div className="bg-white/70 backdrop-blur-md rounded-2xl p-4 border border-white/40 text-center shadow-sm vibe-glass-card">
                    <p className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">Waktu Pulang</p>
                    <p className="text-xl sm:text-2xl font-sans tracking-tight font-extrabold text-slate-800">
                      {todayAttendance.clock_out ? formatTimeShort(new Date(todayAttendance.clock_out)) : "--:--"}
                    </p>
                  </div>
                </div>
              )}

            </div>
          </div>
        </main>

        <AlertDialog open={showClockOutConfirm} onOpenChange={setShowClockOutConfirm}>
          <AlertDialogContent className="bg-white text-slate-900 border-slate-200">
            <AlertDialogHeader>
              <AlertDialogTitle className={isEarlyLeave ? "text-amber-600" : "text-slate-900"}>
                {isEarlyLeave ? "Konfirmasi Pulang Awal" : "Konfirmasi Clock Out"}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-slate-600">
                {isEarlyLeave ? (
                  <div className="space-y-2">
                    <p>Waktu saat ini <b>belum menunjukkan jam pulang ({settings.clockOutStart})</b>.</p>
                    <p>Apakah Anda yakin ingin mengakhiri shift sekarang?</p>
                    {workDurationHours < 1 && (
                      <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs font-medium border border-red-100 mt-2">
                        Peringatan: Anda baru bekerja kurang dari 1 jam. Pastikan tidak salah tekan.
                      </div>
                    )}
                  </div>
                ) : (
                  <p>Apakah Anda yakin ingin mengakhiri sesi kerja hari ini?</p>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-slate-200 hover:bg-slate-50 text-slate-700">Batal</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleProceedToJournal}
                className={isEarlyLeave ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}
              >
                Ya, Clock Out
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <JournalEntryModal
          open={showJournalModal}
          onOpenChange={setShowJournalModal}
          duration={formatDurationHrsMins(workDurationHours)}
          onSave={(content) => confirmClockOut(content)}
          onSkip={() => confirmClockOut()}
        />
      </div>

      {/* MOBILE VIEW (Strict design match) */}
      <div className="flex md:hidden min-h-screen bg-white text-slate-900 font-['Inter',sans-serif] flex-col overflow-x-hidden relative pb-[100px]">

        {/* Header */}
        <div className="flex justify-between items-center px-6 pt-12 pb-6">
          <button onClick={() => navigate("/dashboard")} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 shadow-sm active:scale-95 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <span className="text-[17px] font-semibold text-slate-900 tracking-tight">Attendance</span>
          <button className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600"><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center pt-8 w-full max-w-[500px] mx-auto px-4">

          {/* Date & Time Header Match from Image */}
          <div className="flex flex-col items-center w-full mb-8 text-slate-900">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-200 bg-white shadow-sm mb-4">
              <Calendar className="h-3 w-3 text-slate-500" />
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                {formatDate(currentTime)}
              </p>
            </div>

            <h2 className="text-[54px] sm:text-[64px] font-sans font-extrabold tracking-tighter leading-none tabular-nums text-slate-900 drop-shadow-sm mb-2">
              {formatTime(currentTime).replace(/:/g, '.')}
            </h2>
            <p className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase">Waktu Indonesia Barat</p>
          </div>

          {/* Layout Cards Grid */}
          <div className="w-full flex flex-col gap-6 mb-8">
            {/* Status Card (Fingerprint) */}
            <div className="w-full aspect-square max-h-[220px] bg-white rounded-[32px] shadow-[0_8px_30px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col items-center justify-center p-6">
              {!todayAttendance ? (
                <>
                  <Fingerprint className="h-16 w-16 text-slate-300 mb-4" strokeWidth={1.5} />
                  <span className="text-xl font-bold text-slate-800">Belum Masuk</span>
                </>
              ) : !todayAttendance.clock_out ? (
                <>
                  <div className="relative mb-4">
                    <div className="absolute inset-0 border-[3px] border-emerald-400/50 rounded-full animate-pulse-slow p-2" />
                    <Timer className="h-16 w-16 text-[#1A5BA8]" strokeWidth={1.5} />
                  </div>
                  <span className="text-xl font-bold text-slate-800">Sedang Bekerja</span>
                  <span className="text-xs font-semibold text-slate-500 mt-1">{formatTimeShort(new Date(todayAttendance.clock_in))} WIB</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-16 w-16 text-slate-400 mb-4" strokeWidth={1.5} />
                  <span className="text-xl font-bold text-slate-800">Selesai</span>
                  <div className="mt-2 text-xs px-3 py-1 bg-slate-50 rounded-full text-slate-600 font-semibold border border-slate-200">
                    {getWorkDuration()}
                  </div>
                </>
              )}
            </div>

            {/* Shift Card */}
            <div className="w-full bg-white rounded-[24px] shadow-[0_8px_30px_rgba(0,0,0,0.03)] border border-slate-100 p-5">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> JADWAL SHIFT
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-500">WAJIB MASUK</span>
                  <span className="font-bold text-slate-800 font-mono tracking-wide">{settings.clockInStart} - {settings.clockInEnd}</span>
                </div>
                <div className="h-px bg-slate-50 w-full"></div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-500">WAJIB PULANG</span>
                  <span className="font-bold text-slate-800 font-mono tracking-wide">{settings.clockOutStart} - {settings.clockOutEnd}</span>
                </div>
              </div>
            </div>

            {/* Action Button */}
            {!todayAttendance ? (
              <button
                onClick={handleClockIn}
                disabled={isLoading}
                className="w-full h-16 rounded-[20px] bg-[#0B1528] active:bg-slate-900 transition-all flex items-center justify-between px-5 shadow-sm"
              >
                <div className="flex flex-col items-start px-1">
                  <span className="text-white font-bold text-lg">Clock In</span>
                  <span className="text-slate-400 text-[10px] font-medium tracking-wide">Catat kehadiran hari ini</span>
                </div>
                <div className="w-10 h-10 rounded-xl border border-white/10 flex items-center justify-center">
                  {isLoading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" /> : <LogIn className="h-4 w-4 text-white" />}
                </div>
              </button>
            ) : !todayAttendance.clock_out ? (
              <button
                onClick={initiateClockOut}
                disabled={isLoading}
                className="w-full h-16 rounded-[20px] bg-[#1A5BA8] active:bg-[#154682] transition-all flex items-center justify-between px-5 shadow-sm"
              >
                <div className="flex flex-col items-start px-1">
                  <span className="text-white font-bold text-lg">Clock Out</span>
                  <span className="text-blue-200 text-[10px] font-medium tracking-wide">Akhiri sesi via jurnal</span>
                </div>
                <div className="w-10 h-10 rounded-xl border border-white/20 flex items-center justify-center">
                  {isLoading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" /> : <LogOut className="h-4 w-4 text-white" />}
                </div>
              </button>
            ) : (
              <div className="w-full h-16 rounded-[20px] bg-slate-100 border border-slate-200 transition-all flex items-center justify-between px-5 pointer-events-none">
                <div className="flex flex-col items-start px-1">
                  <span className="text-slate-800 font-bold text-lg">Hadir</span>
                  <span className="text-slate-500 text-[10px] font-medium tracking-wide">Kehadiran Berhasil Dicatat</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-slate-500" />
                </div>
              </div>
            )}
          </div>

          {/* Attendance Log Table section */}
          <div className="w-full px-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Attendance Log</h3>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 text-xs font-medium text-slate-600">
                This month <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
              </button>
            </div>

            <div className="w-full">
              {/* Table Header */}
              <div className="grid grid-cols-4 bg-[#8C94A0] rounded-t-xl text-white py-3 px-4 text-[10px] uppercase font-bold tracking-wider opacity-90">
                <div>Date</div>
                <div>Clock In</div>
                <div>Clock Out</div>
                <div>Work Hours</div>
              </div>

              {/* Log Rows */}
              <div className="bg-white border-x border-b border-slate-100 rounded-b-xl overflow-hidden shadow-sm">
                {recentLogs.length > 0 ? recentLogs.map((row, i) => (
                  <div key={row.id || i} className="grid grid-cols-4 items-center border-b border-slate-50 py-3 px-4 text-[11px] font-medium text-slate-700">
                    <div className="text-slate-900 font-semibold">{new Date(row.clock_in).toLocaleDateString("en-GB", { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                    <div>{formatTimeShort(new Date(row.clock_in))}</div>
                    <div>{row.clock_out ? formatTimeShort(new Date(row.clock_out)) : '- -'}</div>
                    <div>{calculateDuration(row.clock_in, row.clock_out)}</div>
                  </div>
                )) : (
                  <div className="py-6 text-center text-xs text-slate-400">Belum ada riwayat absen.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Floating Navigation Pill */}
        {isMobile && (
          <div className="fixed bottom-6 left-6 right-6 z-50">
            <div className="bg-white/80 backdrop-blur-xl rounded-[28px] shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-white/60 flex items-center justify-between px-6 py-4">
              <button onClick={() => navigate("/dashboard")} className="w-[42px] h-[42px] flex items-center justify-center text-slate-400 hover:text-[#047857] transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
              </button>
              <button onClick={() => navigate("/karyawan/absensi")} className="w-[42px] h-[42px] bg-[#047857] rounded-full flex items-center justify-center text-white shadow-md shadow-teal-500/20 transition-colors">
                <Clock className="w-[20px] h-[20px] stroke-[2.5px]" />
              </button>
              <button onClick={() => navigate("/karyawan/riwayat")} className="w-[42px] h-[42px] flex items-center justify-center text-slate-400 hover:text-[#047857] transition-colors">
                <div className="relative">
                  <FileText className="w-[22px] h-[22px] stroke-[2.5px]" />
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-[1.5px] border-white"></span>
                </div>
              </button>
              <button onClick={() => navigate("/karyawan/jurnal")} className="w-[42px] h-[42px] flex items-center justify-center text-slate-400 hover:text-[#047857] transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
              </button>
              <button onClick={() => navigate("/karyawan/profil")} className="w-[42px] h-[42px] flex items-center justify-center text-slate-400 hover:text-[#047857] transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
              </button>
            </div>
          </div>
        )}

      </div>
    </>
  );
};

export default AbsensiKaryawan;
