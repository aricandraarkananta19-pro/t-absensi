import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Clock, Key, User, FileText, ChevronRight, LogOut, Calendar, CheckCircle2, LogIn } from "lucide-react";
import logoImage from "@/assets/logo.png";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSystemSettings } from "@/hooks/useSystemSettings";
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
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [monthStats, setMonthStats] = useState<AttendanceStats>({ present: 0, late: 0, absent: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [usedLeaveDays, setUsedLeaveDays] = useState(0);

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
    },
    {
      icon: Calendar,
      title: "Riwayat Kehadiran",
      description: "Lihat rekap absensi Anda",
      href: "/karyawan/riwayat",
      color: "bg-info/10 text-info",
    },
    {
      icon: FileText,
      title: "Pengajuan Cuti",
      description: "Ajukan izin atau cuti",
      href: "/karyawan/cuti",
      color: "bg-warning/10 text-warning",
    },
    {
      icon: Key,
      title: "Ubah Password",
      description: "Ganti password akun",
      href: "/edit-password",
      color: "bg-primary/10 text-primary",
    },
    {
      icon: User,
      title: "Profil Saya",
      description: "Lihat dan edit profil",
      href: "/karyawan/profil",
      color: "bg-muted-foreground/10 text-muted-foreground",
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
      };
    }
    
    if (todayAttendance.clock_out) {
      return {
        text: `Anda sudah clock-out pada ${new Date(todayAttendance.clock_out).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`,
        buttonText: "Lihat Detail",
        showButton: true,
      };
    }
    
    return {
      text: `Clock-in pada ${new Date(todayAttendance.clock_in).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} - Belum clock-out`,
      buttonText: "Clock Out Sekarang",
      showButton: true,
    };
  };

  const attendanceStatus = getAttendanceStatus();

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
        <Card className={`border-border mb-8 animate-fade-in ${
          todayAttendance?.clock_out 
            ? "bg-gradient-to-r from-success/5 to-success/10" 
            : todayAttendance 
              ? "bg-gradient-to-r from-warning/5 to-warning/10"
              : "bg-gradient-to-r from-primary/5 to-accent/5"
        }`}>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`h-16 w-16 rounded-full flex items-center justify-center ${
                  todayAttendance?.clock_out 
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
