import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
    Users, Clock, Settings, ChevronRight, LayoutDashboard,
    BarChart3, FileText, Calendar, Building2, Shield, TrendingUp, TrendingDown,
    CheckCircle2, AlertCircle, UserCheck, UserX, RefreshCw,
    Bell, MoreVertical, ArrowUpRight, Briefcase, FolderOpen, Database,
    Timer, Zap, Activity, CalendarClock, BookOpen, Sparkles, Filter,
    ChevronDown, CheckCircle
} from "lucide-react";
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from "recharts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ADMIN_MENU_SECTIONS } from "@/config/menu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import EnterpriseLayout from "@/components/layout/EnterpriseLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { cn } from "@/lib/utils";
import { getJakartaDate } from "@/lib/dateUtils";
import {
    useEmployeeIds,
    useDashboardStats,
    useLiveStats,
    useRealTimeMonitoring,
    useMonthlyTrend,
    useDepartmentDistribution,
    useRecentJournals
} from "@/hooks/useDashboardData";
import { useIsMobile } from "@/hooks/useIsMobile";
import MobileDashboardView from "@/components/MobileDashboardView";

// Helper for Avatar Colors
const getAvatarColor = (name: string) => {
    const colors = [
        "bg-red-100 text-red-600", "bg-blue-100 text-blue-600",
        "bg-green-100 text-green-600", "bg-amber-100 text-amber-600",
        "bg-purple-100 text-purple-600", "bg-pink-100 text-pink-600",
        "bg-indigo-100 text-indigo-600", "bg-teal-100 text-teal-600"
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

const getDeptBadgeColor = (dept: string) => {
    if (!dept) return "bg-slate-100 text-slate-600 border-slate-200";
    const colors = [
        "bg-blue-50 text-blue-700 border-blue-200",
        "bg-purple-50 text-purple-700 border-purple-200",
        "bg-green-50 text-green-700 border-green-200",
        "bg-amber-50 text-amber-700 border-amber-200",
        "bg-pink-50 text-pink-700 border-pink-200"
    ];
    let hash = 0;
    for (let i = 0; i < dept.length; i++) {
        hash = dept.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

const CHART_COLORS = {
    primary: "#1A5BA8",
    success: "#7DC242",
    warning: "#F59E0B",
    danger: "#EF4444",
    lightBlue: "#00A0E3",
};

interface WeeklyData { day: string; hadir: number; terlambat: number; tidakHadir: number; }

const isWithinWorkingHours = (clockInStart: string, clockOutEnd: string) => {
    const now = getJakartaDate();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [startHour, startMin] = clockInStart.split(":").map(Number);
    const [endHour, endMin] = clockOutEnd.split(":").map(Number);
    return currentTime >= (startHour * 60 + startMin) && currentTime <= (endHour * 60 + endMin);
};

// Calculate Delay Duration
const getDelayDuration = (clockIn: string | null, targetClockIn: string) => {
    if (!clockIn) return null;
    const [tH, tM] = targetClockIn.split(':').map(Number);
    const target = new Date(); target.setHours(tH, tM, 0, 0);
    const actual = new Date(clockIn);

    // Check if same day, if so, calculate duration diff
    const diffMs = actual.getTime() - target.getTime();
    if (diffMs > 0) {
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 60) return `${diffMins} mnt`;
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        return `${hours}j ${mins}m`;
    }
    return null;
};

const AdminDashboardNew = () => {
    const { user } = useAuth();
    const { settings, isLoading: settingsLoading } = useSystemSettings();
    const [activeDate, setActiveDate] = useState(getJakartaDate());
    const isMobile = useIsMobile();

    // Filters
    const [attendanceFilter, setAttendanceFilter] = useState<'all' | 'present' | 'late' | 'absent'>('all');
    const [journalFilter, setJournalFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');

    const activeDateDisplay = activeDate.toLocaleDateString("id-ID", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
    });

    const { data: karyawanUserIds } = useEmployeeIds();
    const { data: dashboardStats, isLoading: isLoadingStats } = useDashboardStats(karyawanUserIds);
    const { data: liveStatsQuery, isLoading: isLoadingLive } = useLiveStats(karyawanUserIds);
    const { data: realTimeEmployees, isLoading: isLoadingRealTime } = useRealTimeMonitoring(karyawanUserIds);
    const { data: monthlyTrend, isLoading: isLoadingTrend } = useMonthlyTrend(karyawanUserIds);
    const { data: deptDistribution, isLoading: isLoadingDept } = useDepartmentDistribution(karyawanUserIds);
    const { data: journalsData, isLoading: isLoadingJournals } = useRecentJournals(karyawanUserIds);
    const queryClient = useQueryClient();

    useEffect(() => {
        const channel = supabase.channel('attendance-dashboard-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
                    queryClient.invalidateQueries({ queryKey: ["liveStats"] });
                    queryClient.invalidateQueries({ queryKey: ["realTimeMonitoring"] });
                }
            ).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [queryClient]);

    const isLoading = isLoadingStats || isLoadingLive || isLoadingRealTime || isLoadingTrend || isLoadingDept || isLoadingJournals || settingsLoading;

    const stats = {
        totalEmployees: dashboardStats?.totalEmployees || 0,
        presentToday: dashboardStats?.presentToday || 0,
        lateToday: dashboardStats?.lateToday || 0,
        absentToday: dashboardStats?.absentToday || 0,
        departments: dashboardStats?.departments || 0,
        pendingLeave: dashboardStats?.pendingLeave || 0,
        approvedLeaveThisMonth: dashboardStats?.approvedLeaveThisMonth || 0,
        attendanceThisMonth: 0,
        attendanceRate: 0,
        newEmployeesThisMonth: dashboardStats?.newEmployeesThisMonth || 0,
    };

    const currentMonthTrend = monthlyTrend && monthlyTrend.length > 0 ? monthlyTrend[monthlyTrend.length - 1] : null;
    if (currentMonthTrend) {
        stats.attendanceRate = currentMonthTrend.attendanceRate;
        stats.attendanceThisMonth = currentMonthTrend.total;
    }

    const recentAttendance = realTimeEmployees?.map(emp => ({
        ...emp,
        delay: emp.status === 'late' ? getDelayDuration(emp.clock_in, settings?.clockInEnd || '08:00') : null
    })) || [];

    // Filtered lists
    const filteredAttendance = useMemo(() => {
        if (attendanceFilter === 'all') return recentAttendance;
        return recentAttendance.filter(r => r.status === attendanceFilter);
    }, [recentAttendance, attendanceFilter]);

    const pendingJournalsList = journalsData?.journals.map(j => ({
        id: j.id, user_id: j.user_id, full_name: j.full_name, title: j.content,
        created_at: j.created_at, status: j.status as 'approved' | 'pending' | 'rejected',
        avatar_url: j.avatar_url, department: j.department, duration: j.duration
    })) || [];

    const filteredJournals = useMemo(() => {
        if (journalFilter === 'all') return pendingJournalsList;
        return pendingJournalsList.filter(j => j.status === journalFilter);
    }, [pendingJournalsList, journalFilter]);

    const weeklyData: WeeklyData[] = monthlyTrend?.map(m => ({
        day: m.month, hadir: m.attendanceRate, terlambat: m.late, tidakHadir: Math.max(0, 100 - m.attendanceRate)
    })) || [];

    const departmentData = deptDistribution?.map(d => ({
        name: d.name, value: d.count, color: d.color
    })) || [];

    const menuWithBadges = ADMIN_MENU_SECTIONS.map(section => ({
        ...section,
        items: section.items.map(item => ({
            ...item,
            badge: item.title === "Laporan" && stats.pendingLeave > 0 ? stats.pendingLeave : undefined,
        })),
    }));

    const formatTime = (dateString: string) => new Date(dateString).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

    const getStatusBadge = (status: string) => {
        if (status === "present") return (
            <div className="flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-emerald-500 animate-pulse" /> Hadir
            </div>
        );
        if (status === "late") return (
            <div className="flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-amber-500" /> Terlambat
            </div>
        );
        if (status === "absent") return (
            <div className="flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-red-500" /> Tdk Hadir
            </div>
        );
        return <Badge variant="secondary" className="text-xs rounded-full">{status}</Badge>;
    };

    const getInitials = (name: string) => name.split(" ").map(n => n.charAt(0)).slice(0, 2).join("").toUpperCase();

    // Smart Insights Generation
    const totalClockedIn = stats.presentToday + stats.lateToday;
    const absenteesPercentage = stats.totalEmployees > 0
        ? Math.round(((stats.totalEmployees - totalClockedIn) / stats.totalEmployees) * 100)
        : 0;

    const hasLate = stats.lateToday > 0;
    const pendingReviewCount = pendingJournalsList.filter(j => j.status === 'pending').length;

    if (isMobile) {
        return <MobileDashboardView role="admin" />;
    }

    return (
        <EnterpriseLayout
            title="Overview"
            subtitle={`Kondisi Perusahaan Hari Ini • ${activeDateDisplay}`}
            menuSections={menuWithBadges}
            roleLabel="Super Admin"
            showRefresh={false} showExport={false}
            onRefresh={() => { }} refreshInterval={60}
        >
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out space-y-6 max-w-[1600px] mx-auto pb-10">

                {/* SMART INSIGHT SECTION - Business Insight Today */}
                <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-[20px] p-5 lg:p-6 shadow-lg relative overflow-hidden flex flex-col md:flex-row gap-6 justify-between items-start md:items-center border border-indigo-800/50">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                    <div className="absolute bottom-0 left-20 w-40 h-40 bg-blue-400 opacity-10 rounded-full blur-2xl pointer-events-none" />

                    <div className="relative z-10 flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shrink-0 shadow-inner">
                            <Sparkles className="w-6 h-6 text-blue-200" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2 mb-1">
                                Business Insight Today
                                <Badge className="bg-blue-500/20 text-blue-100 hover:bg-blue-500/20 border-blue-400/30 text-[10px] uppercase font-bold tracking-wider rounded-md px-2 py-0.5">Live</Badge>
                            </h2>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                {/* Insight 1 */}
                                {absenteesPercentage > 50 && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 border border-white/10 rounded-full text-xs font-medium text-white shadow-sm">
                                        <AlertCircle className="w-3.5 h-3.5 text-amber-300" />
                                        {absenteesPercentage}% belum absensi
                                    </span>
                                )}
                                {/* Insight 2 */}
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 border border-white/10 rounded-full text-xs font-medium text-white shadow-sm">
                                    {hasLate ? (
                                        <><Timer className="w-3.5 h-3.5 text-rose-300" /> {stats.lateToday} orang datang terlambat</>
                                    ) : (
                                        <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /> 0 keterlambatan hari ini</>
                                    )}
                                </span>
                                {/* Insight 3 */}
                                {pendingReviewCount > 0 && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 border border-white/10 rounded-full text-xs font-medium text-white shadow-sm">
                                        <BookOpen className="w-3.5 h-3.5 text-blue-200" /> {pendingReviewCount} jurnal butuh review
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="relative z-10 hidden lg:block text-right">
                        <div className="text-sm font-medium text-blue-200 mb-1">Kehadiran Tim</div>
                        <div className="text-3xl font-extrabold text-white tracking-tight leading-none bg-clip-text">
                            {stats.totalEmployees > 0 ? Math.round((totalClockedIn / stats.totalEmployees) * 100) : 0}<span className="text-xl text-blue-200">%</span>
                        </div>
                    </div>
                </div>

                {/* PREMIUM SUMMARY CARDS OVERHAUL */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                    {/* Card 1: Total Karyawan */}
                    <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-slate-200/60 hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.1)] hover:border-blue-200 transition-all duration-300 group flex flex-col relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-50 text-slate-200 group-hover:text-blue-50 transition-colors group-hover:scale-110 duration-500">
                            <Users strokeWidth={1} className="w-16 h-16" />
                        </div>
                        <div className="flex justify-between items-start mb-4 relative z-10">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100/50 shadow-inner group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                                <Users className="w-5 h-5" />
                            </div>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                                <Users className="w-3 h-3" /> Aktif Bekerja
                            </span>
                        </div>
                        <div className="relative z-10 flex-col mb-4">
                            <div className="text-3xl font-black text-slate-800 tracking-tight">{isLoading ? <Skeleton className="h-9 w-16" /> : stats.totalEmployees}</div>
                            <div className="text-sm font-semibold text-slate-500 mt-1">Total Karyawan</div>
                        </div>
                        <div className="mt-auto relative z-10 flex items-center gap-2 pt-4 border-t border-slate-100">
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-xs font-bold text-slate-700">+{stats.newEmployeesThisMonth}</span>
                            <span className="text-xs text-slate-400 font-medium">bergabung bulan ini</span>
                        </div>
                    </div>

                    {/* Card 2: Hadir Hari Ini */}
                    <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-slate-200/60 hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.1)] hover:border-emerald-200 transition-all duration-300 group flex flex-col relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-50 text-slate-200 group-hover:text-emerald-50 transition-colors group-hover:scale-110 duration-500">
                            <UserCheck strokeWidth={1} className="w-16 h-16" />
                        </div>
                        <div className="flex justify-between items-start mb-4 relative z-10">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/50 shadow-inner group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-300">
                                <UserCheck className="w-5 h-5" />
                            </div>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                                {isLoading ? "-" : Math.round((stats.presentToday / Math.max(stats.totalEmployees, 1)) * 100)}% Rate
                            </span>
                        </div>
                        <div className="relative z-10 flex-col mb-4">
                            <div className="text-3xl font-black text-slate-800 tracking-tight flex items-baseline gap-1">
                                {isLoading ? <Skeleton className="h-9 w-16" /> : stats.presentToday} <span className="text-sm font-bold text-slate-400">/ {stats.totalEmployees}</span>
                            </div>
                            <div className="text-sm font-semibold text-slate-500 mt-1">Hadir Hari Ini</div>
                        </div>
                        <div className="mt-auto relative z-10 pt-4 border-t border-slate-100">
                            <Progress value={Math.round((stats.presentToday / Math.max(stats.totalEmployees, 1)) * 100)} className="h-1.5 w-full bg-slate-100 [&>div]:bg-emerald-500" />
                            <div className="flex justify-between items-center mt-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Progress</span>
                                <span className="text-[10px] font-bold text-slate-700">{isLoading ? "-" : stats.totalEmployees - stats.presentToday} belum absen</span>
                            </div>
                        </div>
                    </div>

                    {/* Card 3: Terlambat */}
                    <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-slate-200/60 hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.1)] hover:border-amber-200 transition-all duration-300 group flex flex-col relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-50 text-slate-200 group-hover:text-amber-50 transition-colors group-hover:scale-110 duration-500">
                            <Clock strokeWidth={1} className="w-16 h-16" />
                        </div>
                        <div className="flex justify-between items-start mb-4 relative z-10">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100/50 shadow-inner group-hover:bg-amber-500 group-hover:text-white transition-colors duration-300">
                                <Clock className="w-5 h-5" />
                            </div>
                            {stats.lateToday > 0 && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-1 rounded-lg border border-rose-100 animate-pulse">
                                    <AlertCircle className="w-3 h-3" /> Attention
                                </span>
                            )}
                        </div>
                        <div className="relative z-10 flex-col mb-4">
                            <div className="text-3xl font-black text-slate-800 tracking-tight">{isLoading ? <Skeleton className="h-9 w-16" /> : stats.lateToday}</div>
                            <div className="text-sm font-semibold text-slate-500 mt-1">Karyawan Terlambat</div>
                        </div>
                        <div className="mt-auto relative z-10 pt-4 border-t border-slate-100 flex items-center gap-2">
                            {stats.lateToday === 0 ? (
                                <><CheckCircle className="w-4 h-4 text-emerald-500" /><span className="text-xs font-semibold text-slate-600">Performa waktu sempurna</span></>
                            ) : (
                                <><TrendingDown className="w-4 h-4 text-rose-500" /><span className="text-xs font-semibold text-slate-600">{stats.lateToday} karyawan terlambat hari ini</span></>
                            )}
                        </div>
                    </div>

                    {/* Card 4: Jurnal Pending */}
                    <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-slate-200/60 hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.1)] hover:border-indigo-200 transition-all duration-300 group flex flex-col relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-50 text-slate-200 group-hover:text-indigo-50 transition-colors group-hover:scale-110 duration-500">
                            <BookOpen strokeWidth={1} className="w-16 h-16" />
                        </div>
                        <div className="flex justify-between items-start mb-4 relative z-10">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100/50 shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                                <BookOpen className="w-5 h-5" />
                            </div>
                            <Link to="/admin/jurnal" className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg border border-indigo-100 transition-colors">
                                Review <ChevronRight className="w-3 h-3" />
                            </Link>
                        </div>
                        <div className="relative z-10 flex-col mb-4">
                            <div className="text-3xl font-black text-slate-800 tracking-tight">{isLoading ? <Skeleton className="h-9 w-16" /> : pendingReviewCount}</div>
                            <div className="text-sm font-semibold text-slate-500 mt-1">Jurnal Pending</div>
                        </div>
                        <div className="mt-auto relative z-10 pt-4 border-t border-slate-100">
                            <div className="flex items-center justify-between">
                                <div className="flex -space-x-2">
                                    {(filteredJournals.slice(0, 3) || []).map((j, i) => (
                                        <Avatar key={j.id} className="w-6 h-6 border-2 border-white">
                                            <AvatarImage src={j.avatar_url} />
                                            <AvatarFallback className={cn("text-[8px]", getAvatarColor(j.full_name))}>{getInitials(j.full_name)}</AvatarFallback>
                                        </Avatar>
                                    ))}
                                    {pendingReviewCount > 3 && (
                                        <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-slate-600">
                                            +{pendingReviewCount - 3}
                                        </div>
                                    )}
                                </div>
                                <span className="text-xs font-medium text-slate-500">Menunggu Review</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* CENTRAL CONTENT GRID: Table + Jurnal */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Real-time Monitoring Table */}
                    <div className="xl:col-span-2 flex flex-col">

                        {/* AI Insight Box above table */}
                        {absenteesPercentage > 80 ? (
                            <div className="bg-blue-50/50 border border-blue-100/60 rounded-[16px] p-4 mb-4 flex gap-3 text-sm text-blue-800 shadow-sm items-center">
                                <Sparkles className="w-5 h-5 text-blue-500 shrink-0" />
                                <span className="font-medium">
                                    <strong>Insight:</strong> Sebagian besar karyawan belum absen. Biasanya lonjakan absen terjadi pukul 07:45 - 08:00 WIB.
                                </span>
                            </div>
                        ) : null}

                        <Card className="flex-1 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] border-slate-200/60 bg-white rounded-[20px] overflow-hidden flex flex-col">
                            <CardHeader className="border-b border-slate-100/80 bg-slate-50/30 pb-4 px-6 pt-5">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="space-y-1">
                                        <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                            <Activity className="h-5 w-5 text-blue-600" /> Real-time Monitoring
                                        </CardTitle>
                                        <CardDescription>Live update karyawan hari ini</CardDescription>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {/* Filters */}
                                        <div className="bg-slate-100/70 p-1 rounded-xl flex items-center text-sm font-semibold border border-slate-200/50 shadow-inner">
                                            <button
                                                onClick={() => setAttendanceFilter('all')}
                                                className={cn("px-3 py-1.5 rounded-lg transition-all", attendanceFilter === 'all' ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                                            >Semua</button>
                                            <button
                                                onClick={() => setAttendanceFilter('present')}
                                                className={cn("px-3 py-1.5 rounded-lg transition-all", attendanceFilter === 'present' ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                                            >Hadir</button>
                                            <button
                                                onClick={() => setAttendanceFilter('late')}
                                                className={cn("px-3 py-1.5 rounded-lg transition-all", attendanceFilter === 'late' ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                                            >Telat</button>
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0 overflow-y-auto" style={{ maxHeight: '420px' }}>
                                <Table>
                                    <TableHeader className="bg-white sticky top-0 z-10 shadow-[0_1px_2px_0_rgba(0,0,0,0.03)] border-b border-slate-200/80">
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="w-[45%] text-xs font-bold text-slate-500 uppercase tracking-widest pl-6 h-12">Karyawan</TableHead>
                                            <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-widest text-center h-12">Jam Masuk</TableHead>
                                            <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-widest text-center h-12 hidden md:table-cell">Keterlambatan</TableHead>
                                            <TableHead className="text-right text-xs font-bold text-slate-500 uppercase tracking-widest pr-6 h-12">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoadingRealTime ? (
                                            Array.from({ length: 5 }).map((_, i) => (
                                                <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-12 w-full" /></TableCell></TableRow>
                                            ))
                                        ) : filteredAttendance.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-48 text-center text-slate-500 font-medium">
                                                    <div className="flex flex-col items-center justify-center gap-2">
                                                        <UserX className="w-10 h-10 text-slate-300" />
                                                        <p>Belum ada data dengan status ini.</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredAttendance.map((record) => (
                                                <TableRow key={record.id} className="group hover:bg-slate-50/70 border-b border-slate-100 transition-colors">
                                                    <TableCell className="font-medium pl-6 py-4">
                                                        <div className="flex items-center gap-3 w-max">
                                                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold border shadow-sm transition-transform group-hover:scale-105", getAvatarColor(record.full_name), "border-white")}>
                                                                {getInitials(record.full_name)}
                                                            </div>
                                                            <div>
                                                                <div className="text-sm font-bold text-slate-800 transition-colors">{record.full_name}</div>
                                                                <div className="mt-1">
                                                                    <span className={cn("text-[9px] px-2 py-0.5 rounded-md font-bold uppercase tracking-widest", getDeptBadgeColor(record.department))}>
                                                                        {record.department || 'General'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {record.clock_in ? (
                                                            <div className="inline-flex font-mono text-[13px] font-bold bg-slate-100/80 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200/80">
                                                                {formatTime(record.clock_in)}
                                                            </div>
                                                        ) : <span className="text-slate-300">-</span>}
                                                    </TableCell>
                                                    <TableCell className="text-center font-medium text-slate-600 hidden md:table-cell">
                                                        {record.status === 'late' && record.delay ? (
                                                            <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-md border border-rose-100">
                                                                {record.delay}
                                                            </span>
                                                        ) : <span className="text-slate-300">-</span>}
                                                    </TableCell>
                                                    <TableCell className="text-right pr-6">
                                                        {getStatusBadge(record.status)}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                            <div className="p-3 border-t border-slate-100 bg-slate-50/50 mt-auto">
                                <Button variant="ghost" className="w-full text-sm font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50" asChild>
                                    <Link to="/admin/absensi">Buka Log Kehadiran Lintas Divisi &rarr;</Link>
                                </Button>
                            </div>
                        </Card>
                    </div>

                    {/* Jurnal Activity Feed */}
                    <Card className="shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] border-slate-200/60 bg-white rounded-[20px] flex flex-col h-full xl:max-h-[500px]">
                        <CardHeader className="pb-2 border-b border-slate-100/80 px-5 pt-5">
                            <div className="flex items-center justify-between mb-2">
                                <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                                    <Briefcase className="h-4 w-4 text-indigo-500" /> Jurnal Masuk
                                </CardTitle>
                                <div className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">Live Feed</div>
                            </div>
                            {/* Filter Jurnal */}
                            <div className="flex gap-1.5 mt-2">
                                {['all', 'pending', 'approved'].map(fk => (
                                    <button
                                        key={fk} onClick={() => setJournalFilter(fk as any)}
                                        className={cn("px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-md transition-all",
                                            journalFilter === fk ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50")}
                                    >
                                        {fk}
                                    </button>
                                ))}
                            </div>
                        </CardHeader>

                        <CardContent className="flex-1 p-0 overflow-y-auto">
                            {filteredJournals.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-8 text-center h-full">
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                                        <CheckCircle2 className="h-8 w-8 text-slate-300" />
                                    </div>
                                    <p className="font-bold text-sm text-slate-700">Tidak ada jurnal {journalFilter !== 'all' ? journalFilter : ''}</p>
                                    <p className="text-xs text-slate-400 mt-1">Anda sudah uptodate.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100/80">
                                    {filteredJournals.map((journal) => (
                                        <div key={journal.id} className="p-4 hover:bg-slate-50 transition-colors group relative">
                                            <div className="flex gap-3">
                                                <Avatar className="h-9 w-9 border-2 border-white shadow-sm shrink-0">
                                                    <AvatarImage src={journal.avatar_url || ""} className="object-cover" />
                                                    <AvatarFallback className={cn("text-[10px] font-bold", getAvatarColor(journal.full_name))}>
                                                        {getInitials(journal.full_name)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start mb-0.5">
                                                        <p className="text-sm font-bold text-slate-800 line-clamp-1 group-hover:text-blue-600 transition-colors">{journal.full_name}</p>
                                                        <span className="text-[10px] font-bold text-slate-400 ml-2 shrink-0">
                                                            {new Date(journal.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] font-semibold text-slate-500 mb-1.5">{journal.department || 'Umum'}</p>
                                                    <div className="text-xs text-slate-600 bg-slate-50/80 border border-slate-100 p-2.5 rounded-xl line-clamp-2 leading-relaxed font-medium mb-2 group-hover:bg-white transition-colors group-hover:shadow-sm">
                                                        {journal.title.replace(/\*\*/g, '')}
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        {journal.status === 'pending' && <Badge variant="outline" className="text-[9px] px-2 py-0 border-amber-200 text-amber-700 bg-amber-50 uppercase tracking-widest font-bold">Pending Review</Badge>}
                                                        {journal.status === 'approved' && <Badge variant="outline" className="text-[9px] px-2 py-0 border-emerald-200 text-emerald-700 bg-emerald-50 uppercase tracking-widest font-bold">Approved</Badge>}
                                                        {journal.status === 'rejected' && <Badge variant="outline" className="text-[9px] px-2 py-0 border-rose-200 text-rose-700 bg-rose-50 uppercase tracking-widest font-bold">Rejected</Badge>}

                                                        {journal.status === 'pending' && (
                                                            <Button size="sm" variant="outline" className="h-6 text-[10px] font-bold px-3 opacity-0 group-hover:opacity-100 transition-opacity translate-y-1 group-hover:translate-y-0" asChild>
                                                                <Link to={`/admin/jurnal?action=review&id=${journal.id}`}>Review</Link>
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* BOTTOM CHARTS */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-2 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] border-slate-200/60 bg-white rounded-[20px]">
                        <CardHeader className="pb-0 px-6 pt-6">
                            <CardTitle className="text-base font-bold text-slate-800 tracking-tight">Tren Kinerja Bulanan</CardTitle>
                            <CardDescription className="text-xs font-medium text-slate-500">Persentase kehadiran 6 bulan terakhir</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4 pb-6 px-2">
                            {isLoading ? (
                                <Skeleton className="h-[250px] w-full mx-4" />
                            ) : (
                                <div className="h-[250px] w-full px-2">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={weeklyData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorHadir" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={CHART_COLORS.success} stopOpacity={0.8} />
                                                    <stop offset="95%" stopColor={CHART_COLORS.success} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                                            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 600 }} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 600 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} dx={-10} />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px -5px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                                                itemStyle={{ fontSize: '12px' }}
                                            />
                                            <Area type="monotone" dataKey="hadir" stroke={CHART_COLORS.success} strokeWidth={3} fill="url(#colorHadir)" name="Kehadiran"
                                                activeDot={{ r: 6, strokeWidth: 0, fill: CHART_COLORS.success }}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] border-slate-200/60 bg-white rounded-[20px]">
                        <CardHeader className="pb-0 px-6 pt-6">
                            <CardTitle className="text-base font-bold text-slate-800 tracking-tight">Kekuatan Tim</CardTitle>
                            <CardDescription className="text-xs font-medium text-slate-500">Distribusi per departemen</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4 pb-6 px-4">
                            {isLoading ? (
                                <Skeleton className="h-[220px] w-full" />
                            ) : departmentData.length > 0 ? (
                                <div className="h-[220px] flex items-center justify-center">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={departmentData} cx="50%" cy="45%" innerRadius={60} outerRadius={85} paddingAngle={3} dataKey="value" stroke="none">
                                                {departmentData.map((e, index) => <Cell key={index} fill={e.color || CHART_COLORS.primary} />)}
                                            </Pie>
                                            <Tooltip
                                                formatter={(value: any) => [`${value} Orang`, 'Jumlah']}
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px -5px rgba(0,0,0,0.1)', fontWeight: 'bold', fontSize: '12px' }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-[220px] flex items-center justify-center font-medium text-slate-400 text-sm">Belum ada data</div>
                            )}
                            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2">
                                {departmentData.slice(0, 4).map((d, i) => (
                                    <div key={i} className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }}></div>
                                        <span className="text-[11px] font-bold text-slate-600">{d.name}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

            </div>
        </EnterpriseLayout>
    );
};

export default AdminDashboardNew;
