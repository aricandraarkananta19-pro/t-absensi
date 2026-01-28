import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock, ArrowLeft, MapPin, CheckCircle2, XCircle,
  LogIn, LogOut, Calendar, Timer
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useSystemSettings } from "@/hooks/useSystemSettings";

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

    return `${hours} jam ${minutes} menit`;
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
