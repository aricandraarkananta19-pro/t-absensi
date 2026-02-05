
import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    Users, Clock, Key, Settings, ChevronRight, LogOut, LayoutDashboard,
    BarChart3, FileText, Calendar, Building2, Shield, TrendingUp, TrendingDown,
    CheckCircle2, AlertCircle, UserCheck, UserX, RefreshCw, Download,
    Bell, MoreVertical, ArrowUpRight, Briefcase, FolderOpen, Database,
    Timer, Zap, Activity, CalendarClock
} from "lucide-react";
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from "recharts";
import logoImage from "@/assets/logo.png";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

// 1. TIMEZONE & DATE ENGINE
// Helper to get date in Jakarta Timezone
const getJakartaDate = (offsetDays = 0) => {
    // Current UTC time
    const now = new Date();
    // Convert to Jakarta Time string
    const jakartaTimeStr = now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
    const jakartaDate = new Date(jakartaTimeStr);

    if (offsetDays !== 0) {
        jakartaDate.setDate(jakartaDate.getDate() + offsetDays);
    }

    return jakartaDate;
};

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
    const yesterdayDate = getJakartaDate(-1);

    // Display Strings
    const activeDateDisplay = activeDate.toLocaleDateString("id-ID", {
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
        approvedLeaveThisMonth: 0,
        attendanceThisMonth: 0,
        attendanceRate: 0,
        newEmployeesThisMonth: 0,
    });

    // Validated Live Stats
    const [liveStats, setLiveStats] = useState({
        clockedInToday: 0,
        lateToday: 0,
        lastClockIn: null as string | null,
    });

    const [recentAttendance, setRecentAttendance] = useState<Array<{
        id: string;
        full_name: string;
        clock_in: string;
        status: string;
    }>>([]);
    const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
    const [departmentData, setDepartmentData] = useState<Array<{ name: string; value: number; color: string }>>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [hasDataForToday, setHasDataForToday] = useState(true);

    // Menu sections for sidebar
    const menuSections = [
        {
            title: "Menu Utama",
            items: [
                { icon: LayoutDashboard, title: "Dashboard", href: "/dashboard" },
                { icon: Users, title: "Kelola Karyawan", href: "/admin/karyawan" },
                { icon: Clock, title: "Rekap Absensi", href: "/admin/absensi" },
                { icon: Briefcase, title: "Jurnal Kerja", href: "/admin/jurnal" },
                { icon: BarChart3, title: "Laporan", href: "/admin/laporan" },
            ],
        },
        {
            title: "Pengaturan",
            items: [
                { icon: Building2, title: "Departemen", href: "/admin/departemen" },
                { icon: Shield, title: "Kelola Role", href: "/admin/role" },
                { icon: Key, title: "Reset Password", href: "/admin/reset-password" },
                { icon: Settings, title: "Pengaturan", href: "/admin/pengaturan" },
                { icon: Database, title: "Export Database", href: "/admin/export-database" },
            ],
        },
    ];

    // Add pending leave badge to menu items
    const menuWithBadges = menuSections.map(section => ({
        ...section,
        items: section.items.map(item => ({
            ...item,
            badge: item.title === "Laporan" && stats.pendingLeave > 0 ? stats.pendingLeave : undefined,
        })),
    }));

    // 3. AUTO-REFRESH & DATE VALIDATION ENGINE
    useEffect(() => {
        // Function to check if date changed (e.g. passed midnight)
        const checkDateChange = () => {
            const currentJakarta = getJakartaDate();
            if (
                currentJakarta.getDate() !== activeDate.getDate() ||
                currentJakarta.getMonth() !== activeDate.getMonth() ||
                currentJakarta.getFullYear() !== activeDate.getFullYear()
            ) {
                console.log("Date changed! Updating active date to:", currentJakarta);
                setActiveDate(currentJakarta); // Will trigger fetchAllData via dependency
            }
        };

        /*
        const interval = setInterval(() => {
            checkDateChange();
            if (!document.hidden) {
                fetchAllData(false); // Background refresh only if visible
            }
        }, AUTO_REFRESH_INTERVAL);

        return () => clearInterval(interval);
        */
    }, [activeDate]);


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
                fetchDepartmentDistribution(karyawanUserIds),
            ]);

            setLastUpdated(new Date()); // Local machine time for update timestamp
        } finally {
            setIsLoading(false);
        }
    }, [settings.attendanceStartDate, activeDate]); // Depend on activeDate!

    useEffect(() => {
        if (!settingsLoading) {
            fetchAllData(true);
        }

        /*
        const attendanceChannel = supabase
            .channel("dashboard-attendance-changes")
            .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, () => fetchAllData(false))
            .subscribe();

        const profilesChannel = supabase
            .channel("dashboard-profiles-changes")
            .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => fetchAllData(false))
            .subscribe();

        const leaveChannel = supabase
            .channel("dashboard-leave-changes")
            .on("postgres_changes", { event: "*", schema: "public", table: "leave_requests" }, () => fetchAllData(false))
            .subscribe();

        return () => {
            supabase.removeChannel(attendanceChannel);
            supabase.removeChannel(profilesChannel);
            supabase.removeChannel(leaveChannel);
        };
        */
    }, [settingsLoading, fetchAllData]);

    const fetchLiveStats = async (karyawanUserIds: Set<string>) => {
        // Use activeDate (Jakarta) for query
        const startOfToday = new Date(activeDate);
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date(activeDate);
        endOfToday.setHours(23, 59, 59, 999);

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

        // Update emptiness check
        setHasDataForToday(karyawanTodayAttendance.length > 0);
    };

    const fetchDepartmentDistribution = async (karyawanUserIds: Set<string>) => {
        const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, department");

        if (profiles) {
            const karyawanProfiles = profiles.filter(p => karyawanUserIds.has(p.user_id));
            const deptCounts: Record<string, number> = {};

            karyawanProfiles.forEach(p => {
                const dept = p.department || "Lainnya";
                deptCounts[dept] = (deptCounts[dept] || 0) + 1;
            });

            const colors = [BRAND_COLORS.blue, BRAND_COLORS.green, BRAND_COLORS.lightBlue, "#8B5CF6", "#EC4899", "#06B6D4"];
            const deptData = Object.entries(deptCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([name, value], index) => ({
                    name: name.length > 12 ? name.substring(0, 12) + "..." : name,
                    value,
                    color: colors[index % colors.length],
                }));

            setDepartmentData(deptData);
        }
    };

    const fetchStats = async (karyawanUserIds: Set<string>) => {
        // Stats based on activeDate (TODAY)
        const startOfTargetDay = new Date(activeDate);
        startOfTargetDay.setHours(0, 0, 0, 0);
        const endOfTargetDay = new Date(activeDate);
        endOfTargetDay.setHours(23, 59, 59, 999);

        const today = activeDate;
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

        const [
            profilesResult,
            targetDayAttendanceResult,
            departmentsResult,
            pendingLeavesResult,
            approvedLeavesResult,
            monthAttendanceResult,
            approvedLeavesTodayResult
        ] = await Promise.all([
            supabase.from("profiles").select("user_id, created_at"),
            // Fetch attendance from TODAY (activeDate)
            supabase.from("attendance").select("user_id, status")
                .gte("clock_in", startOfTargetDay.toISOString())
                .lte("clock_in", endOfTargetDay.toISOString()),
            supabase.from("profiles").select("department").not("department", "is", null),
            supabase.from("leave_requests").select("user_id").eq("status", "pending"),
            supabase.from("leave_requests").select("user_id")
                .eq("status", "approved")
                .gte("start_date", startOfMonth.toISOString().split("T")[0])
                .lte("end_date", endOfMonth.toISOString().split("T")[0]),
            supabase.from("attendance").select("user_id")
                .gte("clock_in", startOfMonth.toISOString())
                .lte("clock_in", endOfMonth.toISOString()),
            // New Query: Leaves for TODAY specifically
            supabase.from("leave_requests")
                .select("user_id")
                .eq("status", "approved")
                .lte("start_date", activeDate.toISOString())
                .gte("end_date", activeDate.toISOString()),
        ]);

        const karyawanProfiles = profilesResult.data?.filter(p => karyawanUserIds.has(p.user_id)) || [];
        const totalEmployees = karyawanProfiles.length;

        const newEmployeesThisMonth = karyawanProfiles.filter(p => {
            const created = new Date(p.created_at);
            return created >= startOfMonth && created <= endOfMonth;
        }).length;

        const karyawanTargetDayAttendance = targetDayAttendanceResult.data?.filter(a => karyawanUserIds.has(a.user_id)) || [];
        const presentToday = karyawanTargetDayAttendance.length;
        const lateToday = karyawanTargetDayAttendance.filter(a => a.status === "late").length;
        // Absent is implicitly Total - Present for simple summary, but ideally we query 'absent' status.
        // For Dashboard quick view, Total - Present is a good estimation if we assume working day.

        const karyawanApprovedLeavesToday = approvedLeavesTodayResult?.data?.filter(l => karyawanUserIds.has(l.user_id)) || [];
        const employeesOnLeaveToday = new Set(karyawanApprovedLeavesToday.map(l => l.user_id)).size;

        const absentToday = Math.max(0, totalEmployees - presentToday - employeesOnLeaveToday);

        const uniqueDepartments = new Set(departmentsResult.data?.map(d => d.department).filter(Boolean));
        const karyawanPendingLeaves = pendingLeavesResult.data?.filter(l => karyawanUserIds.has(l.user_id)) || [];
        const karyawanApprovedLeavesMonth = approvedLeavesResult.data?.filter(l => karyawanUserIds.has(l.user_id)) || [];
        const karyawanMonthAttendance = monthAttendanceResult.data?.filter(a => karyawanUserIds.has(a.user_id)) || [];

        const workDaysThisMonth = getWorkDaysInMonth(today.getFullYear(), today.getMonth());
        const expectedAttendance = totalEmployees * workDaysThisMonth;
        const attendanceRate = expectedAttendance > 0
            ? Math.round((karyawanMonthAttendance.length / expectedAttendance) * 100)
            : 0;

        setStats({
            totalEmployees,
            presentToday,
            lateToday,
            absentToday,
            departments: uniqueDepartments.size,
            pendingLeave: karyawanPendingLeaves.length,
            approvedLeaveThisMonth: karyawanApprovedLeavesMonth.length,
            attendanceThisMonth: karyawanMonthAttendance.length,
            attendanceRate: Math.min(100, attendanceRate),
            newEmployeesThisMonth,
        });
    };

    const fetchWeeklyTrend = async (karyawanUserIds: Set<string>) => {
        const today = activeDate;
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

        // OPTIMIZATION: Only fetch last 6 months, not whole year
        const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);
        const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

        const [profilesResult, attendanceResult] = await Promise.all([
            // Optimization: We already have profile data in fetchAllData parent or unrelated? 
            // We need count for each month. 
            // Profiles count can change over time but for trend we usually take current count or snapshot.
            // Using current active profiles is standard for simple dashboards.
            supabase.from("profiles").select("user_id"),
            supabase.from("attendance").select("user_id, status, clock_in")
                .gte("clock_in", sixMonthsAgo.toISOString())
                .lte("clock_in", endOfToday.toISOString()),
        ]);

        const karyawanProfiles = profilesResult.data?.filter(p => karyawanUserIds.has(p.user_id)) || [];
        const totalEmployees = karyawanProfiles.length;
        const allAttendance = attendanceResult.data?.filter(a => karyawanUserIds.has(a.user_id)) || [];

        const weekData: WeeklyData[] = [];

        for (let i = 5; i >= 0; i--) {
            const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
            const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

            const monthAttendance = allAttendance.filter(a => {
                const clockIn = new Date(a.clock_in);
                return clockIn >= monthStart && clockIn <= monthEnd;
            });

            const presentCount = monthAttendance.filter(a => a.status === "present").length;
            const lateCount = monthAttendance.filter(a => a.status === "late").length;

            const workDays = getWorkDaysInMonth(date.getFullYear(), date.getMonth());
            const expected = totalEmployees * workDays;
            const percentage = expected > 0 ? Math.round(((presentCount + lateCount) / expected) * 100) : 0;

            weekData.push({
                day: monthNames[date.getMonth()],
                hadir: Math.min(100, percentage),
                terlambat: lateCount,
                tidakHadir: Math.max(0, 100 - percentage),
            });
        }

        setWeeklyData(weekData);
    };

    const fetchRecentAttendance = async (karyawanUserIds: Set<string>) => {
        // Fetch attendance from TODAY (activeDate) - because user wants "Dashboard data always matches TODAY'S DATE"
        const targetDate = activeDate;
        const startOfTargetDay = new Date(targetDate);
        startOfTargetDay.setHours(0, 0, 0, 0);
        const endOfTargetDay = new Date(targetDate);
        endOfTargetDay.setHours(23, 59, 59, 999);

        const [attendanceResult, profilesResult] = await Promise.all([
            supabase.from("attendance")
                .select("id, user_id, clock_in, status")
                .gte("clock_in", startOfTargetDay.toISOString())
                .lte("clock_in", endOfTargetDay.toISOString())
                .order("clock_in", { ascending: false })
                .limit(10),
            supabase.from("profiles").select("user_id, full_name"),
        ]);

        if (attendanceResult.data) {
            const profileMap = new Map(profilesResult.data?.map(p => [p.user_id, p.full_name]) || []);
            const karyawanData = attendanceResult.data.filter(a => karyawanUserIds.has(a.user_id));

            const attendanceWithNames = karyawanData.slice(0, 5).map(record => ({
                id: record.id,
                full_name: profileMap.get(record.user_id) || "Unknown",
                clock_in: record.clock_in,
                status: record.status,
            }));
            setRecentAttendance(attendanceWithNames);
        }
    };

    const getWorkDaysInMonth = (year: number, month: number) => {
        const date = new Date(year, month, 1);
        let workDays = 0;
        while (date.getMonth() === month) {
            const dayOfWeek = date.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) workDays++;
            date.setDate(date.getDate() + 1);
        }
        return workDays;
    };

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
            onRefresh={() => fetchAllData(false)}
            refreshInterval={60}
        >
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out space-y-6">
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

                    {/* Report Date Info */}
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
                            <p className="text-sm text-slate-600">Terakhir Update</p>
                            <p className="text-base font-semibold text-slate-800">
                                {lastUpdated ? lastUpdated.toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' }) : "-"}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-slate-500">Status</p>
                            <Badge variant="outline" className="text-xs border-green-200 text-green-700 bg-green-50">
                                Sync Aktif
                            </Badge>
                        </div>
                    </div>
                </div>

                {/* No Data Warning */}
                {!hasDataForToday && !isLoading && (
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
                            <p className="font-semibold text-amber-800">Belum ada absensi hari ini</p>
                            <p className="text-sm text-amber-700">
                                Menampilkan data live untuk {activeDateDisplay}. Statistik akan muncul saat karyawan mulai clock-in.
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
                        trend={{
                            value: `+${stats.newEmployeesThisMonth} bulan ini`,
                            direction: "up",
                        }}
                        subtitle={`Dari ${stats.departments} departemen`}
                        icon={Users}
                        color="primary"
                        isLoading={isLoading}
                    />
                    <StatCard
                        title="Kehadiran Hari Ini"
                        value={stats.totalEmployees > 0 ? `${Math.round((stats.presentToday / stats.totalEmployees) * 100)}%` : "0%"}
                        trend={{
                            value: `${stats.presentToday} dari ${stats.totalEmployees}`,
                            direction: stats.presentToday >= stats.totalEmployees * 0.8 ? "up" : "down",
                        }}
                        subtitle={`Terlambat: ${stats.lateToday} orang`}
                        icon={UserCheck}
                        color="success"
                        isLoading={isLoading}
                    />
                    <StatCard
                        title="Pengajuan Cuti"
                        value={stats.pendingLeave}
                        unit="Pengajuan"
                        subtitle="Menunggu persetujuan"
                        icon={Calendar}
                        color="warning"
                        isLoading={isLoading}
                    />
                    <StatCard
                        title="Kehadiran Bulan Ini"
                        value={`${stats.attendanceRate}%`}
                        trend={{
                            value: stats.attendanceRate >= 80 ? "Di atas target" : "Di bawah target",
                            direction: stats.attendanceRate >= 80 ? "up" : "down",
                        }}
                        subtitle={`${stats.attendanceThisMonth} total absensi`}
                        icon={BarChart3}
                        color={stats.attendanceRate >= 80 ? "info" : "danger"}
                        isLoading={isLoading}
                    />
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                    {/* Attendance Trend Chart */}
                    <Card className="lg:col-span-2 border-slate-200 shadow-sm bg-white">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base font-semibold text-slate-800">Tren Kehadiran</CardTitle>
                                    <CardDescription className="text-sm">Persentase kehadiran 6 bulan terakhir</CardDescription>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs gap-1.5 border-slate-200 hover:border-slate-300"
                                >
                                    <Download className="h-3.5 w-3.5" />
                                    Export
                                </Button>
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
                    </Card>

                    {/* Department Distribution */}
                    <Card className="border-slate-200 shadow-sm bg-white">
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
                    </Card>
                </div>
            </div>
        </EnterpriseLayout>
    );
};

export default AdminDashboardNew;
