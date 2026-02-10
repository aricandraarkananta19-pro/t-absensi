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
    Building2, MoreHorizontal, Eye
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AttendanceHistoryTableProps {
    data: DailyAttendanceStatus[];
    isLoading?: boolean;
}

export function AttendanceHistoryTable({ data, isLoading }: AttendanceHistoryTableProps) {
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[400px] w-full gap-3">
                <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
                <p className="text-slate-500 font-medium animate-pulse">Memuat data kehadiran...</p>
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[400px] text-center p-8">
                <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center shadow-sm mb-4 border border-slate-100 animate-in zoom-in duration-500">
                    <CalendarOff className="h-8 w-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-1">Tidak Ada Data</h3>
                <p className="text-slate-500 text-sm max-w-[250px]">Belum ada riwayat kehadiran yang tercatat untuk periode ini.</p>
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
            <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100/50 px-2 py-1 rounded">
                {hours}j {minutes}m
            </span>
        );
    };

    const getStatusBadge = (status: string, isWeekend: boolean) => {
        if (isWeekend) {
            return <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"><CalendarOff className="w-3 h-3 mr-1.5" /> Libur</Badge>;
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
        <div className="w-full bg-white border-t border-slate-100 shadow-none rounded-none">
            <Table>
                <TableHeader className="bg-slate-50/80 backdrop-blur-sm sticky top-0 z-20 border-b border-slate-200 shadow-sm">
                    <TableRow className="hover:bg-slate-50/80 border-none">
                        <TableHead className="w-[25%] font-bold text-xs uppercase tracking-wider text-slate-500 pl-6 h-12">Tanggal</TableHead>
                        <TableHead className="w-[15%] font-bold text-xs uppercase tracking-wider text-slate-500 text-center h-12">Jam Masuk</TableHead>
                        <TableHead className="w-[15%] font-bold text-xs uppercase tracking-wider text-slate-500 text-center h-12">Jam Pulang</TableHead>
                        <TableHead className="w-[15%] font-bold text-xs uppercase tracking-wider text-slate-500 text-center h-12">Durasi</TableHead>
                        <TableHead className="w-[15%] font-bold text-xs uppercase tracking-wider text-slate-500 text-center h-12">Status</TableHead>
                        <TableHead className="w-[15%] font-bold text-xs uppercase tracking-wider text-slate-500 text-center h-12">Aksi</TableHead>
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
                                        <span className="text-sm font-medium text-slate-400 group-hover:text-slate-600 transition-colors">
                                            {format(new Date(row.date), "EEEE, d MMM yyyy", { locale: id })}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-center py-4 text-slate-300">-</TableCell>
                                    <TableCell className="text-center py-4 text-slate-300">-</TableCell>
                                    <TableCell className="text-center py-4 text-slate-300">-</TableCell>
                                    <TableCell className="text-center py-4">
                                        <Badge variant="outline" className="border-dashed border-slate-200 text-slate-400 font-normal shadow-none hover:bg-transparent">Belum Berlangsung</Badge>
                                    </TableCell>
                                    <TableCell className="text-center py-4 text-slate-200">
                                        <div className="w-8 h-8 rounded-full bg-slate-50 mx-auto"></div>
                                    </TableCell>
                                </TableRow>
                            );
                        }

                        return (
                            <TableRow
                                key={row.date}
                                className={cn(
                                    "border-b border-slate-50 transition-all duration-300 group animate-in slide-in-from-bottom-2 fade-in fill-mode-backwards",
                                    finalIsWeekend ? "bg-slate-50/50 hover:bg-slate-50" : "hover:bg-slate-50/40",
                                    (row.status === 'absent' || row.status === 'alpha') && !finalIsWeekend && "bg-red-50/10 hover:bg-red-50/20"
                                )}
                                style={{ animationDelay: `${index * 30}ms` }}
                            >
                                <TableCell className="pl-6 py-4">
                                    <div className="flex flex-col">
                                        <span className={cn(
                                            "font-bold text-sm transition-colors",
                                            finalIsWeekend ? "text-red-500" : "text-slate-800 group-hover:text-blue-700"
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
                                        <div className="inline-flex items-center justify-center bg-white text-slate-700 shadow-sm px-3 py-1.5 rounded-md font-mono text-xs font-bold border border-slate-200 group-hover:border-blue-300 group-hover:shadow-md transition-all group-hover:scale-105">
                                            {format(new Date(row.clockIn), "HH:mm")}
                                        </div>
                                    ) : (
                                        <span className="text-slate-300 text-lg">·</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-center py-4">
                                    {row.clockOut ? (
                                        <div className="inline-flex items-center justify-center bg-white text-slate-700 shadow-sm px-3 py-1.5 rounded-md font-mono text-xs font-bold border border-slate-200 group-hover:border-blue-300 group-hover:shadow-md transition-all group-hover:scale-105">
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
                                    <div className="flex justify-center items-center">
                                        {/* Action Button: Visible on Hover */}
                                        <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-100 hover:text-blue-600 rounded-full focus:ring-0 focus:ring-offset-0">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48 bg-white/95 backdrop-blur-sm border-slate-200 shadow-lg">
                                                    <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wider text-slate-500">Aksi</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem className="cursor-pointer text-sm font-medium focus:bg-slate-100">
                                                        <Eye className="w-4 h-4 mr-2 text-slate-500" /> Lihat Detail
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="cursor-pointer text-sm font-medium focus:bg-slate-100">
                                                        <MapPin className="w-4 h-4 mr-2 text-slate-500" /> Cek Lokasi
                                                    </DropdownMenuItem>
                                                    {row.clockIn && (
                                                        <DropdownMenuItem className="cursor-pointer text-sm font-medium text-blue-600 focus:text-blue-700 focus:bg-blue-50">
                                                            <FileText className="w-4 h-4 mr-2" /> Unduh Bukti
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>

                                        {/* Default State: Location Icon (Fades out on hover) */}
                                        <div className="absolute opacity-100 group-hover:opacity-0 transition-opacity duration-300 pointer-events-none">
                                            {row.clockIn ? (
                                                <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
                                                    <Building2 className="h-3.5 w-3.5" />
                                                </div>
                                            ) : (
                                                <span className="text-slate-200">-</span>
                                            )}
                                        </div>
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div >
    );
}
