
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { JournalCardData } from "@/components/journal/JournalCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Clock, Paperclip } from "lucide-react";

interface JournalReviewSidebarProps {
    journals: JournalCardData[];
    selectedId: string | null;
    onSelect: (journal: JournalCardData) => void;
    isLoading?: boolean;
    hasMore?: boolean;
    onLoadMore?: () => void;
    isLoadingMore?: boolean;
}

export function JournalReviewSidebar({
    journals,
    selectedId,
    onSelect,
    isLoading = false,
    hasMore = false,
    onLoadMore,
    isLoadingMore = false
}: JournalReviewSidebarProps) {

    if (isLoading) {
        return (
            <div className="space-y-3 p-4">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-24 bg-slate-50 rounded-xl animate-pulse border border-slate-100" />
                ))}
            </div>
        );
    }

    if (journals.length === 0 && !isLoading) {
        return (
            <div className="p-8 text-center text-slate-500 text-sm">
                No journals found.
            </div>
        );
    }

    return (
        <div className="space-y-2 p-3">
            {journals.map((journal) => {
                const isSelected = selectedId === journal.id;
                // Safe access to profile data
                const profile = (journal as any).profiles || {};
                const fullName = profile.full_name || "Unknown User";
                const avatar = profile.avatar_url;

                // Format duration nicely
                const hours = Math.floor(journal.duration / 60);
                const minutes = journal.duration % 60;
                const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

                // Title fallback
                const displayTitle = (journal as any).title || "Activity Report";

                return (
                    <div
                        key={journal.id}
                        onClick={() => onSelect(journal)}
                        className={cn(
                            "group cursor-pointer rounded-xl p-4 border transition-all duration-200 relative overflow-hidden",
                            isSelected
                                ? "bg-blue-50/50 border-blue-200 shadow-sm"
                                : "bg-white border-transparent hover:border-slate-100 hover:bg-slate-50"
                        )}
                    >
                        {isSelected && (
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600" />
                        )}

                        <div className="flex items-start gap-3">
                            <div className="relative shrink-0">
                                <Avatar className="h-10 w-10 border border-slate-100">
                                    <AvatarImage src={avatar || undefined} />
                                    <AvatarFallback className="text-xs bg-slate-100 text-slate-600">
                                        {fullName.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                {journal.verification_status === 'need_revision' && (
                                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border-2 border-white" />
                                )}
                            </div>

                            <div className="min-w-0 flex-1">
                                <div className="flex justify-between items-start mb-0.5">
                                    <h4 className={cn(
                                        "text-sm font-bold truncate pr-2",
                                        isSelected ? "text-blue-900" : "text-slate-900"
                                    )}>
                                        {fullName}
                                    </h4>
                                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                        {format(new Date(journal.date), "dd MMM")}
                                    </span>
                                </div>

                                <p className="text-xs font-medium text-slate-700 truncate mb-1.5">
                                    {displayTitle}
                                </p>

                                <div className="flex items-center gap-3 text-[10px] text-slate-500">
                                    <div className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        <span>{durationText}</span>
                                    </div>
                                    {/* Placeholder for attachments count if we implement it later */}
                                    {/* <div className="flex items-center gap-1">
                                        <Paperclip className="w-3 h-3" />
                                        <span>2</span>
                                    </div> */}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}

            {hasMore && (
                <div className="p-4 pt-2">
                    <button
                        onClick={onLoadMore}
                        disabled={isLoadingMore}
                        className="w-full py-2.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        {isLoadingMore ? (
                            <>
                                <span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                                Loading...
                            </>
                        ) : (
                            "Load More"
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
