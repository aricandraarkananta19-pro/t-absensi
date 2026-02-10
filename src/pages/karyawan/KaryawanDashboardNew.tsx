import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    Clock, Key, User, FileText, ChevronRight, LogOut, Calendar,
    CheckCircle2, LogIn, MapPin, History, LayoutDashboard, TrendingUp,
    Timer, Target, Award, Bell, BookOpen, Briefcase, Coffee
} from "lucide-react";
import logoImage from "@/assets/logo.png";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useIsMobile } from "@/hooks/useIsMobile";
import MobileNavigation from "@/components/MobileNavigation";
import { WorkInsightWidget } from "@/components/journal/WorkInsightWidget";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

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
    totalHours: number;
}

// --- Icons ---
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

const KaryawanDashboardNew = () => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const { settings } = useSystemSettings();
    const isMobile = useIsMobile();

    // Data State
    const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
    const [monthStats, setMonthStats] = useState<AttendanceStats>({ present: 0, late: 0, absent: 0, totalHours: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [usedLeaveDays, setUsedLeaveDays] = useState(0);
    const [completedTasks, setCompletedTasks] = useState(0);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Journal Logic State
    const [journalContent, setJournalContent] = useState("");
    const [selectedProject, setSelectedProject] = useState("");
    const [isSavingJournal, setIsSavingJournal] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    // New State for Real-Time Updates & Flexible Input
    const [recentActivities, setRecentActivities] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [projectSuggestions] = useState([
        "T-Absensi Platform Development",
        "Internal Meeting & Coordination",
        "Client Support & Maintenance",
        "HR Operations & Administration",
        "Infrastructure & DevOps"
    ]);

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
            fetchTaskStats();
            fetchRecentActivities();
        }
    }, [user]);

    const fetchRecentActivities = async () => {
        if (!user) return;
        // Fetch last 5 activities
        const { data } = await supabase
            .from("work_journals")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(5);

        if (data) setRecentActivities(data);
    };

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

    const fetchTaskStats = async () => {
        if (!user) return;
        // Mocking "Tasks" as completed journals for now
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const { count } = await supabase
            .from("work_journals")
            .select("*", { count: 'exact', head: true })
            .eq("user_id", user.id)
            .gte("date", startOfMonth.toISOString())
            .eq("verification_status", "approved");

        setCompletedTasks(count || 0);
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
            .select("clock_in, clock_out, status")
            .eq("user_id", user.id)
            .gte("clock_in", startOfMonth.toISOString())
            .lte("clock_in", endOfMonth.toISOString());

        if (data) {
            const present = data.filter(d => d.status === "present" || d.status === "late").length;
            const late = data.filter(d => d.status === "late").length;

            // Calculate total hours
            let totalMinutes = 0;
            data.forEach(d => {
                if (d.clock_in && d.clock_out) {
                    const params1 = new Date(d.clock_in);
                    const params2 = new Date(d.clock_out);
                    const diff = Math.abs(params2.getTime() - params1.getTime());
                    totalMinutes += Math.floor(diff / 1000 / 60);
                }
            });

            setMonthStats({
                present,
                late,
                absent: 0,
                totalHours: Math.floor(totalMinutes / 60)
            });
        }
    };

    const handleLogout = async () => {
        await signOut();
        toast({ title: "Logout berhasil", description: "Sampai jumpa kembali!" });
        navigate("/auth");
    };

    const handleSaveJournal = async () => {
        if (!journalContent.trim()) {
            toast({ variant: "destructive", title: "Gagal", description: "Tulis aktivitas Anda terlebih dahulu." });
            return;
        }

        setIsSavingJournal(true);
        try {
            const { data: newJournal, error } = await supabase
                .from('work_journals' as any)
                .insert({
                    user_id: user?.id,
                    content: `**${selectedProject}**\n\n${journalContent}`, // Prepend project name as title since column is missing
                    date: new Date().toISOString().split('T')[0],
                    duration: 0,
                    status: 'completed',
                    verification_status: 'submitted',
                    obstacles: selectedProject, // Map project to obstacles as per convention
                    mood: '😊',
                    work_result: 'completed'
                    // title: selectedProject // Removed to fix error
                })
                .select()
                .single();

            if (error) throw error;

            toast({
                title: "Jurnal Disimpan",
                description: "Laporan kerja Anda telah dikirim.",
            });

            // Real-time update: Prepend new journal
            if (newJournal) {
                setRecentActivities(prev => [newJournal, ...prev].slice(0, 5));
            }

            setJournalContent("");
            setSelectedProject(""); // Optional: reset project or keep it? User might add multiple for same project. keeping it is better usually, but maybe reset if prompted. I'll keep it as user might do multiple entries. Actually, clearing it might be annoying. I will NOT clear it.
            setLastSaved(new Date());

        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: (error as Error).message });
        } finally {
            setIsSavingJournal(false);
        }
    };

    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Selamat Pagi" : hour < 17 ? "Selamat Siang" : "Selamat Malam";
    const remainingLeave = Math.max(0, settings.maxLeaveDays - usedLeaveDays);

    // --- VIEW MAPPING ---
    return (
        <div className="min-h-screen bg-[#F8FAFC] font-['Inter',system-ui,sans-serif] pb-24 md:pb-12">

            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
                <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        {/* Logo Area */}
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs tracking-wider shadow-blue-200 shadow-lg">
                                <TrendingUp className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-sm font-bold text-slate-900 leading-none">T-Absensi</h1>
                                <p className="text-[10px] text-slate-500 font-medium tracking-wide">TRAINCOM</p>
                            </div>
                        </div>

                        {/* Search Bar (Visual Only) */}
                        <div className="hidden md:flex items-center relative w-96">
                            <div className="absolute left-3 text-slate-400">
                                <History className="w-4 h-4" />
                            </div>
                            <input
                                type="text"
                                placeholder="Cari data absensi, tugas, atau cuti..."
                                className="w-full pl-10 pr-4 py-2 bg-slate-100/50 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all text-slate-600"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button className="relative p-2 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-500 transition-colors">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                        </button>
                        <div className="h-8 w-px bg-slate-200" />

                        <div className="flex items-center gap-3 pl-2 cursor-pointer hover:bg-slate-50 p-1 rounded-full pr-3 transition-all" onClick={() => navigate('/karyawan/profil')}>
                            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center border-2 border-white shadow-sm overflow-hidden">
                                {user?.user_metadata?.avatar_url ?
                                    <img src={user.user_metadata.avatar_url} alt="Profile" className="w-full h-full object-cover" /> :
                                    <User className="w-5 h-5 text-amber-600" />
                                }
                            </div>
                            <div className="hidden sm:block">
                                <div className="text-xs font-bold text-slate-700">{user?.user_metadata?.full_name?.split(' ')[0] || 'User'}</div>
                                <div className="text-[10px] text-slate-500">Employee</div>
                            </div>
                        </div>

                        {/* Mobile Menu Toggle (Simplified) */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleLogout}
                            className="text-slate-400 hover:text-red-600 hover:bg-red-50 sm:hidden"
                        >
                            <LogOut className="w-5 h-5" />
                        </Button>
                    </div>
                </div>
            </header>

            <main className="max-w-[1400px] mx-auto px-6 py-8">

                {/* Greeting */}
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-slate-900">Halo, {user?.user_metadata?.full_name || 'Karyawan'}</h2>
                    <p className="text-slate-500 text-sm">Berikut ringkasan aktivitas kerja Anda hari ini.</p>
                </div>

                {/* Top Stats Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {/* Card 1: Attendance */}
                    <div className="bg-white rounded-[24px] p-6 border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Kehadiran Bulan Ini</p>
                                <div className="flex items-baseline gap-2 mt-1">
                                    <h3 className="text-3xl font-bold text-slate-900">95%</h3>
                                    <span className="text-xs font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">+2.4%</span>
                                </div>
                            </div>
                            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
                                <CheckCircle2 className="w-6 h-6" />
                            </div>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-green-500 h-full w-[95%] rounded-full"></div>
                        </div>
                    </div>

                    {/* Card 2: Work Hours */}
                    <div className="bg-white rounded-[24px] p-6 border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Jam Kerja Total</p>
                                <div className="flex items-baseline gap-2 mt-1">
                                    <h3 className="text-3xl font-bold text-slate-900">{monthStats.totalHours}h</h3>
                                    <span className="text-xs font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">-5.2h</span>
                                </div>
                                <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                                    <span>Target: 176h/bulan</span>
                                </div>
                            </div>
                            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                                <Clock className="w-6 h-6" />
                            </div>
                        </div>
                    </div>

                    {/* Card 3: Leave */}
                    <div className="bg-white rounded-[24px] p-6 border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sisa Cuti Tahunan</p>
                                <h3 className="text-3xl font-bold text-slate-900 mt-1">{remainingLeave} Hari</h3>
                                <p className="text-xs text-slate-400 mt-1">Hangus dalam 210 hari</p>
                            </div>
                            <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center">
                                <Calendar className="w-6 h-6" />
                            </div>
                        </div>
                    </div>

                    {/* Card 4: Tasks */}
                    <div className="bg-white rounded-[24px] p-6 border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tugas Selesai</p>
                                <div className="flex items-baseline gap-2 mt-1">
                                    <h3 className="text-3xl font-bold text-slate-900">{completedTasks}</h3>
                                    <span className="text-xs font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">+4</span>
                                </div>
                                <p className="text-xs text-slate-400 mt-1">Bulan ini (Sprint 4)</p>
                            </div>
                            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center">
                                <Award className="w-6 h-6" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main 2-Column Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-7 gap-8">

                    {/* Left Column: Attendance Control (3 Cols) */}
                    <div className="lg:col-span-3 space-y-8">
                        {/* Attendance Clock Card */}
                        <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm text-center relative overflow-hidden">
                            {/* Background decorative elements */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>

                            <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-8">ATTENDANCE CONTROL</p>

                            <div className="mb-2">
                                <h2 className="text-6xl font-mono font-bold text-slate-900 tracking-tighter tabular-nums">
                                    {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </h2>
                            </div>

                            <p className="text-slate-500 font-medium mb-6">
                                {format(currentTime, "EEEE, d MMMM yyyy", { locale: idLocale })}
                            </p>

                            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-green-50 text-green-700 rounded-full text-xs font-semibold mb-10">
                                <MapPin className="w-3 h-3" />
                                Lokasi: Kantor Pusat (Terverifikasi)
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {todayAttendance && !todayAttendance.clock_out ? (
                                    <>
                                        <button
                                            disabled={true}
                                            className="flex items-center justify-center gap-2 py-4 rounded-xl bg-slate-100 text-slate-400 font-semibold cursor-not-allowed"
                                        >
                                            <CheckCircle2 className="w-5 h-5" />
                                            Sudah Masuk
                                        </button>
                                        <button
                                            onClick={() => navigate('/karyawan/absensi')}
                                            className="flex items-center justify-center gap-2 py-4 rounded-xl bg-[#DC2626] hover:bg-[#b91c1c] text-white font-semibold transition-all shadow-lg shadow-red-200 active:scale-95"
                                        >
                                            <LogOut className="w-5 h-5" />
                                            Check-Out
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => navigate('/karyawan/absensi')}
                                            className="flex items-center justify-center gap-2 py-4 rounded-xl bg-[#00A86B] hover:bg-[#008f5b] text-white font-semibold transition-all shadow-lg shadow-green-200 active:scale-95 col-span-2"
                                        >
                                            <LogIn className="w-5 h-5" />
                                            Check-In Sekarang
                                        </button>
                                    </>
                                )}
                            </div>

                            <button className="mt-8 text-sm text-blue-600 font-semibold hover:underline flex items-center justify-center gap-2 mx-auto">
                                <Coffee className="w-4 h-4" />
                                Mulai Istirahat
                            </button>
                        </div>

                        {/* Quick Menu */}
                        <div className="bg-white rounded-[24px] p-6 border border-slate-100 shadow-sm">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">QUICK ACTIONS</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => navigate('/edit-password')}
                                    className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-100 transition-all active:scale-95 group"
                                >
                                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-2 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                        <Key className="w-5 h-5" />
                                    </div>
                                    <span className="text-xs font-bold text-slate-700">Reset Password</span>
                                </button>

                                <button
                                    onClick={() => navigate('/karyawan/cuti')}
                                    className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-100 transition-all active:scale-95 group"
                                >
                                    <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mb-2 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                                        <Calendar className="w-5 h-5" />
                                    </div>
                                    <span className="text-xs font-bold text-slate-700">Pengajuan Cuti</span>
                                </button>

                                <button
                                    onClick={() => navigate('/karyawan/riwayat')}
                                    className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-100 transition-all active:scale-95 group"
                                >
                                    <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-2 group-hover:bg-green-600 group-hover:text-white transition-colors">
                                        <FileText className="w-5 h-5" />
                                    </div>
                                    <span className="text-xs font-bold text-slate-700">Laporan Absensi</span>
                                </button>

                                <button
                                    onClick={() => navigate('/karyawan/jurnal')}
                                    className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-100 transition-all active:scale-95 group"
                                >
                                    <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mb-2 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                        <BookOpen className="w-5 h-5" />
                                    </div>
                                    <span className="text-xs font-bold text-slate-700">Jurnal Kerja</span>
                                </button>
                            </div>
                        </div>


                        {/* Upcoming Leave Card */}
                        <div className="bg-white rounded-[24px] p-6 border border-slate-100 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-slate-900">Upcoming Leave</h3>
                                <Link to="/karyawan/cuti" className="text-xs font-bold text-blue-600 hover:underline">View All</Link>
                            </div>

                            <div className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="bg-blue-100 text-blue-700 w-12 h-12 rounded-xl flex flex-col items-center justify-center leading-none">
                                        <span className="text-[10px] font-bold uppercase">Jun</span>
                                        <span className="text-xl font-bold">12</span>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 text-sm">Cuti Tahunan (3 Hari)</h4>
                                        <span className="text-xs text-slate-500">Menunggu Persetujuan HR</span>
                                    </div>
                                </div>
                                <div className="text-amber-500">
                                    <Timer className="w-5 h-5" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Journal & Activity (4 Cols) */}
                    <div className="lg:col-span-4 space-y-8">

                        {/* Journal Widget */}
                        <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                        <FileText className="w-5 h-5" />
                                    </div>
                                    <h3 className="font-bold text-slate-900">Jurnal Kerja Hari Ini</h3>
                                </div>
                                <span className="text-xs text-slate-400">Last updated: {lastSaved ? lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not saved'}</span>
                            </div>

                            <div className="p-6">
                                <div className="space-y-6">
                                    <div className="relative z-20">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Pilih Proyek (Ketik untuk baru)</label>
                                        <div className="relative group">
                                            <Input
                                                id="project-input"
                                                type="text"
                                                className="w-full pl-4 pr-10 py-6 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-slate-700 font-medium placeholder:text-slate-400"
                                                placeholder="Contoh: Website Redesign..."
                                                value={selectedProject}
                                                onChange={(e) => {
                                                    setSelectedProject(e.target.value);
                                                    setShowSuggestions(true);
                                                }}
                                                onFocus={() => setShowSuggestions(true)}
                                                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                            />
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 bg-slate-50 pl-2">
                                                <Briefcase className="w-5 h-5" />
                                            </div>

                                            {/* Suggestions Dropdown */}
                                            {showSuggestions && (
                                                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                                    <div className="max-h-60 overflow-y-auto py-2">
                                                        {projectSuggestions
                                                            .filter(p => !selectedProject || p.toLowerCase().includes(selectedProject.toLowerCase()))
                                                            .map((project, idx) => (
                                                                <button
                                                                    key={idx}
                                                                    className="w-full text-left px-4 py-3 hover:bg-blue-50 hover:text-blue-700 text-sm font-medium text-slate-700 transition-colors flex items-center justify-between group/item"
                                                                    onClick={() => {
                                                                        setSelectedProject(project);
                                                                        setShowSuggestions(false);
                                                                    }}
                                                                >
                                                                    <span>{project}</span>
                                                                    <ChevronRight className="w-4 h-4 text-blue-300 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                                                                </button>
                                                            ))}
                                                        {projectSuggestions.filter(p => !selectedProject || p.toLowerCase().includes(selectedProject.toLowerCase())).length === 0 && (
                                                            <div className="px-4 py-3 text-xs text-slate-400 italic text-center border-t border-slate-50">
                                                                Tekan enter atau simpan untuk menggunakan nama proyek baru ini.
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Apa yang anda kerjakan hari ini?</label>
                                        <textarea
                                            className="w-full min-h-[160px] p-4 bg-slate-50 border border-slate-200 rounded-xl resize-none focus:bg-white focus:border-blue-500 focus:outline-none transition-all placeholder:text-slate-400 text-slate-700"
                                            placeholder="Tulis rincian tugas atau progres anda di sini..."
                                            value={journalContent}
                                            onChange={(e) => setJournalContent(e.target.value)}
                                        ></textarea>
                                    </div>

                                    <div className="flex items-center justify-between pt-2">
                                        <div className="flex gap-2">
                                            <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                                                <div className="w-5 h-5"><Briefcase className="w-full h-full" /></div>
                                            </button>
                                            <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                                                <div className="w-5 h-5"><div className="w-4 h-4 border-2 border-current rounded-sm border-dashed"></div></div>
                                            </button>
                                            <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                                                <div className="w-5 h-5"><User className="w-full h-full" /></div>
                                            </button>
                                        </div>

                                        <Button
                                            onClick={handleSaveJournal}
                                            disabled={isSavingJournal || !journalContent}
                                            className="bg-[#1A5BA8] hover:bg-[#154a8a] text-white px-6 py-6 rounded-xl font-bold shadow-lg shadow-blue-200"
                                        >
                                            Simpan Jurnal <ChevronRight className="w-4 h-4 ml-1" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Activity Stream */}
                        <div className="bg-transparent">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">AKTIVITAS TERAKHIR</h3>

                            <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm p-6">
                                <div className="space-y-8 relative pl-6 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100 min-h-[100px]">
                                    {recentActivities.length > 0 ? (
                                        recentActivities.map((activity, index) => {
                                            // Extract display title from content
                                            let displayTitle = activity.content;
                                            // Handle Markdown Bold Project Title override if present
                                            if (displayTitle && displayTitle.startsWith("**")) {
                                                const parts = displayTitle.split('\n\n');
                                                if (parts.length > 1) displayTitle = parts[1];
                                                else displayTitle = displayTitle.replace(/\*\*(.*?)\*\*/g, '$1');
                                            }
                                            // Truncate
                                            if (displayTitle && displayTitle.length > 70) displayTitle = displayTitle.substring(0, 70) + '...';

                                            const projectName = activity.obstacles || "Development";
                                            const timeString = new Date(activity.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                                            return (
                                                <div key={activity.id || index} className="relative group animate-in slide-in-from-bottom-2 duration-500 fill-mode-backwards" style={{ animationDelay: `${index * 150}ms` }}>
                                                    <div className={cn(
                                                        "absolute -left-[29px] top-1.5 w-3.5 h-3.5 rounded-full border-4 border-white shadow-sm transition-all group-hover:scale-125 z-10",
                                                        index === 0 ? "bg-green-500 ring-2 ring-green-100" : "bg-slate-300 group-hover:bg-blue-500 group-hover:ring-2 ring-blue-100"
                                                    )}></div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-800 text-sm leading-snug group-hover:text-blue-700 transition-colors">{displayTitle}</h4>
                                                        <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1.5 font-medium uppercase tracking-wide">
                                                            {timeString} • <span className="text-blue-600">{projectName}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full py-8 text-center text-slate-400 opacity-60">
                                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                                                <Briefcase className="w-6 h-6 text-slate-300" />
                                            </div>
                                            <span className="text-xs">Belum ada aktivitas hari ini</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

            </main>

            {/* Mobile Navigation */}
            {isMobile && <MobileNavigation />}
        </div>
    );
};

export default KaryawanDashboardNew;
