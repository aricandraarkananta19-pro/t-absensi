import { useState } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Calendar, Clock, Pencil, Trash2, CheckCircle2,
    AlertCircle, FileEdit, Send, Eye, MoreHorizontal, History,
    ChevronRight, User
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

export interface JournalCardData {
    id: string;
    content: string;
    date: string;
    duration: number;
    verification_status: string;
    manager_notes?: string;
    work_result?: 'completed' | 'progress' | 'pending';
    obstacles?: string;
    mood?: '😊' | '😐' | '😣';
    created_at: string;
    updated_at?: string;
    profiles?: {
        full_name: string;
        avatar_url: string | null;
        department?: string | null;
        position?: string | null;
    };
}

interface JournalCardProps {
    journal: JournalCardData;
    onEdit?: (journal: JournalCardData) => void;
    onDelete?: (journal: JournalCardData) => void;
    onView?: (journal: JournalCardData) => void;
    showActions?: boolean;
    isEmployee?: boolean;
}

// Enterprise-grade status configuration with refined colors
const STATUS_CONFIG = {
    draft: {
        label: "Draft",
        className: "bg-slate-50 text-slate-600 border-slate-200",
        dotColor: "bg-slate-400",
        icon: FileEdit,
        description: "Belum dikirim"
    },
    submitted: {
        label: "Menunggu Review",
        className: "bg-amber-50 text-amber-700 border-amber-200",
        dotColor: "bg-amber-500",
        icon: Send,
        description: "Menunggu review Manager"
    },
    read: {
        label: "Dibaca",
        className: "bg-purple-50 text-purple-700 border-purple-200",
        dotColor: "bg-purple-500",
        icon: Eye,
        description: "Manager telah membaca"
    },
    need_revision: {
        label: "Revisi",
        className: "bg-orange-50 text-orange-600 border-orange-200",
        dotColor: "bg-orange-500",
        icon: AlertCircle,
        description: "Ada catatan untuk diperbaiki"
    },
    approved: {
        label: "Disetujui",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
        dotColor: "bg-emerald-500",
        icon: CheckCircle2,
        description: "Jurnal telah diverifikasi"
    }
};

// Minimal enterprise status badge
export function JournalStatusBadge({ status, showIcon = true }: { status: string; showIcon?: boolean }) {
    const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.submitted;

    return (
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide border ${config.className}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
            {config.label}
        </div>
    );
}

// Get initials from name
function getInitials(name: string): string {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function JournalCard({
    journal,
    onEdit,
    onDelete,
    onView,
    showActions = true,
    isEmployee = true
}: JournalCardProps) {
    const isMobile = useIsMobile();
    const status = journal.verification_status || 'submitted';
    const profile = (journal as any).profiles;

    // Permission Logic
    const canEdit = isEmployee
        ? ['draft', 'need_revision', 'submitted'].includes(status)
        : true;
    const canDelete = isEmployee
        ? ['draft', 'submitted', 'need_revision'].includes(status)
        : true;
    const isLocked = status === 'approved';
    const isBackdated = isAfter(startOfDay(parseISO(journal.created_at)), addDays(startOfDay(parseISO(journal.date)), 1));

    // Content - Line clamp for readability
    const maxLength = isMobile ? 150 : 220;
    const truncatedContent = journal.content.length > maxLength
        ? journal.content.substring(0, maxLength) + "..."
        : journal.content;

    // Background gradient based on status
    const getGradient = () => {
        if (isLocked) return "from-emerald-50/30 to-white";
        if (status === 'need_revision') return "from-orange-50/30 to-white";
        if (status === 'submitted') return "from-amber-50/20 to-white";
        return "from-slate-50/20 to-white";
    };

    return (
        <Card
            className={`
                relative overflow-hidden bg-gradient-to-br ${getGradient()}
                border border-slate-200/80 transition-all duration-300 cursor-pointer group
                hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/50
                ${isMobile ? 'rounded-2xl' : 'rounded-xl'}
            `}
            onClick={() => onView?.(journal)}
        >
            {/* Accent Line */}
            <div className={`absolute top-0 left-0 w-1 h-full ${STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.dotColor || 'bg-slate-300'}`} />

            <CardContent className={`${isMobile ? 'p-4' : 'p-5'} pl-5`}>
                <div className="flex flex-col gap-4">

                    {/* HEADER ROW */}
                    <div className="flex items-start justify-between gap-3">

                        {/* Left: Avatar + Name/Date */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                            {!isEmployee && profile ? (
                                <>
                                    <Avatar className="h-11 w-11 border-2 border-white shadow-sm shrink-0">
                                        <AvatarImage src={profile.avatar_url || undefined} alt={profile.full_name} />
                                        <AvatarFallback className="bg-gradient-to-br from-slate-700 to-slate-900 text-white text-sm font-bold">
                                            {getInitials(profile.full_name)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                        <h4 className="text-sm font-bold text-slate-900 truncate leading-tight">
                                            {profile.full_name}
                                        </h4>
                                        <p className="text-xs text-slate-500 truncate mt-0.5">
                                            {profile.position || profile.department || "Karyawan"}
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="h-11 w-11 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-sm shrink-0">
                                        <Calendar className="w-5 h-5 text-white" />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-sm font-bold text-slate-900">
                                            {format(new Date(journal.date), "EEEE", { locale: id })}
                                        </h4>
                                        <p className="text-xs text-slate-500">
                                            {format(new Date(journal.date), "d MMMM yyyy", { locale: id })}
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Right: Status + Date (Admin) */}
                        <div className="flex flex-col items-end gap-2 shrink-0">
                            <JournalStatusBadge status={status} />
                            {!isEmployee && (
                                <span className="text-[10px] text-slate-400 font-medium tabular-nums">
                                    {format(new Date(journal.date), "dd/MM/yy", { locale: id })}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* CONTENT SECTION */}
                    <div className="space-y-3">
                        <p className="text-sm text-slate-700 leading-relaxed line-clamp-3">
                            {journal.content}
                        </p>

                        {/* Duration + Mood Pills */}
                        {(journal.duration > 0 || journal.mood) && (
                            <div className="flex items-center gap-2 flex-wrap">
                                {journal.duration > 0 && (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 rounded-md text-[10px] font-medium text-slate-600">
                                        <Clock className="w-3 h-3" />
                                        {Math.floor(journal.duration / 60)}j {journal.duration % 60}m
                                    </span>
                                )}
                                {journal.mood && (
                                    <span className="text-base grayscale-0 cursor-help" title="Mood hari ini">
                                        {journal.mood}
                                    </span>
                                )}
                                {isBackdated && (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-medium">
                                        <History className="w-3 h-3" />
                                        Diisi terlambat
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* MANAGER NOTES (if any) */}
                    {journal.manager_notes && (
                        <div className={`
                            text-xs p-3 rounded-lg border-l-4
                            ${status === 'need_revision'
                                ? 'bg-orange-50 border-orange-400 text-orange-800'
                                : 'bg-blue-50 border-blue-400 text-blue-800'}
                        `}>
                            <span className="font-bold block mb-1">💬 Catatan Manager</span>
                            <span className="line-clamp-2">{journal.manager_notes}</span>
                        </div>
                    )}

                    {/* OBSTACLES (if any) */}
                    {journal.obstacles && (
                        <div className="text-xs p-3 rounded-lg bg-amber-50 border-l-4 border-amber-400 text-amber-800">
                            <span className="font-bold block mb-1">⚠️ Kendala</span>
                            <span className="line-clamp-2">{journal.obstacles}</span>
                        </div>
                    )}

                    {/* ACTIONS ROW */}
                    {showActions && (
                        <div
                            className="flex items-center justify-between pt-3 border-t border-slate-100"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-3 text-xs font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50 gap-1.5"
                                    onClick={() => onView?.(journal)}
                                >
                                    <Eye className="w-3.5 h-3.5" />
                                    Lihat Detail
                                </Button>
                            </div>

                            <div className="flex items-center gap-1">
                                {isEmployee && !isLocked && (
                                    <>
                                        {canEdit && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                                onClick={() => onEdit?.(journal)}
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </Button>
                                        )}
                                        {canDelete && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                onClick={() => onDelete?.(journal)}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        )}
                                    </>
                                )}

                                {!isEmployee && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600">
                                                <MoreHorizontal className="w-4 h-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-44">
                                            <DropdownMenuItem onClick={() => onView?.(journal)} className="gap-2">
                                                <Eye className="w-4 h-4" /> Lihat Detail
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => onDelete?.(journal)} className="text-red-600 gap-2">
                                                <Trash2 className="w-4 h-4" /> Arsipkan
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

export default JournalCard;

