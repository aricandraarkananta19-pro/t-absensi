import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    Clock, Key, User, FileText, ChevronRight, LogOut, Calendar,
    CheckCircle2, LogIn, MapPin, History, LayoutDashboard, TrendingUp,
    Timer, Target, Award
} from "lucide-react";
import logoImage from "@/assets/logo.png";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useIsMobile } from "@/hooks/useIsMobile";
import MobileNavigation from "@/components/MobileNavigation";
import { cn } from "@/lib/utils";

// Talenta Brand Colors
const BRAND_COLORS = {
    blue: "#1A5BA8",
    lightBlue: "#00A0E3",
    green: "#7DC242",
};

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

const KaryawanDashboardNew = () => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const { settings } = useSystemSettings();
    const isMobile = useIsMobile();
    const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
    const [monthStats, setMonthStats] = useState<AttendanceStats>({ present: 0, late: 0, absent: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [usedLeaveDays, setUsedLeaveDays] = useState(0);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Update current time every second
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

    // Get current time for greeting
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Selamat Pagi" : hour < 17 ? "Selamat Siang" : "Selamat Malam";

    const getAttendanceStatus = () => {
        if (!todayAttendance) {
            return {
                text: "Belum clock-in hari ini",
                buttonText: "Clock In",
                showButton: true,
                status: "waiting",
                icon: LogIn,
                color: "primary",
            };
        }

        if (todayAttendance.clock_out) {
            return {
                text: `Selesai pukul ${new Date(todayAttendance.clock_out).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`,
                buttonText: "Lihat Detail",
                showButton: true,
                status: "done",
                icon: CheckCircle2,
                color: "success",
            };
        }

        return {
            text: `Clock-in ${new Date(todayAttendance.clock_in).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`,
            buttonText: "Clock Out",
            showButton: true,
            status: "pending",
            icon: Clock,
            color: "warning",
        };
    };

    const attendanceStatus = getAttendanceStatus();
    const StatusIcon = attendanceStatus.icon;
    const remainingLeave = Math.max(0, settings.maxLeaveDays - usedLeaveDays);
    const totalWorkDays = monthStats.present + monthStats.late;
    const attendanceRate = totalWorkDays > 0 ? Math.round((monthStats.present / totalWorkDays) * 100) : 0;

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

    const menuItems = [
        {
            icon: Clock,
            title: "Absensi",
            description: "Clock-in / Clock-out",
            href: "/karyawan/absensi",
            bgColor: `${BRAND_COLORS.blue}15`,
            iconColor: BRAND_COLORS.blue,
        },
        {
            icon: History,
            title: "Riwayat",
            description: "Rekap kehadiran",
            href: "/karyawan/riwayat",
            bgColor: `${BRAND_COLORS.green}15`,
            iconColor: BRAND_COLORS.green,
        },
        {
            icon: Calendar,
            title: "Cuti",
            description: "Ajukan izin/cuti",
            href: "/karyawan/cuti",
            bgColor: `${BRAND_COLORS.lightBlue}15`,
            iconColor: BRAND_COLORS.lightBlue,
        },
        {
            icon: User,
            title: "Profil",
            description: "Data pribadi",
            href: "/karyawan/profil",
            bgColor: "#8B5CF615",
            iconColor: "#8B5CF6",
        },
    ];

    // ==========================================
    // MOBILE VIEW - Clean Light Theme
    // ==========================================
    if (isMobile) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-24 font-['Inter',system-ui,sans-serif]">
                {/* Header - Brand Gradient */}
                <header className="relative overflow-hidden">
                    <div
                        className="absolute inset-0"
                        style={{
                            background: `linear-gradient(135deg, ${BRAND_COLORS.blue} 0%, ${BRAND_COLORS.lightBlue} 50%, ${BRAND_COLORS.green} 100%)`
                        }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />

                    <div className="relative z-10 pt-safe px-5 pb-8">
                        {/* Top Row */}
                        <div className="flex items-center justify-between mb-6 pt-4">
                            <div className="flex items-center gap-3">
                                <div className="bg-white/20 backdrop-blur-lg p-2 rounded-xl">
                                    <img
                                        src={logoImage}
                                        alt="Logo"
                                        className="h-8 w-auto"
                                    />
                                </div>
                                <span className="text-white/90 text-sm font-semibold">Talenta Traincom</span>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="p-2.5 rounded-full bg-white/15 backdrop-blur-sm active:bg-white/25 transition-colors"
                            >
                                <LogOut className="h-5 w-5 text-white" />
                            </button>
                        </div>

                        {/* Greeting */}
                        <div className="mb-5">
                            <h1 className="text-2xl font-bold text-white mb-1">
                                {greeting}! 👋
                            </h1>
                            <p className="text-white/80 text-base">
                                {user?.user_metadata?.full_name || "Karyawan"}
                            </p>
                        </div>

                        {/* Date & Location */}
                        <div className="flex items-center justify-between">
                            <p className="text-white/70 text-sm">
                                {formatDate(currentTime)}
                            </p>
                            <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-full">
                                <MapPin className="h-3.5 w-3.5 text-white/80" />
                                <span className="text-white/90 text-xs font-medium">Kantor</span>
                            </div>
                        </div>
                    </div>

                    {/* Curved Bottom */}
                    <div className="absolute bottom-0 left-0 right-0 h-6">
                        <svg viewBox="0 0 1440 48" fill="none" className="w-full h-full">
                            <path d="M0 48h1440V0C1440 0 1080 48 720 48S0 0 0 0v48z" fill="#f8fafc" />
                        </svg>
                    </div>
                </header>

                {/* Quick Action Card */}
                <div className="px-5 -mt-2">
                    <button
                        onClick={() => navigate("/karyawan/absensi")}
                        className={cn(
                            "w-full p-5 rounded-2xl shadow-md transition-all active:scale-[0.98]",
                            "flex items-center gap-4 text-left bg-white border border-slate-200"
                        )}
                    >
                        <div
                            className="w-14 h-14 rounded-2xl flex items-center justify-center"
                            style={{
                                background: attendanceStatus.status === "done"
                                    ? `${BRAND_COLORS.green}15`
                                    : attendanceStatus.status === "pending"
                                        ? "#F59E0B15"
                                        : `${BRAND_COLORS.blue}15`
                            }}
                        >
                            <StatusIcon
                                className="h-7 w-7"
                                style={{
                                    color: attendanceStatus.status === "done"
                                        ? BRAND_COLORS.green
                                        : attendanceStatus.status === "pending"
                                            ? "#F59E0B"
                                            : BRAND_COLORS.blue
                                }}
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-800 text-base">
                                {attendanceStatus.status === "done"
                                    ? "Absensi Selesai"
                                    : attendanceStatus.status === "pending"
                                        ? "Sedang Bekerja"
                                        : "Absensi Hari Ini"}
                            </p>
                            <p className="text-sm text-slate-500 mt-0.5">{attendanceStatus.text}</p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-slate-400" />
                    </button>
                </div>

                {/* Stats Section */}
                <div className="px-5 mt-6">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
                        Statistik Bulan Ini
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 className="h-4 w-4" style={{ color: BRAND_COLORS.green }} />
                                <span className="text-xs text-slate-500">Hadir</span>
                            </div>
                            <p className="text-2xl font-bold" style={{ color: BRAND_COLORS.green }}>{monthStats.present}</p>
                        </div>
                        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <Timer className="h-4 w-4 text-amber-500" />
                                <span className="text-xs text-slate-500">Telat</span>
                            </div>
                            <p className="text-2xl font-bold text-amber-600">{monthStats.late}</p>
                        </div>
                        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <Calendar className="h-4 w-4" style={{ color: BRAND_COLORS.blue }} />
                                <span className="text-xs text-slate-500">Sisa Cuti</span>
                            </div>
                            <p className="text-2xl font-bold" style={{ color: BRAND_COLORS.blue }}>{remainingLeave}</p>
                        </div>
                    </div>
                </div>

                {/* Menu Grid */}
                <div className="px-5 mt-6">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
                        Menu
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        {menuItems.map((item, index) => (
                            <Link
                                key={item.title}
                                to={item.href}
                                className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm active:scale-[0.98] transition-transform"
                                style={{ animationDelay: `${index * 0.05}s` }}
                            >
                                <div
                                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
                                    style={{ backgroundColor: item.bgColor }}
                                >
                                    <item.icon className="h-6 w-6" style={{ color: item.iconColor }} />
                                </div>
                                <p className="font-semibold text-slate-800 text-sm">{item.title}</p>
                                <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Work Hours Info */}
                <div className="px-5 mt-6 mb-4">
                    <div
                        className="rounded-2xl p-4 border"
                        style={{
                            backgroundColor: `${BRAND_COLORS.blue}05`,
                            borderColor: `${BRAND_COLORS.blue}20`
                        }}
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{ backgroundColor: `${BRAND_COLORS.blue}15` }}
                            >
                                <Clock className="h-5 w-5" style={{ color: BRAND_COLORS.blue }} />
                            </div>
                            <h4 className="font-semibold text-slate-800">Jam Kerja</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Clock In</span>
                                <span className="font-medium text-slate-800">{settings.clockInStart} - {settings.clockInEnd}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Clock Out</span>
                                <span className="font-medium text-slate-800">{settings.clockOutStart} - {settings.clockOutEnd}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Navigation */}
                <MobileNavigation />
            </div>
        );
    }

    // ==========================================
    // DESKTOP VIEW - Clean Light Theme
    // ==========================================
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50 font-['Inter',system-ui,sans-serif]">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-6xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div
                                className="p-2 rounded-xl shadow-md"
                                style={{
                                    background: `linear-gradient(135deg, ${BRAND_COLORS.blue} 0%, ${BRAND_COLORS.lightBlue} 100%)`
                                }}
                            >
                                <img src={logoImage} alt="Logo" className="h-8 w-auto" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-lg font-bold text-slate-800">Portal Karyawan</h1>
                                    <Badge
                                        className="border-0 text-xs font-medium"
                                        style={{ backgroundColor: `${BRAND_COLORS.blue}15`, color: BRAND_COLORS.blue }}
                                    >
                                        Karyawan
                                    </Badge>
                                </div>
                                <p className="text-sm text-slate-500">Talenta Traincom Indonesia</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-medium text-slate-800">
                                    {user?.user_metadata?.full_name || "Karyawan"}
                                </p>
                                <p className="text-xs text-slate-500">{user?.email}</p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleLogout}
                                className="gap-2 border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                            >
                                <LogOut className="h-4 w-4" />
                                <span className="hidden sm:inline">Logout</span>
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-6xl mx-auto px-6 py-8">
                {/* Welcome Section */}
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-slate-800">
                        {greeting}, {user?.user_metadata?.full_name?.split(" ")[0] || "Karyawan"}! 👋
                    </h2>
                    <p className="text-slate-500">{formatDate(currentTime)}</p>
                </div>

                {/* Quick Action Card */}
                <Card className={cn(
                    "mb-8 border-0 shadow-md overflow-hidden bg-white"
                )}>
                    <div
                        className="h-1"
                        style={{
                            background: attendanceStatus.status === "done"
                                ? `linear-gradient(90deg, ${BRAND_COLORS.green} 0%, #8BC34A 100%)`
                                : attendanceStatus.status === "pending"
                                    ? "linear-gradient(90deg, #F59E0B 0%, #FBBF24 100%)"
                                    : `linear-gradient(90deg, ${BRAND_COLORS.blue} 0%, ${BRAND_COLORS.lightBlue} 100%)`
                        }}
                    />
                    <CardContent className="py-6">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div
                                    className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm"
                                    style={{
                                        backgroundColor: attendanceStatus.status === "done"
                                            ? `${BRAND_COLORS.green}15`
                                            : attendanceStatus.status === "pending"
                                                ? "#F59E0B15"
                                                : `${BRAND_COLORS.blue}15`
                                    }}
                                >
                                    <StatusIcon
                                        className="h-8 w-8"
                                        style={{
                                            color: attendanceStatus.status === "done"
                                                ? BRAND_COLORS.green
                                                : attendanceStatus.status === "pending"
                                                    ? "#F59E0B"
                                                    : BRAND_COLORS.blue
                                        }}
                                    />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-800">Absensi Hari Ini</h3>
                                    <p className="text-slate-500">{attendanceStatus.text}</p>
                                </div>
                            </div>
                            <Button
                                size="lg"
                                className="gap-2 shadow-md transition-all hover:shadow-lg text-white"
                                style={{
                                    background: attendanceStatus.status === "done"
                                        ? "#64748B"
                                        : attendanceStatus.status === "pending"
                                            ? "linear-gradient(135deg, #EF4444 0%, #F87171 100%)"
                                            : `linear-gradient(135deg, ${BRAND_COLORS.blue} 0%, ${BRAND_COLORS.lightBlue} 100%)`
                                }}
                                onClick={() => navigate("/karyawan/absensi")}
                            >
                                <Clock className="h-5 w-5" />
                                {attendanceStatus.buttonText}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Stats Cards */}
                <div className="grid gap-4 sm:grid-cols-3 mb-8">
                    <Card className="border-slate-200 shadow-sm bg-white hover:shadow-md transition-shadow">
                        <CardContent className="py-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-slate-500 mb-1">Hadir Tepat Waktu</p>
                                    <p className="text-3xl font-bold" style={{ color: BRAND_COLORS.green }}>{monthStats.present}</p>
                                    <p className="text-xs text-slate-400 mt-1">hari bulan ini</p>
                                </div>
                                <div
                                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                                    style={{ backgroundColor: `${BRAND_COLORS.green}15` }}
                                >
                                    <CheckCircle2 className="h-6 w-6" style={{ color: BRAND_COLORS.green }} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-slate-200 shadow-sm bg-white hover:shadow-md transition-shadow">
                        <CardContent className="py-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-slate-500 mb-1">Terlambat</p>
                                    <p className="text-3xl font-bold text-amber-600">{monthStats.late}</p>
                                    <p className="text-xs text-slate-400 mt-1">hari bulan ini</p>
                                </div>
                                <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
                                    <Timer className="h-6 w-6 text-amber-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-slate-200 shadow-sm bg-white hover:shadow-md transition-shadow">
                        <CardContent className="py-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-slate-500 mb-1">Sisa Cuti</p>
                                    <p className="text-3xl font-bold" style={{ color: BRAND_COLORS.blue }}>{remainingLeave}</p>
                                    <p className="text-xs text-slate-400 mt-1">dari {settings.maxLeaveDays} hari</p>
                                </div>
                                <div
                                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                                    style={{ backgroundColor: `${BRAND_COLORS.blue}15` }}
                                >
                                    <Calendar className="h-6 w-6" style={{ color: BRAND_COLORS.blue }} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Menu Grid */}
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Menu</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {menuItems.map((item, index) => (
                        <Link key={item.title} to={item.href}>
                            <Card className="h-full border-slate-200 shadow-sm bg-white hover:shadow-md hover:border-slate-300 transition-all group">
                                <CardHeader className="pb-3">
                                    <div
                                        className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-all group-hover:shadow-md"
                                        style={{ backgroundColor: item.bgColor }}
                                    >
                                        <item.icon className="h-6 w-6" style={{ color: item.iconColor }} />
                                    </div>
                                    <CardTitle className="flex items-center justify-between text-base text-slate-800">
                                        {item.title}
                                        <ChevronRight className="h-5 w-5 text-slate-400 group-hover:translate-x-1 transition-transform" />
                                    </CardTitle>
                                    <CardDescription className="text-sm">{item.description}</CardDescription>
                                </CardHeader>
                            </Card>
                        </Link>
                    ))}
                    {/* Change Password */}
                    <Link to="/edit-password">
                        <Card className="h-full border-slate-200 shadow-sm bg-white hover:shadow-md hover:border-slate-300 transition-all group">
                            <CardHeader className="pb-3">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 bg-slate-100 group-hover:bg-slate-200 transition-colors">
                                    <Key className="h-6 w-6 text-slate-600" />
                                </div>
                                <CardTitle className="flex items-center justify-between text-base text-slate-800">
                                    Ubah Password
                                    <ChevronRight className="h-5 w-5 text-slate-400 group-hover:translate-x-1 transition-transform" />
                                </CardTitle>
                                <CardDescription className="text-sm">Ganti password akun</CardDescription>
                            </CardHeader>
                        </Card>
                    </Link>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-200 bg-white mt-12">
                <div className="max-w-6xl mx-auto px-6 py-4">
                    <p className="text-center text-sm text-slate-500">
                        © 2025 Talenta Traincom Indonesia. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default KaryawanDashboardNew;
