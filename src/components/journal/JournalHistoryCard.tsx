
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Clock, Folder, MessageSquare, AlertCircle, CheckCircle2, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
        badge: "bg-slate-50 text-slate-600 border-slate-200",
        label: "Draft",
        accent: "border-l-slate-300"
    },
    submitted: {
        dot: "bg-amber-500",
        badge: "bg-amber-50 text-amber-700 border-amber-200",
        label: "Menunggu Review",
        accent: "border-l-amber-400"
    },
    pending: {
        dot: "bg-amber-500",
        badge: "bg-amber-50 text-amber-700 border-amber-200",
        label: "Menunggu Review",
        accent: "border-l-amber-400"
    },
    need_revision: {
        dot: "bg-orange-500",
        badge: "bg-orange-50 text-orange-700 border-orange-200",
        label: "Revisi Diperlukan",
        accent: "border-l-orange-400"
    },
    rejected: {
        dot: "bg-red-500",
        badge: "bg-red-50 text-red-700 border-red-200",
        label: "Ditolak",
        accent: "border-l-red-400"
    },
    approved: {
        dot: "bg-emerald-500",
        badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
        label: "Disetujui",
        accent: "border-l-emerald-400"
    },
    read: {
        dot: "bg-blue-500",
        badge: "bg-blue-50 text-blue-700 border-blue-200",
        label: "Dibaca",
        accent: "border-l-blue-400"
    },
};

export const extractTitleAndContent = (rawContent: string) => {
    if (!rawContent) return { title: "", content: "" };
    const match = rawContent.match(/^\*\*(.*?)\*\*\n\n([\s\S]*)$/);
    if (match) {
        return { title: match[1], content: match[2] };
    }
    return { title: "", content: rawContent };
};

// Category emoji map
const CATEGORY_EMOJI: Record<string, string> = {
    development: "🛠️",
    meeting: "📋",
    design: "🎨",
    research: "🔬",
    support: "🤝",
    learning: "📚"
};

export function JournalHistoryCard({ journal, onClick }: JournalHistoryCardProps) {
    const status = STATUS_CONFIG[journal.verification_status] || STATUS_CONFIG.submitted;

    // Format Duration
    const hours = Math.floor(journal.duration / 60);
    const minutes = journal.duration % 60;
    const durationString = hours > 0
        ? `${hours} jam ${minutes > 0 ? `${minutes} menit` : ''}`
        : `${minutes} menit`;

    const categoryLabel = journal.project_category
        ? `${CATEGORY_EMOJI[journal.project_category] || '📁'} ${journal.project_category.charAt(0).toUpperCase() + journal.project_category.slice(1)}`
        : "📁 Umum";

    const { title: extractedTitle, content: extractedContent } = extractTitleAndContent(journal.content);
    const displayTitle = journal.title || extractedTitle || "Laporan Aktivitas";
    const displayContent = extractedTitle ? extractedContent : journal.content;

    return (
        <div
            className={`relative bg-white rounded-xl border border-slate-200 border-l-4 ${status.accent} hover:shadow-md hover:border-slate-300 transition-all duration-300 cursor-pointer group overflow-hidden`}
            onClick={onClick}
        >
            <div className="p-5">
                {/* Header: Date & Status */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">
                            {format(new Date(journal.date), "EEEE", { locale: localeId })}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-sm text-slate-500">
                            {format(new Date(journal.date), "d MMMM yyyy", { locale: localeId })}
                        </span>
                    </div>

                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${status.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                        {status.label}
                    </span>
                </div>

                {/* Title */}
                <h3 className="text-base font-bold text-slate-900 mb-1.5 line-clamp-1 group-hover:text-blue-700 transition-colors">
                    {displayTitle}
                </h3>

                {/* Content Preview */}
                <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed mb-4">
                    {displayContent}
                </p>

                {/* Footer Metadata */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1.5">
                            {categoryLabel}
                        </span>
                        <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {durationString}
                        </span>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                </div>

                {/* Manager Feedback */}
                {journal.manager_notes && (
                    <div className={`mt-4 pt-4 border-t border-slate-100 flex gap-3 ${journal.verification_status === 'need_revision' ? 'bg-red-50/30 -mx-5 px-5 -mb-5 pb-5 rounded-b-lg' : ''}`}>
                        <Avatar className="w-7 h-7 border border-slate-200 shrink-0">
                            <AvatarImage src={journal.manager_profile?.avatar_url || undefined} />
                            <AvatarFallback className="bg-slate-100 text-slate-600 text-[10px]">M</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                            <p className="text-[11px] font-bold text-slate-700 mb-0.5">
                                {journal.manager_profile?.full_name || "Catatan Manager"}
                            </p>
                            <p className="text-xs text-slate-500 italic line-clamp-2">
                                "{journal.manager_notes}"
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
