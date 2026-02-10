
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, XCircle, Briefcase, Calendar } from "lucide-react";

interface AttendanceStatsProps {
    stats: {
        present: number;
        late: number;
        absent: number;
        leave: number;
        totalDays: number;
    };
    loading?: boolean;
}

export function AttendanceStats({ stats, loading = false }: AttendanceStatsProps) {
    if (loading) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
                ))}
            </div>
        );
    }

    const items = [
        {
            label: "Total Kehadiran",
            value: stats.present,
            icon: CheckCircle2,
            color: "text-emerald-600",
            bg: "bg-emerald-50",
            border: "border-emerald-100"
        },
        {
            label: "Terlambat",
            value: stats.late,
            icon: Clock,
            color: "text-amber-600",
            bg: "bg-amber-50",
            border: "border-amber-100"
        },
        {
            label: "Tidak Hadir (Alpha)",
            value: stats.absent,
            icon: XCircle,
            color: "text-red-600",
            bg: "bg-red-50",
            border: "border-red-100"
        },
        {
            label: "Cuti / Izin",
            value: stats.leave,
            icon: Briefcase,
            color: "text-blue-600",
            bg: "bg-blue-50",
            border: "border-blue-100"
        }
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {items.map((item, index) => (
                <Card key={index} className={cn("border shadow-sm", item.border)}>
                    <CardContent className="p-4 flex flex-col justify-between h-full">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                {item.label}
                            </span>
                            <div className={cn("p-1.5 rounded-lg", item.bg)}>
                                <item.icon className={cn("w-4 h-4", item.color)} />
                            </div>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className={cn("text-2xl font-bold", item.color)}>
                                {item.value}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">Hari</span>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
