
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    Users, Clock, BarChart3, Building2,
    FileCheck, TrendingUp, TrendingDown, UserCheck, UserX, AlertCircle,
    ChevronRight, Activity, BookOpen, CheckCircle2, Bell, Timer, CalendarClock
} from "lucide-react";
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import EnterpriseLayout from "@/components/layout/EnterpriseLayout";
import StatCard from "@/components/ui/stat-card";
import { useAuth } from "@/hooks/useAuth";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { cn } from "@/lib/utils";
import { getJakartaDate } from "@/lib/dateUtils";
import {
    useDashboardStats,
    useEmployeeIds,
    useLiveStats,
    useWeeklyTrend,
    useRealTimeMonitoring,
    useMonthlyTrend,
    useDepartmentDistribution,
    useRecentJournals
} from "@/hooks/useDashboardData";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";
import { MANAGER_MENU_SECTIONS } from "@/config/menu";
import { RealTimeMonitoringTable } from "@/components/dashboard/RealTimeMonitoringTable";
import { EMPTY_STATE_MESSAGES } from "@/lib/dashboardTestData";

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
    const { user } = useAuth();
    const navigate = useNavigate();
    const { settings, isLoading: settingsLoading } = useSystemSettings();
    const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());

    // Use today for live stats, yesterday for report
    const activeDate = getJakartaDate();
    const reportDate = new Date(activeDate);
    reportDate.setDate(reportDate.getDate() - 1);

    const reportDateDisplay = reportDate.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    });

    // --------------------------------------------------------------------------------
    // REACT QUERY HOOKS - All data fetching optimized with React Query
    // --------------------------------------------------------------------------------
    const { data: karyawanUserIds, isLoading: isIdsLoading } = useEmployeeIds();
    const { data: stats, isLoading: isStatsLoading } = useDashboardStats(karyawanUserIds);
    const { data: liveStats } = useLiveStats(karyawanUserIds);
    const { data: weeklyData, isLoading: isWeeklyLoading } = useWeeklyTrend(karyawanUserIds);

    // NEW HOOKS for Dashboard Activation
    const {
        data: realTimeData,
        isLoading: isRealTimeLoading,
        isRefetching: isRealTimeRefetching,
        refetch: refetchRealTime
    } = useRealTimeMonitoring(karyawanUserIds);
    const { data: monthlyData, isLoading: isMonthlyLoading } = useMonthlyTrend(karyawanUserIds);
    const { data: departmentData, isLoading: isDeptLoading } = useDepartmentDistribution(karyawanUserIds);
    const { data: journalsData, isLoading: isJournalsLoading } = useRecentJournals(karyawanUserIds);

    // Initial Loading State for Skeleton
    const isInitialLoading = isIdsLoading || isStatsLoading || isWeeklyLoading;

    // Update lastUpdated timestamp when live data refreshes
    useEffect(() => {
        if (!isRealTimeRefetching) {
            setLastUpdated(new Date());
        }
    }, [isRealTimeRefetching]);

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    };

    // Menu sections
    const menuSections = MANAGER_MENU_SECTIONS;


    // Check if within working hours
    const workingHoursActive = !settingsLoading && isWithinWorkingHours(settings.clockInStart, settings.clockOutEnd);

    // Safely unwrap stats with defaults
    const safeStats = stats || {
        totalEmployees: 0,
        presentToday: 0,
        lateToday: 0,
        absentToday: 0,
        departments: 0,
        pendingLeave: 0,
        onTimeRate: 0
    };

    // Safely unwrap liveStats
    const safeLiveStats = liveStats || {
        clockedInToday: 0,
        lateToday: 0,
        lastClockIn: null
    };

    // Calculate attendance breakdown for donut
    const attendanceBreakdown = [
        { name: "Hadir", value: safeStats.presentToday - safeStats.lateToday, color: CHART_COLORS.success },
        { name: "Terlambat", value: safeStats.lateToday, color: CHART_COLORS.warning },
        { name: "Tidak Hadir", value: safeStats.absentToday, color: CHART_COLORS.danger },
    ].filter(item => item.value > 0);

    // --------------------------------------------------------------------------------
    // EARLY RETURN for SKELETON
    // --------------------------------------------------------------------------------
    if (isInitialLoading) {
        return (
            <EnterpriseLayout
                title="Dashboard"
                subtitle={`Rekap Kehadiran: ${reportDateDisplay}`}
                roleLabel="Manager"
                menuSections={menuSections}
                showRefresh={false}
            >
                <DashboardSkeleton />
            </EnterpriseLayout>
        );
    }



    return (
        <EnterpriseLayout
            title="Dashboard Manager"
            subtitle={`Rekap Kehadiran: ${reportDateDisplay}`}
            menuSections={menuSections}
            roleLabel="Manager"
            showRefresh={false}
            showExport={false}
            // onRefresh handled by react-query internally mostly
            refreshInterval={60}
        >
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out space-y-6">

                {/* Live Status Bar */}
                <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Today's Live Counter */}
                    <div
                        className="p-5 rounded-2xl border flex items-center gap-4 hover:shadow-sm transition-shadow bg-white"
                        style={{
                            backgroundColor: `${BRAND_COLORS.green}08`,
                            borderColor: `${BRAND_COLORS.green}25`
                        }}
                    >
                        <div
                            className="w-14 h-14 rounded-xl flex items-center justify-center shadow-sm relative shrink-0"
                            style={{
                                background: `linear-gradient(135deg, ${BRAND_COLORS.green} 0%, #8BC34A 100%)`
                            }}
                        >
                            <Activity className="h-7 w-7 text-white" />
                            {safeLiveStats.clockedInToday > 0 && (
                                <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-green-400 animate-pulse border-2 border-white" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-600 truncate">Clock-In Hari Ini</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold" style={{ color: BRAND_COLORS.green }}>
                                    {safeLiveStats.clockedInToday}
                                </span>
                                <span className="text-sm text-slate-500 truncate">
                                    / {safeStats.totalEmployees} karyawan
                                </span>
                            </div>
                        </div>
                        {safeLiveStats.lastClockIn && (
                            <div className="text-right hidden xs:block">
                                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Terakhir</p>
                                <p className="text-sm font-bold text-slate-700">
                                    {formatTime(safeLiveStats.lastClockIn)}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Working Hours Status */}
                    <div
                        className="p-5 rounded-2xl border flex items-center gap-4 hover:shadow-sm transition-shadow bg-white"
                        style={{
                            backgroundColor: workingHoursActive ? `${BRAND_COLORS.blue}08` : "#F8FAFC",
                            borderColor: workingHoursActive ? `${BRAND_COLORS.blue}25` : "#E2E8F0"
                        }}
                    >
                        <div
                            className="w-14 h-14 rounded-xl flex items-center justify-center shadow-sm shrink-0"
                            style={{
                                background: workingHoursActive
                                    ? `linear-gradient(135deg, ${BRAND_COLORS.blue} 0%, ${BRAND_COLORS.lightBlue} 100%)`
                                    : "#94A3B8"
                            }}
                        >
                            <Timer className="h-7 w-7 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-600">Jam Kerja Kantor</p>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                <span className="text-lg font-bold text-slate-800">
                                    {settings.clockInStart} - {settings.clockOutEnd}
                                </span>
                                {workingHoursActive ? (
                                    <Badge className="text-[10px] h-5 px-1.5 border-0 text-white" style={{ backgroundColor: BRAND_COLORS.green }}>
                                        Aktif
                                    </Badge>
                                ) : (
                                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 text-slate-500">
                                        Libur / Tutup
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Report Date Info */}
                    <div
                        className="p-5 rounded-2xl border flex items-center gap-4 hover:shadow-sm transition-shadow bg-white sm:col-span-2 lg:col-span-1"
                        style={{
                            backgroundColor: `${BRAND_COLORS.lightBlue}08`,
                            borderColor: `${BRAND_COLORS.lightBlue}25`
                        }}
                    >
                        <div
                            className="w-14 h-14 rounded-xl flex items-center justify-center shadow-sm shrink-0"
                            style={{
                                background: `linear-gradient(135deg, ${BRAND_COLORS.lightBlue} 0%, ${BRAND_COLORS.blue} 100%)`
                            }}
                        >
                            <CalendarClock className="h-7 w-7 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-600">Tanggal Rekap Otomatis</p>
                            <p className="text-lg font-bold text-slate-800 truncate">
                                {reportDate.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                            </p>
                        </div>
                    </div>
                </div>

                {/* KPI Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <StatCard
                        title="Total Karyawan"
                        value={safeStats.totalEmployees}
                        unit="Orang"
                        subtitle={`Dari ${safeStats.departments} departemen`}
                        icon={Users}
                        color="primary"
                    />
                    <StatCard
                        title="Hadir Kemarin"
                        value={safeStats.presentToday}
                        unit="Orang"
                        trend={{
                            value: `${safeStats.onTimeRate}% On Time`,
                            direction: safeStats.onTimeRate > 80 ? "up" : "down",
                        }}
                        subtitle={`Terlambat: ${safeStats.lateToday}`}
                        icon={UserCheck}
                        color="success"
                    />
                    <StatCard
                        title="Tidak Hadir"
                        value={safeStats.absentToday}
                        unit="Orang"
                        subtitle="Termasuk izin & cuti"
                        icon={UserX}
                        color={safeStats.absentToday > 0 ? "danger" : "success"}
                    />
                    <StatCard
                        title="Pending Cuti"
                        value={safeStats.pendingLeave}
                        unit="Request"
                        icon={FileCheck}
                        color="warning"
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
                            {attendanceBreakdown.length > 0 ? (
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

                {/* Row 3: Real-Time Monitoring + Quick Actions & Journals */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                    {/* Real-Time Monitoring Table - Full width on mobile/tablet, 2 cols on desktop */}
                    <div className="lg:col-span-2 min-h-[400px]">
                        <RealTimeMonitoringTable
                            data={realTimeData}
                            isLoading={isRealTimeLoading}
                            isRefetching={isRealTimeRefetching}
                            lastUpdated={lastUpdated}
                            onRefresh={() => refetchRealTime()}
                        />
                    </div>

                    {/* Quick Actions + Journals */}
                    <div className="flex flex-col gap-3">
                        <Link to="/manager/absensi">
                            <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all group cursor-pointer bg-white">
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
                            <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-green-300 hover:bg-green-50/50 transition-all group cursor-pointer bg-white">
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
                            <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50/50 transition-all group cursor-pointer bg-white">
                                <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center transition-all group-hover:bg-amber-100">
                                    <FileCheck className="h-6 w-6 text-amber-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-slate-800">Kelola Cuti</p>
                                    <p className="text-xs text-slate-500">Approve/reject pengajuan</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {safeStats.pendingLeave > 0 && (
                                        <Badge
                                            className="text-white text-xs px-2 border-0"
                                            style={{ backgroundColor: BRAND_COLORS.green }}
                                        >
                                            {safeStats.pendingLeave}
                                        </Badge>
                                    )}
                                    <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-amber-500 transition-colors" />
                                </div>
                            </div>
                        </Link>

                        {/* Jurnal Tim Terbaru - Using new React Query hook */}
                        <Card className="border-slate-200 shadow-sm bg-white">
                            <CardHeader className="pb-3 border-b border-slate-100">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                                            <BookOpen className="h-4 w-4 text-amber-600" />
                                            Jurnal Tim Terbaru
                                        </CardTitle>
                                        {/* 4PM Notification */}
                                        {journalsData?.needsReminder && (
                                            <div className="flex items-center gap-1 mt-1">
                                                <Bell className="h-3 w-3 text-amber-500" />
                                                <span className="text-xs text-amber-600">
                                                    {journalsData.employeesNeedingJournals} karyawan belum mengisi jurnal
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <Button variant="ghost" size="sm" className="h-6 text-[10px]" asChild>
                                        <Link to="/manager/jurnal">Lihat Semua</Link>
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0 overflow-y-auto max-h-[300px]">
                                {(!journalsData?.journals || journalsData.journals.length === 0) ? (
                                    <div className="flex flex-col items-center justify-center h-48 text-center p-4">
                                        <CheckCircle2 className="h-10 w-10 text-green-500 mb-2 opacity-20" />
                                        <p className="text-sm font-medium text-slate-900">Belum ada jurnal</p>
                                        <p className="text-xs text-slate-500">Data jurnal tim kosong.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {journalsData.journals.map((journal) => (
                                            <div key={journal.id} className="p-4 hover:bg-slate-50 transition-colors">
                                                <div className="flex items-start justify-between mb-1">
                                                    <p className="text-sm font-medium text-slate-900 line-clamp-1">{journal.full_name}</p>
                                                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                                        {new Date(journal.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-600 mb-3 line-clamp-2">{journal.title}</p>
                                                <div className="flex items-center justify-between">
                                                    {journal.status === 'approved' && <Badge variant="outline" className="text-[10px] h-5 border-green-200 text-green-700 bg-green-50">Disetujui</Badge>}
                                                    {journal.status === 'rejected' && <Badge variant="outline" className="text-[10px] h-5 border-red-200 text-red-700 bg-red-50">Ditolak</Badge>}
                                                    {(journal.status === 'submitted' || journal.status === 'pending') && <Badge variant="outline" className="text-[10px] h-5 border-amber-200 text-amber-700 bg-amber-50">Menunggu</Badge>}
                                                    <Button size="sm" variant="ghost" className="h-6 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2" asChild>
                                                        <Link to="/manager/jurnal">Detail</Link>
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Row 4: Monthly Trend + Department Distribution */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* 6-Month Attendance Trend */}
                    <Card className="border-slate-200 shadow-sm bg-white">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base font-semibold text-slate-800">Tren Kehadiran 6 Bulan</CardTitle>
                                    <CardDescription className="text-sm">Persentase kehadiran bulanan</CardDescription>
                                </div>
                                <TrendingUp className="h-5 w-5" style={{ color: BRAND_COLORS.green }} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            {(!monthlyData || monthlyData.length === 0) ? (
                                <div className="text-center py-8">
                                    <div
                                        className="w-16 h-16 mx-auto mb-3 rounded-2xl flex items-center justify-center"
                                        style={{ backgroundColor: `${BRAND_COLORS.blue}10` }}
                                    >
                                        <TrendingUp className="h-8 w-8" style={{ color: `${BRAND_COLORS.blue}50` }} />
                                    </div>
                                    <p className="text-slate-500 text-sm font-medium">Belum ada data bulanan</p>
                                    <p className="text-slate-400 text-xs mt-1">Data akan muncul seiring waktu</p>
                                </div>
                            ) : (
                                <div className="h-[200px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={monthlyData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                            <XAxis
                                                dataKey="month"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#64748B', fontSize: 12 }}
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#64748B', fontSize: 12 }}
                                                domain={[0, 100]}
                                                tickFormatter={(val) => `${val}%`}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    background: 'white',
                                                    border: '1px solid #E2E8F0',
                                                    borderRadius: '8px',
                                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                                }}
                                                formatter={(value: number) => [`${value}%`, '']}
                                            />
                                            <Legend />
                                            <Line type="monotone" dataKey="attendanceRate" stroke={CHART_COLORS.primary} strokeWidth={2} name="Kehadiran" dot={{ fill: CHART_COLORS.primary }} />
                                            <Line type="monotone" dataKey="onTimeRate" stroke={CHART_COLORS.success} strokeWidth={2} name="Tepat Waktu" dot={{ fill: CHART_COLORS.success }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Department Distribution */}
                    <Card className="border-slate-200 shadow-sm bg-white">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base font-semibold text-slate-800">Distribusi Departemen</CardTitle>
                                    <CardDescription className="text-sm">Jumlah karyawan per departemen</CardDescription>
                                </div>
                                <Building2 className="h-5 w-5" style={{ color: BRAND_COLORS.blue }} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            {(!departmentData || departmentData.length === 0) ? (
                                <div className="text-center py-8">
                                    <div
                                        className="w-16 h-16 mx-auto mb-3 rounded-2xl flex items-center justify-center"
                                        style={{ backgroundColor: `${BRAND_COLORS.blue}10` }}
                                    >
                                        <Building2 className="h-8 w-8" style={{ color: `${BRAND_COLORS.blue}50` }} />
                                    </div>
                                    <p className="text-slate-500 text-sm font-medium">Belum ada data departemen</p>
                                    <p className="text-slate-400 text-xs mt-1">Pastikan karyawan sudah ada departemen</p>
                                </div>
                            ) : (
                                <div className="flex items-center gap-4">
                                    <div className="h-[180px] flex-shrink-0" style={{ width: '180px' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={departmentData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={45}
                                                    outerRadius={75}
                                                    paddingAngle={2}
                                                    dataKey="count"
                                                >
                                                    {departmentData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip formatter={(value: number, name: string) => [value, name]} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="flex-1 space-y-2 overflow-y-auto max-h-[180px]">
                                        {departmentData.map((dept, index) => (
                                            <div key={index} className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: dept.color }} />
                                                <span className="text-sm text-slate-600 truncate flex-1">{dept.name}</span>
                                                <span className="text-sm font-semibold text-slate-800">{dept.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

            </div>
        </EnterpriseLayout>
    );
};

export default ManagerDashboardNew;
