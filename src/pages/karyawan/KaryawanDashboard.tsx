import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Clock, Key, User, FileText, ChevronRight, LogOut, Calendar, CheckCircle2, LogIn, MapPin } from "lucide-react";
import logoImage from "@/assets/logo.png";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useIsMobile } from "@/hooks/useIsMobile";
import MobileNavigation from "@/components/MobileNavigation";

interface AttendanceRecord {
  id: string;
  clock_in: string;
  clock_out: string | null;
  status: string;
}

interface AttendanceStats {
  present: number;
  late: number;
  absent: number;
}

const KaryawanDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { settings } = useSystemSettings();
  const isMobile = useIsMobile();
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [monthStats, setMonthStats] = useState<AttendanceStats>({ present: 0, late: 0, absent: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [usedLeaveDays, setUsedLeaveDays] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every second for iOS display
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user) {
      fetchTodayAttendance();
      fetchMonthStats();
      fetchUsedLeaveDays();
    }
  }, [user]);

  const fetchUsedLeaveDays = async () => {
    if (!user) return;

    const currentYear = new Date().getFullYear();
    const { data } = await supabase
      .from("leave_requests")
      .select("start_date, end_date")
      .eq("user_id", user.id)
      .eq("status", "approved")
      .eq("leave_type", "cuti")
      .gte("start_date", `${currentYear}-01-01`)
      .lte("end_date", `${currentYear}-12-31`);

    if (data) {
      const totalDays = data.reduce((acc, leave) => {
        const start = new Date(leave.start_date);
        const end = new Date(leave.end_date);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return acc + diffDays;
      }, 0);
      setUsedLeaveDays(totalDays);
    }
  };

  const fetchTodayAttendance = async () => {
    if (!user) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", user.id)
      .gte("clock_in", today.toISOString())
      .lt("clock_in", tomorrow.toISOString())
      .order("clock_in", { ascending: false })
      .maybeSingle();

    if (data) {
      setTodayAttendance(data);
    }
    setIsLoading(false);
  };

  const fetchMonthStats = async () => {
    if (!user) return;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const { data } = await supabase
      .from("attendance")
      .select("status")
      .eq("user_id", user.id)
      .gte("clock_in", startOfMonth.toISOString())
      .lte("clock_in", endOfMonth.toISOString());

    if (data) {
      const present = data.filter(d => d.status === "present").length;
      const late = data.filter(d => d.status === "late").length;
      setMonthStats({ present, late, absent: 0 });
    }
  };

  const handleLogout = async () => {
    await signOut();
    toast({
      title: "Logout berhasil",
      description: "Sampai jumpa kembali!",
    });
    navigate("/auth");
  };

  const menuItems = [
    {
      icon: Clock,
      title: "Absensi",
      description: "Clock-in dan clock-out",
      href: "/karyawan/absensi",
      color: "bg-accent/10 text-accent",
      iosColor: "green",
    },
    {
      icon: Calendar,
      title: "Riwayat Kehadiran",
      description: "Lihat rekap absensi Anda",
      href: "/karyawan/riwayat",
      color: "bg-info/10 text-info",
      iosColor: "teal",
    },
    {
      icon: FileText,
      title: "Pengajuan Cuti",
      description: "Ajukan izin atau cuti",
      href: "/karyawan/cuti",
      color: "bg-warning/10 text-warning",
      iosColor: "orange",
    },
    {
      icon: Key,
      title: "Ubah Password",
      description: "Ganti password akun",
      href: "/edit-password",
      color: "bg-primary/10 text-primary",
      iosColor: "purple",
    },
  ];

  // Get current time for greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Selamat Pagi" : hour < 17 ? "Selamat Siang" : "Selamat Malam";

  const getAttendanceStatus = () => {
    if (!todayAttendance) {
      return {
        text: "Anda belum melakukan clock-in hari ini",
        buttonText: "Clock In Sekarang",
        showButton: true,
        status: "waiting",
      };
    }

    if (todayAttendance.clock_out) {
      return {
        text: `Clock-out pada ${new Date(todayAttendance.clock_out).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`,
        buttonText: "Lihat Detail",
        showButton: true,
        status: "done",
      };
    }

    return {
      text: `Clock-in pada ${new Date(todayAttendance.clock_in).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`,
      buttonText: "Clock Out Sekarang",
      showButton: true,
      status: "pending",
    };
  };

  const attendanceStatus = getAttendanceStatus();

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
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  // ==========================================
  // iOS MOBILE VIEW
  // ==========================================
  if (isMobile) {
    return (
      <div className="ios-mobile-container">
        {/* iOS Header with Gradient */}
        <header className="ios-header">
          <div className="relative z-10">
            {/* Top Row - Logo and Logout */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <img src={logoImage} alt="T-Absensi" className="h-8 w-auto brightness-0 invert" />
                <span className="text-white/80 text-sm font-medium">T-Absensi</span>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-full bg-white/10 active:bg-white/20 transition-colors"
              >
                <LogOut className="h-5 w-5 text-white" />
              </button>
            </div>

            {/* Greeting */}
            <div className="mb-4">
              <h1 className="ios-greeting">{greeting}! 👋</h1>
              <p className="ios-greeting-subtitle">
                {user?.user_metadata?.full_name || "Karyawan"}
              </p>
            </div>

            {/* Date & Time Display */}
            <div className="flex items-center justify-between">
              <div className="ios-date-display">
                {formatDate(currentTime)}
              </div>
              <div className="ios-location-badge">
                <MapPin className="h-3.5 w-3.5" />
                <span>Kantor</span>
              </div>
            </div>
          </div>
        </header>

        {/* Quick Action Card - Floating */}
        <div
          className="ios-quick-action"
          onClick={() => navigate("/karyawan/absensi")}
        >
          <div className={`ios-quick-action-icon ${attendanceStatus.status}`}>
            {attendanceStatus.status === "done" ? (
              <CheckCircle2 className="h-7 w-7" />
            ) : attendanceStatus.status === "pending" ? (
              <Clock className="h-7 w-7" />
            ) : (
              <LogIn className="h-7 w-7" />
            )}
          </div>
          <div className="ios-quick-action-content">
            <p className="ios-quick-action-title">
              {attendanceStatus.status === "done"
                ? "Absensi Selesai"
                : attendanceStatus.status === "pending"
                  ? "Sedang Bekerja"
                  : "Absensi Hari Ini"}
            </p>
            <p className="ios-quick-action-desc">{attendanceStatus.text}</p>
          </div>
          <ChevronRight className="ios-quick-action-arrow h-5 w-5" />
        </div>

        {/* Stats Section */}
        <div className="px-4 mb-6">
          <h3 className="ios-section-header">Statistik Bulan Ini</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="ios-stats-card">
              <div className="ios-stats-value green">{monthStats.present}</div>
              <div className="ios-stats-label">Hadir</div>
            </div>
            <div className="ios-stats-card">
              <div className="ios-stats-value orange">{monthStats.late}</div>
              <div className="ios-stats-label">Terlambat</div>
            </div>
            <div className="ios-stats-card">
              <div className="ios-stats-value blue">{Math.max(0, settings.maxLeaveDays - usedLeaveDays)}</div>
              <div className="ios-stats-label">Sisa Cuti</div>
            </div>
          </div>
        </div>

        {/* Menu Grid */}
        <div className="px-4">
          <h3 className="ios-section-header">Menu</h3>
          <div className="ios-menu-grid">
            {menuItems.map((item) => (
              <Link
                key={item.title}
                to={item.href}
                className="ios-menu-item"
              >
                <div className={`ios-menu-icon ${item.iosColor}`}>
                  <item.icon className="h-6 w-6" />
                </div>
                <div className="ios-menu-title">{item.title}</div>
                <div className="ios-menu-desc">{item.description}</div>
              </Link>
            ))}
          </div>
        </div>

        {/* Work Hours Info */}
        <div className="px-4 mt-6 mb-8">
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
                <span>Clock Out</span>
                <span className="font-medium text-foreground">{settings.clockOutStart} - {settings.clockOutEnd}</span>
              </div>
            </div>
          </div>
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-24 items-center justify-center">
                <img src={logoImage} alt="Logo" className="h-full w-auto object-contain" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-foreground">Portal Karyawan</h1>
                  <Badge variant="secondary">Karyawan</Badge>
                </div>
                <p className="text-sm text-muted-foreground">Talenta Digital Attendance</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-foreground">
                  {user?.user_metadata?.full_name || "Karyawan"}
                </p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8 animate-fade-in">
          <h2 className="text-xl font-semibold text-foreground">
            {greeting}, {user?.user_metadata?.full_name || "Karyawan"}!
          </h2>
          <p className="text-muted-foreground">
            {new Date().toLocaleDateString("id-ID", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric"
            })}
          </p>
        </div>

        {/* Quick Action - Absensi */}
        <Card className={`border-border mb-8 animate-fade-in ${todayAttendance?.clock_out
            ? "bg-gradient-to-r from-success/5 to-success/10"
            : todayAttendance
              ? "bg-gradient-to-r from-warning/5 to-warning/10"
              : "bg-gradient-to-r from-primary/5 to-accent/5"
          }`}>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`h-16 w-16 rounded-full flex items-center justify-center ${todayAttendance?.clock_out
                    ? "bg-success/20"
                    : todayAttendance
                      ? "bg-warning/20"
                      : "bg-accent/20"
                  }`}>
                  {todayAttendance?.clock_out ? (
                    <CheckCircle2 className="h-8 w-8 text-success" />
                  ) : todayAttendance ? (
                    <Clock className="h-8 w-8 text-warning" />
                  ) : (
                    <LogIn className="h-8 w-8 text-accent" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Absensi Hari Ini</h3>
                  <p className="text-muted-foreground">{attendanceStatus.text}</p>
                </div>
              </div>
              <Button
                size="lg"
                className="gap-2"
                onClick={() => navigate("/karyawan/absensi")}
                variant={todayAttendance?.clock_out ? "outline" : "default"}
              >
                <Clock className="h-5 w-5" />
                {attendanceStatus.buttonText}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          <Card className="border-border animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-success">{monthStats.present}</div>
                <p className="text-sm text-muted-foreground">Hari Hadir (Tepat Waktu)</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-warning">{monthStats.late}</div>
                <p className="text-sm text-muted-foreground">Hari Terlambat</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-info">{Math.max(0, settings.maxLeaveDays - usedLeaveDays)}</div>
                <p className="text-sm text-muted-foreground">Sisa Cuti Tahunan</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Menu Grid */}
        <h3 className="mb-4 text-lg font-semibold text-foreground">Menu</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {menuItems.map((item, index) => (
            <Link
              key={item.title}
              to={item.href}
              className="block animate-fade-in"
              style={{ animationDelay: `${(index + 3) * 0.1}s` }}
            >
              <Card className="group h-full border-border transition-all duration-300 hover:border-primary/30 hover:shadow-lg">
                <CardHeader className="pb-3">
                  <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-lg ${item.color}`}>
                    <item.icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="flex items-center justify-between text-lg">
                    {item.title}
                    <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
          {/* Profile Menu Item - Desktop Only */}
          <Link
            to="/karyawan/profil"
            className="block animate-fade-in"
            style={{ animationDelay: `${(menuItems.length + 3) * 0.1}s` }}
          >
            <Card className="group h-full border-border transition-all duration-300 hover:border-primary/30 hover:shadow-lg">
              <CardHeader className="pb-3">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-muted-foreground/10 text-muted-foreground">
                  <User className="h-6 w-6" />
                </div>
                <CardTitle className="flex items-center justify-between text-lg">
                  Profil Saya
                  <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </CardTitle>
                <CardDescription>Lihat dan edit profil</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-12">
        <div className="container mx-auto px-4 py-4">
          <p className="text-center text-sm text-muted-foreground">
            © 2025 Talenta Digital Attendance System. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default KaryawanDashboard;
