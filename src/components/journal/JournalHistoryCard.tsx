
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Clock, Folder, MessageSquare, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export interface JournalHistoryItem {
    id: string;
    title?: string;
    content: string;
    date: string;
    duration: number;
    verification_status: 'draft' | 'submitted' | 'need_revision' | 'approved' | 'read';
    manager_notes?: string;
    manager_profile?: {
        full_name: string;
        avatar_url: string | null;
    };
    project_category?: string;
    obstacles?: string; // Added to match usage
}

interface JournalHistoryCardProps {
    journal: JournalHistoryItem;
    onClick?: () => void;
}

const STATUS_CONFIG = {
    draft: { color: "border-slate-400", badgeBg: "bg-slate-100", badgeText: "text-slate-600", label: "Draft" },
    submitted: { color: "border-amber-400", badgeBg: "bg-amber-100", badgeText: "text-amber-700", label: "Pending" },
    need_revision: { color: "border-red-500", badgeBg: "bg-red-100", badgeText: "text-red-700", label: "Revision Required" },
    approved: { color: "border-green-500", badgeBg: "bg-green-100", badgeText: "text-green-700", label: "Approved" },
    read: { color: "border-blue-400", badgeBg: "bg-blue-100", badgeText: "text-blue-700", label: "Read" },
};

export function JournalHistoryCard({ journal, onClick }: JournalHistoryCardProps) {
    const status = STATUS_CONFIG[journal.verification_status] || STATUS_CONFIG.submitted;

    // Format Duration
    const hours = Math.floor(journal.duration / 60);
    const minutes = journal.duration % 60;
    const durationString = hours > 0
        ? `${hours}.${Math.round(minutes / 6)} Hours` // e.g. 4.5 Hours
        : `${minutes} Mins`;

    return (
        <Card
            className={`overflow-hidden border-l-4 border-y border-r border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer bg-white ${status.color}`}
            onClick={onClick}
        >
            <CardContent className="p-5">
                {/* Header: Date & Status */}
                <div className="flex items-center justify-between mb-3">
                    <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-medium rounded-md px-2.5 py-1">
                        {format(new Date(journal.date), "MMM d, yyyy")}
                    </Badge>

                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${status.badgeBg} ${status.badgeText}`}>
                        {journal.verification_status === 'approved' && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {journal.verification_status === 'need_revision' && <AlertCircle className="w-3.5 h-3.5" />}
                        {status.label}
                    </div>
                </div>

                {/* Content */}
                <div className="mb-4">
                    <h3 className="text-lg font-bold text-slate-900 mb-1 line-clamp-1">
                        {journal.title || "No Title"}
                    </h3>
                    <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
                        {journal.content}
                    </p>
                </div>

                {/* Footer Metadata */}
                <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
                    <div className="flex items-center gap-1.5">
                        <Folder className="w-4 h-4 text-slate-400" />
                        <span>{journal.project_category || "General Task"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span>{durationString}</span>
                    </div>
                </div>

                {/* Manager Feedback Section */}
                {journal.manager_notes && (
                    <div className={`mt-4 pt-4 border-t border-slate-100 flex gap-3 ${journal.verification_status === 'need_revision' ? 'bg-red-50/50 -mx-5 px-5 -mb-5 py-4' : ''}`}>
                        <Avatar className="w-8 h-8 border border-slate-200">
                            <AvatarImage src={journal.manager_profile?.avatar_url || undefined} />
                            <AvatarFallback className="bg-slate-100 text-slate-600 text-xs">M</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="text-xs font-bold text-slate-900 mb-0.5">
                                {journal.manager_profile?.full_name || "Manager Feedback"}
                            </p>
                            <p className="text-xs text-slate-600 italic">
                                "{journal.manager_notes}"
                            </p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
