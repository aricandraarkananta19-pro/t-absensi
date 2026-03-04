import { useState } from "react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Plus, Clock, CheckCircle2, XCircle, FileText, Calendar, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import MobileNavigation from "@/components/MobileNavigation";

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
        <div className="flex flex-col min-h-screen bg-[#F8FAFC] pb-[100px] font-sans">
            {/* Premium Dark Header */}
            <div className="bg-[#0F172A] text-white pt-[max(env(safe-area-inset-top),32px)] pb-12 px-6 rounded-b-[40px] shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white dark:bg-slate-900/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                <div className="relative z-10 mb-2">
                    <h1 className="text-xl font-bold tracking-tight">Manajemen Cuti</h1>
                    <p className="text-sm font-medium text-slate-400 mt-1">Sisa hak cuti tahunan Anda: {remainingLeave} Hari</p>
                </div>
            </div>

            <div className="px-6 -mt-8 relative z-20">
                {/* Balance Cards */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Sisa Cuti</span>
                        <span className="text-3xl font-bold text-[#16A34A]">{remainingLeave}</span>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Terpakai</span>
                        <span className="text-3xl font-bold text-[#0F172A]">{usedLeaveDays}</span>
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
                    <h3 className="text-[13px] font-bold text-[#0F172A] uppercase tracking-wider">Riwayat Pengajuan</h3>
                </div>

                <div className="space-y-3">
                    {leaveRequests.length === 0 ? (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-100 dark:border-slate-800 text-center flex flex-col items-center justify-center">
                            <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                                <FileText className="w-6 h-6 text-slate-400" />
                            </div>
                            <span className="text-sm font-bold text-[#0F172A]">Belum Ada Pengajuan</span>
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Anda belum pernah mengajukan cuti.</span>
                        </div>
                    ) : (
                        leaveRequests.map((req) => (
                            <div key={req.id} className="bg-white dark:bg-slate-900 p-4 rounded-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-slate-100 dark:border-slate-800">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h4 className="font-bold text-[#0F172A] text-sm mb-1">{getLeaveTypeLabel(req.leave_type)}</h4>
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
