import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
    FileText, Clock, AlertCircle, XCircle, CheckCircle,
    Calendar, Briefcase, User2
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { JournalCardData } from "./JournalCard";
import { cn } from "@/lib/utils";

interface JournalReviewDetailProps {
    journal?: JournalCardData | null;
    onApprove: (id: string) => Promise<void>;
    onReject: (id: string, reason: string) => Promise<void>;
    onRequestRevision: (id: string, comment: string) => Promise<void>;
    isProcessing?: boolean;
}

interface JournalHistoryItem {
    id: string;
    date: string;
    content: string;
    verification_status: string;
}

// Status config
const STATUS_MAP: Record<string, { label: string; className: string; dot: string; bg: string }> = {
    approved: {
        label: "Disetujui",
        className: "text-emerald-700",
        dot: "bg-emerald-500",
        bg: "bg-emerald-50 border-emerald-200"
    },
    need_revision: {
        label: "Revisi",
        className: "text-orange-700",
        dot: "bg-orange-500",
        bg: "bg-orange-50 border-orange-200"
    },
    rejected: {
        label: "Ditolak",
        className: "text-red-700",
        dot: "bg-red-500",
        bg: "bg-red-50 border-red-200"
    },
    submitted: {
        label: "Menunggu Review",
        className: "text-amber-700",
        dot: "bg-amber-500",
        bg: "bg-amber-50 border-amber-200"
    },
    pending: {
        label: "Menunggu Review",
        className: "text-amber-700",
        dot: "bg-amber-500",
        bg: "bg-amber-50 border-amber-200"
    }
};

function StatusBadge({ status }: { status: string }) {
    const config = STATUS_MAP[status] || STATUS_MAP.submitted;
    return (
        <span className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border",
            config.bg, config.className
        )}>
            <span className={cn("w-2 h-2 rounded-full", config.dot)} />
            {config.label}
        </span>
    );
}

export function JournalReviewDetail({
    journal,
    onApprove,
    onReject,
    onRequestRevision,
    isProcessing = false
}: JournalReviewDetailProps) {
    const [comment, setComment] = useState("");
    const [actionMode, setActionMode] = useState<'approve' | 'reject' | 'revise' | null>(null);

    // Fetch History
    const { data: history = [] } = useQuery({
        queryKey: ['journal_history', journal?.user_id],
        queryFn: async () => {
            if (!journal?.user_id) return [];
            const { data, error } = await supabase
                .from('work_journals')
                .select('id, date, content, verification_status')
                .eq('user_id', journal.user_id)
                .neq('id', journal.id)
                .is('deleted_at', null)
                .order('date', { ascending: false })
                .limit(5);

            if (error) throw error;
            return data as JournalHistoryItem[];
        },
        enabled: !!journal?.user_id,
        staleTime: 60000
    });

    if (!journal) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 dark:bg-slate-800/50">
                <div className="w-20 h-20 rounded-3xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center mb-5">
                    <FileText className="w-10 h-10 text-slate-300" />
                </div>
                <p className="text-base font-semibold text-slate-400">Pilih jurnal untuk melihat detail</p>
                <p className="text-sm text-slate-300 mt-1">Klik pada jurnal di daftar sebelah kiri</p>
            </div>
        );
    }

    const {
        verification_status = 'submitted',
        content,
        duration,
        date,
        profiles
    } = journal as any;

    const displayTitle = (journal as any).title || "Laporan Aktivitas Harian";
    const profile = profiles || {};

    const handleAction = async (action: 'approve' | 'reject' | 'revise') => {
        if (action === 'approve') {
            await onApprove(journal.id);
        } else if (action === 'reject') {
            await onReject(journal.id, comment);
        } else if (action === 'revise') {
            await onRequestRevision(journal.id, comment);
        }
        setActionMode(null);
        setComment("");
    };

    // Duration Formatting
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    const durationText = hours > 0 ? `${hours} jam ${minutes} menit` : `${minutes} menit`;

    const getHistoryStatusBadge = (status: string) => {
        const config = STATUS_MAP[status] || STATUS_MAP.submitted;
        return (
            <span className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                config.bg, config.className
            )}>
                <span className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
                {config.label}
            </span>
        );
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900">
            {/* Header */}
            <div className="px-8 py-7 border-b border-slate-100 dark:border-slate-800 shrink-0">
                {/* Status + ID */}
                <div className="flex items-center justify-between mb-5">
                    <StatusBadge status={verification_status} />
                    <span className="text-[11px] font-mono text-slate-400 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                        ID: #{journal.id.substring(0, 8).toUpperCase()}
                    </span>
                </div>

                {/* Title */}
                <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-6 leading-snug">
                    {displayTitle}
                </h1>

                {/* User Info Card */}
                <div className="flex items-center justify-between bg-gradient-to-r from-slate-50 to-white rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-11 w-11 border-2 border-white shadow-md">
                            <AvatarImage src={profile.avatar_url || undefined} />
                            <AvatarFallback className="bg-gradient-to-br from-slate-600 to-slate-800 text-white font-bold text-sm">
                                {profile.full_name?.substring(0, 2).toUpperCase() || "?"}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{profile.full_name || "Unknown User"}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                                <span>{profile.position || "Karyawan"}</span>
                                <span className="text-slate-200">•</span>
                                <span>{profile.department || "General"}</span>
                            </p>
                        </div>
                    </div>

                    <div className="hidden sm:flex items-center gap-5">
                        <div className="text-right">
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Tanggal</p>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                {format(new Date(date), "d MMM yyyy", { locale: localeId })}
                            </p>
                        </div>
                        <div className="w-px h-10 bg-slate-200/60" />
                        <div className="text-right">
                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Durasi</p>
                            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100 justify-end">
                                <Clock className="w-3.5 h-3.5 text-blue-500" />
                                {durationText}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto px-8 py-7">
                <div className="space-y-8 max-w-4xl">
                    {/* Activity Description */}
                    <section>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center">
                                <FileText className="w-3.5 h-3.5 text-blue-600" />
                            </div>
                            Deskripsi Aktivitas
                        </h3>
                        <div className="p-5 bg-slate-50/70 rounded-xl border border-slate-100 dark:border-slate-800">
                            <div className="prose prose-slate text-sm max-w-none text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                                {content}
                            </div>
                        </div>
                    </section>

                    {/* History Section */}
                    {history.length > 0 && (
                        <section>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center">
                                    <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                                </div>
                                Jurnal Sebelumnya
                            </h3>
                            <div className="space-y-2">
                                {history.map((item) => (
                                    <div
                                        key={item.id}
                                        className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50/70 transition-all duration-200"
                                    >
                                        <div className="flex flex-col gap-1 min-w-0 flex-1 mr-3">
                                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                                {format(new Date(item.date), "EEEE, d MMM yyyy", { locale: localeId })}
                                            </span>
                                            <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                                {item.content}
                                            </span>
                                        </div>
                                        {getHistoryStatusBadge(item.verification_status)}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </div>

            {/* Footer Action Area */}
            <div className="px-8 py-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 shrink-0">
                <div className="max-w-4xl mx-auto space-y-4">
                    <Textarea
                        placeholder="Tambahkan catatan untuk karyawan (wajib untuk penolakan/revisi)..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 min-h-[80px] focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none rounded-xl text-sm"
                    />

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Catatan wajib diisi untuk Penolakan & Revisi</span>
                        </div>

                        <div className="flex items-center gap-2.5 w-full sm:w-auto">
                            <Button
                                variant="outline"
                                className="flex-1 sm:flex-none text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 rounded-xl h-10 font-semibold gap-1.5 transition-all"
                                onClick={() => handleAction('reject')}
                                disabled={isProcessing || !comment}
                            >
                                <XCircle className="w-4 h-4" />
                                Tolak
                            </Button>

                            <Button
                                variant="outline"
                                className="flex-1 sm:flex-none border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:bg-slate-800 rounded-xl h-10 font-semibold gap-1.5 transition-all"
                                onClick={() => handleAction('revise')}
                                disabled={isProcessing || !comment}
                            >
                                Minta Revisi
                            </Button>

                            <Button
                                className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-6 rounded-xl h-10 font-semibold gap-1.5 shadow-sm shadow-emerald-200 transition-all"
                                onClick={() => handleAction('approve')}
                                disabled={isProcessing}
                            >
                                <CheckCircle className="w-4 h-4" />
                                Setujui
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
