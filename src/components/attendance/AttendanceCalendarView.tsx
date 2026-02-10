
import { format, getDay, isSameMonth, isToday, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay } from "date-fns";
import { id } from "date-fns/locale";
import { DailyAttendanceStatus } from "@/lib/attendanceGenerator";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, XCircle, FileText, AlertCircle, CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AttendanceCalendarViewProps {
    data: DailyAttendanceStatus[];
    currentMonth?: Date;
}

export function AttendanceCalendarView({ data, currentMonth = new Date() }: AttendanceCalendarViewProps) {
    // 1. Determine the month to display (from data or prop). 
    // If data spans multiple months, this simple view might need pagination or stacking. 
    // Converting to a map for easy lookup
    const dataMap = new Map(data.map(d => [format(new Date(d.date), 'yyyy-MM-dd'), d]));

    // Get the range from data or fallback to current month
    const firstDate = data.length > 0 ? new Date(data[0].date) : startOfMonth(currentMonth);
    const lastDate = data.length > 0 ? new Date(data[data.length - 1].date) : endOfMonth(currentMonth);

    // Generate calendar grid (Monthly view of the first date's month)
    const monthStart = startOfMonth(firstDate);
    const monthEnd = endOfMonth(firstDate);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    const weekDays = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden m-1">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-blue-600" />
                    {format(monthStart, 'MMMM yyyy', { locale: id })}
                </h3>
                <div className="flex gap-2">
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded-md shadow-sm">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                        <span className="text-[10px] font-semibold text-slate-600">Hadir</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded-md shadow-sm">
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                        <span className="text-[10px] font-semibold text-slate-600">Telat</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded-md shadow-sm">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                        <span className="text-[10px] font-semibold text-slate-600">Alpha</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
                {weekDays.map((d, i) => (
                    <div key={d} className={cn(
                        "py-3 text-center text-xs font-bold uppercase tracking-wider",
                        i === 5 || i === 6 ? "text-red-500 bg-red-50/30" : "text-slate-500"
                    )}>
                        {d}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 divide-x divide-slate-100 bg-slate-50/20">
                {calendarDays.map((day, idx) => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const record = dataMap.get(dateKey);
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    const isCurrentMonth = isSameMonth(day, monthStart);

                    if (!isCurrentMonth) {
                        return (
                            <div key={dateKey} className="min-h-[110px] bg-slate-50/50 p-2 opacity-50 flex flex-col items-start border-b border-slate-100">
                                <span className="text-xs font-semibold text-slate-400">{format(day, 'd')}</span>
                            </div>
                        );
                    }

                    // Render Status Logic
                    let bgColor = "bg-white hover:bg-slate-50";
                    let accentColor = "border-transparent";
                    let content = null;

                    if (record) {
                        switch (record.status) {
                            case 'present':
                                bgColor = "bg-emerald-50/20 hover:bg-emerald-50/40";
                                accentColor = "border-emerald-500";
                                content = (
                                    <div className="mt-auto w-full">
                                        <Badge variant="outline" className="w-full justify-center bg-emerald-100/50 text-emerald-700 border-emerald-200 text-[10px] h-5 mb-1 shadow-sm">
                                            {record.clockIn ? format(new Date(record.clockIn), 'HH:mm') : 'Hadir'}
                                        </Badge>
                                    </div>
                                );
                                break;
                            case 'late':
                                bgColor = "bg-amber-50/20 hover:bg-amber-50/40";
                                accentColor = "border-amber-500";
                                content = (
                                    <div className="mt-auto w-full">
                                        <Badge variant="outline" className="w-full justify-center bg-amber-100/50 text-amber-700 border-amber-200 text-[10px] h-5 mb-1 shadow-sm">
                                            {record.clockIn ? format(new Date(record.clockIn), 'HH:mm') : 'Telat'}
                                        </Badge>
                                    </div>
                                );
                                break;
                            case 'early_leave':
                                bgColor = "bg-blue-50/20 hover:bg-blue-50/40";
                                accentColor = "border-blue-500";
                                content = (
                                    <div className="mt-auto w-full">
                                        <Badge variant="outline" className="w-full justify-center bg-blue-100/50 text-blue-700 border-blue-200 text-[10px] h-5 mb-1 shadow-sm">
                                            Pulang Cepat
                                        </Badge>
                                    </div>
                                );
                                break;
                            case 'absent':
                            case 'alpha':
                                bgColor = "bg-red-50/20 hover:bg-red-50/40";
                                accentColor = "border-red-500";
                                content = (
                                    <div className="mt-auto w-full">
                                        <div className="mx-auto bg-red-100 text-red-600 rounded-full w-6 h-6 flex items-center justify-center mb-1">
                                            <XCircle className="w-4 h-4" />
                                        </div>
                                    </div>
                                );
                                break;
                            case 'leave':
                                bgColor = "bg-purple-50/20 hover:bg-purple-50/40";
                                accentColor = "border-purple-500";
                                content = (
                                    <div className="mt-auto w-full">
                                        <Badge variant="outline" className="w-full justify-center bg-purple-100/50 text-purple-700 border-purple-200 text-[10px] h-5 mb-1 shadow-sm">Cuti</Badge>
                                    </div>
                                );
                                break;
                            case 'permission':
                                bgColor = "bg-indigo-50/20 hover:bg-indigo-50/40";
                                accentColor = "border-indigo-500";
                                content = (
                                    <div className="mt-auto w-full">
                                        <Badge variant="outline" className="w-full justify-center bg-indigo-100/50 text-indigo-700 border-indigo-200 text-[10px] h-5 mb-1 shadow-sm">Izin</Badge>
                                    </div>
                                );
                                break;
                            case 'sick':
                                bgColor = "bg-pink-50/20 hover:bg-pink-50/40";
                                accentColor = "border-pink-500";
                                content = (
                                    <div className="mt-auto w-full">
                                        <Badge variant="outline" className="w-full justify-center bg-pink-100/50 text-pink-700 border-pink-200 text-[10px] h-5 mb-1 shadow-sm">Sakit</Badge>
                                    </div>
                                );
                                break;
                            default:
                                if (isWeekend) {
                                    bgColor = "bg-slate-50/50";
                                }
                        }
                    } else {
                        // Current month but no record (Future or before join?)
                        if (isWeekend) bgColor = "bg-slate-50/50";
                    }

                    return (
                        <div key={dateKey} className={cn(
                            "min-h-[110px] p-2 flex flex-col items-start justify-between border-b border-slate-100 transition-all border-l-4",
                            bgColor,
                            accentColor
                        )}>
                            <div className="flex justify-between w-full">
                                <span className={cn(
                                    "text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full",
                                    isToday(day) ? "bg-blue-600 text-white shadow-md" : (isWeekend ? "text-red-500 bg-white/50" : "text-slate-700")
                                )}>{format(day, 'd')}</span>
                                {isToday(day) && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 rounded-sm h-fit">Today</span>}
                            </div>

                            {content}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
