import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, isSameDay, subMonths } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Download, Clock, ArrowRight, Calendar, Search } from "lucide-react";
import { DailyAttendanceStatus } from "@/lib/attendanceGenerator";
import { cn } from "@/lib/utils";
import MobileNavigation from "@/components/MobileNavigation";
import { useTheme } from "@/contexts/ThemeContext";

interface Props {
    attendanceList: DailyAttendanceStatus[];
    currentMonth: Date;
    onPrevMonth: () => void;
    onNextMonth: () => void;
    onExport: () => void;
}

export default function RiwayatAbsensiMobile({
    attendanceList,
    currentMonth,
    onPrevMonth,
    onNextMonth,
    onExport
}: Props) {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
    const { isDark } = useTheme();

    const stats = useMemo(() => {
        return {
            present: attendanceList.filter(l => ['present', 'late', 'early_leave'].includes(l.status)).length,
            late: attendanceList.filter(l => l.status === 'late').length,
            absent: attendanceList.filter(l => ['absent', 'alpha'].includes(l.status)).length,
            leave: attendanceList.filter(l => ['leave', 'permission', 'sick'].includes(l.status)).length,
        };
    }, [attendanceList]);

    const attendanceRate = useMemo(() => {
        const total = stats.present + stats.absent + stats.leave;
        return total > 0 ? Math.round((stats.present / total) * 100) : 0;
    }, [stats]);

    // Calendar logic
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = new Date(monthStart);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    const endDate = new Date(monthEnd);
    if (endDate.getDay() !== 6) endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
    const calendarDays: Date[] = [];
    let day = new Date(startDate);
    while (day <= endDate) { calendarDays.push(new Date(day)); day.setDate(day.getDate() + 1); }

    const getStatusForDate = (date: Date) => attendanceList.find(a => isSameDay(new Date(a.date), date));

    const getStatusDot = (status?: string) => {
        if (!status) return "bg-transparent";
        if (['present'].includes(status)) return "bg-emerald-500";
        if (status === 'late') return "bg-orange-500";
        if (status === 'early_leave') return "bg-blue-500";
        if (['absent', 'alpha'].includes(status)) return "bg-red-500";
        if (['leave', 'permission', 'sick'].includes(status)) return "bg-violet-500";
        if (status === 'weekend') return "bg-slate-300";
        return "bg-transparent";
    };

    const getStatusBadge = (status: string) => {
        const map: Record<string, { text: string; color: string; bg: string }> = {
            present: { text: "Hadir", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
            late: { text: "Terlambat", color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
            early_leave: { text: "Pulang Cepat", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
            leave: { text: "Cuti", color: "text-violet-700", bg: "bg-violet-50 border-violet-200" },
            permission: { text: "Izin", color: "text-violet-700", bg: "bg-violet-50 border-violet-200" },
            sick: { text: "Sakit", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
            absent: { text: "Alpha", color: "text-red-700", bg: "bg-red-50 border-red-200" },
            alpha: { text: "Alpha", color: "text-red-700", bg: "bg-red-50 border-red-200" },
            future: { text: "Mendatang", color: "text-slate-500 dark:text-slate-400", bg: "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700" },
            weekend: { text: "Libur", color: "text-slate-500 dark:text-slate-400", bg: "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700" },
        };
        return map[status] || { text: status, color: "text-slate-600 dark:text-slate-300", bg: "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700" };
    };

    // Selected date detail
    const selectedRecord = getStatusForDate(selectedDate);

    // Group records by week for list view
    const filteredList = attendanceList.filter(a => !['future', 'weekend'].includes(a.status));

    return (
        <div className={cn("flex flex-col min-h-screen pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500", isDark ? "bg-slate-900" : "bg-slate-50")}>
            {/* ===== HEADER ===== */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-violet-800" />
                <div className="relative z-10 pt-[max(env(safe-area-inset-top),40px)] pb-6 px-5">
                    <div className="flex justify-between items-center">
                        <h1 className="text-xl font-bold text-white tracking-tight">Riwayat Kehadiran</h1>
                        <button onClick={onExport} className="w-9 h-9 rounded-xl bg-white/20 dark:bg-slate-900/30 flex items-center justify-center border border-white/10 active:scale-95 transition-transform">
                            <Download className="w-4 h-4 text-white" />
                        </button>
                    </div>
                </div>
            </div>

            {/* ===== STATS ROW ===== */}
            <div className="px-5 -mt-3 relative z-10">
                <div className={cn("rounded-2xl shadow-sm border p-4", isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100")}>
                    <div className="grid grid-cols-4 gap-1">
                        <div className="text-center">
                            <span className="text-2xl font-bold text-emerald-600 tabular-nums">{stats.present}</span>
                            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Hadir</span>
                        </div>
                        <div className={cn("text-center border-l", isDark ? "border-slate-700" : "border-slate-100")}>
                            <span className="text-2xl font-bold text-orange-500 tabular-nums">{stats.late}</span>
                            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Telat</span>
                        </div>
                        <div className={cn("text-center border-l", isDark ? "border-slate-700" : "border-slate-100")}>
                            <span className="text-2xl font-bold text-red-500 tabular-nums">{stats.absent}</span>
                            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Alpha</span>
                        </div>
                        <div className={cn("text-center border-l", isDark ? "border-slate-700" : "border-slate-100")}>
                            <span className="text-2xl font-bold text-violet-600 tabular-nums">{stats.leave}</span>
                            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Cuti</span>
                        </div>
                    </div>

                    {/* Attendance rate bar */}
                    <div className={cn("mt-3 pt-3 border-t flex items-center gap-3", isDark ? "border-slate-700" : "border-slate-100")}>
                        <div className={cn("flex-1 h-2 rounded-full overflow-hidden", isDark ? "bg-slate-700" : "bg-slate-100")}>
                            <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-700" style={{ width: `${attendanceRate}%` }} />
                        </div>
                        <span className="text-xs font-bold text-indigo-600">{attendanceRate}%</span>
                    </div>
                </div>
            </div>

            {/* ===== MONTH NAVIGATION ===== */}
            <div className="px-5 mt-5 flex items-center justify-between">
                <button onClick={onPrevMonth} className={cn("w-9 h-9 rounded-xl flex items-center justify-center shadow-sm border active:scale-95 transition-transform", isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100")}>
                    <ChevronLeft className={cn("w-5 h-5", isDark ? "text-slate-300" : "text-slate-600")} />
                </button>
                <span className={cn("text-sm font-bold capitalize", isDark ? "text-slate-100" : "text-slate-800")}>
                    {format(currentMonth, 'MMMM yyyy', { locale: idLocale })}
                </span>
                <button onClick={onNextMonth} className={cn("w-9 h-9 rounded-xl flex items-center justify-center shadow-sm border active:scale-95 transition-transform", isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100")}>
                    <ChevronRight className={cn("w-5 h-5", isDark ? "text-slate-300" : "text-slate-600")} />
                </button>
            </div>

            {/* ===== CALENDAR VIEW ===== */}
            <div className="px-5 mt-4">
                <div className={cn("rounded-2xl shadow-sm border p-4", isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100")}>
                    {/* Day headers */}
                    <div className="grid grid-cols-7 gap-y-3 gap-x-0.5 mb-3">
                        {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(d => (
                            <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">{d}</div>
                        ))}

                        {calendarDays.map((d, i) => {
                            const isCurrentMonth = d.getMonth() === currentMonth.getMonth();
                            const isSelected = isSameDay(d, selectedDate);
                            const isToday = isSameDay(d, new Date());
                            const record = getStatusForDate(d);
                            const dotColor = getStatusDot(record?.status);

                            return (
                                <button
                                    key={i}
                                    onClick={() => setSelectedDate(d)}
                                    className={cn(
                                        "flex flex-col items-center justify-center py-1.5 rounded-xl transition-colors active:scale-95",
                                        !isCurrentMonth && "opacity-25",
                                        isSelected && "bg-indigo-600 shadow-sm",
                                        isToday && !isSelected && "bg-indigo-50"
                                    )}
                                >
                                    <span className={cn(
                                        "text-xs font-semibold tabular-nums",
                                        isSelected ? "text-white" : isToday ? "text-indigo-600 font-bold" : "text-slate-700 dark:text-slate-200"
                                    )}>
                                        {d.getDate()}
                                    </span>
                                    <div className={cn(
                                        "w-1.5 h-1.5 rounded-full mt-0.5 transition-all",
                                        isSelected ? "bg-white dark:bg-slate-900/60" : dotColor,
                                        !record && "opacity-0"
                                    )} />
                                </button>
                            );
                        })}
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 justify-center">
                        {[
                            { color: "bg-emerald-500", label: "Hadir" },
                            { color: "bg-orange-500", label: "Telat" },
                            { color: "bg-red-500", label: "Alpha" },
                            { color: "bg-violet-500", label: "Cuti/Izin" },
                        ].map(item => (
                            <div key={item.label} className="flex items-center gap-1.5">
                                <div className={cn("w-2 h-2 rounded-full", item.color)} />
                                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Selected date detail */}
                {selectedRecord && selectedRecord.status !== 'future' && selectedRecord.status !== 'weekend' && (
                    <div className="mt-3 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-4 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                {format(selectedDate, 'EEEE, d MMMM', { locale: idLocale })}
                            </span>
                            {(() => {
                                const badge = getStatusBadge(selectedRecord.status);
                                return (
                                    <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-lg border", badge.bg, badge.color)}>
                                        {badge.text}
                                    </span>
                                );
                            })()}
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                                    {selectedRecord.clockIn ? new Date(selectedRecord.clockIn).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                </span>
                            </div>
                            <ArrowRight className="w-3 h-3 text-slate-300" />
                            <div className="flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                                    {selectedRecord.clockOut ? new Date(selectedRecord.clockOut).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ===== DETAIL LIST ===== */}
            <div className="px-5 mt-6">
                <h3 className={cn("text-sm font-bold mb-3", isDark ? "text-slate-100" : "text-slate-800")}>Detail Kehadiran</h3>

                {filteredList.length === 0 ? (
                    <div className={cn("rounded-2xl shadow-sm border p-8 text-center", isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100")}>
                        <div className={cn("w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3", isDark ? "bg-slate-700" : "bg-indigo-50")}>
                            <Search className={cn("w-6 h-6", isDark ? "text-slate-400" : "text-indigo-400")} />
                        </div>
                        <p className={cn("text-sm font-semibold", isDark ? "text-slate-300" : "text-slate-400")}>Belum ada data kehadiran</p>
                        <p className="text-xs text-slate-500 mt-1">Data akan muncul setelah Anda melakukan check-in harian.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filteredList.map((item, idx) => {
                            const badge = getStatusBadge(item.status);
                            const duration = item.clockIn && item.clockOut
                                ? Math.floor((new Date(item.clockOut).getTime() - new Date(item.clockIn).getTime()) / (1000 * 60 * 60))
                                : null;

                            return (
                                <div key={idx} className={cn("rounded-xl shadow-sm border p-3.5 flex items-center gap-3 active:scale-[0.98] transition-transform", isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100")}>
                                    {/* Date circle */}
                                    <div className={cn("w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 border", badge.bg)}>
                                        <span className={cn("text-sm font-bold leading-none", badge.color)}>{new Date(item.date).getDate()}</span>
                                        <span className={cn("text-[8px] font-bold uppercase leading-tight mt-0.5", badge.color)}>
                                            {format(new Date(item.date), 'MMM', { locale: idLocale })}
                                        </span>
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100">{format(new Date(item.date), 'EEEE', { locale: idLocale })}</span>
                                            <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border", badge.bg, badge.color)}>
                                                {badge.text}
                                            </span>
                                        </div>
                                        <div className="flex gap-3 text-[11px] font-medium text-slate-400">
                                            <span>Masuk: {item.clockIn ? new Date(item.clockIn).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                                            <span>Keluar: {item.clockOut ? new Date(item.clockOut).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                                        </div>
                                    </div>

                                    {/* Duration */}
                                    {duration !== null && (
                                        <div className="text-right shrink-0">
                                            <span className="text-sm font-bold text-slate-800 dark:text-slate-100 tabular-nums">{duration}</span>
                                            <span className="text-[10px] font-medium text-slate-400 ml-0.5">j</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <MobileNavigation />
        </div>
    );
}
