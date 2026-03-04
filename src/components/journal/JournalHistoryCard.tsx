import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Clock, Folder, MessageSquare, AlertCircle, CheckCircle2, ChevronRight, Hash } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface JournalHistoryItem {
    id: string;
    title?: string;
    content: string;
    date: string;
    duration: number;
    verification_status: 'draft' | 'submitted' | 'pending' | 'need_revision' | 'approved' | 'read' | 'rejected';
    manager_notes?: string;
    manager_profile?: {
        full_name: string;
        avatar_url: string | null;
    };
    project_category?: string;
    obstacles?: string;
}

interface JournalHistoryCardProps {
    journal: JournalHistoryItem;
    onClick?: () => void;
}

const STATUS_CONFIG = {
    draft: {
        dot: "bg-slate-400",
        badge: "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700",
        label: "Draft",
        accent: "border-slate-200 dark:border-slate-700 hover:border-slate-300"
    },
    submitted: {
        dot: "bg-amber-500",
        badge: "bg-amber-50 text-amber-700 border-amber-200",
        label: "Menunggu Review",
        accent: "border-slate-200/80 hover:border-amber-300"
    },
    pending: {
        dot: "bg-amber-500",
        badge: "bg-amber-50 text-amber-700 border-amber-200",
        label: "Menunggu Review",
        accent: "border-slate-200/80 hover:border-amber-300"
    },
    need_revision: {
        dot: "bg-orange-500",
        badge: "bg-orange-50 text-orange-700 border-orange-200",
        label: "Revisi Diperlukan",
        accent: "border-orange-200 hover:border-orange-400 ring-2 ring-orange-50"
    },
    rejected: {
        dot: "bg-rose-500",
        badge: "bg-rose-50 text-rose-700 border-rose-200",
        label: "Ditolak",
        accent: "border-rose-200 hover:border-rose-300"
    },
    approved: {
        dot: "bg-emerald-500",
        badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
        label: "Disetujui",
        accent: "border-slate-200/80 hover:border-emerald-300"
    },
    read: {
        dot: "bg-blue-500",
        badge: "bg-blue-50 text-blue-700 border-blue-200",
        label: "Dibaca",
        accent: "border-slate-200/80 hover:border-blue-300"
    },
};

export const extractTitleAndContent = (rawContent: string) => {
    if (!rawContent) return { title: "", content: "" };
    const match = rawContent.match(/^\*\*(.*?)\*\*\n\n([\s\S]*)$/);
    if (match) {
        return { title: match[1], content: match[2] };
    }
    return { title: "Laporan Harian", content: rawContent };
};

export function JournalHistoryCard({ journal, onClick }: JournalHistoryCardProps) {
    const status = STATUS_CONFIG[journal.verification_status] || STATUS_CONFIG.submitted;

    const hours = Math.floor((journal.duration || 0) / 60);
    const minutes = (journal.duration || 0) % 60;
    const durationString = hours > 0
        ? `${hours}j ${minutes > 0 ? `${minutes}m` : ''}`
        : `${minutes}m`;

    const categoryLabel = journal.project_category || "Umum";

    const { title: extractedTitle, content: extractedContent } = extractTitleAndContent(journal.content);
    const displayTitle = journal.title || extractedTitle || "Laporan Aktivitas";
    const displayContent = extractedTitle ? extractedContent : journal.content;

    return (
        <div
            onClick={onClick}
            className={cn(
                "group relative bg-white dark:bg-slate-900 rounded-[20px] p-5 border transition-all duration-300 cursor-pointer overflow-hidden flex flex-col gap-4",
                "shadow-[0_2px_10px_-4px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_32px_-4px_rgba(0,0,0,0.08)] hover:-translate-y-1",
                status.accent
            )}
        >
            {/* Header: Date & Status */}
            <div className="flex items-start justify-between">
                <div className="flex flex-col">
                    <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100">
                        {format(new Date(journal.date), "EEEE, d MMM yyyy", { locale: localeId })}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400 mt-0.5 uppercase tracking-wider">
                        {categoryLabel}
                    </span>
                </div>

                <span className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase border",
                    status.badge
                )}>
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", status.dot)} />
                    {status.label}
                </span>
            </div>

            {/* Content Body */}
            <div>
                <h3 className="text-[15px] font-bold text-slate-900 dark:text-white mb-1.5 line-clamp-1 group-hover:text-blue-700 transition-colors">
                    {displayTitle}
                </h3>
                <p className="text-[13px] text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed font-medium">
                    {displayContent}
                </p>
            </div>

            {/* Footer Metrics */}
            <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100/80 dark:border-slate-800/80">
                <div className="flex items-center gap-3">
                    {journal.duration > 0 && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[11px] border border-slate-200/60 font-bold">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {durationString}
                        </span>
                    )}
                </div>

                {journal.manager_notes && (
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/50">
                        <MessageSquare className="w-3.5 h-3.5" />
                        Ada Catatan
                    </div>
                )}
            </div>

            {/* Feedback Detail Preview Hover state handled via expanding block or slide-in on click usually */}
            {journal.manager_notes && journal.verification_status === 'need_revision' && (
                <div className="bg-orange-50/50 p-3 rounded-xl border border-orange-100/50 mt-2">
                    <p className="text-xs font-semibold text-orange-800 line-clamp-2">
                        <span className="font-bold text-orange-600">Revisi: </span>
                        {journal.manager_notes}
                    </p>
                </div>
            )}
        </div>
    );
}
