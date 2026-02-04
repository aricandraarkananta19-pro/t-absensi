import { useIsMobile } from "@/hooks/useIsMobile";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Calendar, Clock, Pencil, Trash2, CheckCircle2,
    AlertCircle, FileEdit, Send, Eye, MoreHorizontal, History, MessageSquare,
    User
} from "lucide-react";
import { format, isAfter, addDays, parseISO, startOfDay } from "date-fns";
import { id } from "date-fns/locale";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

export interface JournalCardData {
    id: string;
    content: string;
    date: string;
    duration: number;
    verification_status: string; // 'draft', 'submitted', 'need_revision', 'approved'
    manager_notes?: string;
    work_result?: 'completed' | 'progress' | 'pending';
    obstacles?: string;
    mood?: string;
    created_at: string;
    updated_at?: string;
    profiles?: {
        full_name: string;
        avatar_url: string | null;
        department: string | null;
        position: string | null;
    };
}

interface JournalCardProps {
    journal: JournalCardData;
    onEdit?: (journal: JournalCardData) => void;
    onDelete?: (journal: JournalCardData) => void;
    onView?: (journal: JournalCardData) => void;
    showActions?: boolean;
    isEmployee?: boolean;
    showProfile?: boolean; // New prop to toggle profile visibility
}

// ----------------------------------------------------------------------
// CONFIGURATION
// ----------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: any; description: string }> = {
    draft: {
        label: "Draft",
        className: "bg-slate-100 text-slate-600 border-slate-200",
        icon: FileEdit,
        description: "Hanya terlihat oleh Anda"
    },
    submitted: {
        label: "Menunggu Review",
        className: "bg-blue-50 text-blue-700 border-blue-200",
        icon: Clock,
        description: "Menunggu persetujuan atasan"
    },
    need_revision: {
        label: "Perlu Revisi",
        className: "bg-orange-50 text-orange-700 border-orange-200",
        icon: AlertCircle,
        description: "Perlu perbaikan dari karyawan"
    },
    approved: {
        label: "Disetujui",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
        icon: CheckCircle2,
        description: "Jurnal telah diverifikasi"
    }
};

const WORK_RESULT_LABELS: Record<string, { label: string; className: string }> = {
    completed: { label: "Selesai", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    progress: { label: "Progress", className: "bg-blue-50 text-blue-700 border-blue-200" },
    pending: { label: "Tertunda", className: "bg-amber-50 text-amber-700 border-amber-200" }
};


export function JournalStatusBadge({ status, showIcon = true }: { status: string; showIcon?: boolean }) {
    const safeStatus = STATUS_CONFIG[status] ? status : 'submitted';
    const config = STATUS_CONFIG[safeStatus];
    const IconComponent = config.icon;

    return (
        <TooltipProvider>
            <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                    <Badge variant="outline" className={`${config.className} font-semibold text-[10px] uppercase tracking-wide px-2.5 py-0.5 gap-1.5 cursor-default hover:bg-opacity-80 transition-all`}>
                        {showIcon && <IconComponent className="w-3 h-3" />}
                        {config.label}
                    </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs font-medium">
                    {config.description}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

// ----------------------------------------------------------------------
// MAIN COMPONENT
// ----------------------------------------------------------------------

export function JournalCard({
    journal,
    onEdit,
    onDelete,
    onView,
    showActions = true,
    isEmployee = true,
    showProfile = false
}: JournalCardProps) {
    const isMobile = useIsMobile();
    const status = journal.verification_status || 'submitted';

    // Permission Logic
    const canEdit = isEmployee ? ['draft', 'need_revision'].includes(status) : true;
    const canDelete = isEmployee ? ['draft'].includes(status) : true; // Employees can only delete drafts usually, or maybe revised ones.
    const isLocked = status === 'approved' && isEmployee; // Employee cannot touch approved journals

    // Parsing Dates safely
    const journalDate = new Date(journal.date);
    const createdAt = parseISO(journal.created_at);
    const isBackdated = isAfter(startOfDay(createdAt), addDays(startOfDay(journalDate), 1));

    // Profile Initials
    const getInitials = (name: string) => name ? name.split(" ").map(n => n.charAt(0)).slice(0, 2).join("").toUpperCase() : "??";

    return (
        <Card
            className={`
                group relative overflow-hidden transition-all duration-300 border
                ${isMobile ? 'rounded-2xl border-slate-200/60 shadow-sm mb-3' : 'rounded-xl hover:shadow-md hover:border-slate-300 border-slate-200'}
                bg-white
            `}
            onClick={() => onView?.(journal)}
        >
            <CardContent className="p-0 flex flex-col sm:flex-row h-full">

                {/* 1. LEFT SIDE: Profile or Date Strip */}
                {showProfile && journal.profiles ? (
                    <div className="p-4 sm:w-64 sm:border-r border-b sm:border-b-0 border-dashed border-slate-200 bg-slate-50/50 flex sm:flex-col flex-row items-center sm:items-start gap-3 shrink-0">
                        <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border-2 border-white shadow-sm">
                            <AvatarImage src={journal.profiles.avatar_url || ""} />
                            <AvatarFallback className="bg-blue-100 text-blue-600 text-xs font-bold">
                                {getInitials(journal.profiles.full_name)}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 text-left">
                            <p className="font-semibold text-slate-900 text-sm truncate leading-snug">
                                {journal.profiles.full_name}
                            </p>
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                                {journal.profiles.position || "Karyawan"}
                            </p>
                            <div className="flex items-center gap-1.5 mt-2 text-[10px] text-slate-400 font-medium">
                                <Calendar className="w-3 h-3" />
                                {format(journalDate, "d MMM yyyy", { locale: id })}
                            </div>
                        </div>
                    </div>
                ) : (
                    // Default Date Strip for Employee View (Desktop)
                    !isMobile && (
                        <div className="w-20 bg-slate-50/30 border-r border-slate-100 flex flex-col items-center justify-center py-4 shrink-0 hover:bg-slate-100 transition-colors">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                                {format(journalDate, "MMM", { locale: id })}
                            </span>
                            <span className="text-2xl font-bold text-slate-700 leading-none mt-1">
                                {format(journalDate, "dd")}
                            </span>
                            <span className="text-[10px] font-medium text-slate-400 mt-1">
                                {format(journalDate, "ccc", { locale: id })}
                            </span>
                        </div>
                    )
                )}

                {/* 2. MAIN CONTENT AREA */}
                <div className="flex-1 p-4 sm:p-5 relative min-w-0">

                    {/* Header Row: Status & Title */}
                    <div className="flex flex-wrap items-start justify-between gap-y-2 gap-x-4 mb-3">
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Mobile Date Header if not showing profile or if strictly mobile layout */}
                            {(!showProfile || isMobile) && (showProfile ? null : (
                                <div className="sm:hidden flex items-center gap-2 text-xs font-semibold text-slate-700 mr-2">
                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                    {format(journalDate, "d MMM yyyy", { locale: id })}
                                </div>
                            ))}

                            <JournalStatusBadge status={status} />

                            {journal.work_result && (
                                <Badge variant="outline" className={`${WORK_RESULT_LABELS[journal.work_result]?.className} text-[10px] h-5`}>
                                    {WORK_RESULT_LABELS[journal.work_result]?.label}
                                </Badge>
                            )}

                            {isBackdated && (
                                <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-600 border-amber-200 h-5 gap-1">
                                    <History className="w-3 h-3" />
                                    Terlambat
                                </Badge>
                            )}
                        </div>

                        {/* Duration Badge */}
                        {journal.duration > 0 && (
                            <div className="flex items-center gap-1 text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                                <Clock className="w-3 h-3" />
                                <span>{Math.floor(journal.duration / 60)}j {journal.duration % 60}m</span>
                            </div>
                        )}
                    </div>

                    {/* Content Preview */}
                    <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap line-clamp-3 mb-4">
                        {journal.content}
                    </div>

                    {/* Footer Info: Obstacles & Notes */}
                    <div className="space-y-2">
                        {journal.obstacles && (
                            <div className="flex items-start gap-2 text-xs bg-amber-50/50 p-2 rounded-md border border-amber-100/50">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                                <div className="text-slate-600">
                                    <span className="font-semibold text-amber-700">Kendala: </span>
                                    {journal.obstacles}
                                </div>
                            </div>
                        )}

                        {journal.manager_notes && (
                            <div className={`flex items-start gap-2 text-xs p-2 rounded-md border ${status === 'need_revision' ? 'bg-orange-50 border-orange-100' : 'bg-blue-50 border-blue-100'
                                }`}>
                                <MessageSquare className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${status === 'need_revision' ? 'text-orange-600' : 'text-blue-600'
                                    }`} />
                                <div className="text-slate-600">
                                    <span className={`font-semibold ${status === 'need_revision' ? 'text-orange-700' : 'text-blue-700'
                                        }`}>Catatan Manager: </span>
                                    {journal.manager_notes}
                                </div>
                            </div>
                        )}
                    </div>

                </div>

                {/* 3. RIGHT SIDE: Actions (Hover or Mobile Menu) */}
                <div className="p-2 sm:p-4 flex sm:flex-col items-center justify-end sm:justify-start gap-1 border-t sm:border-t-0 sm:border-l border-slate-100 bg-slate-50/30">
                    <div className="w-full flex justify-end gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                            onClick={(e) => { e.stopPropagation(); onView?.(journal); }}
                        >
                            <Eye className="w-4 h-4 ml-1 md:ml-0 md:mr-1.5" />
                            <span className="hidden md:inline">Lihat</span>
                        </Button>

                        {/* More Actions Dropdown */}
                        {(canEdit || canDelete) && showActions && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400">
                                        <MoreHorizontal className="w-4 h-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {canEdit && (
                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit?.(journal); }}>
                                            <Pencil className="w-4 h-4 mr-2" /> Edit Jurnal
                                        </DropdownMenuItem>
                                    )}
                                    {canDelete && (
                                        <DropdownMenuItem
                                            onClick={(e) => { e.stopPropagation(); onDelete?.(journal); }}
                                            className="text-red-600 focus:text-red-700"
                                        >
                                            <Trash2 className="w-4 h-4 mr-2" /> Hapus
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </div>

            </CardContent>
        </Card>
    );
}

export default JournalCard;
