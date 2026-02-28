import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, isSameDay } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, FileSpreadsheet, Download } from "lucide-react";
import { DailyAttendanceStatus } from "@/lib/attendanceGenerator";
import { cn } from "@/lib/utils";
import MobileNavigation from "@/components/MobileNavigation";

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

    const stats = useMemo(() => {
        return {
            present: attendanceList.filter(l => ['present', 'late', 'early_leave'].includes(l.status)).length,
            late: attendanceList.filter(l => l.status === 'late').length,
            absent: attendanceList.filter(l => ['absent', 'alpha'].includes(l.status)).length,
            leave: attendanceList.filter(l => ['leave', 'permission', 'sick'].includes(l.status)).length,
        };
    }, [attendanceList]);

    // Simple calendar logic
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = new Date(monthStart);
    startDate.setDate(startDate.getDate() - startDate.getDay()); // Start from Sunday

    const endDate = new Date(monthEnd);
    if (endDate.getDay() !== 6) {
        endDate.setDate(endDate.getDate() + (6 - endDate.getDay())); // End on Saturday
    }

    const calendarDays = [];
    let day = new Date(startDate);
    while (day <= endDate) {
        calendarDays.push(new Date(day));
        day.setDate(day.getDate() + 1);
    }

    const getStatusForDate = (date: Date) => {
        return attendanceList.find(a => isSameDay(new Date(a.date), date));
    };

    const getStatusColor = (status?: string) => {
        if (!status) return "bg-slate-100";
        if (['present'].includes(status)) return "bg-green-500";
        if (status === 'late') return "bg-yellow-500";
        if (status === 'early_leave') return "bg-blue-500";
        if (['absent', 'alpha'].includes(status)) return "bg-red-500";
        if (['leave', 'permission', 'sick'].includes(status)) return "bg-purple-500";
        return "bg-slate-100";
    };

    const getStatusText = (status: string) => {
        if (status === 'present') return { text: "Hadir", color: "text-[#16A34A]", bg: "bg-green-50" };
        if (status === 'late') return { text: "Terlambat", color: "text-[#F59E0B]", bg: "bg-yellow-50" };
        if (status === 'early_leave') return { text: "Pulang Cepat", color: "text-[#2563EB]", bg: "bg-blue-50" };
        if (status === 'leave' || status === 'permission') return { text: "Izin/Cuti", color: "text-purple-600", bg: "bg-purple-50" };
        return { text: "Alpha", color: "text-[#DC2626]", bg: "bg-red-50" };
    };

    return (
        <div className="flex flex-col min-h-screen bg-[#F8FAFC] pb-[100px] font-sans">
            {/* Header */}
            <div className="bg-[#0F172A] text-white pt-[max(env(safe-area-inset-top),32px)] pb-6 px-6">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-xl font-bold tracking-tight">Riwayat Kehadiran</h1>
                    <button onClick={onExport} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center active:scale-95 transition-transform border border-white/10">
                        <Download className="w-4 h-4 text-white" />
                    </button>
                </div>
            </div>

            <div className="px-4 -mt-4 relative z-10">
                {/* Stats row */}
                <div className="grid grid-cols-4 gap-2 mb-6 bg-white p-3 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-slate-100">
                    <div className="flex flex-col items-center justify-center text-center p-2">
                        <span className="text-lg font-bold text-[#16A34A]">{stats.present}</span>
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">Hadir</span>
                    </div>
                    <div className="flex flex-col items-center justify-center text-center p-2 border-l border-slate-100">
                        <span className="text-lg font-bold text-[#F59E0B]">{stats.late}</span>
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">Telat</span>
                    </div>
                    <div className="flex flex-col items-center justify-center text-center p-2 border-l border-slate-100">
                        <span className="text-lg font-bold text-[#DC2626]">{stats.absent}</span>
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">Alpha</span>
                    </div>
                    <div className="flex flex-col items-center justify-center text-center p-2 border-l border-slate-100">
                        <span className="text-lg font-bold text-purple-600">{stats.leave}</span>
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">Cuti</span>
                    </div>
                </div>

                {/* Calendar View */}
                <div className="bg-white rounded-[24px] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-slate-100 p-5 mb-6">
                    <div className="flex justify-between items-center mb-6">
                        <span className="text-[15px] font-bold text-[#0F172A]">{format(currentMonth, 'MMMM yyyy', { locale: idLocale })}</span>
                        <div className="flex gap-2">
                            <button onClick={onPrevMonth} className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 active:bg-slate-100"><ChevronLeft className="w-4 h-4" /></button>
                            <button onClick={onNextMonth} className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 active:bg-slate-100"><ChevronRight className="w-4 h-4" /></button>
                        </div>
                    </div>

                    <div className="grid grid-cols-7 gap-y-4 gap-x-1 mb-2">
                        {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(d => (
                            <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase">{d}</div>
                        ))}
                        {calendarDays.map((d, i) => {
                            const isCurrentMonth = d.getMonth() === currentMonth.getMonth();
                            const isSelected = isSameDay(d, selectedDate);
                            const record = getStatusForDate(d);
                            const colorClass = getStatusColor(record?.status);
                            const labelClass = isSelected ? "bg-[#0F172A] text-white" : "text-[#0F172A]";

                            return (
                                <button
                                    key={i}
                                    onClick={() => setSelectedDate(d)}
                                    className={cn("flex flex-col items-center justify-center p-1 rounded-xl transition-all", !isCurrentMonth && "opacity-30")}
                                >
                                    <span className={cn("w-7 h-7 flex items-center justify-center rounded-full text-xs font-semibold mb-1", labelClass)}>{d.getDate()}</span>
                                    <div className={cn("w-1.5 h-1.5 rounded-full", colorClass, !record && "opacity-0")} />
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-slate-100 justify-center">
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500" /><span className="text-[10px] font-medium text-slate-500">Hadir</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-yellow-500" /><span className="text-[10px] font-medium text-slate-500">Telat</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500" /><span className="text-[10px] font-medium text-slate-500">Alpha</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" /><span className="text-[10px] font-medium text-slate-500">Pulang</span></div>
                    </div>
                </div>

                {/* Detail List for selected date or month */}
                <h3 className="text-[13px] font-bold text-[#0F172A] uppercase tracking-wider mb-4 px-2">Detail Kehadiran</h3>

                <div className="space-y-3">
                    {attendanceList.map((item, idx) => {
                        const style = getStatusText(item.status);
                        return (
                            <div key={idx} className="bg-white p-4 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.02)] border border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={cn("w-10 h-10 rounded-full flex flex-col justify-center items-center", style.bg)}>
                                        <span className={cn("text-xs font-bold", style.color)}>{new Date(item.date).getDate()}</span>
                                        <span className={cn("text-[8px] font-bold uppercase", style.color)}>{format(new Date(item.date), 'MMM', { locale: idLocale })}</span>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-[13px] font-bold text-[#0F172A]">{format(new Date(item.date), 'EEEE', { locale: idLocale })}</span>
                                            <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded uppercase", style.bg, style.color)}>{style.text}</span>
                                        </div>
                                        <div className="flex gap-3 text-[11px] font-medium text-slate-500">
                                            <span>M: {item.clockIn ? item.clockIn.substring(11, 16) : '--:--'}</span>
                                            <span>K: {item.clockOut ? item.clockOut.substring(11, 16) : '--:--'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Total</span>
                                    <span className="text-sm font-bold text-[#0F172A]">{item.clockIn && item.clockOut ? Math.floor((new Date(item.clockOut).getTime() - new Date(item.clockIn).getTime()) / (1000 * 60 * 60)) : '-'} <span className="text-[10px] font-semibold text-slate-500">j</span></span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <MobileNavigation />
        </div>
    );
}
