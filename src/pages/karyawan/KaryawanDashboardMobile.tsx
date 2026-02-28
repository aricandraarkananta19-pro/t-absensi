import { useState, useEffect } from "react";
import { Clock, MapPin, CheckCircle2, ChevronRight, History, Calendar, FileText, Bell, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { cn } from "@/lib/utils";
import MobileNavigation from "@/components/MobileNavigation";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

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

export default function KaryawanDashboardMobile() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { settings } = useSystemSettings();

    const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
    const [monthStats, setMonthStats] = useState<AttendanceStats>({ present: 0, late: 0, absent: 0, totalHours: 0 });
    const [usedLeaveDays, setUsedLeaveDays] = useState(0);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [location, setLocation] = useState<string>("Mengecek lokasi akurat...");
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [elapsedTime, setElapsedTime] = useState("00:00:00");
    const [recentActivities, setRecentActivities] = useState<any[]>([]);

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
        }
    }, [user]);

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
        if (todayData) setTodayAttendance(todayData);

        // Month stats
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
        const { data: monthData } = await supabase
            .from("attendance")
            .select("clock_in, clock_out, status")
            .eq("user_id", user?.id)
            .gte("clock_in", startOfMonth)
            .lte("clock_in", endOfMonth);

        if (monthData) {
            const present = monthData.filter(d => d.status === "present" || d.status === "late").length;
            const late = monthData.filter(d => d.status === "late").length;
            let totalMinutes = 0;
            monthData.forEach(d => {
                if (d.clock_in && d.clock_out) {
                    const diff = Math.abs(new Date(d.clock_out).getTime() - new Date(d.clock_in).getTime());
                    totalMinutes += Math.floor(diff / 1000 / 60);
                }
            });
            setMonthStats({ present, late, absent: 0, totalHours: Math.floor(totalMinutes / 60) });
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

        // Recent Timeline (Work Journals)
        const { data: timelineData, error } = await supabase
            .from("work_journals")
            .select("*")
            .eq("user_id", user?.id)
            .is("deleted_at", null)
            .order("date", { ascending: false })
            .limit(3);
        if (timelineData) setRecentActivities(timelineData);
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
        setIsActionLoading(true);
        try {
            if (!todayAttendance) {
                // Clock In
                const { data, error } = await supabase.functions.invoke("clock-in", {
                    body: { location },
                });
                if (!error && data?.success) {
                    toast({ title: "Berhasil Masuk", description: "Selamat bekerja!" });
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
                    toast({ title: "Berhasil Masuk", description: "Selamat bekerja!" });
                    fetchData();
                }
            } else if (!todayAttendance.clock_out) {
                // Clock Out
                const { data, error } = await supabase.functions.invoke("clock-out", {
                    body: { location },
                });
                if (!error && data?.success) {
                    toast({ title: "Berhasil Keluar", description: "Terima kasih atas kerja kerasnya!" });
                    fetchData();
                } else {
                    const now = new Date();
                    const { error: dbError } = await supabase
                        .from("attendance")
                        .update({ clock_out: now.toISOString(), clock_out_location: location })
                        .eq("id", todayAttendance.id);
                    if (dbError) throw dbError;
                    toast({ title: "Berhasil Keluar", description: "Terima kasih atas kerja kerasnya!" });
                    fetchData();
                }
            }
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "Terjadi kesalahan." });
        } finally {
            setIsActionLoading(false);
        }
    };

    const isWorking = Boolean(todayAttendance && !todayAttendance.clock_out);
    const isFinished = Boolean(todayAttendance && todayAttendance.clock_out);

    const remainingLeave = Math.max(0, settings.maxLeaveDays - usedLeaveDays);
    const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'Karyawan';

    // Premium Corporate Colors
    const primaryNavy = "#0F172A";
    const primaryBlue = "#2563EB";
    const successGreen = "#16A34A";
    const dangerRed = "#DC2626";

    return (
        <div className="flex flex-col min-h-screen bg-[#F8FAFC] pb-[100px] font-sans">
            {/* Header Gelap - Premium Corporate Look */}
            <div className="bg-[#0F172A] text-white pt-[max(env(safe-area-inset-top),32px)] pb-12 px-6 rounded-b-[40px] shadow-lg relative overflow-hidden">
                {/* Minimalist decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                <div className="relative z-10 flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-[13px] font-medium text-slate-400 uppercase tracking-widest mb-1">Talenta Traincom</h2>
                        <h1 className="text-xl font-semibold">Beranda</h1>
                    </div>
                    <button className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/10 active:scale-95 transition-transform">
                        <Bell className="w-5 h-5 text-white" />
                    </button>
                </div>

                <div className="relative z-10 text-center flex flex-col items-center">
                    <p className="text-sm font-medium text-slate-300 mb-1">{format(currentTime, 'EEEE, d MMMM yyyy', { locale: idLocale })}</p>
                    <h2 className="text-[64px] font-bold tracking-tight leading-none mb-4 tabular-nums">
                        {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </h2>

                    <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-white/5 mb-4 max-w-full">
                        <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="text-[11px] font-medium truncate whitespace-nowrap">{location}</span>
                    </div>

                    <p className="text-[11px] font-bold uppercase tracking-widest text-[#2563EB]">
                        Jadwal: {settings.clockInStart} - {settings.clockOutStart}
                    </p>
                </div>
            </div>

            {/* Kontainer Tombol / Status Overlapping */}
            <div className="px-6 -mt-8 relative z-20 flex flex-col items-center w-full">

                {/* Tombol Aksi Utama */}
                <div className="bg-white p-2 rounded-[40px] shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-slate-100 mb-6">
                    <button
                        onClick={handleClockAction}
                        disabled={isActionLoading || isFinished}
                        className={cn(
                            "w-[160px] h-[160px] rounded-[32px] flex flex-col items-center justify-center gap-3 transition-all duration-300 shadow-inner",
                            !todayAttendance ? "bg-[#2563EB] hover:bg-[#1E40AF] text-white active:scale-95" :
                                isWorking ? "bg-[#DC2626] hover:bg-[#991B1B] text-white active:scale-95" :
                                    "bg-slate-100 text-slate-400 cursor-not-allowed"
                        )}
                    >
                        {isActionLoading ? (
                            <div className="w-10 h-10 animate-spin border-4 border-white/30 border-t-white rounded-full" />
                        ) : (
                            <>
                                {!todayAttendance ? (
                                    <>
                                        <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mb-1">
                                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
                                        </div>
                                        <span className="text-xl font-bold tracking-tight">MASUK</span>
                                    </>
                                ) : isWorking ? (
                                    <>
                                        <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mb-1">
                                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                                        </div>
                                        <span className="text-xl font-bold tracking-tight">KELUAR</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-12 h-12 mb-1 opacity-50" />
                                        <span className="text-lg font-bold tracking-tight">SELESAI</span>
                                    </>
                                )}
                            </>
                        )}
                    </button>
                </div>

                {/* Kartu Status Kerja Langsung */}
                {todayAttendance && (
                    <div className="w-full bg-white rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-[#E5E7EB] mb-8">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2">
                                <div className={cn("w-2.5 h-2.5 rounded-full", isWorking ? "bg-[#16A34A] animate-pulse" : "bg-slate-300")} />
                                <span className="text-xs font-bold uppercase tracking-widest text-[#0F172A]">
                                    {isWorking ? "Sedang Bekerja" : "Sesi Selesai"}
                                </span>
                            </div>
                            <span className="text-[10px] font-semibold bg-[#F8FAFC] px-2 py-1 rounded-md text-[#2563EB] flex items-center gap-1 border border-blue-100">
                                <CheckCircle2 className="w-3 h-3" /> GPS Valid
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-[#F8FAFC] p-4 rounded-xl border border-slate-100 flex flex-col items-center text-center">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Waktu Masuk</span>
                                <span className="text-lg font-bold text-[#0F172A]">{todayAttendance.clock_in.substring(11, 16)}</span>
                            </div>
                            <div className="bg-[#F8FAFC] p-4 rounded-xl border border-slate-100 flex flex-col items-center text-center">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Durasi Kerja</span>
                                <span className="text-lg font-bold text-[#0F172A] tabular-nums font-mono">{elapsedTime}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Statistik Kehadiran Cepat (Horizontal Scroll) */}
            <div className="w-full mb-8">
                <h3 className="text-[13px] font-bold text-[#0F172A] uppercase tracking-wider mb-4 px-6">Ringkasan Bulan Ini</h3>
                <div className="flex gap-3 overflow-x-auto pb-4 hide-scrollbar px-6 w-full snap-x">
                    <div className="min-w-[124px] bg-white p-4 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-[#E5E7EB] shrink-0 snap-start">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Tingkat Hadir</span>
                        <div className="text-2xl font-bold text-[#0F172A]">96<span className="text-sm font-medium text-slate-400 ml-0.5">%</span></div>
                    </div>
                    <div className="min-w-[124px] bg-white p-4 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-[#E5E7EB] shrink-0 snap-start">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Terlambat</span>
                        <div className="text-2xl font-bold text-[#DC2626]">{monthStats.late}<span className="text-sm font-medium text-slate-400 ml-1">x</span></div>
                    </div>
                    <div className="min-w-[124px] bg-white p-4 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-[#E5E7EB] shrink-0 snap-start">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Jam Kerja</span>
                        <div className="text-2xl font-bold text-[#0F172A]">{monthStats.totalHours}<span className="text-sm font-medium text-slate-400 ml-1">jam</span></div>
                    </div>
                    <div className="min-w-[124px] bg-white p-4 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-[#E5E7EB] shrink-0 snap-start mr-6">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Sisa Cuti</span>
                        <div className="text-2xl font-bold text-[#16A34A]">{remainingLeave}<span className="text-sm font-medium text-slate-400 ml-1">hr</span></div>
                    </div>
                </div>
            </div>

            {/* Garis Waktu Kehadiran */}
            <div className="px-6 mb-8 w-full">
                <div className="flex justify-between items-end mb-4 w-full">
                    <h3 className="text-[13px] font-bold text-[#0F172A] uppercase tracking-wider">Log Hari Ini & Kemarin</h3>
                    <button onClick={() => navigate('/karyawan/riwayat')} className="text-[11px] font-bold text-[#2563EB] tracking-wide">Lihat Semua</button>
                </div>

                <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-[#E5E7EB] p-5 w-full">
                    <div className="space-y-4 relative before:absolute before:inset-y-2 before:left-[11px] before:w-px before:bg-slate-200">
                        {recentActivities.map((activity, idx) => {
                            let displayTitle = activity.content;
                            if (displayTitle && displayTitle.startsWith("**")) {
                                const parts = displayTitle.split('\n\n');
                                displayTitle = parts.length > 1 ? parts[1] : displayTitle.replace(/\*\*(.*?)\*\*/g, '$1');
                            }

                            const dateObj = new Date(activity.date);
                            const isToday = format(dateObj, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

                            return (
                                <div key={idx} className="relative pl-8 group">
                                    <div className="absolute left-[3px] top-1.5 w-[17px] h-[17px] rounded-full bg-white border-[2px] border-[#2563EB]" />
                                    <div className="flex justify-between items-baseline mb-1">
                                        <span className="text-xs font-bold text-[#0F172A]">{isToday ? "Hari Ini" : format(dateObj, 'd MMM yyyy', { locale: idLocale })}</span>
                                        <span className="text-[10px] text-slate-400 font-semibold">{new Date(activity.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div className="bg-[#F8FAFC] p-3 rounded-xl border border-slate-100 mt-1.5">
                                        <span className="block text-[11px] text-[#2563EB] font-bold mb-1 tracking-wider">{activity.obstacles || 'Update'}</span>
                                        <p className="text-xs font-medium text-slate-600 line-clamp-2">{displayTitle}</p>
                                    </div>
                                </div>
                            );
                        })}

                        {recentActivities.length === 0 && (
                            <p className="text-xs text-slate-500 font-medium pl-6 py-2">Belum ada aktivitas yang dicatat.</p>
                        )}
                    </div>
                </div>
            </div>

            <MobileNavigation />

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
