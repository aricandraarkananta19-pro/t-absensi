import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    Users, Clock, LogOut, LayoutDashboard, BarChart3, Calendar, Building2,
    FileCheck, TrendingUp, TrendingDown, UserCheck, UserX, AlertCircle,
    ChevronRight, MoreVertical, Download, Eye, Activity, Timer, CalendarClock, BookOpen
} from "lucide-react";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell
} from "recharts";
import logoImage from "@/assets/logo.png";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import EnterpriseLayout from "@/components/layout/EnterpriseLayout";
import StatCard from "@/components/ui/stat-card";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { ABSENSI_WAJIB_ROLE } from "@/lib/constants";
import { cn } from "@/lib/utils";

// Talenta Brand Colors
const BRAND_COLORS = {
    blue: "#1A5BA8",
    lightBlue: "#00A0E3",
    green: "#7DC242",
};

// Chart colors
const CHART_COLORS = {
    primary: BRAND_COLORS.blue,
    success: BRAND_COLORS.green,
    warning: "#F59E0B",
    danger: "#EF4444",
    lightBlue: BRAND_COLORS.lightBlue,
};

// Helper function to get yesterday's date for automated report
const getYesterdayDate = () => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date;
};

// Check if current time is within working hours
const isWithinWorkingHours = (clockInStart: string, clockOutEnd: string) => {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = clockInStart.split(":").map(Number);
    const [endHour, endMin] = clockOutEnd.split(":").map(Number);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    return currentTime >= startTime && currentTime <= endTime;
};

const ManagerDashboardNew = () => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const { settings, isLoading: settingsLoading } = useSystemSettings();

    // Use date from yesterday for attendance recap (automated daily report)
    const reportDate = getYesterdayDate();
    const reportDateDisplay = reportDate.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    });

    const [stats, setStats] = useState({
        totalEmployees: 0,
        presentToday: 0,
        lateToday: 0,
        absentToday: 0,
        departments: 0,
        pendingLeave: 0,
        onTimeRate: 0,
    });

    // Today's live stats
    const [liveStats, setLiveStats] = useState({
        clockedInToday: 0,
        lateToday: 0,
        lastClockIn: null as string | null,
    });

    const [recentAttendance, setRecentAttendance] = useState<Array<{
        id: string;
        full_name: string;
        department?: string;
        clock_in: string;
        status: string;
    }>>([]);
    const [weeklyData, setWeeklyData] = useState<Array<{ day: string; hadir: number; terlambat: number }>>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [hasDataForReportDate, setHasDataForReportDate] = useState(true);

    // Menu sections for sidebar
    const menuSections = [
        {
            title: "Menu Utama",
            items: [
                { icon: LayoutDashboard, title: "Dashboard", href: "/manager" },
                { icon: Clock, title: "Rekap Absensi", href: "/manager/absensi" },
                { icon: BookOpen, title: "Jurnal Tim", href: "/manager/jurnal" },
                { icon: BarChart3, title: "Laporan", href: "/manager/laporan" },
                { icon: FileCheck, title: "Kelola Cuti", href: "/manager/cuti", badge: stats.pendingLeave },
            ],
        },
    ];

    const fetchAllData = useCallback(async (showLoading = true) => {
        if (showLoading) setIsLoading(true);
        try {
            const { data: karyawanRoles } = await supabase
                .from("user_roles")
                .select("user_id")
                .in("role", ABSENSI_WAJIB_ROLE);
            const karyawanUserIds = new Set(karyawanRoles?.map(r => r.user_id) || []);

            await Promise.all([
                fetchStats(karyawanUserIds),
                fetchLiveStats(karyawanUserIds),
                fetchRecentAttendance(karyawanUserIds),
                fetchWeeklyTrend(karyawanUserIds),
            ]);

            setLastUpdated(new Date());
        } finally {
            setIsLoading(false);
        }
    }, [settings.attendanceStartDate]);

    useEffect(() => {
        if (!settingsLoading) {
            fetchAllData(true);
        }

        const attendanceChannel = supabase
            .channel("manager-dashboard-attendance-changes")
            .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, () => fetchAllData(false))
            .subscribe();

        const profilesChannel = supabase
            .channel("manager-dashboard-profiles-changes")
            .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => fetchAllData(false))
            .subscribe();

        const leaveChannel = supabase
            .channel("manager-dashboard-leave-changes")
            .on("postgres_changes", { event: "*", schema: "public", table: "leave_requests" }, () => fetchAllData(false))
            .subscribe();

        return () => {
            supabase.removeChannel(attendanceChannel);
            supabase.removeChannel(profilesChannel);
            supabase.removeChannel(leaveChannel);
        };
    }, [settingsLoading, fetchAllData]);

    // Fetch today's live stats
    const fetchLiveStats = async (karyawanUserIds: Set<string>) => {
        const today = new Date();
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
        const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

        const { data: todayAttendance } = await supabase
            .from("attendance")
            .select("user_id, status, clock_in")
            .gte("clock_in", startOfToday.toISOString())
            .lte("clock_in", endOfToday.toISOString())
            .order("clock_in", { ascending: false });

        const karyawanTodayAttendance = todayAttendance?.filter(a => karyawanUserIds.has(a.user_id)) || [];

        setLiveStats({
            clockedInToday: karyawanTodayAttendance.length,
            lateToday: karyawanTodayAttendance.filter(a => a.status === "late").length,
            lastClockIn: karyawanTodayAttendance[0]?.clock_in || null,
        });
    };

    const fetchStats = async (karyawanUserIds: Set<string>) => {
        // Use report date (yesterday) for attendance stats
        const targetDate = getYesterdayDate();
        const startOfTargetDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);
        const endOfTargetDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);

        const [
            profilesResult,
            targetDayAttendanceResult,
            departmentsResult,
            pendingLeavesResult,
            approvedLeavesResult,
        ] = await Promise.all([
            supabase.from("profiles").select("user_id"),
            supabase.from("attendance").select("user_id, status")
                .gte("clock_in", startOfTargetDay.toISOString())
                .lte("clock_in", endOfTargetDay.toISOString()),
            supabase.from("profiles").select("department").not("department", "is", null),
            supabase.from("leave_requests").select("user_id").eq("status", "pending"),
            supabase.from("leave_requests")
                .select("user_id")
                .eq("status", "approved")
                .lte("start_date", targetDate.toISOString())
                .gte("end_date", targetDate.toISOString()),
        ]);

        const karyawanProfiles = profilesResult.data?.filter(p => karyawanUserIds.has(p.user_id)) || [];
        const totalEmployees = karyawanProfiles.length;

        const karyawanTargetDayAttendance = targetDayAttendanceResult.data?.filter(a => karyawanUserIds.has(a.user_id)) || [];
        const karyawanPendingLeaves = pendingLeavesResult.data?.filter(l => karyawanUserIds.has(l.user_id)) || [];
        const karyawanApprovedLeaves = approvedLeavesResult?.data?.filter(l => karyawanUserIds.has(l.user_id)) || [];
        const employeesOnLeave = new Set(karyawanApprovedLeaves.map(l => l.user_id)).size;

        const presentToday = karyawanTargetDayAttendance.length;
        const lateToday = karyawanTargetDayAttendance.filter(a => a.status === "late").length;
        const onTimeToday = presentToday - lateToday;
        // Alpha = Total - Present - Leave
        const absentToday = Math.max(0, totalEmployees - presentToday - employeesOnLeave);

        // Check if there's data for the report date
        setHasDataForReportDate(presentToday > 0);

        const uniqueDepartments = new Set(departmentsResult.data?.map(d => d.department).filter(Boolean));


        const onTimeRate = presentToday > 0 ? Math.round((onTimeToday / presentToday) * 100) : 0;

        setStats({
            totalEmployees,
            presentToday,
            lateToday,
            absentToday,
            departments: uniqueDepartments.size,
            pendingLeave: karyawanPendingLeaves.length,
            onTimeRate,
        });
    };

    const fetchWeeklyTrend = async (karyawanUserIds: Set<string>) => {
        const today = new Date();
        const days = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
        const weekData: Array<{ day: string; hadir: number; terlambat: number }> = [];

        // Get last 7 days of attendance (ending yesterday)
        const endDate = getYesterdayDate();
        for (let i = 6; i >= 0; i--) {
            const date = new Date(endDate);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split("T")[0];

            const { data: dayAttendance } = await supabase
                .from("attendance")
                .select("user_id, status")
                .gte("clock_in", `${dateStr}T00:00:00`)
                .lt("clock_in", `${dateStr}T23:59:59`);

            const karyawanAttendance = dayAttendance?.filter(a => karyawanUserIds.has(a.user_id)) || [];
            const hadir = karyawanAttendance.filter(a => a.status === "present" || a.status === "late").length;
            const terlambat = karyawanAttendance.filter(a => a.status === "late").length;

            weekData.push({
                day: days[date.getDay()],
                hadir,
                terlambat,
            });
        }

        setWeeklyData(weekData);
    };

    const fetchRecentAttendance = async (karyawanUserIds: Set<string>) => {
        // Use report date (yesterday) for recent attendance
        const targetDate = getYesterdayDate();
        const startOfTargetDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);
        const endOfTargetDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);

        const [attendanceResult, profilesResult] = await Promise.all([
            supabase.from("attendance")
                .select("id, user_id, clock_in, status")
                .gte("clock_in", startOfTargetDay.toISOString())
                .lte("clock_in", endOfTargetDay.toISOString())
                .order("clock_in", { ascending: false })
                .limit(10),
            supabase.from("profiles").select("user_id, full_name, department"),
        ]);

        if (attendanceResult.data) {
            const profileMap = new Map(profilesResult.data?.map(p => [p.user_id, { name: p.full_name, dept: p.department }]) || []);
            const karyawanData = attendanceResult.data.filter(a => karyawanUserIds.has(a.user_id));

            const attendanceWithNames = karyawanData.slice(0, 6).map(record => ({
                id: record.id,
                full_name: profileMap.get(record.user_id)?.name || "Unknown",
                department: profileMap.get(record.user_id)?.dept || undefined,
                clock_in: record.clock_in,
                status: record.status,
            }));
            setRecentAttendance(attendanceWithNames);
        }
    };

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "present":
                return <Badge className="border-0 text-xs font-medium" style={{ backgroundColor: `${BRAND_COLORS.green}15`, color: BRAND_COLORS.green }}>Hadir</Badge>;
            case "late":
                return <Badge className="bg-amber-50 text-amber-600 border-0 text-xs font-medium">Terlambat</Badge>;
            default:
                return <Badge variant="secondary" className="text-xs">{status}</Badge>;
        }
    };

    const getInitials = (name: string) => {
        return name.split(" ").map(n => n.charAt(0)).slice(0, 2).join("").toUpperCase();
    };

    // Calculate attendance breakdown for donut
    const attendanceBreakdown = [
        { name: "Hadir", value: stats.presentToday - stats.lateToday, color: CHART_COLORS.success },
        { name: "Terlambat", value: stats.lateToday, color: CHART_COLORS.warning },
        { name: "Tidak Hadir", value: stats.absentToday, color: CHART_COLORS.danger },
    ].filter(item => item.value > 0);

    // Check if within working hours
    const workingHoursActive = !settingsLoading && isWithinWorkingHours(settings.clockInStart, settings.clockOutEnd);

    return (
        <EnterpriseLayout
            title="Dashboard Manager"
            subtitle={`Rekap Kehadiran: ${reportDateDisplay}`}
            menuSections={menuSections}
            roleLabel="Manager"
            showRefresh={true}
            onRefresh={() => fetchAllData(false)}
            refreshInterval={60}
        >
            {/* Live Status Bar */}
            <div className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Today's Live Counter */}
                <div
                    className="p-4 rounded-2xl border flex items-center gap-4"
                    style={{
                        backgroundColor: `${BRAND_COLORS.green}08`,
                        borderColor: `${BRAND_COLORS.green}25`
                    }}
                >
                    <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm relative"
                        style={{
                            background: `linear-gradient(135deg, ${BRAND_COLORS.green} 0%, #8BC34A 100%)`
                        }}
                    >
                        <Activity className="h-6 w-6 text-white" />
                        {liveStats.clockedInToday > 0 && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-400 animate-pulse" />
                        )}
                    </div>
                    <div className="flex-1">
                        <p className="text-sm text-slate-600">Clock-In Hari Ini (Live)</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold" style={{ color: BRAND_COLORS.green }}>
                                {liveStats.clockedInToday}
                            </span>
                            <span className="text-sm text-slate-500">
                                / {stats.totalEmployees} karyawan
                            </span>
                        </div>
                    </div>
                    {liveStats.lastClockIn && (
                        <div className="text-right">
                            <p className="text-xs text-slate-500">Terakhir</p>
                            <p className="text-sm font-medium text-slate-700">
                                {formatTime(liveStats.lastClockIn)}
                            </p>
                        </div>
                    )}
                </div>

                {/* Working Hours Status */}
                <div
                    className="p-4 rounded-2xl border flex items-center gap-4"
                    style={{
                        backgroundColor: workingHoursActive ? `${BRAND_COLORS.blue}08` : "#F1F5F9",
                        borderColor: workingHoursActive ? `${BRAND_COLORS.blue}25` : "#E2E8F0"
                    }}
                >
                    <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm"
                        style={{
                            background: workingHoursActive
                                ? `linear-gradient(135deg, ${BRAND_COLORS.blue} 0%, ${BRAND_COLORS.lightBlue} 100%)`
                                : "#94A3B8"
                        }}
                    >
                        <Timer className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm text-slate-600">Jam Kerja</p>
                        <div className="flex items-center gap-2">
                            <span className="text-base font-semibold text-slate-800">
                                {settings.clockInStart} - {settings.clockOutEnd}
                            </span>
                            {workingHoursActive ? (
                                <Badge className="text-xs border-0 text-white px-2" style={{ backgroundColor: BRAND_COLORS.green }}>
                                    Aktif
                                </Badge>
                            ) : (
                                <Badge variant="secondary" className="text-xs px-2">
                                    Tidak Aktif
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>

                {/* Report Date Info with Last Updated */}
                <div
                    className="p-4 rounded-2xl border flex items-center gap-4"
                    style={{
                        backgroundColor: `${BRAND_COLORS.lightBlue}08`,
                        borderColor: `${BRAND_COLORS.lightBlue}25`
                    }}
                >
                    <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm"
                        style={{
                            background: `linear-gradient(135deg, ${BRAND_COLORS.lightBlue} 0%, ${BRAND_COLORS.blue} 100%)`
                        }}
                    >
                        <CalendarClock className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm text-slate-600">Data Rekap Otomatis</p>
                        <p className="text-base font-semibold text-slate-800">
                            {reportDate.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                    </div>
                    {lastUpdated && (
                        <div className="text-right">
                            <p className="text-xs text-slate-500">Diperbarui</p>
                            <p className="text-sm font-medium text-slate-700">
                                {lastUpdated.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* No Data Warning */}
            {!hasDataForReportDate && !isLoading && (
                <div
                    className="mb-6 p-4 rounded-2xl border flex items-center gap-4"
                    style={{
                        backgroundColor: "#FEF3C7",
                        borderColor: "#FCD34D"
                    }}
                >
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                        <AlertCircle className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                        <p className="font-semibold text-amber-800">Tidak ada data kehadiran</p>
                        <p className="text-sm text-amber-700">
                            Belum ada karyawan yang clock-in pada {reportDateDisplay}. Data akan muncul setelah karyawan melakukan absensi.
                        </p>
                    </div>
                </div>
            )}

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard
                    title="Total Karyawan"
                    value={stats.totalEmployees}
                    unit="Orang"
                    subtitle={`Dari ${stats.departments} departemen`}
                    icon={Users}
                    color="primary"
                    isLoading={isLoading}
                />
                <StatCard
                    title="Hadir Kemarin"
                    value={stats.presentToday}
                    unit="Orang"
                    trend={{
                        value: `${stats.totalEmployees > 0 ? Math.round((stats.presentToday / stats.totalEmployees) * 100) : 0}% kehadiran`,
                        direction: stats.presentToday >= stats.totalEmployees * 0.8 ? "up" : "down",
                    }}
                    subtitle={`Terlambat: ${stats.lateToday}`}
                    icon={UserCheck}
                    color="success"
                    isLoading={isLoading}
                />
                <StatCard
                    title="Tidak Hadir"
                    value={stats.absentToday}
                    unit="Orang"
                    subtitle="Termasuk izin & cuti"
                    icon={UserX}
                    color={stats.absentToday > 0 ? "danger" : "success"}
                    isLoading={isLoading}
                />
                <StatCard
                    title="Cuti Menunggu"
                    value={stats.pendingLeave}
                    unit="Pengajuan"
                    subtitle="Perlu persetujuan Anda"
                    icon={Calendar}
                    color={stats.pendingLeave > 0 ? "warning" : "success"}
                    isLoading={isLoading}
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                {/* Weekly Attendance Chart */}
                <Card className="lg:col-span-2 border-slate-200 shadow-sm bg-white">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-base font-semibold text-slate-800">Kehadiran Minggu Ini</CardTitle>
                                <CardDescription className="text-sm">Data 7 hari terakhir</CardDescription>
                            </div>
                            <Link to="/manager/laporan">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs gap-1.5 border-slate-200"
                                >
                                    <BarChart3 className="h-3.5 w-3.5" />
                                    Detail
                                </Button>
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Skeleton className="h-[220px] w-full" />
                        ) : (
                            <div className="h-[220px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                background: 'white',
                                                border: '1px solid #E2E8F0',
                                                borderRadius: '8px',
                                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                            }}
                                        />
                                        <Bar dataKey="hadir" fill={CHART_COLORS.success} name="Hadir" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="terlambat" fill={CHART_COLORS.warning} name="Terlambat" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                        {/* Legend */}
                        <div className="flex justify-center gap-6 mt-2">
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: CHART_COLORS.success }} />
                                Hadir Tepat Waktu
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: CHART_COLORS.warning }} />
                                Terlambat
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Today's Breakdown */}
                <Card className="border-slate-200 shadow-sm bg-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold text-slate-800">Ringkasan Kemarin</CardTitle>
                        <CardDescription className="text-sm">Distribusi {reportDate.toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Skeleton className="h-[220px] w-full" />
                        ) : attendanceBreakdown.length > 0 ? (
                            <>
                                <div className="h-[160px] flex items-center justify-center">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={attendanceBreakdown}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={45}
                                                outerRadius={70}
                                                paddingAngle={3}
                                                dataKey="value"
                                            >
                                                {attendanceBreakdown.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                formatter={(value: number) => [`${value} orang`, ""]}
                                                contentStyle={{
                                                    background: 'white',
                                                    border: '1px solid #E2E8F0',
                                                    borderRadius: '8px',
                                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                                }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                {/* Legend */}
                                <div className="flex flex-col gap-2 mt-4">
                                    {attendanceBreakdown.map((item, index) => (
                                        <div key={index} className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                                <span className="text-slate-600">{item.name}</span>
                                            </div>
                                            <span className="font-semibold text-slate-800">{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="h-[220px] flex flex-col items-center justify-center text-center">
                                <div
                                    className="w-16 h-16 mb-3 rounded-2xl flex items-center justify-center"
                                    style={{ backgroundColor: `${BRAND_COLORS.blue}10` }}
                                >
                                    <Clock className="h-8 w-8" style={{ color: `${BRAND_COLORS.blue}50` }} />
                                </div>
                                <p className="text-slate-500 text-sm font-medium">Belum ada data</p>
                                <p className="text-slate-400 text-xs mt-1">Menunggu clock-in karyawan</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Recent Attendance */}
                <Card className="border-slate-200 shadow-sm bg-white">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-base font-semibold text-slate-800">Kehadiran Kemarin</CardTitle>
                                <CardDescription className="text-sm">Aktivitas {reportDate.toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</CardDescription>
                            </div>
                            <Link to="/manager/absensi">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-xs gap-1 hover:bg-blue-50"
                                    style={{ color: BRAND_COLORS.blue }}
                                >
                                    Lihat Semua
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </Button>
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                        {isLoading ? (
                            <div className="space-y-3">
                                {[...Array(4)].map((_, i) => (
                                    <Skeleton key={i} className="h-14 w-full" />
                                ))}
                            </div>
                        ) : recentAttendance.length > 0 ? (
                            <div className="space-y-2">
                                {recentAttendance.map((record, index) => (
                                    <div
                                        key={record.id}
                                        className={cn(
                                            "flex items-center gap-3 p-3 rounded-xl transition-colors hover:bg-slate-50",
                                            index === 0 && "bg-gradient-to-r from-green-50/50 to-transparent"
                                        )}
                                    >
                                        <div
                                            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white shadow-sm"
                                            style={{
                                                background: `linear-gradient(135deg, ${BRAND_COLORS.blue} 0%, ${BRAND_COLORS.green} 100%)`
                                            }}
                                        >
                                            {getInitials(record.full_name)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-800 truncate">{record.full_name}</p>
                                            <p className="text-xs text-slate-500">
                                                {record.department ? `${record.department} • ` : ""}
                                                {formatTime(record.clock_in)}
                                            </p>
                                        </div>
                                        {getStatusBadge(record.status)}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <div
                                    className="w-16 h-16 mx-auto mb-3 rounded-2xl flex items-center justify-center"
                                    style={{ backgroundColor: `${BRAND_COLORS.blue}10` }}
                                >
                                    <Clock className="h-8 w-8" style={{ color: `${BRAND_COLORS.blue}50` }} />
                                </div>
                                <p className="text-slate-500 text-sm font-medium">Belum ada data kehadiran</p>
                                <p className="text-slate-400 text-xs mt-1">Data akan muncul saat karyawan clock-in</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card className="border-slate-200 shadow-sm bg-white">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold text-slate-800">Menu Manager</CardTitle>
                        <CardDescription className="text-sm">Akses cepat fitur utama</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="grid grid-cols-1 gap-3">
                            <Link to="/manager/absensi">
                                <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all group cursor-pointer">
                                    <div
                                        className="w-12 h-12 rounded-xl flex items-center justify-center transition-all group-hover:shadow-md"
                                        style={{ backgroundColor: `${BRAND_COLORS.blue}15` }}
                                    >
                                        <Clock className="h-6 w-6" style={{ color: BRAND_COLORS.blue }} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-slate-800">Rekap Absensi</p>
                                        <p className="text-xs text-slate-500">Lihat data kehadiran tim</p>
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                                </div>
                            </Link>
                            <Link to="/manager/laporan">
                                <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-green-300 hover:bg-green-50/50 transition-all group cursor-pointer">
                                    <div
                                        className="w-12 h-12 rounded-xl flex items-center justify-center transition-all group-hover:shadow-md"
                                        style={{ backgroundColor: `${BRAND_COLORS.green}15` }}
                                    >
                                        <BarChart3 className="h-6 w-6" style={{ color: BRAND_COLORS.green }} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-slate-800">Laporan</p>
                                        <p className="text-xs text-slate-500">Analisis & export data</p>
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-green-500 transition-colors" />
                                </div>
                            </Link>
                            <Link to="/manager/cuti">
                                <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50/50 transition-all group cursor-pointer">
                                    <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center transition-all group-hover:bg-amber-100">
                                        <FileCheck className="h-6 w-6 text-amber-600" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-slate-800">Kelola Cuti</p>
                                        <p className="text-xs text-slate-500">Approve/reject pengajuan</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {stats.pendingLeave > 0 && (
                                            <Badge
                                                className="text-white text-xs px-2 border-0"
                                                style={{ backgroundColor: BRAND_COLORS.green }}
                                            >
                                                {stats.pendingLeave}
                                            </Badge>
                                        )}
                                        <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-amber-500 transition-colors" />
                                    </div>
                                </div>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </EnterpriseLayout>
    );
};

export default ManagerDashboardNew;
