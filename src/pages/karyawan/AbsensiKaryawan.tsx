import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock, ArrowLeft, MapPin, CheckCircle2, XCircle,
  LogIn, LogOut, Calendar, Timer, Fingerprint
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
  const [currentTime, setCurrentTime] = useState(new Date());
  const [location, setLocation] = useState<string | null>(null);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);

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
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation(`${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`);
          setCoordinates({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          setLocation("Lokasi tidak tersedia");
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

      // Setup realtime subscription
      const channel = supabase
        .channel("my-attendance-changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "attendance", filter: `user_id=eq.${user.id}` },
          () => fetchTodayAttendance()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchTodayAttendance = async () => {
    if (!user) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", user.id)
      .gte("clock_in", today.toISOString())
      .lt("clock_in", tomorrow.toISOString())
      .order("clock_in", { ascending: false })
      .maybeSingle();

    if (!error && data) {
      setTodayAttendance(data);
    } else {
      setTodayAttendance(null);
    }
  };

  const handleClockIn = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      // Call Edge Function for secure Clock In
      const { data, error } = await supabase.functions.invoke("clock-in", {
        body: {
          location: settings.enableLocationTracking ? location : null,
          latitude: settings.enableLocationTracking ? coordinates?.lat : null,
          longitude: settings.enableLocationTracking ? coordinates?.lng : null,
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Gagal melakukan clock in");
      }

      toast({
        title: "Clock In Berhasil",
        description: `Anda tercatat ${data.status_assigned === "late" ? "terlambat" : "hadir"} pada ${new Date(data.server_time).toLocaleTimeString("id-ID")}`,
      });
      fetchTodayAttendance();

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Terjadi kesalahan sistem";
      toast({
        variant: "destructive",
        title: "Gagal Clock In",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!user || !todayAttendance) return;
    setIsLoading(true);

    try {
      // Call Edge Function for secure Clock Out
      const { data, error } = await supabase.functions.invoke("clock-out", {
        body: {
          location: settings.enableLocationTracking ? location : null,
          latitude: settings.enableLocationTracking ? coordinates?.lat : null,
          longitude: settings.enableLocationTracking ? coordinates?.lng : null,
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Gagal melakukan clock out");
      }

      toast({
        title: "Clock Out Berhasil",
        description: data.message || `Anda tercatat pulang. Total kerja: ${data.work_hours} jam`,
      });
      fetchTodayAttendance();

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Terjadi kesalahan sistem";
      toast({
        variant: "destructive",
        title: "Gagal Clock Out",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return <Badge className="bg-success text-success-foreground">Hadir</Badge>;
      case "late":
        return <Badge className="bg-warning text-warning-foreground">Terlambat</Badge>;
      case "early_leave":
        return <Badge className="bg-info text-info-foreground">Pulang Awal</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // ==========================================
  // iOS MOBILE VIEW - Native Feel
  // ==========================================
  if (isMobile) {
    return (
      <div className="ios-mobile-container" style={{ paddingBottom: "calc(160px + env(safe-area-inset-bottom))" }}>
        {/* iOS Header - Slim & Transparent for Clock Page */}
        <header className="fixed top-0 left-0 right-0 z-50 px-4 pt-[calc(env(safe-area-inset-top)+10px)] pb-2 bg-transparent transition-all">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate("/dashboard")}
              className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/10 text-white shadow-lg active:scale-95 transition-transform"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/10 text-white font-medium text-sm shadow-lg flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-white/90" />
              <span>{location || "Lokasi..."}</span>
            </div>
            <div className="w-10" /> {/* Spacer */}
          </div>
        </header>

        {/* Dynamic Background for Clock Page */}
        <div className="fixed inset-0 z-0 bg-gradient-to-b from-[#1A5BA8] to-[#0D305A]" />

        <div className="relative z-10 flex flex-col min-h-[85vh] justify-center items-center text-white px-6">
          {/* Date Display */}
          <div className="mb-4 px-4 py-1.5 rounded-full bg-white/10 border border-white/5 backdrop-blur-sm animate-fade-in-up">
            <p className="text-sm font-medium text-white/90">
              {formatDate(currentTime)}
            </p>
          </div>

          {/* Large Digital Clock */}
          <div className="mb-10 text-center relative animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <div className="text-[72px] font-thin tracking-tighter leading-none tabular-nums drop-shadow-xl font-mono">
              {formatTime(currentTime)}
            </div>
            <p className="text-white/60 text-sm mt-2 font-light tracking-wide">WIB (Waktu Indonesia Barat)</p>
          </div>

          {/* Status Circle */}
          <div className="mb-12 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            {!todayAttendance ? (
              <div className="w-48 h-48 rounded-full flex flex-col items-center justify-center gap-3 bg-white/5 backdrop-blur-sm border-2 border-white/20 shadow-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-t from-white/10 to-transparent opacity-50" />
                <LogIn className="h-12 w-12 text-white/80" />
                <span className="text-base font-medium text-white/90">Belum Masuk</span>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20" />
              </div>
            ) : !todayAttendance.clock_out ? (
              <div className="w-48 h-48 rounded-full flex flex-col items-center justify-center gap-3 bg-green-500/20 backdrop-blur-md border-2 border-green-400/30 shadow-[0_0_40px_rgba(34,197,94,0.3)] relative overflow-hidden animate-pulse-slow">
                <Timer className="h-12 w-12 text-green-400" />
                <div className="text-center">
                  <span className="block text-base font-bold text-green-100">Sedang Bekerja</span>
                  <span className="text-xs text-green-200/80">{formatTimeShort(new Date(todayAttendance.clock_in))}</span>
                </div>
              </div>
            ) : (
              <div className="w-48 h-48 rounded-full flex flex-col items-center justify-center gap-3 bg-blue-500/20 backdrop-blur-md border-2 border-blue-400/30 shadow-[0_0_40px_rgba(59,130,246,0.3)] relative">
                <CheckCircle2 className="h-12 w-12 text-blue-400" />
                <span className="text-base font-bold text-blue-100">Selesai</span>
                <div className="text-xs px-3 py-1 bg-blue-500/30 rounded-full text-blue-100 border border-blue-400/20">
                  {getWorkDuration()}
                </div>
              </div>
            )}
          </div>

          {/* Today's Summary - Floating Card style */}
          {todayAttendance && (
            <div className="w-full bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex items-center justify-between shadow-lg animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <div className="text-center flex-1 border-r border-white/10">
                <p className="text-xs text-white/60 mb-1">Masuk</p>
                <p className="text-lg font-bold text-white">
                  {formatTimeShort(new Date(todayAttendance.clock_in))}
                </p>
              </div>
              <div className="text-center flex-1">
                <p className="text-xs text-white/60 mb-1">Pulang</p>
                {todayAttendance.clock_out ? (
                  <p className="text-lg font-bold text-white">
                    {formatTimeShort(new Date(todayAttendance.clock_out))}
                  </p>
                ) : (
                  <p className="text-lg font-bold text-white/40">-:-</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Action Bar */}
        <div
          className="fixed left-0 right-0 bottom-[calc(68px+env(safe-area-inset-bottom))] p-5 bg-white rounded-t-[32px] shadow-[0_-5px_30px_rgba(0,0,0,0.15)] z-40"
        >
          <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-6" />

          {!todayAttendance ? (
            <button
              onClick={handleClockIn}
              disabled={isLoading}
              className="w-full h-14 rounded-2xl bg-[#007AFF] active:scale-[0.98] transition-transform flex items-center justify-center gap-3 shadow-lg shadow-blue-500/30 text-white font-semibold text-lg"
            >
              {isLoading ? (
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <Fingerprint className="h-6 w-6" />
                  <span>Geser Masuk</span>
                </>
              )}
            </button>
          ) : !todayAttendance.clock_out ? (
            <button
              onClick={handleClockOut}
              disabled={isLoading}
              className="w-full h-14 rounded-2xl bg-[#FF3B30] active:scale-[0.98] transition-transform flex items-center justify-center gap-3 shadow-lg shadow-red-500/30 text-white font-semibold text-lg"
            >
              {isLoading ? (
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <LogOut className="h-6 w-6" />
                  <span>Geser Pulang</span>
                </>
              )}
            </button>
          ) : (
            <div className="w-full h-14 rounded-2xl bg-slate-100 flex items-center justify-center gap-2 text-slate-500 font-medium">
              <CheckCircle2 className="h-5 w-5" />
              <span>Shift Selesai</span>
            </div>
          )}

          <p className="text-center text-xs text-slate-400 mt-4">
            Pastikan lokasi Anda akurat sebelum melakukan absensi.
          </p>
        </div>

        {/* iOS Bottom Navigation */}
        <MobileNavigation />
      </div>
    );
  }

  // ==========================================
  // DESKTOP VIEW (Original - Unchanged)
  // ==========================================
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                <Clock className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Absensi</h1>
                <p className="text-sm text-muted-foreground">Clock In & Clock Out</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-lg space-y-6">
          {/* Current Time Card */}
          <Card className="border-border shadow-lg animate-fade-in overflow-hidden">
            <div className="bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground">
              <div className="text-center">
                <p className="text-sm opacity-90 mb-1">
                  <Calendar className="inline h-4 w-4 mr-1" />
                  {formatDate(currentTime)}
                </p>
                <div className="text-5xl font-bold tracking-tight">
                  {formatTime(currentTime)}
                </div>
              </div>
            </div>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{location || "Mendapatkan lokasi..."}</span>
              </div>
            </CardContent>
          </Card>

          {/* Attendance Status */}
          {todayAttendance ? (
            <Card className="border-border shadow-card animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Status Hari Ini</CardTitle>
                  {getStatusBadge(todayAttendance.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Clock In Info */}
                <div className="flex items-center gap-4 p-3 rounded-lg bg-success/10">
                  <div className="h-10 w-10 rounded-full bg-success/20 flex items-center justify-center">
                    <LogIn className="h-5 w-5 text-success" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Clock In</p>
                    <p className="text-lg font-bold text-success">
                      {new Date(todayAttendance.clock_in).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>

                {/* Clock Out Info */}
                <div className={`flex items-center gap-4 p-3 rounded-lg ${todayAttendance.clock_out ? "bg-info/10" : "bg-muted"
                  }`}>
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${todayAttendance.clock_out ? "bg-info/20" : "bg-muted-foreground/20"
                    }`}>
                    <LogOut className={`h-5 w-5 ${todayAttendance.clock_out ? "text-info" : "text-muted-foreground"
                      }`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Clock Out</p>
                    {todayAttendance.clock_out ? (
                      <p className="text-lg font-bold text-info">
                        {new Date(todayAttendance.clock_out).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Belum clock out</p>
                    )}
                  </div>
                  {todayAttendance.clock_out ? (
                    <CheckCircle2 className="h-5 w-5 text-info" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>

                {/* Work Duration */}
                <div className="flex items-center gap-4 p-3 rounded-lg bg-primary/10">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Timer className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Durasi Kerja</p>
                    <p className="text-lg font-bold text-primary">{getWorkDuration()}</p>
                  </div>
                </div>

                {/* Clock Out Button */}
                {!todayAttendance.clock_out && (
                  <Button
                    onClick={handleClockOut}
                    disabled={isLoading}
                    variant="destructive"
                    size="lg"
                    className="w-full gap-2 mt-4"
                  >
                    {isLoading ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-destructive-foreground border-t-transparent" />
                    ) : (
                      <LogOut className="h-5 w-5" />
                    )}
                    Clock Out
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            /* Clock In Card */
            <Card className="border-border shadow-card animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 h-20 w-20 rounded-full bg-accent/20 flex items-center justify-center">
                  <LogIn className="h-10 w-10 text-accent" />
                </div>
                <CardTitle>Belum Clock In</CardTitle>
                <CardDescription>
                  Tekan tombol di bawah untuk mencatat kehadiran Anda
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleClockIn}
                  disabled={isLoading}
                  size="lg"
                  className="w-full gap-2"
                >
                  {isLoading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  ) : (
                    <LogIn className="h-5 w-5" />
                  )}
                  Clock In Sekarang
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Info Card - Dynamic based on settings */}
          <Card className="border-border animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <CardContent className="pt-6">
              <h3 className="text-sm font-medium text-foreground mb-2">Jam Kerja</h3>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>• Clock In: <span className="font-medium text-foreground">{settings.clockInStart} - {settings.clockInEnd}</span> (Terlambat setelah {settings.lateThreshold})</p>
                <p>• Clock Out: <span className="font-medium text-foreground">{settings.clockOutStart} - {settings.clockOutEnd}</span> (Pulang awal sebelum {settings.clockOutStart})</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default AbsensiKaryawan;
