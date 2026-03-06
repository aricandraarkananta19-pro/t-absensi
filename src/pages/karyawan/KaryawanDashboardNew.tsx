import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import {
    Clock, FileText, LogOut, Calendar,
    CheckCircle2, LogIn, MapPin, TrendingUp,
    Target, Sparkles, ArrowUpRight, Send,
    CalendarDays, FileCheck
} from "lucide-react";
import {
    AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { cn } from "@/lib/utils";
import { format, subDays } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import KaryawanWorkspaceLayout from "@/components/layout/KaryawanWorkspaceLayout";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useTheme } from "@/contexts/ThemeContext";
import MobileDashboardView from "@/components/MobileDashboardView";
import { useQueryClient } from "@tanstack/react-query";

interface AttendanceRecord {
    id: string;
    clock_in: string;
    clock_out: string | null;
    clock_in_location: string | null;
    clock_out_location: string | null;
    status: string;
    date: string;
}

interface AttendanceStats {
    present: number;
    late: number;
    absent: number;
    leave: number;
    totalHours: number;
}

interface ProductivityDay {
    name: string;
    jam: number;
    jurnal: number;
}

const KaryawanDashboardNew = () => {
    const { user } = useAuth();
    const { settings } = useSystemSettings();
    const isMobile = useIsMobile();
    const queryClient = useQueryClient();

    const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
    const [monthStats, setMonthStats] = useState<AttendanceStats>({ present: 0, late: 0, absent: 0, leave: 0, totalHours: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [usedLeaveDays, setUsedLeaveDays] = useState(0);
    const [completedTasks, setCompletedTasks] = useState(0);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [productivityData, setProductivityData] = useState<ProductivityDay[]>([]);

    // Clock action states
    const [location, setLocation] = useState<string>("Mengecek lokasi...");
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [confirmAction, setConfirmAction] = useState<"in" | "out">("in");

    // Journal states
    const [journalTitle, setJournalTitle] = useState("");
    const [journalContent, setJournalContent] = useState("");
    const [journalCategory, setJournalCategory] = useState("");
    const [journalDuration, setJournalDuration] = useState("");
    const [isSavingJournal, setIsSavingJournal] = useState(false);
    const [recentActivities, setRecentActivities] = useState<any[]>([]);

    // Notification count
    const [notifCount, setNotifCount] = useState(0);

    // Dark mode
    const { isDark } = useTheme();

    // Elapsed time
    const [elapsedTime, setElapsedTime] = useState("00:00:00");

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Elapsed time calculation
    useEffect(() => {
        if (!todayAttendance?.clock_in) return;
        const update = () => {
            const start = new Date(todayAttendance.clock_in).getTime();
            const end = todayAttendance.clock_out ? new Date(todayAttendance.clock_out).getTime() : Date.now();
            const diff = Math.max(0, end - start);
            const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
            const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
            const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
            setElapsedTime(`${h}:${m}:${s}`);
        };
        update();
        if (!todayAttendance.clock_out) {
            const interval = setInterval(update, 1000);
            return () => clearInterval(interval);
        }
    }, [todayAttendance]);

    useEffect(() => {
        if (user) {
            fetchTodayAttendance();
            fetchMonthStats();
            fetchUsedLeaveDays();
            fetchTaskStats();
            fetchRecentActivities();
            fetchProductivityData();
            fetchNotifCount();
        }
    }, [user]);

    // Location tracking
    useEffect(() => {
        if (settings.enableLocationTracking && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
                        const data = await res.json();
                        if (data?.address) {
                            const addr = data.address;
                            const localArea = addr.residential || addr.suburb || addr.village || addr.neighbourhood || addr.road || "";
                            const city = addr.city || addr.town || addr.county || "";
                            setLocation([localArea, city].filter(Boolean).join(", ") || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
                        } else {
                            setLocation(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
                        }
                    } catch {
                        setLocation(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
                    }
                },
                () => setLocation("Lokasi tidak tersedia")
            );
        } else {
            setLocation("Tracking lokasi dinonaktifkan");
        }
    }, [settings.enableLocationTracking]);

    const fetchNotifCount = useCallback(async () => {
        if (!user) return;
        const { count: myLeave } = await supabase.from("leave_requests").select("*", { count: "exact", head: true })
            .eq("user_id", user.id).eq("status", "approved")
            .gt("created_at", new Date(Date.now() - 7 * 86400000).toISOString());
        setNotifCount(myLeave || 0);
    }, [user]);

    // Fetch REAL productivity data (last 7 days attendance hours + journal count)
    const fetchProductivityData = async () => {
        if (!user) return;
        const days: ProductivityDay[] = [];
        for (let i = 6; i >= 0; i--) {
            const day = subDays(new Date(), i);
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayName = format(day, 'EEE', { locale: idLocale });

            const { data: att } = await supabase.from("attendance")
                .select("clock_in, clock_out")
                .eq("user_id", user.id)
                .eq("date", dateStr)
                .maybeSingle();

            let hours = 0;
            if (att?.clock_in && att?.clock_out) {
                hours = Math.round((new Date(att.clock_out).getTime() - new Date(att.clock_in).getTime()) / 3600000 * 10) / 10;
            }

            const { count: jCount } = await supabase.from("work_journals")
                .select("*", { count: "exact", head: true })
                .eq("user_id", user.id)
                .eq("date", dateStr);

            days.push({ name: dayName, jam: Math.max(0, hours), jurnal: jCount || 0 });
        }
        setProductivityData(days);
    };

    const fetchRecentActivities = async () => {
        if (!user) return;
        const { data } = await supabase.from("work_journals").select("*")
            .eq("user_id", user.id).is("deleted_at", null)
            .order("date", { ascending: false }).limit(5);
        if (data) setRecentActivities(data);
    };

    const fetchUsedLeaveDays = async () => {
        if (!user) return;
        const year = new Date().getFullYear();
        const { data } = await supabase.from("leave_requests")
            .select("start_date, end_date")
            .eq("user_id", user.id).eq("status", "approved")
            .gte("start_date", `${year}-01-01`).lte("end_date", `${year}-12-31`);

        if (data) {
            const totalDays = data.reduce((acc, leave) => {
                const s = new Date(leave.start_date);
                const e = new Date(leave.end_date);
                return acc + Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            }, 0);
            setUsedLeaveDays(totalDays);
        }
    };

    const fetchTaskStats = async () => {
        if (!user) return;
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const { count } = await supabase.from("work_journals")
            .select("*", { count: 'exact', head: true })
            .eq("user_id", user.id).gte("date", format(startOfMonth, 'yyyy-MM-dd'));
        setCompletedTasks(count || 0);
    };

    const fetchTodayAttendance = async () => {
        if (!user) return;
        const now = new Date();
        const todayStr = format(now, 'yyyy-MM-dd');
        const { data } = await supabase.from("attendance").select("*")
            .eq("user_id", user.id).eq("date", todayStr).maybeSingle();
        if (data) setTodayAttendance(data);
        setIsLoading(false);
    };

    const fetchMonthStats = async () => {
        if (!user) return;
        const now = new Date();
        const startStr = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd');
        const endStr = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd');

        const { data } = await supabase.from("attendance")
            .select("clock_in, clock_out, status")
            .eq("user_id", user.id).gte("date", startStr).lte("date", endStr);

        const targetData = data || [];
        const present = targetData.filter(d => ['present', 'late', 'early_leave'].includes(d.status)).length;
        const late = targetData.filter(d => d.status === "late").length;
        const absent = targetData.filter(d => ['absent', 'alpha'].includes(d.status)).length;
        const leave = targetData.filter(d => ['leave', 'sick', 'permission'].includes(d.status)).length;

        let totalMinutes = 0;
        targetData.forEach(d => {
            if (d.clock_in && d.clock_out) {
                totalMinutes += Math.floor(Math.abs(new Date(d.clock_out).getTime() - new Date(d.clock_in).getTime()) / 60000);
            }
        });
        setMonthStats({ present, late, absent, leave, totalHours: Math.floor(totalMinutes / 60) });
    };

    // Clock In/Out Actions (synced from mobile)
    const handleClockAction = () => {
        if (!todayAttendance) {
            setConfirmAction("in");
            setShowConfirmDialog(true);
        } else if (!todayAttendance.clock_out) {
            setConfirmAction("out");
            setShowConfirmDialog(true);
        }
    };

    const executeClockAction = async () => {
        setShowConfirmDialog(false);
        setIsActionLoading(true);
        try {
            if (confirmAction === "in") {
                const { data, error } = await supabase.functions.invoke("clock-in", { body: { location } });
                if (!error && data?.success) {
                    if (navigator.vibrate) navigator.vibrate(100);
                    toast({ title: "✅ Berhasil Masuk", description: "Selamat bekerja! Semangat hari ini." });
                    fetchTodayAttendance();
                } else {
                    const now = new Date();
                    const todayStr = format(now, 'yyyy-MM-dd');
                    const { error: dbError } = await supabase.from("attendance").insert({
                        user_id: user?.id, date: todayStr,
                        clock_in: now.toISOString(), clock_in_location: location, status: "present",
                    });
                    if (dbError) throw dbError;
                    toast({ title: "✅ Berhasil Masuk", description: "Selamat bekerja! Semangat hari ini." });
                    fetchTodayAttendance();
                }
            } else {
                const { data, error } = await supabase.functions.invoke("clock-out", { body: { location } });
                if (!error && data?.success) {
                    toast({ title: "🏠 Berhasil Keluar", description: "Terima kasih atas kerja kerasnya!" });
                    fetchTodayAttendance();
                } else {
                    const now = new Date();
                    const { error: dbError } = await supabase.from("attendance")
                        .update({ clock_out: now.toISOString(), clock_out_location: location })
                        .eq("id", todayAttendance!.id);
                    if (dbError) throw dbError;
                    toast({ title: "🏠 Berhasil Keluar", description: "Terima kasih atas kerja kerasnya!" });
                    fetchTodayAttendance();
                }
            }
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "Terjadi kesalahan." });
        } finally {
            setIsActionLoading(false);
        }
    };

    // Journal submission (synced from mobile quick journal)
    const handleSaveJournal = async () => {
        if (!journalTitle.trim() || !journalContent.trim() || !journalCategory || !journalDuration) {
            toast({ variant: "destructive", title: "Lengkapi Semua Field", description: "Judul, kategori, durasi, dan deskripsi wajib diisi." });
            return;
        }
        setIsSavingJournal(true);
        try {
            const durationMinutes = Math.round(parseFloat(journalDuration) * 60);
            const finalContent = `**${journalTitle}**\n\n${journalContent}`;
            const { error } = await supabase.from('work_journals').insert({
                user_id: user?.id, content: finalContent,
                duration: durationMinutes, obstacles: journalCategory,
                date: format(new Date(), 'yyyy-MM-dd'),
                verification_status: 'submitted', work_result: 'completed', mood: '😊'
            });
            if (error) throw error;
            toast({ title: "📝 Jurnal Tersimpan", description: "Log pekerjaan berhasil dicatat." });
            setJournalTitle(""); setJournalContent(""); setJournalCategory(""); setJournalDuration("");
            fetchRecentActivities();
            fetchTaskStats();
            await queryClient.invalidateQueries({ queryKey: ['journals', 'employee', user?.id] });
        } catch (err: any) {
            toast({ variant: "destructive", title: "Error", description: err.message || "Gagal menyimpan jurnal." });
        } finally {
            setIsSavingJournal(false);
        }
    };

    const hour = currentTime.getHours();
    const greeting = hour < 11 ? "Selamat Pagi" : hour < 15 ? "Selamat Siang" : hour < 18 ? "Selamat Sore" : "Selamat Malam";
    const remainingLeave = Math.max(0, settings.maxLeaveDays - usedLeaveDays);
    const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'Karyawan';

    const totalRecordedDays = monthStats.present + monthStats.absent;
    const attRate = totalRecordedDays > 0 ? Math.round((monthStats.present / totalRecordedDays) * 100) : 100;

    const isWorking = Boolean(todayAttendance && !todayAttendance.clock_out);
    const isFinished = Boolean(todayAttendance && todayAttendance.clock_out);

    // Late minutes calculation
    const lateMinutes = useMemo(() => {
        if (!todayAttendance?.clock_in || !settings.clockInEnd) return 0;
        const [tH, tM] = settings.clockInEnd.split(':').map(Number);
        const target = new Date(); target.setHours(tH, tM, 0, 0);
        const actual = new Date(todayAttendance.clock_in);
        const diff = actual.getTime() - target.getTime();
        return diff > 0 ? Math.floor(diff / 60000) : 0;
    }, [todayAttendance, settings.clockInEnd]);

    if (isMobile) {
        return <MobileDashboardView role="karyawan" />;
    }

    const cardBase = cn(
        "rounded-[28px] border shadow-[0_4px_24px_-4px_rgba(0,0,0,0.05)] transition-all duration-300 relative overflow-hidden",
        isDark ? "bg-slate-800/80 backdrop-blur-2xl border-slate-700/50" : "bg-white/70 backdrop-blur-2xl border-white/80"
    );
    const textPrimary = isDark ? "text-white" : "text-slate-900";
    const textSecondary = isDark ? "text-slate-400" : "text-slate-500";
    const textMuted = isDark ? "text-slate-500" : "text-slate-400";

    return (
        <KaryawanWorkspaceLayout notifCount={notifCount}>

            {/* Sapaan & Insight */}
            <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                <div>
                    <h1 className={cn("text-2xl md:text-3xl font-extrabold tracking-tight", textPrimary)}>
                        {greeting}, {firstName}! 👋
                    </h1>
                    <p className={cn("text-sm mt-1.5 font-medium", textSecondary)}>
                        {format(currentTime, 'EEEE, d MMMM yyyy', { locale: idLocale })} — Ringkasan produktivitas Anda hari ini.
                    </p>
                </div>

                {/* Insight Box */}
                <div className={cn("flex items-start gap-3 p-4 rounded-2xl w-full md:max-w-md shadow-sm",
                    isDark ? "bg-indigo-900/30 border border-indigo-800/40" : "bg-blue-50/50 border border-blue-100/50")}>
                    <div className={cn("mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                        isDark ? "bg-indigo-800 text-indigo-300" : "bg-blue-100 text-blue-600")}>
                        <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                        <h4 className={cn("text-xs font-bold uppercase tracking-wider mb-1", isDark ? "text-slate-300" : "text-slate-700")}>Insight Performa</h4>
                        <p className={cn("text-sm leading-snug", isDark ? "text-slate-400" : "text-slate-600")}>
                            Anda telah mencatat <strong>{monthStats.totalHours} jam kerja</strong> dan <strong>{completedTasks} jurnal</strong> bulan ini.
                            {monthStats.late > 0 ? ` Perhatikan ${monthStats.late}x keterlambatan.` : " Pertahankan kedisiplinan!"}
                        </p>
                    </div>
                </div>
            </div>

            {/* 4 Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                {/* Card: Jam Kerja */}
                <div className={cn(cardBase, "p-5 flex flex-col gap-3 group hover:border-blue-200 transition-colors")}>
                    <div className="flex items-center justify-between">
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center border",
                            isDark ? "bg-slate-700 border-slate-600" : "bg-slate-50 border-slate-100")}>
                            <Clock className={cn("w-4 h-4", isDark ? "text-slate-300" : "text-slate-600")} />
                        </div>
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">Sehat</span>
                    </div>
                    <div className="mt-2">
                        <h3 className={cn("text-[11px] font-bold uppercase tracking-widest mb-1", textMuted)}>Jam Tercatat</h3>
                        <div className={cn("text-2xl font-extrabold tracking-tight", textPrimary)}>{monthStats.totalHours}<span className={cn("text-sm font-medium ml-1", textMuted)}>jam</span></div>
                    </div>
                </div>

                {/* Card: Jurnal Selesai */}
                <div className={cn(cardBase, "p-5 flex flex-col gap-3 group hover:border-purple-200 transition-colors")}>
                    <div className="flex items-center justify-between">
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center border",
                            isDark ? "bg-slate-700 border-slate-600" : "bg-slate-50 border-slate-100")}>
                            <CheckCircle2 className={cn("w-4 h-4", isDark ? "text-slate-300" : "text-slate-600")} />
                        </div>
                        <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">Baik</span>
                    </div>
                    <div className="mt-2">
                        <h3 className={cn("text-[11px] font-bold uppercase tracking-widest mb-1", textMuted)}>Jurnal Selesai</h3>
                        <div className={cn("text-2xl font-extrabold tracking-tight", textPrimary)}>{completedTasks}</div>
                    </div>
                </div>

                {/* Card: Sisa Cuti */}
                <div className={cn(cardBase, "p-5 flex flex-col gap-3 group hover:border-amber-200 transition-colors")}>
                    <div className="flex items-center justify-between">
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center border",
                            isDark ? "bg-slate-700 border-slate-600" : "bg-slate-50 border-slate-100")}>
                            <Calendar className={cn("w-4 h-4", isDark ? "text-slate-300" : "text-slate-600")} />
                        </div>
                    </div>
                    <div className="mt-2">
                        <h3 className={cn("text-[11px] font-bold uppercase tracking-widest mb-1", textMuted)}>Sisa Cuti</h3>
                        <div className={cn("text-2xl font-extrabold tracking-tight", textPrimary)}>{remainingLeave}<span className={cn("text-sm font-medium ml-1", textMuted)}>hari</span></div>
                        <div className={cn("text-xs font-semibold mt-1", textMuted)}>Terpakai: {usedLeaveDays}</div>
                    </div>
                </div>

                {/* Card: Tingkat Kehadiran */}
                <div className={cn(cardBase, "p-5 flex flex-col gap-3 group hover:border-emerald-200 transition-colors")}>
                    <div className="flex items-center justify-between">
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center border",
                            isDark ? "bg-slate-700 border-slate-600" : "bg-slate-50 border-slate-100")}>
                            <Target className={cn("w-4 h-4", isDark ? "text-slate-300" : "text-slate-600")} />
                        </div>
                        <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-md",
                            attRate >= 90 ? "text-emerald-600 bg-emerald-50" : "text-amber-600 bg-amber-50"
                        )}>{attRate >= 90 ? 'Sangat Baik' : 'Perlu Perhatian'}</span>
                    </div>
                    <div className="mt-2">
                        <h3 className={cn("text-[11px] font-bold uppercase tracking-widest mb-1", textMuted)}>Tingkat Kehadiran</h3>
                        <div className={cn("text-2xl font-extrabold tracking-tight", textPrimary)}>{attRate}<span className={cn("text-sm font-medium", textMuted)}>%</span></div>
                        <div className={cn("text-xs font-semibold mt-1", textMuted)}>Terlambat: {monthStats.late}x</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Panel: Clock + Ring + Chart */}
                <div className="lg:col-span-1 space-y-6">

                    {/* Attendance Control — Inline Clock In/Out */}
                    <div className={cn(cardBase, "p-6 relative overflow-hidden bg-slate-900 text-white border-slate-800")}>
                        <div className="absolute -right-20 -top-20 w-48 h-48 bg-blue-500/30 rounded-full blur-[60px]" />
                        <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-purple-500/20 rounded-full blur-[40px]" />

                        <div className="relative z-10 flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2 text-slate-300">
                                <Clock className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase tracking-wider">Waktu Langsung</span>
                            </div>
                            <span className="text-[10px] font-medium px-2 py-1 rounded bg-white/10 text-slate-300">
                                {format(currentTime, 'dd MMM', { locale: idLocale })}
                            </span>
                        </div>

                        <div className="relative z-10 text-center mb-6">
                            <h2 className="text-5xl font-extrabold tracking-tighter tabular-nums text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400">
                                {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </h2>
                            <p className="text-xs text-slate-400 font-medium mt-2 max-w-[220px] mx-auto truncate" title={location}>
                                <MapPin className="w-3 h-3 inline mr-1 text-blue-400" /> {location}
                            </p>
                        </div>

                        <div className="relative z-10">
                            {todayAttendance && !todayAttendance.clock_out ? (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                                            <span className="block text-[10px] uppercase text-emerald-400 font-bold mb-1">Masuk</span>
                                            <span className="text-sm font-semibold">{todayAttendance.clock_in.substring(11, 16)}</span>
                                        </div>
                                        <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                                            <span className="block text-[10px] uppercase text-slate-400 font-bold mb-1">Durasi</span>
                                            <span className="text-sm font-semibold tabular-nums font-mono text-indigo-300">{elapsedTime.substring(0, 5)}</span>
                                        </div>
                                        <button onClick={handleClockAction} disabled={isActionLoading}
                                            className="bg-red-500 hover:bg-red-400 text-white rounded-xl font-bold text-xs shadow-lg transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-1">
                                            {isActionLoading ? <div className="w-4 h-4 animate-spin border-2 border-white/30 border-t-white rounded-full" /> : <><LogOut className="w-3.5 h-3.5" /> Keluar</>}
                                        </button>
                                    </div>
                                    {todayAttendance.status === 'late' && lateMinutes > 0 && (
                                        <div className="text-center">
                                            <span className="text-[10px] font-bold bg-red-500/20 text-red-300 px-2.5 py-1 rounded-full border border-red-500/20">
                                                TERLAMBAT {lateMinutes} menit
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ) : todayAttendance && todayAttendance.clock_out ? (
                                <div className="bg-white/10 border border-white/10 rounded-xl p-4 text-center space-y-2">
                                    <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                                    <p className="text-sm font-medium">Sesi selesai. Kerja bagus hari ini!</p>
                                    <div className="flex justify-center gap-3 text-[11px] text-slate-400">
                                        <span>Masuk: {todayAttendance.clock_in.substring(11, 16)}</span>
                                        <span>•</span>
                                        <span>Keluar: {todayAttendance.clock_out.substring(11, 16)}</span>
                                        <span>•</span>
                                        <span className="text-indigo-300 font-bold">{elapsedTime.substring(0, 5)}</span>
                                    </div>
                                </div>
                            ) : (
                                <button onClick={handleClockAction} disabled={isActionLoading}
                                    className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-4 font-bold shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all hover:shadow-[0_0_25px_rgba(37,99,235,0.5)] flex justify-center items-center gap-2">
                                    {isActionLoading ? <div className="w-5 h-5 animate-spin border-2 border-white/30 border-t-white rounded-full" /> : <><LogIn className="w-5 h-5" /> Masuk Sekarang</>}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Attendance Ring */}
                    <div className={cn(cardBase, "p-5")}>
                        <h3 className={cn("text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2", textMuted)}>
                            <span className={cn("w-5 h-px", isDark ? "bg-slate-600" : "bg-slate-300")} />
                            Statistik Bulan Ini
                        </h3>
                        <div className="flex items-center gap-4">
                            <div className="relative w-[72px] h-[72px] shrink-0">
                                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                    <circle cx="18" cy="18" r="15.5" fill="none" stroke={isDark ? "#334155" : "#E2E8F0"} strokeWidth="3" />
                                    <circle cx="18" cy="18" r="15.5" fill="none"
                                        stroke={attRate >= 80 ? "#4F46E5" : attRate >= 60 ? "#F59E0B" : "#EF4444"}
                                        strokeWidth="3" strokeLinecap="round"
                                        strokeDasharray={`${attRate * 0.9738} ${97.38 - attRate * 0.9738}`}
                                        className="transition-all duration-1000 ease-out" />
                                </svg>
                                <span className={cn("absolute inset-0 flex items-center justify-center text-sm font-extrabold", textPrimary)}>{attRate}%</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 flex-1">
                                <div className={cn("p-2.5 rounded-xl text-center", isDark ? "bg-slate-700" : "bg-slate-50")}>
                                    <span className={cn("text-lg font-extrabold", textPrimary)}>{monthStats.present}</span>
                                    <span className={cn("block text-[9px] font-bold uppercase tracking-wider", textMuted)}>Hadir</span>
                                </div>
                                <div className={cn("p-2.5 rounded-xl text-center", isDark ? "bg-slate-700" : "bg-slate-50")}>
                                    <span className="text-lg font-extrabold text-red-500">{monthStats.late}</span>
                                    <span className={cn("block text-[9px] font-bold uppercase tracking-wider", textMuted)}>Telat</span>
                                </div>
                                <div className={cn("p-2.5 rounded-xl text-center", isDark ? "bg-slate-700" : "bg-slate-50")}>
                                    <span className="text-lg font-extrabold text-emerald-600">{remainingLeave}</span>
                                    <span className={cn("block text-[9px] font-bold uppercase tracking-wider", textMuted)}>Cuti</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Productivity Chart (REAL DATA) */}
                    <div className={cn(cardBase, "p-6")}>
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h3 className={cn("font-bold text-sm", textPrimary)}>Grafik Produktivitas</h3>
                                <p className={cn("text-[11px] font-medium", textSecondary)}>Jam kerja 7 hari terakhir</p>
                            </div>
                            <div className={cn("p-1.5 rounded-md border", isDark ? "bg-slate-700 border-slate-600" : "bg-slate-50 border-slate-100")}>
                                <TrendingUp className={cn("w-4 h-4", textMuted)} />
                            </div>
                        </div>
                        <div className="h-[180px] w-full -ml-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={productivityData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorJam" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDark ? '#64748b' : '#94a3b8' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDark ? '#64748b' : '#94a3b8' }} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: isDark ? '1px solid #334155' : '1px solid #e2e8f0', background: isDark ? '#1e293b' : '#fff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        formatter={(value: any, name: string) => [value, name === 'jam' ? 'Jam Kerja' : 'Jurnal']}
                                    />
                                    <Area type="monotone" dataKey="jam" stroke="#4F46E5" strokeWidth={2} fillOpacity={1} fill="url(#colorJam)" name="jam" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="grid grid-cols-3 gap-3">
                        <Link to="/karyawan/riwayat" className={cn(cardBase, "p-3 flex flex-col items-center gap-1.5 active:scale-95 transition-transform text-center")}>
                            <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center"><CalendarDays className="w-4 h-4 text-blue-600" /></div>
                            <span className={cn("text-[10px] font-bold", isDark ? "text-slate-300" : "text-slate-600")}>Riwayat</span>
                        </Link>
                        <Link to="/karyawan/cuti" className={cn(cardBase, "p-3 flex flex-col items-center gap-1.5 active:scale-95 transition-transform text-center")}>
                            <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center"><FileCheck className="w-4 h-4 text-emerald-600" /></div>
                            <span className={cn("text-[10px] font-bold", isDark ? "text-slate-300" : "text-slate-600")}>Cuti</span>
                        </Link>
                        <Link to="/karyawan/jurnal" className={cn(cardBase, "p-3 flex flex-col items-center gap-1.5 active:scale-95 transition-transform text-center")}>
                            <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center"><TrendingUp className="w-4 h-4 text-violet-600" /></div>
                            <span className={cn("text-[10px] font-bold", isDark ? "text-slate-300" : "text-slate-600")}>Jurnal</span>
                        </Link>
                    </div>
                </div>

                {/* Right: Journal + Timeline */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Journal Editor (with category + duration — synced from mobile) */}
                    <div className={cn(cardBase, "p-6")}>
                        <div className="flex items-center justify-between mb-5">
                            <div className={cn("flex items-center gap-2", textPrimary)}>
                                <FileText className="w-5 h-5" />
                                <h3 className="font-bold">Catat Aktivitas Hari Ini</h3>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <Input
                                className={cn("w-full text-sm font-semibold h-11 shadow-none rounded-xl",
                                    isDark ? "bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 focus:bg-slate-600" : "bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-slate-200/50")}
                                placeholder="Judul aktivitas..."
                                value={journalTitle}
                                onChange={(e) => setJournalTitle(e.target.value)}
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <Select value={journalCategory} onValueChange={setJournalCategory}>
                                    <SelectTrigger className={cn("h-11 rounded-xl text-sm",
                                        isDark ? "bg-slate-700 border-slate-600 text-white" : "border-slate-200")}>
                                        <SelectValue placeholder="Kategori" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="development">🛠️ Development</SelectItem>
                                        <SelectItem value="meeting">📋 Meeting</SelectItem>
                                        <SelectItem value="design">🎨 Design</SelectItem>
                                        <SelectItem value="research">🔬 Research</SelectItem>
                                        <SelectItem value="support">🤝 Support</SelectItem>
                                        <SelectItem value="learning">📚 Learning</SelectItem>
                                        <SelectItem value="administration">📄 Administrasi</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Input
                                    type="number" step="0.5" min="0" max="24"
                                    placeholder="Durasi (jam)"
                                    value={journalDuration}
                                    onChange={(e) => setJournalDuration(e.target.value)}
                                    className={cn("h-11 rounded-xl text-sm",
                                        isDark ? "bg-slate-700 border-slate-600 text-white placeholder:text-slate-500" : "border-slate-200")}
                                />
                            </div>
                            <Textarea
                                className={cn("w-full min-h-[100px] rounded-xl resize-none text-sm font-medium",
                                    isDark ? "bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 focus:bg-slate-600" : "bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-slate-200/50")}
                                placeholder="Deskripsikan pekerjaan Anda hari ini... Sebutkan tantangan dan progres."
                                value={journalContent}
                                onChange={(e) => setJournalContent(e.target.value)}
                            />
                            <div className="flex items-center justify-end pt-1">
                                <Button
                                    onClick={handleSaveJournal}
                                    disabled={isSavingJournal || !journalTitle || !journalContent || !journalCategory || !journalDuration}
                                    className="rounded-xl font-bold px-6 bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm gap-2"
                                >
                                    {isSavingJournal ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send className="w-4 h-4" /> Kirim Jurnal</>}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Recent Timeline — Premium Redesign */}
                    <div className={cn(cardBase, "p-6")}>
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2.5">
                                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center border",
                                    isDark ? "bg-slate-700 border-slate-600" : "bg-indigo-50 border-indigo-100")}>
                                    <Clock className={cn("w-4 h-4", isDark ? "text-slate-300" : "text-indigo-600")} />
                                </div>
                                <div>
                                    <h3 className={cn("font-bold text-sm", textPrimary)}>Aktivitas Terbaru</h3>
                                    <p className={cn("text-[10px] font-medium", textMuted)}>Log jurnal kerja terakhir</p>
                                </div>
                            </div>
                            <Link to="/karyawan/jurnal"
                                className={cn("text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1",
                                    isDark ? "text-indigo-400 bg-indigo-900/30 hover:bg-indigo-900/50 border border-indigo-800/40"
                                        : "text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100")}>
                                Lihat Semua <ArrowUpRight className="w-3 h-3" />
                            </Link>
                        </div>

                        <div className="space-y-3">
                            {recentActivities.length > 0 ? (
                                recentActivities.map((activity, idx) => {
                                    // Parse title from markdown-style content
                                    let displayTitle = '';
                                    let displayBody = activity.content || '';
                                    if (displayBody.startsWith("**")) {
                                        const match = displayBody.match(/\*\*(.*?)\*\*/);
                                        displayTitle = match ? match[1] : '';
                                        displayBody = displayBody.replace(/\*\*(.*?)\*\*\n?\n?/, '').trim();
                                    }

                                    const categoryLabel = activity.obstacles || 'Umum';
                                    const categoryMap: Record<string, { emoji: string; color: string; bg: string; darkBg: string }> = {
                                        'development': { emoji: '🛠️', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-100', darkBg: 'bg-blue-900/20 border-blue-800/40' },
                                        'meeting': { emoji: '📋', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-100', darkBg: 'bg-amber-900/20 border-amber-800/40' },
                                        'design': { emoji: '🎨', color: 'text-pink-700', bg: 'bg-pink-50 border-pink-100', darkBg: 'bg-pink-900/20 border-pink-800/40' },
                                        'research': { emoji: '🔬', color: 'text-cyan-700', bg: 'bg-cyan-50 border-cyan-100', darkBg: 'bg-cyan-900/20 border-cyan-800/40' },
                                        'support': { emoji: '🤝', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100', darkBg: 'bg-emerald-900/20 border-emerald-800/40' },
                                        'learning': { emoji: '📚', color: 'text-violet-700', bg: 'bg-violet-50 border-violet-100', darkBg: 'bg-violet-900/20 border-violet-800/40' },
                                        'administration': { emoji: '📄', color: 'text-slate-700', bg: 'bg-slate-100 border-slate-200', darkBg: 'bg-slate-700/30 border-slate-600/40' },
                                    };
                                    const catStyle = categoryMap[categoryLabel.toLowerCase()] || { emoji: '📝', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-100', darkBg: 'bg-indigo-900/20 border-indigo-800/40' };
                                    const durationHours = activity.duration ? (activity.duration / 60).toFixed(1) : null;

                                    return (
                                        <div key={idx}
                                            className={cn(
                                                "group relative rounded-2xl border p-4 transition-all duration-200 hover:shadow-md",
                                                isDark
                                                    ? "bg-slate-800/50 border-slate-700/60 hover:border-slate-600 hover:bg-slate-700/60"
                                                    : "bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50/50"
                                            )}>
                                            <div className="flex items-start gap-3.5">
                                                {/* Category Icon */}
                                                <div className={cn("w-10 h-10 rounded-xl border flex items-center justify-center text-base shrink-0 transition-transform duration-200 group-hover:scale-110",
                                                    isDark ? catStyle.darkBg : catStyle.bg)}>
                                                    {catStyle.emoji}
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2 mb-1">
                                                        <h4 className={cn("text-[13px] font-bold leading-snug truncate", textPrimary)}>
                                                            {displayTitle || categoryLabel}
                                                        </h4>
                                                        <span className={cn("text-[10px] font-semibold whitespace-nowrap shrink-0 mt-0.5", textMuted)}>
                                                            {activity.created_at ? new Date(activity.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                        </span>
                                                    </div>

                                                    <p className={cn("text-xs line-clamp-2 leading-relaxed mb-2.5", textSecondary)}>
                                                        {displayBody || 'Tidak ada deskripsi.'}
                                                    </p>

                                                    {/* Meta Row */}
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider",
                                                            isDark ? catStyle.darkBg + ' ' + catStyle.color.replace('700', '400') : catStyle.bg + ' ' + catStyle.color)}>
                                                            {categoryLabel}
                                                        </span>
                                                        {durationHours && (
                                                            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md border",
                                                                isDark ? "bg-slate-700 border-slate-600 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-500")}>
                                                                ⏱ {durationHours} jam
                                                            </span>
                                                        )}
                                                        {activity.date && (
                                                            <span className={cn("text-[10px] font-medium", textMuted)}>
                                                                {(() => {
                                                                    try { return format(new Date(activity.date + 'T00:00:00'), 'd MMM yyyy', { locale: idLocale }); }
                                                                    catch { return activity.date; }
                                                                })()}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className={cn("flex flex-col items-center justify-center py-10 text-center rounded-2xl border-2 border-dashed",
                                    isDark ? "border-slate-700" : "border-slate-200")}>
                                    <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-4",
                                        isDark ? "bg-slate-700" : "bg-slate-100")}>
                                        <FileText className={cn("w-7 h-7", textMuted)} />
                                    </div>
                                    <h4 className={cn("text-sm font-bold mb-1", textPrimary)}>Belum Ada Aktivitas</h4>
                                    <p className={cn("text-xs font-medium max-w-[240px]", textMuted)}>
                                        Mulai catat jurnal harian Anda untuk melacak progres pekerjaan.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Confirmation Dialog */}
            <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <DialogContent className={cn("max-w-[380px] rounded-[24px] p-6 mx-auto",
                    isDark ? "bg-slate-800 border-slate-700" : "bg-white")}>
                    <DialogHeader className="mb-2">
                        <DialogTitle className={cn("text-lg font-bold text-center", textPrimary)}>
                            {confirmAction === "in" ? "Konfirmasi Clock In" : "Konfirmasi Clock Out"}
                        </DialogTitle>
                        <DialogDescription className={cn("text-center text-sm", textSecondary)}>
                            {confirmAction === "in"
                                ? "Anda akan memulai sesi kerja hari ini. Pastikan lokasi sudah benar."
                                : "Anda akan mengakhiri sesi kerja. Pastikan semua pekerjaan sudah dicatat."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className={cn("rounded-xl p-3 mb-3 flex items-center gap-2",
                        isDark ? "bg-slate-700" : "bg-slate-50")}>
                        <MapPin className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span className={cn("text-xs font-medium truncate", isDark ? "text-slate-300" : "text-slate-600")}>{location}</span>
                    </div>
                    <DialogFooter className="flex gap-2 sm:gap-2">
                        <Button variant="outline" onClick={() => setShowConfirmDialog(false)} className="flex-1 rounded-xl h-11">
                            Batal
                        </Button>
                        <Button
                            onClick={executeClockAction}
                            className={cn("flex-1 rounded-xl h-11 font-bold text-white",
                                confirmAction === "in" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-red-600 hover:bg-red-700")}
                        >
                            {confirmAction === "in" ? "Ya, Masuk" : "Ya, Keluar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </KaryawanWorkspaceLayout>
    );
};

export default KaryawanDashboardNew;
