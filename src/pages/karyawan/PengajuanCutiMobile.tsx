import { useState } from "react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Plus, Clock, CheckCircle2, XCircle, FileText, Calendar, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import MobileNavigation from "@/components/MobileNavigation";
import { useTheme } from "@/contexts/ThemeContext";

interface LeaveRequest {
    id: string;
    leave_type: string;
    start_date: string;
    end_date: string;
    reason: string | null;
    status: string;
    rejection_reason: string | null;
    created_at: string;
}

interface Props {
    leaveRequests: LeaveRequest[];
    usedLeaveDays: number;
    maxLeaveDays: number;
    onOpenNewRequest: () => void;
}

export default function PengajuanCutiMobile({
    leaveRequests,
    usedLeaveDays,
    maxLeaveDays,
    onOpenNewRequest,
}: Props) {
    const remainingLeave = Math.max(0, maxLeaveDays - usedLeaveDays);
    const { isDark } = useTheme();

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "approved":
                return <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-50 text-[#16A34A] border border-green-100 text-[10px] font-bold uppercase"><CheckCircle2 className="w-3 h-3" /> Disetujui</span>;
            case "rejected":
                return <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-[#DC2626] border border-red-100 text-[10px] font-bold uppercase"><XCircle className="w-3 h-3" /> Ditolak</span>;
            default:
                return <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-yellow-50 text-[#F59E0B] border border-yellow-100 text-[10px] font-bold uppercase"><Clock className="w-3 h-3" /> Menunggu</span>;
        }
    };

    const getLeaveTypeLabel = (type: string) => {
        switch (type) {
            case "cuti": return "Cuti Tahunan";
            case "sakit": return "Sakit";
            case "izin": return "Izin Khusus";
            default: return type;
        }
    };

    const calculateDays = (start: string, end: string) => {
        const startDate = new Date(start);
        const endDate = new Date(end);
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    };

    return (
        <div className={cn("flex flex-col min-h-screen pb-[100px] font-sans animate-in fade-in slide-in-from-bottom-4 duration-500", isDark ? "bg-slate-900" : "bg-[#F8FAFC]")}>
            {/* Premium Dark Header */}
            <div className={cn("text-white pt-[max(env(safe-area-inset-top),32px)] pb-12 px-6 rounded-b-[40px] shadow-lg relative overflow-hidden", isDark ? "bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800" : "bg-[#0F172A]")}>
                <div className="absolute top-0 right-0 w-64 h-64 bg-white dark:bg-slate-900/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                <div className="relative z-10 mb-2">
                    <h1 className="text-xl font-bold tracking-tight">Manajemen Cuti</h1>
                    <p className="text-sm font-medium text-slate-400 mt-1">Sisa hak cuti tahunan Anda: {remainingLeave} Hari</p>
                </div>
            </div>

            <div className="px-6 -mt-8 relative z-20">
                {/* Visual Budget Ring Chart */}
                <div className={cn("p-6 rounded-[28px] shadow-[0_8px_30px_rgba(0,0,0,0.04)] border mb-6 flex items-center justify-between transition-all", isDark ? "bg-slate-800/80 backdrop-blur-md border-slate-700/50" : "bg-white/90 backdrop-blur-md border-slate-200/50")}>
                    <div>
                        <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Kuota Tahunan</h3>
                        <div className="flex items-baseline gap-1.5">
                            <span className={cn("text-[42px] font-black tracking-tighter leading-none", remainingLeave <= 3 ? "text-amber-500" : (isDark ? "text-white" : "text-slate-800"))}>{remainingLeave}</span>
                            <span className="text-xs font-bold text-slate-400">Hari</span>
                        </div>
                        <div className="mt-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-3 py-1.5 rounded-lg w-fit border border-slate-200/50 dark:border-slate-600/50 flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            {usedLeaveDays} Hari Terpakai
                        </div>
                    </div>
                    <div className="relative w-[110px] h-[110px] flex items-center justify-center">
                        <svg className="w-full h-full -rotate-90 drop-shadow-sm" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="38" fill="none" stroke={isDark ? "#334155" : "#F1F5F9"} strokeWidth="12" />
                            <circle
                                cx="50" cy="50" r="38" fill="none"
                                stroke={remainingLeave <= 3 ? "#F59E0B" : "#10B981"}
                                strokeWidth="12" strokeLinecap="round"
                                strokeDasharray={2 * Math.PI * 38}
                                strokeDashoffset={(2 * Math.PI * 38) - ((Math.min(100, Math.round((usedLeaveDays / maxLeaveDays) * 100)) / 100) * (2 * Math.PI * 38))}
                                className="transition-all duration-1000 ease-out"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className={cn("text-base font-black tracking-tight", isDark ? "text-slate-200" : "text-slate-700")}>{maxLeaveDays > 0 ? 100 - Math.min(100, Math.round((usedLeaveDays / maxLeaveDays) * 100)) : 0}%</span>
                            <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Sisa</span>
                        </div>
                    </div>
                </div>

                {/* Primary Action Button */}
                <button
                    onClick={onOpenNewRequest}
                    className="w-full bg-[#2563EB] hover:bg-[#1E40AF] text-white rounded-2xl p-4 font-bold text-[15px] flex items-center justify-center gap-2 active:scale-95 transition-all shadow-[0_8px_20px_rgba(37,99,235,0.2)] mb-8"
                >
                    <Plus className="w-5 h-5" /> Ajukan Cuti / Izin
                </button>

                {/* List of Requests */}
                <div className="flex justify-between items-end mb-4">
                    <h3 className={cn("text-[13px] font-bold uppercase tracking-wider", isDark ? "text-slate-200" : "text-[#0F172A]")}>Riwayat Pengajuan</h3>
                </div>

                <div className="space-y-3">
                    {leaveRequests.length === 0 ? (
                        <div className={cn("rounded-2xl p-8 border text-center flex flex-col items-center justify-center", isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100")}>
                            <div className={cn("w-14 h-14 rounded-full flex items-center justify-center mb-3", isDark ? "bg-slate-700" : "bg-indigo-50")}>
                                <FileText className={cn("w-6 h-6", isDark ? "text-slate-400" : "text-indigo-400")} />
                            </div>
                            <span className={cn("text-sm font-bold", isDark ? "text-white" : "text-[#0F172A]")}>Belum Ada Pengajuan</span>
                            <span className="text-xs font-medium text-slate-500 mt-1">Ketuk tombol di atas untuk mengajukan cuti.</span>
                        </div>
                    ) : (
                        leaveRequests.map((req) => (
                            <div key={req.id} className={cn("p-4 rounded-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.02)] border", isDark ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100")}>
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h4 className={cn("font-bold text-sm mb-1", isDark ? "text-white" : "text-[#0F172A]")}>{getLeaveTypeLabel(req.leave_type)}</h4>
                                        <div className="flex items-center gap-1.5 bg-[#F8FAFC] px-2 py-1 rounded-md max-w-fit">
                                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                                {format(new Date(req.start_date), 'd MMM', { locale: idLocale })} - {format(new Date(req.end_date), 'd MMM yyyy', { locale: idLocale })}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        {getStatusBadge(req.status)}
                                        <span className="text-[11px] font-bold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded-md">
                                            {calculateDays(req.start_date, req.end_date)} Hari
                                        </span>
                                    </div>
                                </div>
                                {req.reason && (
                                    <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                                        "{req.reason}"
                                    </p>
                                )}
                                {req.status === 'rejected' && req.rejection_reason && (
                                    <div className="mt-2 bg-red-50 p-2.5 rounded-xl border border-red-100 flex gap-2 items-start">
                                        <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                                        <span className="text-[11px] font-bold text-red-700">{req.rejection_reason}</span>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            <MobileNavigation />
        </div>
    );
}
