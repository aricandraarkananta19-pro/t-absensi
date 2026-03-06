import { useState, useEffect, useCallback } from "react";
import { Bell, CheckCircle2, Clock, Calendar, FileText, AlertTriangle, X, CheckCheck, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Button } from "@/components/ui/button";

export interface NotificationItem {
    id: string;
    type: 'leave_approved' | 'leave_rejected' | 'attendance_late' | 'journal_reminder' | 'system' | 'leave_pending';
    title: string;
    message: string;
    timestamp: Date;
    read: boolean;
    icon: React.ElementType;
    color: string;
    bgColor: string;
}

interface NotificationPanelProps {
    role: 'admin' | 'manager' | 'karyawan';
    isDark?: boolean;
}

export function useNotifications(role: 'admin' | 'manager' | 'karyawan') {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchNotifications = useCallback(async () => {
        if (!user) return;
        const items: NotificationItem[] = [];
        const now = new Date();

        try {
            if (role === 'karyawan') {
                // 1. Leaves approved/rejected last 7 days
                const { data: leaveData } = await supabase
                    .from("leave_requests")
                    .select("id, leave_type, status, start_date, end_date, updated_at")
                    .eq("user_id", user.id)
                    .in("status", ["approved", "rejected"])
                    .gte("updated_at", new Date(Date.now() - 7 * 86400000).toISOString())
                    .order("updated_at", { ascending: false })
                    .limit(5);

                leaveData?.forEach(leave => {
                    const isApproved = leave.status === 'approved';
                    items.push({
                        id: `leave-${leave.id}`,
                        type: isApproved ? 'leave_approved' : 'leave_rejected',
                        title: isApproved ? 'Cuti Disetujui' : 'Cuti Ditolak',
                        message: `Pengajuan cuti ${leave.leave_type} (${leave.start_date} s/d ${leave.end_date}) telah ${isApproved ? 'disetujui' : 'ditolak'}.`,
                        timestamp: new Date(leave.updated_at),
                        read: false,
                        icon: isApproved ? CheckCircle2 : AlertTriangle,
                        color: isApproved ? 'text-emerald-600' : 'text-red-600',
                        bgColor: isApproved ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20',
                    });
                });

                // 2. Late attendance this month
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                const { data: lateData } = await supabase
                    .from("attendance")
                    .select("id, date, clock_in")
                    .eq("user_id", user.id)
                    .eq("status", "late")
                    .gte("date", format(monthStart, 'yyyy-MM-dd'))
                    .order("date", { ascending: false })
                    .limit(3);

                lateData?.forEach(att => {
                    items.push({
                        id: `late-${att.id}`,
                        type: 'attendance_late',
                        title: 'Terlambat Masuk',
                        message: `Anda tercatat terlambat pada ${att.date}. Masuk: ${att.clock_in ? new Date(att.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}.`,
                        timestamp: new Date(att.clock_in || att.date),
                        read: false,
                        icon: Clock,
                        color: 'text-amber-600',
                        bgColor: 'bg-amber-50 dark:bg-amber-900/20',
                    });
                });

                // 3. Journal reminder (if no journal today)
                const todayStr = format(now, 'yyyy-MM-dd');
                const { count: journalCount } = await supabase
                    .from("work_journals")
                    .select("*", { count: "exact", head: true })
                    .eq("user_id", user.id)
                    .eq("date", todayStr);

                if (now.getHours() >= 15 && (journalCount || 0) === 0) {
                    items.push({
                        id: `reminder-journal-${todayStr}`,
                        type: 'journal_reminder',
                        title: 'Jurnal Belum Diisi',
                        message: 'Anda belum mengisi jurnal kerja hari ini. Jangan lupa mencatat aktivitas Anda.',
                        timestamp: now,
                        read: false,
                        icon: FileText,
                        color: 'text-blue-600',
                        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
                    });
                }
            }

            if (role === 'admin' || role === 'manager') {
                // 1. Pending leave requests
                const { data: pendingLeaves } = await supabase
                    .from("leave_requests")
                    .select("id, user_id, leave_type, start_date, created_at, profile:profiles!leave_requests_user_id_fkey(full_name)")
                    .eq("status", "pending")
                    .order("created_at", { ascending: false })
                    .limit(5);

                pendingLeaves?.forEach(leave => {
                    const empName = (leave as any).profile?.full_name || 'Karyawan';
                    items.push({
                        id: `pending-leave-${leave.id}`,
                        type: 'leave_pending',
                        title: 'Pengajuan Cuti Baru',
                        message: `${empName} mengajukan cuti ${leave.leave_type} mulai ${leave.start_date}. Menunggu persetujuan.`,
                        timestamp: new Date(leave.created_at),
                        read: false,
                        icon: Calendar,
                        color: 'text-indigo-600',
                        bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
                    });
                });

                // 2. Late employees today
                const todayStr = format(now, 'yyyy-MM-dd');
                const { count: lateCount } = await supabase
                    .from("attendance")
                    .select("*", { count: "exact", head: true })
                    .eq("status", "late")
                    .eq("date", todayStr);

                if (lateCount && lateCount > 0) {
                    items.push({
                        id: `late-today-${todayStr}`,
                        type: 'attendance_late',
                        title: 'Karyawan Terlambat Hari Ini',
                        message: `${lateCount} karyawan tercatat terlambat masuk hari ini.`,
                        timestamp: now,
                        read: false,
                        icon: AlertTriangle,
                        color: 'text-amber-600',
                        bgColor: 'bg-amber-50 dark:bg-amber-900/20',
                    });
                }

                // 3. Recent journals submitted today
                const { count: journalToday } = await supabase
                    .from("work_journals")
                    .select("*", { count: "exact", head: true })
                    .eq("date", todayStr);

                if (journalToday && journalToday > 0) {
                    items.push({
                        id: `journal-today-${todayStr}`,
                        type: 'system',
                        title: 'Jurnal Masuk Hari Ini',
                        message: `${journalToday} jurnal kerja telah disubmit oleh karyawan hari ini.`,
                        timestamp: now,
                        read: false,
                        icon: FileText,
                        color: 'text-blue-600',
                        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
                    });
                }
            }

            // Sort by timestamp desc
            items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
            setNotifications(items);
            setUnreadCount(items.filter(n => !n.read).length);

        } catch (err) {
            console.error("Error fetching notifications:", err);
        }
    }, [user, role]);

    useEffect(() => {
        fetchNotifications();
        // Refresh every 60 seconds
        const interval = setInterval(fetchNotifications, 60000);
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    const markAllRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
    };

    const clearAll = () => {
        setNotifications([]);
        setUnreadCount(0);
    };

    return { notifications, unreadCount, markAllRead, clearAll, refresh: fetchNotifications };
}

function timeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMin < 1) return "Baru saja";
    if (diffMin < 60) return `${diffMin} menit lalu`;
    if (diffHours < 24) return `${diffHours} jam lalu`;
    if (diffDays < 7) return `${diffDays} hari lalu`;
    return format(date, 'd MMM yyyy', { locale: idLocale });
}

export function NotificationPanel({ role, isDark = false }: NotificationPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const { notifications, unreadCount, markAllRead, clearAll } = useNotifications(role);

    return (
        <div className="relative">
            {/* Bell Trigger */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "relative p-2 rounded-full transition-all duration-200",
                    isDark ? "hover:bg-slate-800 text-slate-400 hover:text-slate-200" : "hover:bg-slate-100 text-slate-500 hover:text-slate-800",
                    isOpen && (isDark ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-800")
                )}
            >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 px-1 animate-in zoom-in duration-200">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Backdrop */}
            {isOpen && (
                <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            )}

            {/* Panel */}
            {isOpen && (
                <div className={cn(
                    "absolute right-0 top-full mt-2 w-[380px] max-h-[480px] rounded-2xl shadow-2xl border z-50 overflow-hidden flex flex-col animate-in slide-in-from-top-2 fade-in duration-200",
                    isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
                )}>
                    {/* Header */}
                    <div className={cn("px-5 py-4 border-b flex items-center justify-between",
                        isDark ? "border-slate-800 bg-slate-900" : "border-slate-100 bg-white")}>
                        <div>
                            <h3 className={cn("font-bold text-sm", isDark ? "text-white" : "text-slate-900")}>Notifikasi</h3>
                            <p className={cn("text-[10px] font-medium mt-0.5", isDark ? "text-slate-500" : "text-slate-400")}>
                                {unreadCount > 0 ? `${unreadCount} belum dibaca` : 'Semua sudah dibaca'}
                            </p>
                        </div>
                        <div className="flex items-center gap-1">
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllRead}
                                    className={cn("p-1.5 rounded-lg transition-colors text-xs font-medium flex items-center gap-1",
                                        isDark ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-50 text-slate-500")}
                                    title="Tandai semua sudah dibaca"
                                >
                                    <CheckCheck className="w-3.5 h-3.5" />
                                </button>
                            )}
                            {notifications.length > 0 && (
                                <button
                                    onClick={clearAll}
                                    className={cn("p-1.5 rounded-lg transition-colors",
                                        isDark ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-50 text-slate-500")}
                                    title="Hapus semua"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                            <button
                                onClick={() => setIsOpen(false)}
                                className={cn("p-1.5 rounded-lg transition-colors",
                                    isDark ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-50 text-slate-500")}
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto">
                        {notifications.length > 0 ? (
                            <div className="py-1">
                                {notifications.map((notif) => (
                                    <div
                                        key={notif.id}
                                        className={cn(
                                            "px-4 py-3.5 flex items-start gap-3 transition-colors cursor-pointer border-b last:border-b-0",
                                            isDark
                                                ? "border-slate-800/50 hover:bg-slate-800/60"
                                                : "border-slate-50 hover:bg-slate-50/80",
                                            !notif.read && (isDark ? "bg-slate-800/30" : "bg-blue-50/30")
                                        )}
                                    >
                                        {/* Icon */}
                                        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border", notif.bgColor,
                                            isDark ? "border-slate-700" : "border-transparent")}>
                                            <notif.icon className={cn("w-4 h-4", notif.color)} />
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <h4 className={cn("text-[13px] font-bold leading-tight", isDark ? "text-white" : "text-slate-800")}>
                                                    {notif.title}
                                                </h4>
                                                {!notif.read && (
                                                    <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                                                )}
                                            </div>
                                            <p className={cn("text-xs leading-relaxed line-clamp-2 mt-0.5",
                                                isDark ? "text-slate-400" : "text-slate-500")}>
                                                {notif.message}
                                            </p>
                                            <span className={cn("text-[10px] font-semibold mt-1.5 block",
                                                isDark ? "text-slate-600" : "text-slate-400")}>
                                                {timeAgo(notif.timestamp)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-3",
                                    isDark ? "bg-slate-800" : "bg-slate-100")}>
                                    <Bell className={cn("w-6 h-6", isDark ? "text-slate-600" : "text-slate-300")} />
                                </div>
                                <h4 className={cn("text-sm font-bold mb-1", isDark ? "text-slate-300" : "text-slate-700")}>
                                    Tidak Ada Notifikasi
                                </h4>
                                <p className={cn("text-xs font-medium", isDark ? "text-slate-500" : "text-slate-400")}>
                                    Semua informasi penting akan tampil di sini.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
