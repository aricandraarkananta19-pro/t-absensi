import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
    Users, Clock, Key, Settings, ChevronRight, LogOut, LayoutDashboard,
    BarChart3, FileText, Calendar, Building2, Shield, TrendingUp, TrendingDown,
    CheckCircle2, AlertCircle, UserCheck, UserX, RefreshCw,
    Bell, MoreVertical, ArrowUpRight, Briefcase, FolderOpen, Database,
    Timer, Zap, Activity, CalendarClock, BookOpen
} from "lucide-react";
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from "recharts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ADMIN_MENU_SECTIONS } from "@/config/menu";
import logoImage from "@/assets/logo.png";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import EnterpriseLayout from "@/components/layout/EnterpriseLayout";
import StatCard from "@/components/ui/stat-card";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { ABSENSI_WAJIB_ROLE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { getJakartaDate, getJakartaStartOfDayISO, getJakartaEndOfDayISO } from "@/lib/dateUtils";
import {
    useEmployeeIds,
    useDashboardStats,
    useLiveStats,
    useRealTimeMonitoring,
    useMonthlyTrend,
    useDepartmentDistribution,
    useRecentJournals
} from "@/hooks/useDashboardData";

// Helper for Avatar Colors
const getAvatarColor = (name: string) => {
    const colors = [
        "bg-red-100 text-red-600",
        "bg-blue-100 text-blue-600",
        "bg-green-100 text-green-600",
        "bg-amber-100 text-amber-600",
        "bg-purple-100 text-purple-600",
        "bg-pink-100 text-pink-600",
        "bg-indigo-100 text-indigo-600",
        "bg-teal-100 text-teal-600"
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

// Helper for Department Badge Colors
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

// Helper to render bold markdown
const renderJournalContent = (content: string) => {
    if (!content) return "";
    // Split by **bold**
    const parts = content.split(/(\*\*.*?\*\*)/g);
    return (
        <span>
            {parts.map((part, index) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={index} className="font-bold text-slate-800">{part.slice(2, -2)}</strong>;
                }
                return <span key={index}>{part}</span>;
            })}
        </span>
    );
};

const AUTO_REFRESH_INTERVAL = 60000;

// Talenta Brand Colors
const BRAND_COLORS = {
    blue: "#1A5BA8",
    lightBlue: "#00A0E3",
    green: "#7DC242",
};

// Chart colors - Brand themed
const CHART_COLORS = {
    primary: BRAND_COLORS.blue,
    success: BRAND_COLORS.green,
    warning: "#F59E0B",
    danger: "#EF4444",
    lightBlue: BRAND_COLORS.lightBlue,
};

interface WeeklyData {
    day: string;
    hadir: number;
    terlambat: number;
    tidakHadir: number;
}

interface MonthlyData {
    week: string;
    hadir: number;
    terlambat: number;
}

// Check if current time is within working hours (Jakarta Time)
const isWithinWorkingHours = (clockInStart: string, clockOutEnd: string) => {
    const now = getJakartaDate();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = clockInStart.split(":").map(Number);
    const [endHour, endMin] = clockOutEnd.split(":").map(Number);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    return currentTime >= startTime && currentTime <= endTime;
};

const AdminDashboardNew = () => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const { settings, isLoading: settingsLoading } = useSystemSettings();

    // 2. MAIN ACTIVE DATE STATE (Today Jakarta)
    const [activeDate, setActiveDate] = useState(getJakartaDate());

    // Derived Dates
    const yesterdayDate = new Date(activeDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);

    // Display Strings
    const activeDateDisplay = activeDate.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    });

    // 3. REACT QUERY HOOKS
    // Fetch employee IDs first
    const { data: karyawanUserIds } = useEmployeeIds();

    // Fetch all other data using the hooks
    const { data: dashboardStats, isLoading: isLoadingStats } = useDashboardStats(karyawanUserIds);
    const { data: liveStatsQuery, isLoading: isLoadingLive } = useLiveStats(karyawanUserIds);
    const { data: realTimeEmployees, isLoading: isLoadingRealTime } = useRealTimeMonitoring(karyawanUserIds);
    const { data: monthlyTrend, isLoading: isLoadingTrend } = useMonthlyTrend(karyawanUserIds);
    const { data: deptDistribution, isLoading: isLoadingDept } = useDepartmentDistribution(karyawanUserIds);
    const { data: journalsData, isLoading: isLoadingJournals } = useRecentJournals(karyawanUserIds);

    const queryClient = useQueryClient();

    // 4. REAL-TIME SUBSCRIPTION
    useEffect(() => {
        const channel = supabase
            .channel('attendance-dashboard-realtime')
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen for INSERT and UPDATE (clock-out)
                    schema: 'public',
                    table: 'attendance'
                },
                (payload) => {
                    // Invalidate all dashboard queries to force immediate refresh
                    queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
                    queryClient.invalidateQueries({ queryKey: ["liveStats"] });
                    queryClient.invalidateQueries({ queryKey: ["realTimeMonitoring"] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    const isLoading = isLoadingStats || isLoadingLive || isLoadingRealTime || isLoadingTrend || isLoadingDept || isLoadingJournals || settingsLoading;
    const hasDataForToday = true;
    const lastUpdated = new Date();

    // Map hook data to component state shape
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

    // Calculate monthly rate from trend data
    const currentMonthTrend = monthlyTrend && monthlyTrend.length > 0 ? monthlyTrend[monthlyTrend.length - 1] : null;
    if (currentMonthTrend) {
        stats.attendanceRate = currentMonthTrend.attendanceRate;
        stats.attendanceThisMonth = currentMonthTrend.total;
    }

    const liveStats = {
        clockedInToday: liveStatsQuery?.clockedInToday || 0,
        lateToday: liveStatsQuery?.lateToday || 0,
        lastClockIn: liveStatsQuery?.lastClockIn || null,
    };

    // 1. In recentAttendance mapping
    const recentAttendance = realTimeEmployees?.map(emp => ({
        id: emp.id,
        user_id: emp.user_id,
        full_name: emp.full_name,
        clock_in: emp.clock_in,
        status: emp.status,
        shift: emp.shift,
        department: emp.department // Add this line
    })) || [];



    // Map journals to expected format
    const pendingJournalsList = journalsData?.journals.map(j => ({
        id: j.id,
        user_id: j.user_id,
        full_name: j.full_name,
        title: j.content,
        created_at: j.created_at,
        status: j.status,
        avatar_url: j.avatar_url,
        department: j.department,
        duration: j.duration
    })) || [];

    // Map monthly trend to chart format
    const weeklyData: WeeklyData[] = monthlyTrend?.map(m => ({
        day: m.month,
        hadir: m.attendanceRate,
        terlambat: m.late,
        tidakHadir: Math.max(0, 100 - m.attendanceRate)
    })) || [];

    // Map department data
    const departmentData = deptDistribution?.map(d => ({
        name: d.name,
        value: d.count,
        color: d.color
    })) || [];

    // Menu sections for sidebar
    const menuSections = ADMIN_MENU_SECTIONS;

    // Add pending leave badge to menu items
    const menuWithBadges = menuSections.map(section => ({
        ...section,
        items: section.items.map(item => ({
            ...item,
            badge: item.title === "Laporan" && stats.pendingLeave > 0 ? stats.pendingLeave : undefined,
        })),
    }));

    // Auto-refresh using React Query managed internally by hooks, but we keep date check
    useEffect(() => {
        const checkDateChange = () => {
            const currentJakarta = getJakartaDate();
            if (
                currentJakarta.getDate() !== activeDate.getDate() ||
                currentJakarta.getMonth() !== activeDate.getMonth() ||
                currentJakarta.getFullYear() !== activeDate.getFullYear()
            ) {
                setActiveDate(currentJakarta);
            }
        };
        // Interval if needed, but simple re-render check is often enough if component stays mounted
        const interval = setInterval(checkDateChange, AUTO_REFRESH_INTERVAL);
        return () => clearInterval(interval);
    }, [activeDate]);


    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "present":
                return <Badge className="border-0 text-xs font-medium hover:opacity-90" style={{ backgroundColor: `${BRAND_COLORS.green}15`, color: BRAND_COLORS.green }}>Hadir</Badge>;
            case "late":
                return <Badge className="bg-amber-50 text-amber-600 border-0 text-xs font-medium hover:bg-amber-100">Terlambat</Badge>;
            case "absent":
                return <Badge className="bg-red-50 text-red-600 border-0 text-xs font-medium hover:bg-red-100">Tidak Hadir</Badge>;
            default:
                return <Badge variant="secondary" className="text-xs">{status}</Badge>;
        }
    };

    const getInitials = (name: string) => {
        return name.split(" ").map(n => n.charAt(0)).slice(0, 2).join("").toUpperCase();
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm">
                    <p className="font-semibold text-slate-900 mb-1">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        <p key={index} style={{ color: entry.color }}>
                            {entry.name}: {entry.value}%
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    // Check if within working hours
    const workingHoursActive = !settingsLoading && isWithinWorkingHours(settings.clockInStart, settings.clockOutEnd);

    return (
        <EnterpriseLayout
            title="Dashboard"
            subtitle={`Rekap Kehadiran: ${activeDateDisplay}`}
            menuSections={menuWithBadges}
            roleLabel="Administrator"
            showRefresh={false}
            showExport={false}
            onRefresh={() => { /* Handled by React Query auto-refresh */ }}
            refreshInterval={60}
        >
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out space-y-6">
                {/* KPI Summary Cards - Fixed 4 Cols */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <StatCard
                        title="Total Karyawan"
                        value={stats.totalEmployees}
                        unit="Orang"
                        trend={{
                            value: `+${stats.newEmployeesThisMonth}`,
                            direction: "up",
                        }}
                        subtitle="Aktif bekerja"
                        icon={Users}
                        color="primary"
                        isLoading={isLoading}
                    />
                    <StatCard
                        title="Hadir Hari Ini"
                        value={stats.presentToday}
                        unit="Orang"
                        trend={{
                            value: stats.totalEmployees > 0 ? `${Math.round((stats.presentToday / stats.totalEmployees) * 100)}%` : "0%",
                            direction: "up",
                        }}
                        subtitle={`Dari ${stats.totalEmployees} karyawan`}
                        icon={UserCheck}
                        color="success"
                        isLoading={isLoading}
                    />
                    <StatCard
                        title="Terlambat"
                        value={stats.lateToday}
                        unit="Orang"
                        trend={{
                            value: "High Alert",
                            direction: "down",
                        }}
                        subtitle="Butuh perhatian"
                        icon={Clock}
                        color="danger" // Changed to danger for visibility
                        isLoading={isLoading}
                    />
                    <StatCard
                        title="Jurnal Pending"
                        value={pendingJournalsList.length} // Use actual list length or count
                        unit="Laporan"
                        trend={{
                            value: `${stats.pendingLeave} Cuti`, // Show pending leave context too
                            direction: "up",
                        }}
                        subtitle="Menunggu review"
                        icon={BookOpen}
                        color="warning"
                        isLoading={isLoading}
                    />
                </div>

                {/* Main Content Grid: Monitoring & Pending Journals */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
                    {/* Left: Real-time Monitoring Table */}
                    <Card className="xl:col-span-2 border-slate-200 shadow-sm bg-white overflow-hidden">
                        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                                    <Activity className="h-4 w-4 text-blue-600" />
                                    Real-time Monitoring
                                </CardTitle>
                                <CardDescription className="text-sm">Pantauan absensi hari ini ({activeDateDisplay})</CardDescription>
                            </div>
                            <Button variant="ghost" size="sm" className="h-8 text-xs" asChild>
                                <Link to="/admin/absensi">Lihat Semua</Link>
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead className="w-[40%]">Karyawan</TableHead>
                                        <TableHead>Jam Masuk</TableHead>
                                        <TableHead>Shift</TableHead>
                                        <TableHead className="text-right">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {recentAttendance.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center text-slate-500">
                                                Belum ada data absensi hari ini.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        recentAttendance.map((record) => (
                                            <TableRow key={record.id} className="hover:bg-slate-50/50">
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600">
                                                            {getInitials(record.full_name)}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-medium text-slate-900 line-clamp-1">{record.full_name}</div>
                                                            <div className="flex items-center gap-1 mt-0.5">
                                                                {record.department ? (
                                                                    <span className={cn(
                                                                        "text-[10px] px-1.5 py-0.5 rounded-full font-medium border",
                                                                        getDeptBadgeColor(record.department)
                                                                    )}>
                                                                        {record.department}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[10px] text-slate-400 italic"> - </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {record.clock_in ? formatTime(record.clock_in) : "-"}
                                                </TableCell>
                                                <TableCell>{record.shift}</TableCell>
                                                <TableCell className="text-right">
                                                    {getStatusBadge(record.status)}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card >

                    {/* Right: Pending Journals List */}
                    <Card className="border-slate-200 shadow-sm bg-white flex flex-col h-full">
                        <CardHeader className="pb-3 border-b border-slate-100">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                                    <Briefcase className="h-4 w-4 text-amber-600" />
                                    Jurnal Terbaru
                                </CardTitle>
                                <Button variant="ghost" size="sm" className="h-6 text-[10px]" asChild>
                                    <Link to="/admin/jurnal">Lihat Semua</Link>
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 p-0 overflow-y-auto max-h-[400px]">
                            {pendingJournalsList.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-48 text-center p-4">
                                    <CheckCircle2 className="h-10 w-10 text-green-500 mb-2 opacity-20" />
                                    <p className="text-sm font-medium text-slate-900">Belum ada jurnal</p>
                                    <p className="text-xs text-slate-500">Data jurnal hari ini kosong.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-50">
                                    {pendingJournalsList.map((journal) => (
                                        <div key={journal.id} className="p-4 hover:bg-slate-50/80 transition-all group">
                                            <div className="flex gap-3">
                                                {/* Avatar */}
                                                <Avatar className="h-10 w-10 border border-slate-100">
                                                    <AvatarImage src={journal.avatar_url || ""} alt={journal.full_name} className="object-cover" />
                                                    <AvatarFallback className={cn("text-xs font-bold", getAvatarColor(journal.full_name))}>
                                                        {getInitials(journal.full_name)}
                                                    </AvatarFallback>
                                                </Avatar>

                                                <div className="flex-1 min-w-0">
                                                    {/* Header: Name, Dept, Date */}
                                                    <div className="flex items-start justify-between mb-1">
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-sm font-bold text-slate-800 line-clamp-1">
                                                                    {journal.full_name}
                                                                </p>
                                                                {journal.department && (
                                                                    <span className={cn(
                                                                        "text-[9px] px-1.5 py-0.5 rounded-full font-semibold border whitespace-nowrap hidden sm:inline-block",
                                                                        getDeptBadgeColor(journal.department)
                                                                    )}>
                                                                        {journal.department}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {/* Time Ago */}
                                                            <span className="text-[10px] text-slate-400 mt-0.5">
                                                                {new Date(journal.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} • {new Date(journal.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                                            </span>
                                                        </div>
                                                        {/* Status Badge - Compact */}
                                                        <div>
                                                            {journal.status === 'approved' && <Badge variant="outline" className="text-[10px] px-2 py-0 border-transparent text-green-700 bg-green-50/50">Disetujui</Badge>}
                                                            {journal.status === 'rejected' && <Badge variant="outline" className="text-[10px] px-2 py-0 border-transparent text-red-700 bg-red-50/50">Ditolak</Badge>}
                                                            {(journal.status === 'submitted' || journal.status === 'pending') && <Badge variant="outline" className="text-[10px] px-2 py-0 border-transparent text-amber-700 bg-amber-50/50">Menunggu</Badge>}
                                                        </div>
                                                    </div>

                                                    {/* Content - Markdown parsed + Truncated */}
                                                    <div className="text-xs text-slate-600 mb-2 leading-relaxed line-clamp-2 break-words">
                                                        {renderJournalContent(journal.title)}
                                                    </div>

                                                    {/* Footer: Duration & CTA */}
                                                    <div className="flex items-center justify-between mt-2">
                                                        <div className="flex items-center gap-3">
                                                            {journal.duration !== undefined && journal.duration > 0 && (
                                                                <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100/50 px-2 py-1 rounded-md">
                                                                    <Clock className="w-3 h-3 text-slate-400" />
                                                                    {journal.duration < 60
                                                                        ? `${journal.duration}m`
                                                                        : `${Math.floor(journal.duration / 60)}j ${journal.duration % 60 > 0 ? (journal.duration % 60) + 'm' : ''}`}
                                                                </div>
                                                            )}
                                                        </div>

                                                        <Button size="sm" variant="ghost" className="h-6 text-[10px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 opacity-0 group-hover:opacity-100 transition-opacity" asChild>
                                                            <Link to={`/admin/jurnal?id=${journal.id}`}>Detail &rarr;</Link>
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
                            <Button variant="outline" size="sm" className="w-full text-xs h-8 border-slate-200" asChild>
                                <Link to="/admin/jurnal">Buka Semua Jurnal</Link>
                            </Button>
                        </div>
                    </Card >
                </div >

                {/* Charts Row */}
                < div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6" >
                    {/* Attendance Trend Chart */}
                    < Card className="lg:col-span-2 border-slate-200 shadow-sm bg-white" >
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base font-semibold text-slate-800">Tren Kehadiran</CardTitle>
                                    <CardDescription className="text-sm">Persentase kehadiran 6 bulan terakhir</CardDescription>
                                </div>
                                {/* Export button removed */}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <Skeleton className="h-[240px] w-full" />
                            ) : (
                                <div className="h-[240px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorHadir" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={CHART_COLORS.success} stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor={CHART_COLORS.success} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                            <XAxis
                                                dataKey="day"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#64748B', fontSize: 12 }}
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#64748B', fontSize: 12 }}
                                                domain={[0, 100]}
                                                tickFormatter={(value) => `${value}%`}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Area
                                                type="monotone"
                                                dataKey="hadir"
                                                stroke={CHART_COLORS.success}
                                                strokeWidth={2}
                                                fill="url(#colorHadir)"
                                                name="Kehadiran"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </CardContent>
                    </Card >

                    {/* Department Distribution */}
                    < Card className="border-slate-200 shadow-sm bg-white" >
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base font-semibold text-slate-800">Distribusi Departemen</CardTitle>
                            <CardDescription className="text-sm">Jumlah karyawan per departemen</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <Skeleton className="h-[240px] w-full" />
                            ) : departmentData.length > 0 ? (
                                <div className="h-[240px] flex items-center justify-center">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={departmentData}
                                                cx="50%"
                                                cy="45%"
                                                innerRadius={50}
                                                outerRadius={80}
                                                paddingAngle={2}
                                                dataKey="value"
                                            >
                                                {departmentData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                content={({ active, payload }: any) => {
                                                    if (active && payload && payload.length) {
                                                        const { name, value, color } = payload[0].payload;
                                                        return (
                                                            <div className="bg-white p-2 border border-slate-200 shadow-lg rounded-lg text-xs">
                                                                <div className="font-semibold text-slate-800 mb-1">{name}</div>
                                                                <div style={{ color }}>{value} Orang</div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Legend
                                                verticalAlign="bottom"
                                                height={36}
                                                iconType="circle"
                                                layout="horizontal"
                                                align="center"
                                                formatter={(value) => <span className="text-[10px] text-slate-500">{value}</span>}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-[240px] flex items-center justify-center text-slate-400 text-sm">
                                    Belum ada data departemen
                                </div>
                            )}
                        </CardContent>
                    </Card >
                </div >
            </div >
        </EnterpriseLayout >
    );
};

export default AdminDashboardNew;
