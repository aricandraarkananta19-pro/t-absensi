import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, isToday } from "date-fns";
import { id } from "date-fns/locale";
import { DailyAttendanceStatus } from "@/lib/attendanceGenerator";
import { cn } from "@/lib/utils";
import {
    MapPin, Clock, CalendarOff, CheckCircle2,
    XCircle, FileText, LogOut, AlertCircle,
    Building2, MoreHorizontal, Eye, LogIn
} from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface AttendanceHistoryTableProps {
    data: DailyAttendanceStatus[];
    isLoading?: boolean;
    onAction?: (action: 'detail' | 'location' | 'download' | 'manual', record: DailyAttendanceStatus) => void;
}

export function AttendanceHistoryTable({ data, isLoading, onAction }: AttendanceHistoryTableProps) {
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[400px] w-full gap-3">
                <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
                <p className="text-slate-500 dark:text-slate-400 font-medium animate-pulse">Memuat data kehadiran...</p>
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[400px] text-center p-8">
                <div className="h-16 w-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm mb-4 border border-slate-100 dark:border-slate-800 animate-in zoom-in duration-500">
                    <CalendarOff className="h-8 w-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Tidak Ada Data</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm max-w-[250px]">Belum ada riwayat kehadiran yang tercatat untuk periode ini.</p>
            </div>
        );
    }

    const getDuration = (start: string | null, end: string | null, date: string) => {
        if (!start) return <span className="text-slate-300">-</span>;

        if (!end) {
            const recordDate = new Date(date);
            if (isToday(recordDate)) {
                return (
                    <div className="flex items-center gap-1.5 justify-center">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600 border-2 border-white"></span>
                        </span>
                        <span className="text-xs font-bold text-blue-600 animate-pulse">Berjalan...</span>
                    </div>
                );
            }
            return (
                <div className="flex items-center justify-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-100">
                    <AlertCircle className="w-3 h-3" />
                    <span className="text-[10px] font-bold uppercase">Lupa Checkout</span>
                </div>
            );
        }

        const startTime = new Date(start).getTime();
        const endTime = new Date(end).getTime();
        const diff = endTime - startTime;

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        return (
            <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100/50 dark:bg-slate-800/50 px-2 py-1 rounded">
                {hours}j {minutes}m
            </span>
        );
    };

    const getStatusBadge = (status: string, isWeekend: boolean) => {
        if (isWeekend) {
            return <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:bg-slate-800/80"><CalendarOff className="w-3 h-3 mr-1.5" /> Libur</Badge>;
        }

        switch (status) {
            case 'present':
                return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 shadow-sm transition-all hover:scale-105"><CheckCircle2 className="w-3 h-3 mr-1.5" /> Hadir</Badge>;
            case 'late':
                return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 shadow-sm transition-all hover:scale-105"><Clock className="w-3 h-3 mr-1.5" /> Terlambat</Badge>;
            case 'early_leave':
                return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 shadow-sm transition-all hover:scale-105"><LogOut className="w-3 h-3 mr-1.5" /> Pulang Cepat</Badge>;
            case 'absent':
            case 'alpha':
                return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100 shadow-sm transition-all hover:scale-105"><XCircle className="w-3 h-3 mr-1.5" /> Alpha</Badge>;
            case 'leave':
                return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 shadow-sm transition-all hover:scale-105"><FileText className="w-3 h-3 mr-1.5" /> Cuti</Badge>;
            case 'permission':
                return <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 shadow-sm transition-all hover:scale-105"><FileText className="w-3 h-3 mr-1.5" /> Izin</Badge>;
            case 'sick':
                return <Badge variant="outline" className="bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100 shadow-sm transition-all hover:scale-105"><FileText className="w-3 h-3 mr-1.5" /> Sakit</Badge>;
            default:
                return <span className="text-slate-300">-</span>;
        }
    };

    return (
        <div className="w-full">
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shadow-none rounded-none w-full">
                <Table>
                    <TableHeader className="bg-slate-50/80 backdrop-blur-sm sticky top-0 z-20 border-b border-slate-200 dark:border-slate-700 shadow-sm">
                        <TableRow className="hover:bg-slate-50/80 border-none">
                            <TableHead className="w-[25%] font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 pl-6 h-12">Tanggal</TableHead>
                            <TableHead className="w-[15%] font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center h-12">Jam Masuk</TableHead>
                            <TableHead className="w-[15%] font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center h-12">Jam Pulang</TableHead>
                            <TableHead className="w-[15%] font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center h-12">Durasi</TableHead>
                            <TableHead className="w-[15%] font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center h-12">Status</TableHead>
                            <TableHead className="w-[15%] font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center h-12">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.map((row, index) => {
                            const isWeekend = row.status === 'weekend';
                            const isWeekendTime = new Date(row.date).getDay() === 0 || new Date(row.date).getDay() === 6;
                            const finalIsWeekend = row.isWeekend || isWeekendTime;
                            const isFuture = row.status === 'future';

                            // Future Row Style
                            if (isFuture) {
                                return (
                                    <TableRow
                                        key={row.date}
                                        className="border-b border-slate-50 bg-slate-50/20 opacity-40 hover:opacity-100 transition-opacity duration-300 group"
                                        style={{ animationDelay: `${index * 30}ms` }}
                                    >
                                        <TableCell className="pl-6 py-4">
                                            <span className="text-sm font-medium text-slate-400 group-hover:text-slate-600 dark:text-slate-300 transition-colors">
                                                {format(new Date(row.date), "EEEE, d MMM yyyy", { locale: id })}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center py-4 text-slate-300">-</TableCell>
                                        <TableCell className="text-center py-4 text-slate-300">-</TableCell>
                                        <TableCell className="text-center py-4 text-slate-300">-</TableCell>
                                        <TableCell className="text-center py-4">
                                            <Badge variant="outline" className="border-dashed border-slate-200 dark:border-slate-700 text-slate-400 font-normal shadow-none hover:bg-transparent">Belum Berlangsung</Badge>
                                        </TableCell>
                                        <TableCell className="text-center py-4 text-slate-200">
                                            <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 mx-auto"></div>
                                        </TableCell>
                                    </TableRow>
                                );
                            }

                            return (
                                <TableRow
                                    key={row.date}
                                    className={cn(
                                        "border-b border-slate-50 transition-all duration-300 group animate-in slide-in-from-bottom-2 fade-in fill-mode-backwards",
                                        finalIsWeekend ? "bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-50 dark:bg-slate-800" : "hover:bg-slate-50/40",
                                        (row.status === 'absent' || row.status === 'alpha') && !finalIsWeekend && "bg-red-50/10 hover:bg-red-50/20"
                                    )}
                                    style={{ animationDelay: `${index * 30}ms` }}
                                >
                                    <TableCell className="pl-6 py-4">
                                        <div className="flex flex-col">
                                            <span className={cn(
                                                "font-bold text-sm transition-colors",
                                                finalIsWeekend ? "text-red-500" : "text-slate-800 dark:text-slate-100 group-hover:text-blue-700"
                                            )}>
                                                {format(new Date(row.date), "EEEE, d MMM yyyy", { locale: id })}
                                            </span>
                                            {finalIsWeekend && (
                                                <span className="text-[10px] text-red-400 font-medium">Hari Libur</span>
                                            )}
                                            {row.notes && (
                                                <span className="text-[10px] text-slate-400 italic mt-0.5 truncate max-w-[150px] flex items-center gap-1">
                                                    <FileText className="w-3 h-3" /> {row.notes}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center py-4">
                                        {row.clockIn ? (
                                            <div className="inline-flex items-center justify-center bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-sm px-3 py-1.5 rounded-md font-mono text-xs font-bold border border-slate-200 dark:border-slate-700 group-hover:border-blue-300 group-hover:shadow-md transition-all group-hover:scale-105">
                                                {format(new Date(row.clockIn), "HH:mm")}
                                            </div>
                                        ) : (
                                            <span className="text-slate-300 text-lg">·</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center py-4">
                                        {row.clockOut ? (
                                            <div className="inline-flex items-center justify-center bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-sm px-3 py-1.5 rounded-md font-mono text-xs font-bold border border-slate-200 dark:border-slate-700 group-hover:border-blue-300 group-hover:shadow-md transition-all group-hover:scale-105">
                                                {format(new Date(row.clockOut), "HH:mm")}
                                            </div>
                                        ) : (
                                            <span className="text-slate-300 text-lg">·</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center py-4">
                                        {getDuration(row.clockIn, row.clockOut, row.date)}
                                    </TableCell>
                                    <TableCell className="text-center py-4">
                                        <div className="flex justify-center scale-95 origin-center group-hover:scale-100 transition-transform">
                                            {getStatusBadge(row.status, finalIsWeekend)}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center py-4">
                                        <div className="flex justify-center items-center gap-1">
                                            {/* Action Buttons: Inline Premium Design */}
                                            <TooltipProvider delayDuration={100}>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => onAction?.('detail', row)}
                                                            className="h-8 w-8 text-slate-400 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors duration-200 focus:ring-1 focus:ring-blue-200"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="text-xs bg-slate-900 border-slate-700 font-semibold px-2.5 py-1.5 shadow-xl">
                                                        Lihat Detail
                                                    </TooltipContent>
                                                </Tooltip>

                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => onAction?.('location', row)}
                                                            className="h-8 w-8 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors duration-200 focus:ring-1 focus:ring-indigo-200"
                                                        >
                                                            <MapPin className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="text-xs bg-slate-900 border-slate-700 font-semibold px-2.5 py-1.5 shadow-xl">
                                                        Cek Lokasi
                                                    </TooltipContent>
                                                </Tooltip>

                                                {row.clockIn && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => onAction?.('download', row)}
                                                                className="h-8 w-8 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 rounded-lg transition-colors duration-200 focus:ring-1 focus:ring-emerald-200"
                                                            >
                                                                <FileText className="h-4 w-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="text-xs bg-emerald-600 border-emerald-500 font-semibold px-2.5 py-1.5 shadow-xl">
                                                            Unduh Bukti PDF
                                                        </TooltipContent>
                                                    </Tooltip>
                                                )}

                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => onAction?.('manual', row)}
                                                            className="h-8 w-8 text-slate-400 hover:bg-amber-50 hover:text-amber-600 rounded-lg transition-colors duration-200 focus:ring-1 focus:ring-amber-200"
                                                        >
                                                            <Clock className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="text-xs bg-amber-600 border-amber-500 font-semibold px-2.5 py-1.5 shadow-xl text-white">
                                                        Edit / Set Manual
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile Card View (SaaS App Layout - Replicating Premium Design) */}
            <div className="md:hidden space-y-4 p-1">
                <div className="w-full">
                    {/* Table Header exactly matching the design */}
                    <div className="grid grid-cols-4 bg-[#8C94A0] rounded-t-xl text-white py-3 px-4 text-[10px] uppercase font-bold tracking-wider opacity-90">
                        <div>Date</div>
                        <div>Clock In</div>
                        <div>Clock Out</div>
                        <div>Work Hours</div>
                    </div>

                    {/* Table Body exactly matching the design */}
                    <div className="bg-white dark:bg-slate-900 border-x border-b border-slate-100 dark:border-slate-800 rounded-b-xl overflow-hidden shadow-sm">
                        {data.map((row, index) => {
                            const isWeekend = row.status === 'weekend';
                            const isWeekendTime = new Date(row.date).getDay() === 0 || new Date(row.date).getDay() === 6;
                            const finalIsWeekend = row.isWeekend || isWeekendTime;
                            const isFuture = row.status === 'future';

                            if (isFuture || finalIsWeekend) return null; // Only show valid working days in this view based on design to keep it clean

                            // Custom date format for design: "Fri, 23 Jan"
                            const formattedDate = format(new Date(row.date), "E, d MMM", { locale: id }).replace(',', '');

                            // Work Hours calculation for design
                            let workHoursStr = '- -';
                            if (row.clockIn && row.clockOut) {
                                const startTime = new Date(row.clockIn).getTime();
                                const endTime = new Date(row.clockOut).getTime();
                                const diff = endTime - startTime;
                                const hours = Math.floor(diff / (1000 * 60 * 60));
                                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                workHoursStr = minutes > 0 ? `${hours}h${minutes}m` : `${hours}h`;
                            }

                            return (
                                <div key={row.date} className="grid grid-cols-4 items-center border-b border-slate-50 py-3 px-4 text-[11px] font-medium text-slate-700 dark:text-slate-200">
                                    <div className="text-slate-900 dark:text-white font-semibold truncate pr-1">{formattedDate}</div>
                                    <div>{row.clockIn ? format(new Date(row.clockIn), "HH:mm") : '- -'}</div>
                                    <div>{row.clockOut ? format(new Date(row.clockOut), "HH:mm") : '- -'}</div>
                                    <div>{workHoursStr}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
