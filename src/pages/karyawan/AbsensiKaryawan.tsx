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

  const getIOSStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return (
          <div className="ios-status-badge success">
            <span className="dot" />
            <span>Hadir Tepat Waktu</span>
          </div>
        );
      case "late":
        return (
          <div className="ios-status-badge warning">
            <span className="dot" />
            <span>Terlambat</span>
          </div>
        );
      case "early_leave":
        return (
          <div className="ios-status-badge info">
            <span className="dot" />
            <span>Pulang Awal</span>
          </div>
        );
      default:
        return (
          <div className="ios-status-badge info">
            <span className="dot" />
            <span>{status}</span>
          </div>
        );
    }
  };

  // ==========================================
  // iOS MOBILE VIEW
  // ==========================================
  if (isMobile) {
    return (
      <div className="ios-mobile-container" style={{ paddingBottom: "calc(160px + env(safe-area-inset-bottom))" }}>
        {/* iOS Header with Clock */}
        <div className="ios-header" style={{ paddingBottom: "32px" }}>
          <div className="relative z-10">
            {/* Back Button Row */}
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={() => navigate("/dashboard")}
                className="p-2 -ml-2 rounded-full bg-white/10 active:bg-white/20 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-white" />
              </button>
              <div>
                <h1 className="text-lg font-semibold text-white">Absensi</h1>
                <p className="text-sm text-white/70">Clock In & Clock Out</p>
              </div>
            </div>

            {/* Date Display */}
            <div className="text-center mb-4">
              <p className="ios-date-display text-white/80">
                <Calendar className="inline h-4 w-4 mr-1.5" />
                {formatDate(currentTime)}
              </p>
            </div>

            {/* Large Digital Clock */}
            <div className="text-center">
              <div className="ios-clock-display">
                {formatTime(currentTime).split(":").map((part, i) => (
                  <span key={i}>
                    {i > 0 && <span className="ios-clock-seconds">:</span>}
                    <span className={i === 2 ? "ios-clock-seconds" : ""}>{part}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Location Badge */}
            <div className="flex justify-center mt-4">
              <div className="ios-location-badge">
                <MapPin className="h-3.5 w-3.5" />
                <span>{location || "Mendapatkan lokasi..."}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="px-4 mt-6">
          {/* Status Display Area (Non-interactive) */}
          <div className="flex flex-col items-center mb-6">
            {!todayAttendance ? (
              <div className="w-[120px] h-[120px] rounded-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-gray-100 to-gray-50 border-4 border-white shadow-lg">
                <LogIn className="h-10 w-10 text-gray-400" />
                <span className="text-sm font-semibold text-gray-500">Belum Absen</span>
              </div>
            ) : !todayAttendance.clock_out ? (
              <div className="w-[120px] h-[120px] rounded-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-green-50 to-green-100 border-4 border-white shadow-lg pulsing">
                <Timer className="h-10 w-10 text-green-600" />
                <span className="text-sm font-semibold text-green-700">Bekerja</span>
              </div>
            ) : (
              <div className="w-[120px] h-[120px] rounded-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-blue-50 to-blue-100 border-4 border-white shadow-lg">
                <CheckCircle2 className="h-10 w-10 text-blue-600" />
                <span className="text-sm font-semibold text-blue-700">Selesai</span>
              </div>
            )}

            {/* Status Text */}
            <p className="mt-4 text-center text-muted-foreground text-sm max-w-[200px]">
              {!todayAttendance
                ? "Silakan lakukan clock in untuk memulai jam kerja Anda hari ini"
                : !todayAttendance.clock_out
                  ? "Jangan lupa clock out sebelum pulang"
                  : "Terima kasih atas kerja keras Anda hari ini"}
            </p>
          </div>

          {/* Status Badge */}
          {todayAttendance && (
            <div className="flex justify-center mb-6">
              {getIOSStatusBadge(todayAttendance.status)}
            </div>
          )}

          {/* Time Cards */}
          {todayAttendance && (
            <div className="space-y-3 mb-6">
              {/* Clock In Time */}
              <div className="ios-time-card">
                <div className="ios-time-icon in">
                  <LogIn className="h-5 w-5 text-green-500" />
                </div>
                <div className="ios-time-info">
                  <p className="ios-time-label">Clock In</p>
                  <p className="ios-time-value green">
                    {formatTimeShort(new Date(todayAttendance.clock_in))}
                  </p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>

              {/* Clock Out Time */}
              <div className="ios-time-card">
                <div className={`ios-time-icon ${todayAttendance.clock_out ? "out" : "duration"}`}>
                  <LogOut className={`h-5 w-5 ${todayAttendance.clock_out ? "text-red-500" : "text-gray-400"}`} />
                </div>
                <div className="ios-time-info">
                  <p className="ios-time-label">Clock Out</p>
                  {todayAttendance.clock_out ? (
                    <p className="ios-time-value red">
                      {formatTimeShort(new Date(todayAttendance.clock_out))}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Belum clock out</p>
                  )}
                </div>
                {todayAttendance.clock_out ? (
                  <CheckCircle2 className="h-5 w-5 text-red-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-gray-300" />
                )}
              </div>

              {/* Work Duration */}
              <div className="ios-time-card">
                <div className="ios-time-icon duration">
                  <Timer className="h-5 w-5 text-blue-500" />
                </div>
                <div className="ios-time-info">
                  <p className="ios-time-label">Durasi Kerja</p>
                  <p className="ios-time-value blue">{getWorkDuration()}</p>
                </div>
              </div>
            </div>
          )}

          {/* Work Hours Info */}
          <div className="ios-card p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <h4 className="font-semibold text-foreground">Jam Kerja</h4>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>Clock In</span>
                <span className="font-medium text-foreground">{settings.clockInStart} - {settings.clockInEnd}</span>
              </div>
              <div className="flex justify-between">
                <span>Terlambat setelah</span>
                <span className="font-medium text-orange-500">{settings.lateThreshold}</span>
              </div>
              <div className="flex justify-between">
                <span>Clock Out</span>
                <span className="font-medium text-foreground">{settings.clockOutStart} - {settings.clockOutEnd}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Action Bar */}
        <div
          className="fixed left-0 right-0 p-4 bg-white/80 backdrop-blur-xl border-t border-gray-200/50 z-40"
          style={{ bottom: "calc(64px + env(safe-area-inset-bottom))" }}
        >
          {!todayAttendance ? (
            <button
              onClick={handleClockIn}
              disabled={isLoading}
              className="ios-btn-primary w-full flex items-center justify-center gap-3 shadow-lg shadow-green-500/20"
            >
              {isLoading ? (
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <Fingerprint className="h-6 w-6" />
                  <span>Clock In Sekarang</span>
                </>
              )}
            </button>
          ) : !todayAttendance.clock_out ? (
            <button
              onClick={handleClockOut}
              disabled={isLoading}
              className="ios-btn-primary clock-out w-full flex items-center justify-center gap-3 shadow-lg shadow-red-500/20"
            >
              {isLoading ? (
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <LogOut className="h-6 w-6" />
                  <span>Clock Out Sekarang</span>
                </>
              )}
            </button>
          ) : (
            <div className="w-full h-[56px] rounded-2xl flex items-center justify-center gap-2 bg-gray-100 text-gray-400 font-medium">
              <CheckCircle2 className="h-5 w-5" />
              <span>Absensi Selesai</span>
            </div>
          )}
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
