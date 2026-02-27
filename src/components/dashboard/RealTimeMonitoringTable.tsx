import { useState, useEffect, memo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Clock, Users, Wifi, WifiOff, AlertCircle, CheckCircle, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

// Brand Colors
const BRAND_COLORS = {
    blue: "#1A5BA8",
    lightBlue: "#00A0E3",
    green: "#7DC242",
};

interface MonitoringRecord {
    id: string;
    user_id: string;
    full_name: string;
    department?: string;
    clock_in: string;
    clock_out?: string | null;
    status: string;
    liveStatus: "online" | "present" | "late" | "inactive" | "idle" | "absent" | "leave";
    shift: string;
}

interface RealTimeMonitoringTableProps {
    data: MonitoringRecord[] | undefined;
    isLoading: boolean;
    isRefetching: boolean;
    lastUpdated?: Date | null;
    onRefresh?: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
    online: { label: "Online", color: "text-green-700", bgColor: "bg-green-50 border-green-200", icon: Wifi },
    present: { label: "Hadir", color: "text-blue-700", bgColor: "bg-blue-50 border-blue-200", icon: CheckCircle },
    late: { label: "Terlambat", color: "text-amber-700", bgColor: "bg-amber-50 border-amber-200", icon: AlertCircle },
    inactive: { label: "Pulang", color: "text-slate-500", bgColor: "bg-slate-100 border-slate-200", icon: WifiOff },
    idle: { label: "Idle", color: "text-orange-600", bgColor: "bg-orange-50 border-orange-200", icon: Timer },
    absent: { label: "Tidak Hadir", color: "text-red-700", bgColor: "bg-red-50 border-red-200", icon: AlertCircle },
    leave: { label: "Cuti / Izin", color: "text-purple-700", bgColor: "bg-purple-50 border-purple-200", icon: Clock },
};

function formatTime(dateString: string): string {
    return new Date(dateString).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function getInitials(name: string): string {
    return name
        .split(" ")
        .map(n => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

// Optimized Wrapper for Status Badge
const StatusBadge = memo(({ status }: { status: string }) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.present;
    const Icon = config.icon;
    return (
        <Badge
            variant="outline"
            className={cn("text-[10px] h-6 px-2 gap-1 border", config.bgColor, config.color)}
        >
            <Icon className="h-3 w-3" />
            {config.label}
        </Badge>
    );
});

// Optimized Timer Component
const RefreshTimer = memo(({ isRefetching }: { isRefetching: boolean }) => {
    const [countdown, setCountdown] = useState(60); // 60s default now

    useEffect(() => {
        if (isRefetching) {
            setCountdown(60);
            return;
        }
        const interval = setInterval(() => {
            setCountdown(prev => (prev <= 1 ? 60 : prev - 1));
        }, 1000);
        return () => clearInterval(interval);
    }, [isRefetching]);

    return (
        <span className="text-slate-400">
            • Update dalam {countdown}s
        </span>
    );
});

export function RealTimeMonitoringTable({
    data,
    isLoading,
    isRefetching,
    lastUpdated,
    onRefresh
}: RealTimeMonitoringTableProps) {

    if (isLoading) {
        return (
            <Card className="border-white/60 shadow-sm shadow-slate-200/40 bg-white/70 backdrop-blur-md rounded-[20px]">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2 tracking-tight">
                        <Users className="h-4 w-4" style={{ color: BRAND_COLORS.blue }} />
                        Monitoring Real-Time
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="animate-pulse flex items-center gap-3 p-3 rounded-lg bg-slate-50">
                                <div className="w-10 h-10 rounded-full bg-slate-200" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-slate-200 rounded w-32" />
                                    <div className="h-3 bg-slate-200 rounded w-24" />
                                </div>
                                <div className="h-6 w-20 bg-slate-200 rounded" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-white/60 shadow-sm shadow-slate-200/40 bg-white/70 backdrop-blur-md h-full flex flex-col rounded-[20px] vibe-glass-card">
            <CardHeader className="pb-3 border-b border-slate-100/80">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2 tracking-tight">
                            <Users className="h-4 w-4" style={{ color: BRAND_COLORS.blue }} />
                            Monitoring Real-Time
                        </CardTitle>
                        <CardDescription className="text-xs mt-1 flex items-center gap-2">
                            <span className="flex items-center gap-1">
                                <span className={cn(
                                    "w-2 h-2 rounded-full",
                                    isRefetching ? "bg-blue-500 animate-pulse" : "bg-green-500"
                                )} />
                                {isRefetching ? "Memperbarui..." : "Live"}
                            </span>
                            {lastUpdated && <RefreshTimer isRefetching={isRefetching} />}
                        </CardDescription>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onRefresh}
                        disabled={isRefetching}
                        className="h-8 w-8 p-0"
                    >
                        <RefreshCw className={cn("h-4 w-4 text-slate-500", isRefetching && "animate-spin")} />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-auto max-h-[500px]"> {/* Added overflow control */}
                {(!data || data.length === 0) ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div
                            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3"
                            style={{ backgroundColor: `${BRAND_COLORS.blue}10` }}
                        >
                            <Clock className="h-8 w-8" style={{ color: `${BRAND_COLORS.blue}50` }} />
                        </div>
                        <p className="text-slate-500 text-sm font-medium">Belum ada aktivitas hari ini</p>
                        <p className="text-slate-400 text-xs mt-1">Data akan muncul saat karyawan clock-in</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {/* Header Row */}
                        <div className="hidden md:grid md:grid-cols-12 gap-3 p-3 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider sticky top-0 z-10 border-b border-slate-100">
                            <div className="col-span-4">Karyawan</div>
                            <div className="col-span-2 text-center">Clock-In</div>
                            <div className="col-span-2 text-center">Clock-Out</div>
                            <div className="col-span-2 text-center">Shift</div>
                            <div className="col-span-2 text-center">Status</div>
                        </div>

                        {data.map((record, index) => (
                            <div key={record.id} className="group">
                                {/* Desktop Row */}
                                <div className={cn(
                                    "hidden md:grid md:grid-cols-12 gap-3 p-3 transition-colors hover:bg-slate-50 border-b border-slate-50",
                                    index === 0 && record.liveStatus === "online" && "bg-gradient-to-r from-green-50/50 to-transparent"
                                )}>
                                    {/* Employee Info */}
                                    <div className="md:col-span-4 flex items-center gap-3 pl-3">
                                        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shadow-sm">
                                            {getInitials(record.full_name)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors">{record.full_name}</p>
                                            <p className="text-[10px] uppercase font-bold text-slate-400 truncate tracking-wider">{record.department || "-"}</p>
                                        </div>
                                    </div>

                                    {/* Clock-In */}
                                    <div className="md:col-span-2 flex items-center justify-center">
                                        <div className="inline-flex font-mono text-xs font-bold bg-slate-100/50 text-slate-700 px-2 py-1 rounded border border-slate-200 shadow-sm">
                                            {record.clock_in ? formatTime(record.clock_in) : "--:--"}
                                        </div>
                                    </div>

                                    {/* Clock-Out */}
                                    <div className="md:col-span-2 flex items-center justify-center">
                                        <div className="inline-flex font-mono text-xs font-bold bg-slate-50 text-slate-500 px-2 py-1 rounded border border-slate-100">
                                            {record.clock_out ? formatTime(record.clock_out) : "--:--"}
                                        </div>
                                    </div>

                                    {/* Shift */}
                                    <div className="md:col-span-2 flex items-center justify-center">
                                        <span className="text-xs font-medium text-slate-600">{record.shift}</span>
                                    </div>

                                    {/* Status */}
                                    <div className="md:col-span-2 flex items-center justify-center pr-3">
                                        <StatusBadge status={record.liveStatus} />
                                    </div>
                                </div>

                                {/* Mobile Card View (SaaS App Layout) */}
                                <div className="md:hidden bg-white/70 backdrop-blur-md rounded-[20px] p-4 border border-slate-100 shadow-sm flex flex-col gap-3 hover:shadow-md transition-all mb-4 mx-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shadow-sm">
                                                {getInitials(record.full_name)}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-slate-800 line-clamp-1">{record.full_name}</div>
                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider mt-1 inline-block bg-slate-100 text-slate-600">
                                                    {record.department || "Karyawan"}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="scale-90 origin-top-right">
                                            <StatusBadge status={record.liveStatus} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mt-2 bg-slate-50/60 backdrop-blur-sm p-3 rounded-[16px] border border-slate-100">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Masuk</span>
                                            <span className="font-mono text-sm font-bold text-slate-800">{record.clock_in ? formatTime(record.clock_in) : "--:--"}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Pulang</span>
                                            <span className="font-mono text-sm font-bold text-slate-800">{record.clock_out ? formatTime(record.clock_out) : "--:--"}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default RealTimeMonitoringTable;
