import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { MapPin, CheckCircle2, Bell, Clock, BarChart3, FileCheck, Users, ChevronRight, Building2, LogOut, Settings, TrendingUp, CalendarDays, UserCircle, Moon, Sun, Edit3, RefreshCw, Send, X } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { cn } from "@/lib/utils";
import { generateAttendancePeriod } from "@/lib/attendanceGenerator";
import MobileNavigation from "@/components/MobileNavigation";
import AdminMobileNavigation from "@/components/AdminMobileNavigation";
import ManagerMobileNavigation from "@/components/ManagerMobileNavigation";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTheme } from "@/contexts/ThemeContext";

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

export default function MobileDashboardView({ role }: { role: "admin" | "manager" | "karyawan" }) {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const { settings } = useSystemSettings();
    const queryClient = useQueryClient();

    const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
    const [monthStats, setMonthStats] = useState<AttendanceStats>({ present: 0, late: 0, absent: 0, totalHours: 0 });
    const [usedLeaveDays, setUsedLeaveDays] = useState(0);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [location, setLocation] = useState<string>("Mengecek lokasi akurat...");
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [elapsedTime, setElapsedTime] = useState("00:00:00");
    const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
    const [userName, setUserName] = useState<string>("");
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [confirmAction, setConfirmAction] = useState<"in" | "out">("in");
    const [lateMinutes, setLateMinutes] = useState(0);

    // Feature 1: Notification Badge
    const [notifCount, setNotifCount] = useState(0);

    // Feature 2: Pull-to-Refresh
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const touchStartY = useRef(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Feature 5: Dark Mode
    const { isDark, toggleTheme } = useTheme();

    // Feature 6: Quick Journal
    const [showQuickJournal, setShowQuickJournal] = useState(false);
    const [journalTitle, setJournalTitle] = useState("");
    const [journalContent, setJournalContent] = useState("");
    const [journalCategory, setJournalCategory] = useState("");
    const [journalDuration, setJournalDuration] = useState("");
    const [isJournalSubmitting, setIsJournalSubmitting] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (todayAttendance?.clock_in && !todayAttendance.clock_out) {
            const timer = setInterval(() => {
                const now = new Date();
                const clockIn = new Date(todayAttendance.clock_in);
                const diffMs = now.getTime() - clockIn.getTime();
                const hours = Math.floor(diffMs / (1000 * 60 * 60));
                const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

                setElapsedTime(
                    `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
                );
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [todayAttendance]);

    useEffect(() => {
        if (user) {
            fetchData();
            fetchUserName();
        }
    }, [user]);

    const fetchUserName = async () => {
        if (!user) return;
        const { data } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("user_id", user.id)
            .maybeSingle();
        if (data?.full_name) {
            setUserName(data.full_name);
        } else {
            setUserName(user.email?.split("@")[0] || "User");
        }
    };

    const fetchData = async () => {
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        // Today's attendance
        const { data: todayData } = await supabase
            .from("attendance")
            .select("*")
            .eq("user_id", user?.id)
            .eq("date", todayStr)
            .maybeSingle();
        if (todayData) {
            setTodayAttendance(todayData);
            // If late, calculate late minutes
            if (todayData.status === 'late' && settings.clockInStart) {
                const clockInTime = new Date(todayData.clock_in);
                const [h, m] = settings.clockInStart.split(':').map(Number);
                const scheduledTime = new Date(clockInTime);
                scheduledTime.setHours(h, m, 0, 0);
                const diff = Math.floor((clockInTime.getTime() - scheduledTime.getTime()) / 60000);
                setLateMinutes(Math.max(0, diff));
            }
        }

        // Month stats
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);
        const startStr = format(monthStart, 'yyyy-MM-dd');
        const endStr = format(monthEnd, 'yyyy-MM-dd');

        const { data: monthData } = await supabase
            .from("attendance")
            .select("*")
            .eq("user_id", user?.id)
            .gte("date", startStr)
            .lte("date", endStr);

        const { data: monthLeaves } = await supabase
            .from("leave_requests")
            .select("*")
            .eq("user_id", user?.id)
            .eq("status", "approved")
            .lte("start_date", endStr)
            .gte("end_date", startStr);

        const { data: profileData } = await supabase
            .from("profiles")
            .select("created_at")
            .eq("user_id", user?.id)
            .maybeSingle();

        const normalizedMonth = generateAttendancePeriod(
            monthStart,
            monthEnd,
            monthData || [],
            monthLeaves || [],
            profileData?.created_at
        );

        if (normalizedMonth) {
            const present = normalizedMonth.filter(d => ['present', 'late', 'early_leave'].includes(d.status)).length;
            const late = normalizedMonth.filter(d => d.status === 'late').length;
            const absent = normalizedMonth.filter(d => ['absent', 'alpha'].includes(d.status)).length;
            let totalMinutes = 0;
            normalizedMonth.forEach(d => {
                if (d.clockIn && d.clockOut) {
                    const diff = Math.abs(new Date(d.clockOut).getTime() - new Date(d.clockIn).getTime());
                    totalMinutes += Math.floor(diff / 1000 / 60);
                }
            });
            setMonthStats({ present, late, absent, totalHours: Math.floor(totalMinutes / 60) });
        }

        // Leave days
        const year = new Date().getFullYear();
        const { data: leaveData } = await supabase
            .from("leave_requests")
            .select("start_date, end_date")
            .eq("user_id", user?.id)
            .eq("status", "approved")
            .gte("start_date", `${year}-01-01`);

        if (leaveData) {
            const totalDays = leaveData.reduce((acc, leave) => {
                const s = new Date(leave.start_date);
                const e = new Date(leave.end_date);
                return acc + Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            }, 0);
            setUsedLeaveDays(totalDays);
        }

        // Recent Timeline
        const last3Days = new Date();
        last3Days.setDate(last3Days.getDate() - 3);
        const { data: attendanceData } = await supabase
            .from("attendance")
            .select("*")
            .eq("user_id", user?.id)
            .gte("clock_in", last3Days.toISOString())
            .order("clock_in", { ascending: false });

        if (attendanceData) {
            const events: any[] = [];
            attendanceData.forEach(record => {
                if (record.clock_out) {
                    events.push({
                        id: `${record.id}-out`,
                        type: "out",
                        time: record.clock_out,
                        location: record.clock_out_location || "Unknown Location",
                        status: "Selesai Kerja"
                    });
                }
                if (record.clock_in) {
                    events.push({
                        id: `${record.id}-in`,
                        type: "in",
                        time: record.clock_in,
                        location: record.clock_in_location || "Unknown Location",
                        status: record.status === "late" ? "Terlambat" : "Hadir"
                    });
                }
            });
            events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
            setAttendanceLogs(events.slice(0, 5));
        }

        setIsDataLoaded(true);
    };

    // Feature 1: Fetch notification count
    const fetchNotifCount = useCallback(async () => {
        if (!user) return;
        let count = 0;
        if (role === 'manager' || role === 'admin') {
            const { count: leaveCount } = await supabase.from("leave_requests").select("*", { count: "exact", head: true }).eq("status", "pending");
            count += leaveCount || 0;
            const { count: journalCount } = await supabase.from("work_journals").select("*", { count: "exact", head: true }).eq("verification_status", "submitted");
            count += journalCount || 0;
        } else {
            const { count: myLeave } = await supabase.from("leave_requests").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "approved").gt("created_at", new Date(Date.now() - 7 * 86400000).toISOString());
            count += myLeave || 0;
        }
        setNotifCount(count);
    }, [user, role]);

    useEffect(() => { fetchNotifCount(); }, [fetchNotifCount]);

    // Feature 5: Dark Mode toggle removed as it corresponds to ThemeProvider

    // Feature 2: Pull-to-Refresh
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (scrollContainerRef.current && scrollContainerRef.current.scrollTop === 0) {
            touchStartY.current = e.touches[0].clientY;
        }
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!touchStartY.current) return;
        const diff = e.touches[0].clientY - touchStartY.current;
        if (diff > 0 && scrollContainerRef.current && scrollContainerRef.current.scrollTop === 0) {
            setPullDistance(Math.min(diff * 0.4, 80));
        }
    }, []);

    const handleTouchEnd = useCallback(async () => {
        if (pullDistance > 50) {
            setIsRefreshing(true);
            await fetchData();
            await fetchNotifCount();
            setIsRefreshing(false);
        }
        setPullDistance(0);
        touchStartY.current = 0;
    }, [pullDistance]);

    // Feature 6: Quick Journal Submit
    const handleQuickJournalSubmit = async () => {
        if (!journalTitle || !journalContent || !journalCategory || !journalDuration) {
            toast({ variant: "destructive", title: "Lengkapi semua field", description: "Semua field wajib diisi." });
            return;
        }
        setIsJournalSubmitting(true);
        try {
            const durationMinutes = Math.round(parseFloat(journalDuration) * 60);
            const finalContent = `**${journalTitle}**\n\n${journalContent}`;
            const { error } = await supabase.from('work_journals').insert({
                user_id: user?.id,
                content: finalContent,
                duration: durationMinutes,
                obstacles: journalCategory,
                date: format(new Date(), 'yyyy-MM-dd'),
                verification_status: 'submitted',
                work_result: 'completed',
                mood: '😊'
            });
            if (error) throw error;
            if (navigator.vibrate) navigator.vibrate(100);
            toast({ title: "📝 Jurnal Terkirim", description: "Log pekerjaan berhasil dicatat." });
            setShowQuickJournal(false);
            setJournalTitle(""); setJournalContent(""); setJournalCategory(""); setJournalDuration("");
            await queryClient.invalidateQueries({ queryKey: ['journals', 'employee', user?.id] });
        } catch (err: any) {
            toast({ variant: "destructive", title: "Error", description: err.message || "Gagal mengirim jurnal." });
        } finally {
            setIsJournalSubmitting(false);
        }
    };

    useEffect(() => {
        if (settings.enableLocationTracking && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
                        const data = await res.json();
                        if (data && data.address) {
                            const addr = data.address;
                            const localArea = addr.residential || addr.suburb || addr.village || addr.road || "";
                            const city = addr.city || addr.town || "";
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
            setLocation("Tracking dinonaktifkan");
        }
    }, [settings.enableLocationTracking]);

    const handleClockAction = async () => {
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
                const { data, error } = await supabase.functions.invoke("clock-in", {
                    body: { location },
                });
                if (!error && data?.success) {
                    if (navigator.vibrate) navigator.vibrate(100);
                    toast({ title: "✅ Berhasil Masuk", description: "Selamat bekerja! Semangat hari ini." });
                    fetchData();
                } else {
                    const now = new Date();
                    const year = now.getFullYear();
                    const month = String(now.getMonth() + 1).padStart(2, '0');
                    const day = String(now.getDate()).padStart(2, '0');
                    const todayStr = `${year}-${month}-${day}`;

                    const { error: dbError } = await supabase.from("attendance").insert({
                        user_id: user?.id,
                        date: todayStr,
                        clock_in: now.toISOString(),
                        clock_in_location: location,
                        status: "present",
                    });
                    if (dbError) throw dbError;
                    if (navigator.vibrate) navigator.vibrate(100);
                    toast({ title: "✅ Berhasil Masuk", description: "Selamat bekerja! Semangat hari ini." });
                    fetchData();
                }
            } else {
                const { data, error } = await supabase.functions.invoke("clock-out", {
                    body: { location },
                });
                if (!error && data?.success) {
                    if (navigator.vibrate) navigator.vibrate([50, 50, 100]);
                    toast({ title: "🏠 Berhasil Keluar", description: "Terima kasih atas kerja kerasnya!" });
                    fetchData();
                } else {
                    const now = new Date();
                    const { error: dbError } = await supabase
                        .from("attendance")
                        .update({ clock_out: now.toISOString(), clock_out_location: location })
                        .eq("id", todayAttendance!.id);
                    if (dbError) throw dbError;
                    if (navigator.vibrate) navigator.vibrate([50, 50, 100]);
                    toast({ title: "🏠 Berhasil Keluar", description: "Terima kasih atas kerja kerasnya!" });
                    fetchData();
                }
            }
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "Terjadi kesalahan." });
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleLogout = async () => {
        await signOut();
        navigate("/login");
    };

    const isWorking = Boolean(todayAttendance && !todayAttendance.clock_out);
    const isFinished = Boolean(todayAttendance && todayAttendance.clock_out);

    const remainingLeave = Math.max(0, settings.maxLeaveDays - usedLeaveDays);

    const attendanceRate = useMemo(() => {
        const total = monthStats.present + monthStats.absent;
        return total > 0 ? Math.round((monthStats.present / total) * 100) : 100;
    }, [monthStats]);

    const getLogLink = () => {
        if (role === 'admin') return '/admin/absensi';
        if (role === 'manager') return '/manager/absensi';
        return '/karyawan/riwayat';
    };

    const getGreeting = () => {
        const hour = currentTime.getHours();
        if (hour < 11) return "Selamat Pagi";
        if (hour < 15) return "Selamat Siang";
        if (hour < 18) return "Selamat Sore";
        return "Selamat Malam";
    };

    // Menu items for admin/manager quick access
    const adminMenuItems = [
        { icon: Users, title: "Kelola Karyawan", desc: "Data karyawan & role", href: "/admin/karyawan", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
        { icon: Clock, title: "Rekap Absensi", desc: "Data kehadiran", href: "/admin/absensi", color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100" },
        { icon: BarChart3, title: "Laporan", desc: "Laporan kehadiran", href: "/admin/laporan", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
        { icon: FileCheck, title: "Jurnal Kerja", desc: "Review jurnal", href: "/admin/jurnal", color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-100" },
        { icon: Building2, title: "Departemen", desc: "Kelola departemen", href: "/admin/departemen", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
        { icon: Settings, title: "Pengaturan", desc: "Konfigurasi sistem", href: "/admin/pengaturan", color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200" },
    ];

    const managerMenuItems = [
        { icon: Clock, title: "Rekap Absensi", desc: "Data kehadiran tim", href: "/manager/absensi", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
        { icon: BarChart3, title: "Laporan", desc: "Laporan & analisis", href: "/manager/laporan", color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100" },
        { icon: FileCheck, title: "Kelola Cuti", desc: "Approve / Reject", href: "/manager/cuti", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
    ];

    const isKaryawan = role === 'karyawan';
    const firstName = userName.split(' ')[0] || 'User';

    // Skeleton component
    const Skeleton = ({ className }: { className?: string }) => (
        <div className={cn("bg-slate-200/60 rounded-xl animate-pulse", className)} />
    );

    return (
        <div
            ref={scrollContainerRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className={cn("flex flex-col min-h-screen pb-[100px] overflow-y-auto transition-colors duration-300", isDark ? "bg-slate-900" : "bg-[#F8FAFC]")}
            style={{ fontFamily: "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif" }}
        >
            {/* Pull-to-Refresh Indicator */}
            <div className={cn("flex justify-center items-center transition-all duration-300 overflow-hidden", pullDistance > 0 ? "opacity-100" : "opacity-0")} style={{ height: pullDistance }}>
                <RefreshCw className={cn("w-5 h-5 text-indigo-500 transition-transform", isRefreshing ? "animate-spin" : pullDistance > 50 ? "rotate-180" : "")} />
                <span className="text-xs font-medium text-indigo-500 ml-2">{isRefreshing ? "Memperbarui..." : pullDistance > 50 ? "Lepas untuk refresh" : "Tarik untuk refresh"}</span>
            </div>

            {/* ===== HEADER — Indigo Gradient ===== */}
            <div className="relative overflow-hidden rounded-b-[36px] shadow-lg">
                {/* Gradient Background */}
                <div className={cn("absolute inset-0", isDark ? "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" : "bg-gradient-to-br from-[#312E81] via-[#3730A3] to-[#4338CA]")} />
                {/* Decorative orbs */}
                <div className="absolute top-0 right-0 w-60 h-60 bg-white/[0.06] rounded-full blur-3xl -translate-y-1/3 translate-x-1/4 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-400/10 rounded-full blur-2xl translate-y-1/3 -translate-x-1/4 pointer-events-none" />

                <div className="relative z-10 pt-[max(env(safe-area-inset-top),36px)] pb-10 px-6">
                    {/* Top Bar: Greeting + Logout */}
                    <div className="flex justify-between items-start mb-6 vibe-animate">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-white font-bold text-base uppercase backdrop-blur-sm">
                                {firstName.charAt(0)}
                            </div>
                            <div>
                                <p className="text-[12px] font-medium text-indigo-200/80 tracking-wide">{getGreeting()} 👋</p>
                                <h1 className="text-lg font-bold text-white leading-tight tracking-tight">{firstName}</h1>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            {/* Dark Mode Toggle */}
                            <button
                                onClick={toggleTheme}
                                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center border border-white/10 active:scale-90 transition-all backdrop-blur-sm"
                                aria-label="Toggle dark mode"
                            >
                                {isDark ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-white/70" />}
                            </button>
                            {/* Bell with Notification Badge */}
                            <button className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center border border-white/10 active:scale-90 transition-transform backdrop-blur-sm relative">
                                <Bell className="w-4 h-4 text-white/80" />
                                {notifCount > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 shadow-lg animate-pulse">
                                        {notifCount > 9 ? '9+' : notifCount}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={handleLogout}
                                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center border border-white/10 active:scale-90 transition-transform backdrop-blur-sm"
                            >
                                <LogOut className="w-4 h-4 text-white/80" />
                            </button>
                        </div>
                    </div>

                    {/* Time Display */}
                    <div className="text-center flex flex-col items-center vibe-animate vibe-delay-1">
                        <p className="text-[13px] font-medium text-indigo-100/70 mb-0.5 capitalize">
                            {format(currentTime, 'EEEE, d MMMM yyyy', { locale: idLocale })}
                        </p>
                        <h2 className="text-[56px] font-extrabold tracking-tighter leading-none text-white tabular-nums mb-2">
                            {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </h2>

                        {isKaryawan && (
                            <>
                                <div className="inline-flex items-center gap-2 bg-white/[0.08] px-4 py-2 rounded-full border border-white/[0.06] mb-2 max-w-[85%] backdrop-blur-sm">
                                    <MapPin className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
                                    <span className="text-[11px] font-medium text-indigo-100/80 truncate whitespace-nowrap">{location}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-indigo-300/80">
                                    <Clock className="w-3 h-3" />
                                    {settings.clockInStart} — {settings.clockOutStart}
                                </div>
                            </>
                        )}
                        {!isKaryawan && (
                            <div className="inline-flex items-center gap-2 bg-white/[0.08] px-3 py-1.5 rounded-full border border-white/[0.06]">
                                <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-300/80">
                                    {role === 'admin' ? '🛡️ Admin Panel' : '👔 Manager Panel'}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ===== KARYAWAN: Clock-In Button ===== */}
            {isKaryawan && (
                <div className="px-6 -mt-7 relative z-20 flex flex-col items-center w-full vibe-animate vibe-delay-2">
                    <div className="bg-white p-2 rounded-[36px] shadow-[0_8px_32px_rgba(0,0,0,0.08)] border border-slate-100/80 mb-5">
                        <button
                            onClick={handleClockAction}
                            disabled={isActionLoading || isFinished}
                            className={cn(
                                "w-[148px] h-[148px] rounded-[28px] flex flex-col items-center justify-center gap-2 transition-all duration-300 relative overflow-hidden",
                                !todayAttendance ? "bg-gradient-to-br from-[#4F46E5] to-[#6366F1] text-white active:scale-95 shadow-[0_8px_24px_rgba(79,70,229,0.35)]" :
                                    isWorking ? "bg-gradient-to-br from-[#DC2626] to-[#EF4444] text-white active:scale-95 shadow-[0_8px_24px_rgba(220,38,38,0.3)]" :
                                        "bg-slate-50 text-slate-400 cursor-not-allowed border border-slate-200"
                            )}
                        >
                            {isActionLoading ? (
                                <div className="w-10 h-10 animate-spin border-[3px] border-white/30 border-t-white rounded-full" />
                            ) : (
                                <>
                                    {!todayAttendance ? (
                                        <>
                                            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-0.5 backdrop-blur-sm">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
                                            </div>
                                            <span className="text-lg font-extrabold tracking-tight">MASUK</span>
                                        </>
                                    ) : isWorking ? (
                                        <>
                                            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-0.5 backdrop-blur-sm">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                                            </div>
                                            <span className="text-lg font-extrabold tracking-tight">KELUAR</span>
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-10 h-10 mb-0.5 opacity-50" />
                                            <span className="text-base font-extrabold tracking-tight">SELESAI</span>
                                        </>
                                    )}
                                </>
                            )}
                        </button>
                    </div>

                    {/* Working/Done Status Card */}
                    {todayAttendance && (
                        <div className="w-full bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-slate-100 mb-5 vibe-animate vibe-delay-3">
                            <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center gap-2">
                                    <div className={cn("w-2.5 h-2.5 rounded-full", isWorking ? "bg-emerald-500 animate-pulse" : "bg-slate-300")} />
                                    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-800">
                                        {isWorking ? "Sedang Bekerja" : "Sesi Selesai"}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {todayAttendance.status === 'late' && (
                                        <span className="text-[9px] font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-100">
                                            TERLAMBAT {lateMinutes > 0 ? `${lateMinutes}m` : ''}
                                        </span>
                                    )}
                                    <span className="text-[9px] font-bold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
                                        <CheckCircle2 className="w-2.5 h-2.5" /> GPS
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2.5">
                                <div className="bg-slate-50 p-3 rounded-xl flex flex-col items-center text-center">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Masuk</span>
                                    <span className="text-[15px] font-bold text-slate-800 tabular-nums">{todayAttendance.clock_in.substring(11, 16)}</span>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-xl flex flex-col items-center text-center">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Keluar</span>
                                    <span className="text-[15px] font-bold text-slate-800 tabular-nums">
                                        {todayAttendance.clock_out ? todayAttendance.clock_out.substring(11, 16) : "—"}
                                    </span>
                                </div>
                                <div className="bg-indigo-50 p-3 rounded-xl flex flex-col items-center text-center border border-indigo-100/50">
                                    <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider block mb-0.5">Durasi</span>
                                    <span className="text-[15px] font-bold text-indigo-700 tabular-nums font-mono">{elapsedTime.substring(0, 5)}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ===== ADMIN / MANAGER: Quick Access Menu ===== */}
            {!isKaryawan && (
                <div className="px-6 -mt-5 relative z-20 w-full vibe-animate vibe-delay-2">
                    <h3 className={cn("text-[12px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2", isDark ? "text-slate-400" : "text-slate-500")}>
                        <span className={cn("w-5 h-px", isDark ? "bg-slate-600" : "bg-slate-300")} />
                        Menu Cepat
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-5">
                        {(role === 'admin' ? adminMenuItems : managerMenuItems).map((item, idx) => (
                            <Link
                                key={item.href}
                                to={item.href}
                                className={cn(
                                    "rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.03)] border p-4 flex items-center gap-3.5 active:scale-[0.98] transition-all duration-200 vibe-animate",
                                    isDark ? "bg-slate-800 border-slate-700" : "bg-white",
                                    item.border
                                )}
                                style={{ animationDelay: `${(idx + 2) * 60}ms` }}
                            >
                                <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0", item.bg)}>
                                    <item.icon className={cn("w-5 h-5", item.color)} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <span className={cn("text-[13px] font-bold block leading-tight", isDark ? "text-white" : "text-slate-800")}>{item.title}</span>
                                    <span className={cn("text-[11px] font-medium", isDark ? "text-slate-400" : "text-slate-400")}>{item.desc}</span>
                                </div>
                                <ChevronRight className={cn("w-4 h-4 shrink-0", isDark ? "text-slate-500" : "text-slate-300")} />
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* ===== KARYAWAN: Tablet-responsive grid wrapper ===== */}
            {isKaryawan && (
                <div className="md:grid md:grid-cols-2 md:gap-6 md:px-6">
                    {/* LEFT COLUMN (tablet): Stats + Quick Actions */}
                    <div>
                        {/* Attendance Rate Ring + Monthly Stats */}
                        <div className="px-6 md:px-0 mb-5 w-full vibe-animate vibe-delay-3">
                            <h3 className={cn("text-[12px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2", isDark ? "text-slate-400" : "text-slate-500")}>
                                <span className={cn("w-5 h-px", isDark ? "bg-slate-600" : "bg-slate-300")} />
                                Statistik Bulan Ini
                            </h3>

                            {!isDataLoaded ? (
                                <div className="grid grid-cols-4 gap-2.5">
                                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[80px]" />)}
                                </div>
                            ) : (
                                <div className="flex gap-2.5 w-full">
                                    {/* Attendance Ring */}
                                    <div className={cn("p-3 rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.03)] border flex flex-col items-center justify-center min-w-[90px]", isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100")}>
                                        <div className="relative w-[56px] h-[56px] mb-1">
                                            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                                <circle cx="18" cy="18" r="15.5" fill="none" stroke={isDark ? "#334155" : "#E2E8F0"} strokeWidth="3" />
                                                <circle
                                                    cx="18" cy="18" r="15.5" fill="none"
                                                    stroke={attendanceRate >= 80 ? "#4F46E5" : attendanceRate >= 60 ? "#F59E0B" : "#EF4444"}
                                                    strokeWidth="3"
                                                    strokeLinecap="round"
                                                    strokeDasharray={`${attendanceRate * 0.9738} ${97.38 - attendanceRate * 0.9738}`}
                                                    className="transition-all duration-1000 ease-out"
                                                />
                                            </svg>
                                            <span className={cn("absolute inset-0 flex items-center justify-center text-[13px] font-extrabold", isDark ? "text-white" : "text-slate-800")}>{attendanceRate}%</span>
                                        </div>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Hadir</span>
                                    </div>

                                    {/* Stat Cards */}
                                    <div className="grid grid-cols-3 gap-2 flex-1">
                                        <div className={cn("p-3 rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.03)] border flex flex-col items-center justify-center text-center", isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100")}>
                                            <span className="text-xl font-extrabold text-red-500">{monthStats.late}</span>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Telat</span>
                                        </div>
                                        <div className={cn("p-3 rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.03)] border flex flex-col items-center justify-center text-center", isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100")}>
                                            <span className={cn("text-xl font-extrabold", isDark ? "text-white" : "text-slate-800")}>{monthStats.totalHours}<span className="text-[10px] font-medium text-slate-400">j</span></span>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Kerja</span>
                                        </div>
                                        <div className={cn("p-3 rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.03)] border flex flex-col items-center justify-center text-center", isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100")}>
                                            <span className="text-xl font-extrabold text-emerald-600">{remainingLeave}</span>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Cuti</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Quick Actions */}
                        <div className="px-6 md:px-0 mb-5 vibe-animate vibe-delay-4">
                            <div className="grid grid-cols-3 gap-2.5">
                                <Link to="/karyawan/riwayat" className={cn("p-3 rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.03)] border flex flex-col items-center gap-1.5 active:scale-95 transition-transform", isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100")}>
                                    <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                                        <CalendarDays className="w-4.5 h-4.5 text-blue-600" />
                                    </div>
                                    <span className={cn("text-[10px] font-bold", isDark ? "text-slate-300" : "text-slate-600")}>Riwayat</span>
                                </Link>
                                <Link to="/karyawan/cuti" className={cn("p-3 rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.03)] border flex flex-col items-center gap-1.5 active:scale-95 transition-transform", isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100")}>
                                    <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
                                        <FileCheck className="w-4.5 h-4.5 text-emerald-600" />
                                    </div>
                                    <span className={cn("text-[10px] font-bold", isDark ? "text-slate-300" : "text-slate-600")}>Cuti</span>
                                </Link>
                                <Link to="/karyawan/jurnal" className={cn("p-3 rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.03)] border flex flex-col items-center gap-1.5 active:scale-95 transition-transform", isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100")}>
                                    <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center">
                                        <TrendingUp className="w-4.5 h-4.5 text-violet-600" />
                                    </div>
                                    <span className={cn("text-[10px] font-bold", isDark ? "text-slate-300" : "text-slate-600")}>Jurnal</span>
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* ===== KARYAWAN: Attendance Log (RIGHT COLUMN on tablet) ===== */}
                    <div> {/* RIGHT COLUMN wrapper for tablet */}
                        <div className="px-6 md:px-0 mb-8 w-full vibe-animate vibe-delay-5">
                            <div className="flex justify-between items-end mb-3 w-full">
                                <h3 className={cn("text-[12px] font-bold uppercase tracking-widest flex items-center gap-2", isDark ? "text-slate-400" : "text-slate-500")}>
                                    <span className={cn("w-5 h-px", isDark ? "bg-slate-600" : "bg-slate-300")} />
                                    Log Terbaru
                                </h3>
                                <button onClick={() => navigate(getLogLink())} className="text-[11px] font-bold text-indigo-600 tracking-wide active:opacity-70">Lihat Semua</button>
                            </div>

                            {!isDataLoaded ? (
                                <div className="space-y-3">
                                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-[60px] rounded-2xl" />)}
                                </div>
                            ) : attendanceLogs.length === 0 ? (
                                <div className="bg-white rounded-2xl p-8 border border-slate-100 text-center flex flex-col items-center">
                                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-2">
                                        <Clock className="w-5 h-5 text-slate-300" />
                                    </div>
                                    <span className="text-[13px] font-bold text-slate-600">Belum Ada Log</span>
                                    <span className="text-[11px] text-slate-400 mt-0.5">Log kehadiran akan muncul di sini.</span>
                                </div>
                            ) : (
                                <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.03)] border border-slate-100 p-4 w-full">
                                    <div className="space-y-3 relative before:absolute before:inset-y-1 before:left-[9px] before:w-px before:bg-slate-100">
                                        {attendanceLogs.map((log) => {
                                            const dateObj = new Date(log.time);
                                            const isToday = format(dateObj, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                                            const isOut = log.type === "out";

                                            return (
                                                <div key={log.id} className="relative pl-7">
                                                    <div className={cn(
                                                        "absolute left-[2px] top-1 w-[15px] h-[15px] rounded-full border-[2px] bg-white",
                                                        isOut ? "border-slate-300" : (log.status === "Terlambat" ? "border-amber-500" : "border-emerald-500")
                                                    )} />
                                                    <div className="flex justify-between items-baseline mb-0.5">
                                                        <span className="text-[11px] font-bold text-slate-700">{isToday ? "Hari Ini" : format(dateObj, 'd MMM', { locale: idLocale })}</span>
                                                        <span className="text-[10px] text-slate-400 font-semibold tabular-nums">{format(dateObj, 'HH:mm')}</span>
                                                    </div>
                                                    <div className="bg-slate-50 p-2.5 rounded-xl flex items-center justify-between">
                                                        <span className={cn(
                                                            "text-[10px] font-bold tracking-wider",
                                                            isOut ? "text-slate-500" : (log.status === "Terlambat" ? "text-amber-600" : "text-emerald-600")
                                                        )}>
                                                            {isOut ? "Clock Out" : "Clock In"} • {log.status}
                                                        </span>
                                                        <div className="flex items-center gap-1 text-slate-400">
                                                            <MapPin className="w-2.5 h-2.5 shrink-0" />
                                                            <p className="text-[9px] font-medium truncate max-w-[100px]">{log.location}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Dialog */}
            <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <DialogContent className="max-w-[340px] rounded-[24px] p-6 bg-white mx-auto w-[90%]">
                    <DialogHeader className="mb-2">
                        <DialogTitle className="text-lg font-bold text-slate-800 text-center">
                            {confirmAction === "in" ? "Konfirmasi Clock In" : "Konfirmasi Clock Out"}
                        </DialogTitle>
                        <DialogDescription className="text-center text-slate-500 text-sm">
                            {confirmAction === "in"
                                ? "Anda akan memulai sesi kerja hari ini. Pastikan lokasi sudah benar."
                                : "Anda akan mengakhiri sesi kerja. Pastikan semua pekerjaan sudah dicatat."
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <div className="bg-slate-50 rounded-xl p-3 mb-3 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span className="text-xs font-medium text-slate-600 truncate">{location}</span>
                    </div>
                    <DialogFooter className="flex gap-2 sm:gap-2">
                        <Button variant="outline" onClick={() => setShowConfirmDialog(false)} className="flex-1 rounded-xl h-11">
                            Batal
                        </Button>
                        <Button
                            onClick={executeClockAction}
                            className={cn("flex-1 rounded-xl h-11 font-bold text-white",
                                confirmAction === "in"
                                    ? "bg-indigo-600 hover:bg-indigo-700"
                                    : "bg-red-600 hover:bg-red-700"
                            )}
                        >
                            {confirmAction === "in" ? "Ya, Masuk" : "Ya, Keluar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ===== Quick Journal FAB (Feature 6) — Karyawan Only ===== */}
            {isKaryawan && (
                <button
                    onClick={() => setShowQuickJournal(true)}
                    className="fixed bottom-[90px] right-5 w-13 h-13 bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-full flex items-center justify-center shadow-[0_6px_20px_rgba(79,70,229,0.4)] active:scale-90 transition-all z-50 hover:shadow-[0_8px_28px_rgba(79,70,229,0.5)]"
                    style={{ width: 52, height: 52 }}
                    aria-label="Tambah jurnal cepat"
                >
                    <Edit3 className="w-5 h-5" />
                </button>
            )}

            {/* Quick Journal Dialog */}
            <Dialog open={showQuickJournal} onOpenChange={setShowQuickJournal}>
                <DialogContent className="max-w-[400px] rounded-[24px] p-0 bg-white mx-auto w-[92%] border-none overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-5 flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-bold text-white">Log Cepat</h2>
                            <p className="text-[11px] text-indigo-100/80">{format(new Date(), 'EEEE, d MMM yyyy', { locale: idLocale })}</p>
                        </div>
                        <button onClick={() => setShowQuickJournal(false)} className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
                            <X className="w-4 h-4 text-white" />
                        </button>
                    </div>
                    <div className="p-5 space-y-3.5">
                        <Input
                            placeholder="Judul aktivitas..."
                            value={journalTitle}
                            onChange={(e) => setJournalTitle(e.target.value)}
                            className="h-10 rounded-xl border-slate-200 text-sm"
                        />
                        <div className="grid grid-cols-2 gap-2.5">
                            <Select value={journalCategory} onValueChange={setJournalCategory}>
                                <SelectTrigger className="h-10 rounded-xl border-slate-200 text-sm">
                                    <SelectValue placeholder="Kategori" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="development">🛠️ Development</SelectItem>
                                    <SelectItem value="meeting">📋 Meeting</SelectItem>
                                    <SelectItem value="design">🎨 Design</SelectItem>
                                    <SelectItem value="research">🔬 Research</SelectItem>
                                    <SelectItem value="support">🤝 Support</SelectItem>
                                    <SelectItem value="learning">📚 Learning</SelectItem>
                                </SelectContent>
                            </Select>
                            <Input
                                type="number"
                                step="0.5"
                                min="0" max="24"
                                placeholder="Durasi (jam)"
                                value={journalDuration}
                                onChange={(e) => setJournalDuration(e.target.value)}
                                className="h-10 rounded-xl border-slate-200 text-sm"
                            />
                        </div>
                        <Textarea
                            placeholder="Deskripsikan pekerjaan Anda hari ini..."
                            value={journalContent}
                            onChange={(e) => setJournalContent(e.target.value)}
                            className="min-h-[80px] rounded-xl border-slate-200 resize-none text-sm"
                        />
                        <Button
                            onClick={handleQuickJournalSubmit}
                            disabled={isJournalSubmitting || !journalTitle || !journalContent || !journalCategory || !journalDuration}
                            className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2"
                        >
                            {isJournalSubmitting ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <><Send className="w-4 h-4" /> Kirim Jurnal</>
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Bottom Navigation */}
            {role === "admin" && <AdminMobileNavigation />}
            {role === "manager" && <ManagerMobileNavigation />}
            {role === "karyawan" && <MobileNavigation />}

            <style>{`
                .hide-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .hide-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
}
