import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    Clock, Key, User, FileText, ChevronRight, LogOut, Calendar,
    CheckCircle2, LogIn, MapPin, History, LayoutDashboard, TrendingUp,
    Timer, Target, Award, Bell, BookOpen, Briefcase, Coffee, RefreshCw,
    Sparkles, ArrowUpRight, Zap, List
} from "lucide-react";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { cn } from "@/lib/utils";
import { format, subDays } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import KaryawanWorkspaceLayout from "@/components/layout/KaryawanWorkspaceLayout";
import { useIsMobile } from "@/hooks/useIsMobile";
import MobileDashboardView from "@/components/MobileDashboardView";

// Mock Chart Data for Productivity
const productivityData = Array.from({ length: 7 }).map((_, i) => ({
    name: format(subDays(new Date(), 6 - i), 'EEE', { locale: idLocale }),
    hours: Math.floor(Math.random() * 4) + 6, // 6 to 9 hours
    tasks: Math.floor(Math.random() * 5) + 2
}));

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

const KaryawanDashboardNew = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { settings } = useSystemSettings();
    const isMobile = useIsMobile();

    const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
    const [monthStats, setMonthStats] = useState<AttendanceStats>({ present: 0, late: 0, absent: 0, totalHours: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [usedLeaveDays, setUsedLeaveDays] = useState(0);
    const [completedTasks, setCompletedTasks] = useState(0);
    const [currentTime, setCurrentTime] = useState(new Date());

    const [journalContent, setJournalContent] = useState("");
    const [selectedProject, setSelectedProject] = useState("");
    const [isSavingJournal, setIsSavingJournal] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    const [location, setLocation] = useState<string>("Mengecek lokasi...");
    const [recentActivities, setRecentActivities] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [projectSuggestions] = useState([
        "T-Absensi Platform Development",
        "Internal Meeting & Coordination",
        "Client Support & Maintenance",
        "HR Operations & Administration",
        "Infrastructure & DevOps"
    ]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
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

    useEffect(() => {
        if (settings.enableLocationTracking && navigator.geolocation) {
            setLocation("Mencari lokasi akurat...");
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
                        const data = await res.json();
                        if (data && data.address) {
                            const addr = data.address;
                            const localArea = addr.residential || addr.suburb || addr.village || addr.neighbourhood || addr.road || "";
                            const city = addr.city || addr.town || addr.county || addr.municipality || "";
                            const locationParts = [localArea, city].filter(Boolean);
                            setLocation(locationParts.length > 0 ? locationParts.join(", ") : `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
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

    const fetchRecentActivities = async () => {
        if (!user) return;
        const { data, error } = await supabase
            .from("work_journals")
            .select("*")
            .eq("user_id", user.id)
            .is("deleted_at", null)
            .order("date", { ascending: false })
            .limit(5);
        if (!error && data) setRecentActivities(data);
    };

    const fetchUsedLeaveDays = async () => {
        if (!user) return;
        const year = new Date().getFullYear();
        const { data } = await supabase
            .from("leave_requests")
            .select("start_date, end_date")
            .eq("user_id", user.id)
            .eq("status", "approved")
            .eq("leave_type", "cuti")
            .gte("start_date", `${year}-01-01`)
            .lte("end_date", `${year}-12-31`);

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
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const { count } = await supabase
            .from("work_journals")
            .select("*", { count: 'exact', head: true })
            .eq("user_id", user.id)
            .gte("date", startOfMonth.toISOString());
        setCompletedTasks(count || 0);
    };

    const fetchTodayAttendance = async () => {
        if (!user) return;
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const { data } = await supabase
            .from("attendance")
            .select("*")
            .eq("user_id", user.id)
            .eq("date", todayStr)
            .maybeSingle();

        if (data) setTodayAttendance(data);
        setIsLoading(false);
    };

    const fetchMonthStats = async () => {
        if (!user) return;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
        const { data } = await supabase
            .from("attendance")
            .select("clock_in, clock_out, status")
            .eq("user_id", user.id)
            .gte("clock_in", startOfMonth)
            .lte("clock_in", endOfMonth);

        if (data) {
            const present = data.filter(d => d.status === "present" || d.status === "late").length;
            const late = data.filter(d => d.status === "late").length;
            let totalMinutes = 0;
            data.forEach(d => {
                if (d.clock_in && d.clock_out) {
                    const diff = Math.abs(new Date(d.clock_out).getTime() - new Date(d.clock_in).getTime());
                    totalMinutes += Math.floor(diff / 1000 / 60);
                }
            });
            setMonthStats({ present, late, absent: 0, totalHours: Math.floor(totalMinutes / 60) });
        }
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
                    content: `**${selectedProject || 'Aktivitas Umum'}**\n\n${journalContent}`,
                    date: new Date().toISOString().split('T')[0],
                    duration: 0,
                    status: 'completed',
                    verification_status: 'submitted',
                    obstacles: selectedProject || 'Umum',
                    mood: '😊',
                    work_result: 'completed'
                })
                .select()
                .single();

            if (error) throw error;
            toast({ title: "Berhasil", description: "Jurnal berhasil disimpan." });
            if (newJournal) setRecentActivities(prev => [newJournal, ...prev].slice(0, 5));
            setJournalContent("");
            setLastSaved(new Date());
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setIsSavingJournal(false);
        }
    };

    const hour = currentTime.getHours();
    const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
    const remainingLeave = Math.max(0, settings.maxLeaveDays - usedLeaveDays);
    const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'Karyawan';

    if (isMobile) {
        return <MobileDashboardView role="karyawan" />;
    }

    // Premium Linear/Notion Style Classes
    const cardBase = "bg-white rounded-2xl border border-slate-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.04)]";

    return (
        <KaryawanWorkspaceLayout>

            {/* Greeting & Insight Box */}
            <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                        {greeting}, {firstName}!
                    </h1>
                    <p className="text-slate-500 text-sm mt-1.5 font-medium">Here's a snapshot of your productivity and schedule today.</p>
                </div>

                {/* Smart Insight Box */}
                <div className="flex items-start gap-3 bg-blue-50/50 border border-blue-100/50 p-4 rounded-2xl w-full md:max-w-md shadow-sm">
                    <div className="mt-0.5 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                        <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Performance Insight</h4>
                        <p className="text-sm text-slate-600 leading-snug">
                            Anda stabil mencapai <strong>{monthStats.totalHours} jam kerja</strong> bulan ini. Jangan lupa untuk beristirahat dengan cukup hari ini.
                        </p>
                    </div>
                </div>
            </div>

            {/* 4 Mini Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className={cn(cardBase, "p-5 flex flex-col gap-3 group hover:border-blue-200 transition-colors cursor-pointer")}>
                    <div className="flex items-center justify-between">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100">
                            <Clock className="w-4 h-4 text-slate-600" />
                        </div>
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">Healthy</span>
                    </div>
                    <div className="mt-2">
                        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Hours Logged</h3>
                        <div className="text-2xl font-extrabold text-slate-900 tracking-tight">{monthStats.totalHours}<span className="text-sm text-slate-400 font-medium ml-1">hrs</span></div>
                    </div>
                </div>

                <div className={cn(cardBase, "p-5 flex flex-col gap-3 group hover:border-purple-200 transition-colors cursor-pointer")}>
                    <div className="flex items-center justify-between">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100">
                            <CheckCircle2 className="w-4 h-4 text-slate-600" />
                        </div>
                        <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">On track</span>
                    </div>
                    <div className="mt-2">
                        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tasks Completed</h3>
                        <div className="text-2xl font-extrabold text-slate-900 tracking-tight">{completedTasks}</div>
                    </div>
                </div>

                <div className={cn(cardBase, "p-5 flex flex-col gap-3 group hover:border-amber-200 transition-colors cursor-pointer")}>
                    <div className="flex items-center justify-between">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100">
                            <Calendar className="w-4 h-4 text-slate-600" />
                        </div>
                    </div>
                    <div className="mt-2">
                        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Time Off Balance</h3>
                        <div className="text-2xl font-extrabold text-slate-900 tracking-tight">{remainingLeave}<span className="text-sm text-slate-400 font-medium ml-1">days</span></div>
                    </div>
                </div>

                <div className={cn(cardBase, "p-5 flex flex-col gap-3 group hover:border-emerald-200 transition-colors cursor-pointer")}>
                    <div className="flex items-center justify-between">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100">
                            <Target className="w-4 h-4 text-slate-600" />
                        </div>
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">Excellent</span>
                    </div>
                    <div className="mt-2">
                        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Attendance Rate</h3>
                        <div className="text-2xl font-extrabold text-slate-900 tracking-tight">96<span className="text-sm text-slate-400 font-medium">%</span></div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Panel: Time & Attendance + Chart */}
                <div className="lg:col-span-1 space-y-6">

                    {/* Compact Attendance Control */}
                    <div className={cn(cardBase, "p-6 relative overflow-hidden bg-slate-900 text-white")}>
                        {/* Abstract Glow */}
                        <div className="absolute -right-20 -top-20 w-48 h-48 bg-blue-500/30 rounded-full blur-[60px]" />
                        <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-purple-500/20 rounded-full blur-[40px]" />

                        <div className="relative z-10 flex items-center justify-between mb-8">
                            <div className="flex items-center gap-2 text-slate-300">
                                <Clock className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase tracking-wider">Live Time</span>
                            </div>
                            <span className="text-[10px] font-medium px-2 py-1 rounded bg-white/10 text-slate-300">
                                {format(currentTime, 'dd MMM', { locale: idLocale })}
                            </span>
                        </div>

                        <div className="relative z-10 text-center mb-8">
                            <h2 className="text-5xl font-extrabold tracking-tighter tabular-nums text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400 font-sans">
                                {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </h2>
                            <p className="text-xs text-slate-400 font-medium mt-2 max-w-[200px] mx-auto truncate" title={location}>
                                <MapPin className="w-3 h-3 inline mr-1 text-blue-400" /> {location}
                            </p>
                        </div>

                        <div className="relative z-10">
                            {todayAttendance && !todayAttendance.clock_out ? (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                                        <span className="block text-[10px] uppercase text-emerald-400 font-bold mb-1">In at</span>
                                        <span className="text-sm font-semibold">{todayAttendance.clock_in.substring(0, 5)}</span>
                                    </div>
                                    <button onClick={() => navigate('/karyawan/absensi')}
                                        className="bg-white hover:bg-slate-100 text-slate-900 rounded-xl font-bold text-sm shadow-lg transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2">
                                        Clock Out
                                    </button>
                                </div>
                            ) : todayAttendance && todayAttendance.clock_out ? (
                                <div className="bg-white/10 border border-white/10 rounded-xl p-4 text-center">
                                    <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                                    <p className="text-sm font-medium">Shift Finished. Great job today!</p>
                                </div>
                            ) : (
                                <button onClick={() => navigate('/karyawan/absensi')}
                                    className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-4 font-bold shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all hover:shadow-[0_0_25px_rgba(37,99,235,0.5)] flex justify-center items-center gap-2">
                                    <LogIn className="w-5 h-5" /> Clock In Now
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Productivity Chart (Recharts) */}
                    <div className={cn(cardBase, "p-6")}>
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="font-bold text-slate-900 text-sm">Productivity Chart</h3>
                                <p className="text-[11px] text-slate-500 font-medium">Last 7 days active hours</p>
                            </div>
                            <div className="p-1.5 bg-slate-50 rounded-md border border-slate-100">
                                <TrendingUp className="w-4 h-4 text-slate-400" />
                            </div>
                        </div>

                        <div className="h-[180px] w-full mt-2 -ml-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={productivityData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                                    />
                                    <Area type="monotone" dataKey="hours" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorHours)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                </div>

                {/* Middle & Right: Journal & Timeline */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Premium Journal Editor */}
                    <div className={cn(cardBase, "p-6")}>
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2 text-slate-800">
                                <FileText className="w-5 h-5" />
                                <h3 className="font-bold">Log Your Work</h3>
                            </div>
                            {lastSaved && <span className="text-[10px] text-slate-400 font-medium">Saved: {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                        </div>

                        <div className="space-y-4">
                            <div className="relative group">
                                <Input
                                    className="w-full text-sm font-semibold h-12 bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-slate-200/50 shadow-none rounded-xl"
                                    placeholder="Project / Task Name"
                                    value={selectedProject}
                                    onChange={(e) => {
                                        setSelectedProject(e.target.value);
                                        setShowSuggestions(true);
                                    }}
                                    onFocus={() => setShowSuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                />
                                {showSuggestions && (
                                    <div className="absolute z-20 top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden text-sm">
                                        {projectSuggestions.filter(p => p.toLowerCase().includes(selectedProject.toLowerCase())).map((project, idx) => (
                                            <button
                                                key={idx}
                                                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-slate-700 font-medium transition-colors border-b border-slate-50 last:border-0"
                                                onClick={() => { setSelectedProject(project); setShowSuggestions(false); }}
                                            >
                                                {project}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <textarea
                                    className="w-full min-h-[120px] p-4 bg-slate-50 border border-slate-200 rounded-xl resize-none text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200/50 transition-all font-medium text-slate-700"
                                    placeholder="What did you achieve today? Mention challenges and progress..."
                                    value={journalContent}
                                    onChange={(e) => setJournalContent(e.target.value)}
                                />
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <div className="flex items-center gap-3">
                                    <button className="text-slate-400 hover:text-slate-700 transition-colors"><List className="w-4 h-4" /></button>
                                    <button className="text-slate-400 hover:text-slate-700 transition-colors"><Briefcase className="w-4 h-4" /></button>
                                </div>
                                <Button
                                    onClick={handleSaveJournal}
                                    disabled={isSavingJournal || !journalContent}
                                    className="rounded-xl font-bold px-6 bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
                                >
                                    {isSavingJournal ? "Saving..." : "Save Log"}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Recent Timeline */}
                    <div className={cn(cardBase, "p-6")}>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-slate-900 text-sm">Recent Activity</h3>
                            <Link to="/karyawan/jurnal" className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
                                View all <ArrowUpRight className="w-3 h-3" />
                            </Link>
                        </div>

                        <div className="space-y-6 relative before:absolute before:inset-y-2 before:left-[11px] before:w-px before:bg-slate-200">
                            {recentActivities.length > 0 ? (
                                recentActivities.map((activity, idx) => {
                                    let displayTitle = activity.content;
                                    if (displayTitle && displayTitle.startsWith("**")) {
                                        const parts = displayTitle.split('\n\n');
                                        displayTitle = parts.length > 1 ? parts[1] : displayTitle.replace(/\*\*(.*?)\*\*/g, '$1');
                                    }

                                    return (
                                        <div key={idx} className="relative pl-8 group cursor-pointer hover:bg-slate-50 rounded-xl -ml-2 p-2 transition-colors">
                                            <div className="absolute left-[3px] top-3.5 w-[17px] h-[17px] rounded-full bg-white border-2 border-slate-300 group-hover:border-blue-500 transition-colors flex items-center justify-center">
                                                <div className="w-1.5 h-1.5 bg-slate-300 group-hover:bg-blue-500 rounded-full transition-colors" />
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-baseline justify-between">
                                                    <span className="text-xs font-bold text-slate-800">{activity.obstacles || 'Update'}</span>
                                                    <span className="text-[10px] text-slate-400 font-semibold">{new Date(activity.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <p className="text-[13px] text-slate-500 line-clamp-2 mt-1 font-medium">{displayTitle}</p>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="pl-6 text-sm text-slate-400 font-medium">No activity recorded today. Begin working to populate timeline.</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

        </KaryawanWorkspaceLayout>
    );
};

export default KaryawanDashboardNew;
