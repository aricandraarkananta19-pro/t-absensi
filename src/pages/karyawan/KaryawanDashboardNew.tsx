import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    Clock, Key, User, FileText, ChevronRight, LogOut, Calendar,
    CheckCircle2, LogIn, MapPin, History, LayoutDashboard, TrendingUp,
    Timer, Target, Award, Bell
} from "lucide-react";
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
import { WorkInsightWidget } from "@/components/journal/WorkInsightWidget";
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

        if (data) setTodayAttendance(data);
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
            const present = data.filter(d => d.status === "present" || d.status === "late").length;
            const late = data.filter(d => d.status === "late").length;
            setMonthStats({ present, late, absent: 0 }); // Absent needs separate logic, simplified here
        }
    };

    const handleLogout = async () => {
        await signOut();
        toast({ title: "Logout berhasil", description: "Sampai jumpa kembali!" });
        navigate("/auth");
    };

    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Selamat Pagi" : hour < 17 ? "Selamat Siang" : "Selamat Malam";

    const getAttendanceStatus = () => {
        if (!todayAttendance) {
            return {
                text: "Belum clock-in",
                buttonText: "Clock In",
                status: "waiting",
                icon: LogIn,
                color: "blue", // iOS Blue
            };
        }

        if (todayAttendance.clock_out) {
            return {
                text: `Selesai: ${new Date(todayAttendance.clock_out).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`,
                buttonText: "Lihat Detail",
                status: "done",
                icon: CheckCircle2,
                color: "green", // iOS Green
            };
        }

        return {
            text: `Masuk: ${new Date(todayAttendance.clock_in).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`,
            buttonText: "Clock Out",
            status: "pending",
            icon: LogOut, // Changed icon for Clock Out
            color: "red", // iOS Red/Orange for Clock Out
        };
    };

    const attendanceStatus = getAttendanceStatus();
    const StatusIcon = attendanceStatus.icon;
    const remainingLeave = Math.max(0, settings.maxLeaveDays - usedLeaveDays);

    const formatDate = (date: Date) => {
        return date.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    };

    // ==========================================
    // MOBILE VIEW (Premium iOS Style)
    // ==========================================
    if (isMobile) {
        return (
            <div className="ios-mobile-container bg-[#F2F2F7] min-h-screen">
                {/* Fixed Header - Glassmorphism */}
                <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200/50 shadow-sm pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-3 px-5 transition-all duration-300">
                    <div className="flex items-center justify-between w-full relative">
                        {/* Left: Logo */}
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-sky-500 shadow-md flex items-center justify-center shrink-0">
                            <span className="font-bold text-white text-[10px] tracking-wider">TTI</span>
                        </div>

                        {/* Middle: Title */}
                        <div className="flex flex-col items-center justify-center flex-1 mx-2">
                            <h1 className="text-[15px] font-semibold text-slate-900 leading-tight">Talenta Absensi</h1>
                            <p className="text-[10px] text-slate-500 font-medium tracking-wider uppercase opacity-80 leading-tight mt-0.5">Employee Portal</p>
                        </div>

                        {/* Right: Profile */}
                        <button
                            onClick={() => navigate("/karyawan/profil")}
                            className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center border border-slate-200/60 active:bg-slate-100 transition-colors shrink-0"
                        >
                            <User className="h-4.5 w-4.5 text-slate-600" />
                        </button>
                    </div>
                </header>

                <div className="pt-[calc(env(safe-area-inset-top)+85px)] px-5 pb-[calc(80px+env(safe-area-inset-bottom))] space-y-6">
                    {/* Greeting & Date */}
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{greeting},<br />{user?.user_metadata?.full_name?.split(" ")[0]}!</h2>
                        <p className="text-slate-500 font-medium text-sm mt-1 flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> {formatDate(currentTime)}
                        </p>
                    </div>

                    {/* Clock Action Card (Central Focus) */}
                    <div
                        className="bg-white rounded-[24px] p-6 shadow-[0_10px_30px_-5px_rgba(0,0,0,0.06)] border border-white/60 relative overflow-hidden active:scale-[0.98] transition-all duration-300"
                        onClick={() => navigate("/karyawan/absensi")}
                    >
                        {/* Dynamic Background Glow */}
                        <div className={cn(
                            "absolute -right-10 -top-10 w-32 h-32 rounded-full blur-[50px] opacity-30",
                            attendanceStatus.color === 'blue' && "bg-blue-500",
                            attendanceStatus.color === 'green' && "bg-green-500",
                            attendanceStatus.color === 'red' && "bg-orange-500",
                        )} />

                        <div className="flex flex-col items-center justify-center gap-4 py-2 relative z-10">
                            <div className={cn(
                                "w-20 h-20 rounded-[24px] flex items-center justify-center shadow-lg transition-colors duration-500",
                                attendanceStatus.color === 'blue' && "bg-blue-600 shadow-blue-500/30",
                                attendanceStatus.color === 'green' && "bg-green-500 shadow-green-500/30",
                                attendanceStatus.color === 'red' && "bg-orange-500 shadow-orange-500/30",
                            )}>
                                <StatusIcon className="w-9 h-9 text-white stroke-[2.5px]" />
                            </div>

                            <div className="text-center space-y-1">
                                <h3 className="text-xl font-bold text-slate-900">{attendanceStatus.status === 'pending' ? 'Sedang Bekerja' : attendanceStatus.status === 'done' ? 'Selesai Bekerja' : 'Mulai Bekerja'}</h3>
                                <p className={cn(
                                    "text-sm font-medium",
                                    attendanceStatus.color === 'blue' && "text-blue-600",
                                    attendanceStatus.color === 'green' && "text-green-600",
                                    attendanceStatus.color === 'red' && "text-orange-600",
                                )}>{attendanceStatus.text}</p>
                                {/* Shift Schedule Info */}
                                <p className="text-xs text-slate-400 font-medium bg-slate-100/50 px-2 py-1 rounded-md mt-1">
                                    Jadwal: {settings.clockInStart} - {settings.clockOutEnd}
                                </p>
                            </div>

                            <Button
                                className={cn(
                                    "w-full rounded-2xl h-12 text-base font-semibold shadow-none border-0 mt-2",
                                    attendanceStatus.color === 'blue' && "bg-blue-50 text-blue-700 hover:bg-blue-100",
                                    attendanceStatus.color === 'green' && "bg-green-50 text-green-700 hover:bg-green-100",
                                    attendanceStatus.color === 'red' && "bg-orange-50 text-orange-700 hover:bg-orange-100",
                                )}
                            >
                                {attendanceStatus.buttonText}
                            </Button>
                        </div>
                    </div>

                    {/* Stats Grid (Glassmorphism) */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/70 backdrop-blur-md rounded-[20px] p-5 border border-white/50 shadow-sm flex flex-col gap-3">
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="text-3xl font-bold text-slate-900 block">{monthStats.present}</span>
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total Hadir</span>
                                <span className="text-[10px] text-slate-400">(Termasuk Terlambat)</span>
                            </div>
                        </div>
                        <div className="bg-white/70 backdrop-blur-md rounded-[20px] p-5 border border-white/50 shadow-sm flex flex-col gap-3">
                            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                                <Timer className="w-5 h-5" />
                            </div>
                            <div>
                                <span className="text-3xl font-bold text-slate-900 block">{monthStats.late}</span>
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Terlambat</span>
                            </div>
                        </div>
                        <div className="col-span-2 bg-gradient-to-r from-blue-600 to-sky-500 rounded-[20px] p-5 shadow-lg shadow-blue-500/20 text-white relative overflow-hidden">
                            <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
                            <div className="relative z-10 flex items-center justify-between">
                                <div>
                                    <p className="text-blue-100 text-xs font-medium uppercase tracking-wide mb-1">Cuti Tersedia</p>
                                    <p className="text-3xl font-bold">{remainingLeave} <span className="text-lg font-medium opacity-70">Hari</span></p>
                                </div>
                                <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
                                    <FileText className="w-6 h-6 text-white" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Work Insights (Mobile) */}
                    <div className="pt-2">
                        <WorkInsightWidget userId={user?.id} />
                    </div>

                    {/* Quick Menu List (Vertical Cards as requested) */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 ml-1">Shortcut</h3>
                        <div className="space-y-3">
                            {[
                                { title: "Riwayat Absensi", subtitle: "Lihat detail kehadiran bulanan", icon: History, color: "bg-purple-100 text-purple-600", href: "/karyawan/riwayat" },
                                { title: "Ajukan Cuti", subtitle: "Form permohonan izin/cuti", icon: Calendar, color: "bg-rose-100 text-rose-600", href: "/karyawan/cuti" },
                                { title: "Laporan", subtitle: "Unduh rekap kehadiran", icon: FileText, color: "bg-emerald-100 text-emerald-600", href: "/karyawan/laporan" },
                            ].map((item) => (
                                <div
                                    key={item.title}
                                    onClick={() => navigate(item.href)}
                                    className="bg-white rounded-[20px] p-4 flex items-center gap-4 shadow-sm border border-slate-100 active:bg-slate-50 transition-colors"
                                >
                                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", item.color)}>
                                        <item.icon className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-slate-900 text-sm">{item.title}</h4>
                                        <p className="text-xs text-slate-500 mt-0.5">{item.subtitle}</p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-slate-300" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <MobileNavigation />
            </div>
        );
    }

    // ==========================================
    // DESKTOP VIEW - Clean Light Theme (Unchanged logic, just ensure existing consistency)
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

                {/* Quick Action CardDesktop */}
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
                                    <p className="text-xs text-slate-400 mt-1 bg-slate-50 inline-block px-2 py-0.5 rounded">
                                        Shift: {settings.clockInStart} - {settings.clockOutEnd}
                                    </p>
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

                {/* Stats Cards Desktop */}
                <div className="grid gap-4 sm:grid-cols-3 mb-8">
                    <Card className="border-slate-200 shadow-sm bg-white hover:shadow-md transition-shadow">
                        <CardContent className="py-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-slate-500 mb-1">Total Hadir</p>
                                    <p className="text-3xl font-bold" style={{ color: BRAND_COLORS.green }}>{monthStats.present}</p>
                                    <p className="text-xs text-slate-400 mt-1">Termasuk Terlambat</p>
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

                {/* Work Insights Widget */}
                <div className="mb-8">
                    <WorkInsightWidget userId={user?.id} />
                </div>

                {/* Menu Grid Desktop */}
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Menu</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                        { title: "Absensi", desc: "Clock-in / Clock-out", icon: Clock, href: "/karyawan/absensi", color: BRAND_COLORS.blue },
                        { title: "Riwayat", desc: "Rekap kehadiran", icon: History, href: "/karyawan/riwayat", color: BRAND_COLORS.green },
                        { title: "Cuti", desc: "Ajukan izin/cuti", icon: Calendar, href: "/karyawan/cuti", color: BRAND_COLORS.lightBlue },
                        { title: "Profil", desc: "Data pribadi", icon: User, href: "/karyawan/profil", color: "#8B5CF6" },
                    ].map((item) => (
                        <Link key={item.title} to={item.href}>
                            <Card className="h-full border-slate-200 shadow-sm bg-white hover:shadow-md hover:border-slate-300 transition-all group">
                                <CardHeader className="pb-3">
                                    <div
                                        className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-all group-hover:shadow-md"
                                        style={{ backgroundColor: `${item.color}15` }}
                                    >
                                        <item.icon className="h-6 w-6" style={{ color: item.color }} />
                                    </div>
                                    <CardTitle className="flex items-center justify-between text-base text-slate-800">
                                        {item.title}
                                        <ChevronRight className="h-5 w-5 text-slate-400 group-hover:translate-x-1 transition-transform" />
                                    </CardTitle>
                                    <CardDescription className="text-sm">{item.desc}</CardDescription>
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
