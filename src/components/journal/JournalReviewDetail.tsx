import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Clock, AlertCircle, XCircle, CheckCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { JournalCardData } from "./JournalCard";

interface JournalReviewDetailProps {
    journal?: JournalCardData | null;
    onApprove: (id: string) => Promise<void>;
    onReject: (id: string, reason: string) => Promise<void>;
    onRequestRevision: (id: string, comment: string) => Promise<void>;
    isProcessing?: boolean;
}

// Add History Item Interface
interface JournalHistoryItem {
    id: string;
    date: string;
    content: string;
    verification_status: string;
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
                .neq('id', journal.id) // Exclude current
                .is('deleted_at', null)
                .order('date', { ascending: false })
                .limit(5);

            if (error) throw error;
            return data as JournalHistoryItem[];
        },
        enabled: !!journal?.user_id,
        staleTime: 60000 // 1 min
    });

    if (!journal) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50/30">
                <FileText className="w-16 h-16 mb-4 text-slate-200" />
                <p>Select a journal to view details</p>
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

    const displayTitle = (journal as any).title || "Daily Activity Report";
    const profile = profiles || {};

    // Status Logic
    const getStatusBadge = (status: string = verification_status) => {
        switch (status) {
            case 'approved': return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">Approved</Badge>;
            case 'need_revision': return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-orange-200">Revision</Badge>;
            case 'rejected': return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">Rejected</Badge>;
            default: return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">Pending</Badge>;
        }
    };

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
    const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="px-8 py-6 border-b border-slate-100 shrink-0">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        {getStatusBadge()}
                        <span className="text-xs font-mono text-slate-400">• ID: #{journal.id.substring(0, 8)}</span>
                    </div>
                    {/* Dropped Menu for clearer UI */}
                </div>

                <h1 className="text-2xl font-bold text-slate-900 mb-6 leading-tight">
                    {displayTitle}
                </h1>

                {/* User Info Card */}
                <div className="flex items-center justify-between bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-slate-200 shadow-sm">
                            <AvatarImage src={profile.avatar_url || undefined} />
                            <AvatarFallback>{profile.full_name?.substring(0, 2).toUpperCase() || "UN"}</AvatarFallback>
                        </Avatar>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900">{profile.full_name || "Unknown User"}</h3>
                            <p className="text-xs text-slate-500 flex items-center gap-1.5">
                                {profile.position || "Employee"}
                                <span className="text-slate-300">•</span>
                                {profile.department || "General"}
                            </p>
                        </div>
                    </div>

                    <div className="hidden sm:flex items-center gap-6 text-right">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Date</p>
                            <p className="text-sm font-semibold text-slate-900">
                                {format(new Date(date), "MMM d, yyyy")}
                            </p>
                        </div>
                        <div className="w-px h-8 bg-slate-200" />
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Duration</p>
                            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                {durationText}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
                <div className="space-y-8 max-w-4xl">
                    <section>
                        <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-500" />
                            Activity Description
                        </h3>
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="prose prose-slate text-sm max-w-none text-slate-700 leading-relaxed whitespace-pre-wrap">
                                {content}
                            </div>
                        </div>
                    </section>

                    {/* HISTORY SECTION */}
                    {history.length > 0 && (
                        <section>
                            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-slate-400" />
                                Previous Journals
                            </h3>
                            <div className="space-y-3">
                                {history.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-white hover:bg-slate-50 transition-colors">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs font-semibold text-slate-700">
                                                {format(new Date(item.date), "EEE, MMM d, yyyy")}
                                            </span>
                                            <span className="text-xs text-slate-500 line-clamp-1 max-w-[250px]">
                                                {item.content}
                                            </span>
                                        </div>
                                        <div className="transform scale-90 origin-right">
                                            {getStatusBadge(item.verification_status)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </div>

            {/* Footer Action Area */}
            <div className="p-6 border-t border-slate-100 bg-slate-50/50">
                <div className="max-w-4xl mx-auto space-y-4">
                    <Textarea
                        placeholder="Add a comment for revision request or rejection note..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className="bg-white border-slate-200 min-h-[80px] focus:border-blue-500 resize-none rounded-xl"
                    />

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                            Comments are mandatory for Rejection/Revision
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <Button
                                variant="ghost"
                                className="flex-1 sm:flex-none text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleAction('reject')}
                                disabled={isProcessing || (actionMode === 'reject' && !comment) || (!comment && actionMode == null)}
                            >
                                <XCircle className="w-4 h-4 mr-2" />
                                Reject
                            </Button>

                            <Button
                                variant="outline"
                                className="flex-1 sm:flex-none bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                onClick={() => handleAction('revise')}
                                disabled={isProcessing || !comment}
                            >
                                Request Revision
                            </Button>

                            <Button
                                className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white px-6"
                                onClick={() => handleAction('approve')}
                                disabled={isProcessing}
                            >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Approve
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
