import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    Clock, Key, User, FileText, ChevronRight, LogOut, Calendar,
    CheckCircle2, LogIn, MapPin, History, LayoutDashboard, TrendingUp,
    Timer, Target, Award, Bell, BookOpen
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
                                { title: "Jurnal Kerja", subtitle: "Tulis laporan aktivitas", icon: BookOpen, color: "bg-blue-100 text-blue-600", href: "/karyawan/jurnal" },
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
    // ==========================================
    // DESKTOP VIEW - Enterprise & Work-Centric
    // ==========================================

    // Journal Logic
    const [journalContent, setJournalContent] = useState("");
    const [isSavingJournal, setIsSavingJournal] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    const handleSaveJournal = async (isDraft: boolean) => {
        if (!journalContent.trim()) {
            toast({ variant: "destructive", title: "Gagal", description: "Tulis aktivitas Anda terlebih dahulu." });
            return;
        }

        setIsSavingJournal(true);
        try {
            const status = isDraft ? 'draft' : 'submitted';

            const { error } = await supabase
                .from('work_journals' as any)
                .insert({
                    user_id: user?.id,
                    content: journalContent,
                    date: new Date().toISOString().split('T')[0],
                    duration: 0,
                    status: 'completed',
                    verification_status: status
                });

            if (error) throw error;

            toast({
                title: isDraft ? "Draft Disimpan" : "Laporan Terkirim",
                description: isDraft
                    ? "Tersimpan di draft. Belum terlihat oleh manajer."
                    : "Laporan kerja Anda telah dikirim ke manajer.",
            });

            setJournalContent("");
            setLastSaved(new Date());

            // Trigger refresh logic if needed (e.g. invalidate queries)
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setIsSavingJournal(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-['Inter',system-ui,sans-serif] pb-12">
            {/* Enterprise Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs tracking-wider shadow-sm">
                            TTI
                        </div>
                        <div className="h-6 w-px bg-slate-200 mx-1" />
                        <h1 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Workspace</h1>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-bold text-slate-800 leading-none">
                                {user?.user_metadata?.full_name || "Karyawan"}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">{user?.email}</p>
                        </div>
                        <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
                            <User className="w-4 h-4 text-slate-500" />
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleLogout}
                            className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                        >
                            <LogOut className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8">
                <div className="grid grid-cols-12 gap-8">
                    {/* LEFT COLUMN: IDENTITIY & QUICK ACTIONS (3 Cols) */}
                    <div className="col-span-12 lg:col-span-3 space-y-6">
                        {/* Profile Summary */}
                        <Card className="border-0 shadow-sm bg-white overflow-hidden">
                            <div className="h-20 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
                            <div className="px-5 pb-5 -mt-10">
                                <div className="w-20 h-20 rounded-2xl bg-white p-1 shadow-md mb-3">
                                    <div className="w-full h-full rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                                        <User className="w-8 h-8" />
                                    </div>
                                </div>
                                <h2 className="text-lg font-bold text-slate-900 leading-tight">
                                    {greeting},<br />
                                    {user?.user_metadata?.full_name?.split(" ")[0]}
                                </h2>
                                <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 font-medium">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {formatDate(currentTime)}
                                </div>
                            </div>
                        </Card>

                        {/* Attendance Status (Compact) */}
                        <Card className="border-slate-200 shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                    <Clock className="w-4 h-4" /> Status Kehadiran
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-3 h-3 rounded-full animate-pulse",
                                            attendanceStatus.status === 'pending' ? "bg-green-500" :
                                                attendanceStatus.status === 'done' ? "bg-slate-400" : "bg-amber-500"
                                        )} />
                                        <span className="text-sm font-medium text-slate-700">
                                            {attendanceStatus.status === 'pending' ? "Online - Bekerja" :
                                                attendanceStatus.status === 'done' ? "Offline" : "Belum Hadir"}
                                        </span>
                                    </div>
                                    <Button
                                        className={cn(
                                            "w-full font-medium shadow-sm transition-all",
                                            attendanceStatus.color === 'blue' && "bg-blue-600 hover:bg-blue-700",
                                            attendanceStatus.color === 'green' && "bg-emerald-600 hover:bg-emerald-700",
                                            attendanceStatus.color === 'red' && "bg-rose-600 hover:bg-rose-700"
                                        )}
                                        onClick={() => navigate("/karyawan/absensi")}
                                    >
                                        {attendanceStatus.buttonText}
                                    </Button>
                                    <div className="text-center">
                                        <p className="text-xs text-slate-400">
                                            Shift: {settings.clockInStart} - {settings.clockOutEnd}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Navigation Shortcuts */}
                        <div className="space-y-2">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Menu</p>
                            {[
                                { label: "Riwayat Absensi", icon: History, href: "/karyawan/riwayat" },
                                { label: "Jurnal & Laporan", icon: FileText, href: "/karyawan/jurnal" },
                                { label: "Pengajuan Cuti", icon: Calendar, href: "/karyawan/cuti" },
                                { label: "Ubah Password", icon: Key, href: "/edit-password" },
                            ].map((item) => (
                                <Link key={item.href} to={item.href}>
                                    <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white hover:shadow-sm transition-all text-slate-600 hover:text-blue-600 group text-left">
                                        <item.icon className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                                        <span className="text-sm font-medium">{item.label}</span>
                                    </button>
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: WORKSPACE (9 Cols) */}
                    <div className="col-span-12 lg:col-span-9 space-y-8">
                        {/* Stats Overview */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {[
                                { label: "Hadir Bulan Ini", val: monthStats.present, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
                                { label: "Terlambat", val: monthStats.late, icon: Timer, color: "text-amber-600", bg: "bg-amber-50" },
                                { label: "Cuti Tersedia", val: remainingLeave, icon: FileText, color: "text-blue-600", bg: "bg-blue-50" },
                            ].map((stat, idx) => (
                                <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{stat.label}</p>
                                        <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.val}</p>
                                    </div>
                                    <div className={`p-3 rounded-lg ${stat.bg}`}>
                                        <stat.icon className={`w-5 h-5 ${stat.color}`} />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* MAIN WORK JOURNAL INPUT */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-1 h-full bg-blue-600" />
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-blue-50 rounded-lg">
                                    <BookOpen className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">Apa yang Anda kerjakan hari ini?</h3>
                                    <p className="text-sm text-slate-500">Catat aktivitas kerja Anda sekarang. Jangan menunggu pulang.</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <textarea
                                    className="w-full min-h-[120px] p-4 text-base bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none outline-none placeholder:text-slate-400"
                                    placeholder="Contoh: Menyelesaikan desain UI untuk halaman dashboard, Meeting dengan tim marketing..."
                                    value={journalContent}
                                    onChange={(e) => setJournalContent(e.target.value)}
                                />

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                        <InfoIcon className="w-3.5 h-3.5" />
                                        <span>Terhubung langsung ke Manager & Admin</span>
                                        {lastSaved && (
                                            <span className="text-emerald-600 font-medium ml-2 animate-pulse">
                                                • Disimpan {lastSaved.toLocaleTimeString()}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => handleSaveJournal(true)}
                                            disabled={!journalContent || isSavingJournal}
                                            className="text-slate-600 min-w-[100px]"
                                        >
                                            Simpan Draft
                                        </Button>
                                        <Button
                                            onClick={() => handleSaveJournal(false)}
                                            disabled={!journalContent || isSavingJournal}
                                            className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px] shadow-sm"
                                        >
                                            {isSavingJournal ? "Mengirim..." : "Kirim Laporan"}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Recent Activity Feed */}
                        <div>
                            <div className="flex items-center justify-between mb-4 px-1">
                                <h3 className="text-base font-bold text-slate-800">Aktivitas Terkini</h3>
                                <Link to="/karyawan/jurnal" className="text-sm font-medium text-blue-600 hover:underline">
                                    Lihat Semua
                                </Link>
                            </div>
                            <WorkInsightWidget userId={user?.id} />
                        </div>

                    </div>
                </div>
            </main>
        </div>
    );
};

function InfoIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
        </svg>
    )
}

export default KaryawanDashboardNew;
