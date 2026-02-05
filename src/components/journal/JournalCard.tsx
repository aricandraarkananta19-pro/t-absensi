import { useState } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Calendar, Clock, Pencil, Trash2, CheckCircle2,
    AlertCircle, FileEdit, Send, Eye, MoreHorizontal, History
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

// Status badge configuration with clear visual hierarchy
const STATUS_CONFIG = {
    draft: {
        label: "Draft",
        className: "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-150",
        icon: FileEdit,
        description: "Belum dikirim"
    },
    submitted: {
        label: "Terkirim",
        className: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
        icon: Send,
        description: "Menunggu review Manager"
    },
    read: {
        label: "Dibaca Manager",
        className: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100",
        icon: Eye,
        description: "Manager telah membaca"
    },
    need_revision: {
        label: "Perlu Revisi",
        className: "bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100",
        icon: AlertCircle,
        description: "Ada catatan untuk diperbaiki"
    },
    approved: {
        label: "Disetujui",
        className: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100",
        icon: CheckCircle2,
        description: "Jurnal telah diverifikasi"
    }
};

const WORK_RESULT_LABELS = {
    completed: { label: "Selesai", className: "bg-emerald-50 text-emerald-700" },
    progress: { label: "Dalam Progress", className: "bg-blue-50 text-blue-700" },
    pending: { label: "Tertunda", className: "bg-amber-50 text-amber-700" }
};

// Status badge with simplified enterprise look
export function JournalStatusBadge({ status, showIcon = true }: { status: string; showIcon?: boolean }) {
    const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.submitted;
    const IconComponent = config.icon;

    return (
        <Badge
            variant="outline"
            className={`${config.className} font-medium text-[10px] uppercase tracking-wide gap-1.5 px-2.5 py-0.5 border h-6`}
        >
            {showIcon && <IconComponent className="w-3 h-3" />}
            {config.label}
        </Badge>
    );
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
    const profile = (journal as any).profiles; // Type assertion since interface might lag

    // Permission Logic
    const canEdit = isEmployee
        ? ['draft', 'need_revision', 'submitted'].includes(status)
        : true;
    const canDelete = isEmployee
        ? ['draft', 'submitted', 'need_revision'].includes(status)
        : true;
    const isLocked = status === 'approved';
    const isBackdated = isAfter(startOfDay(parseISO(journal.created_at)), addDays(startOfDay(parseISO(journal.date)), 1));

    // Content Truncation
    const truncatedContent = journal.content.length > 200
        ? journal.content.substring(0, 200) + "..."
        : journal.content;

    return (
        <Card className={`
            bg-white border transition-all duration-200 group w-full cursor-pointer
            ${isMobile ? 'rounded-xl mb-3 border-slate-200 shadow-sm' : 'rounded-lg border-slate-200 hover:border-slate-300 hover:shadow-md'}
            ${isLocked ? 'bg-slate-50/40' : ''}
        `}
            onClick={() => {
                if (isMobile && canEdit) onEdit?.(journal);
                else onView?.(journal);
            }}
        >
            <CardContent className="p-4 md:p-5">
                <div className="flex flex-col gap-4">
                    {/* Header: User Info (Admin) or Date (Employee) */}
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            {!isEmployee && profile ? (
                                <>
                                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-100">
                                        {profile.avatar_url ? (
                                            <img src={profile.avatar_url} alt={profile.full_name} className="h-full w-full object-cover" />
                                        ) : (
                                            <span className="text-sm font-bold text-slate-500">{profile.full_name?.charAt(0)}</span>
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold text-slate-900 leading-tight">{profile.full_name}</h4>
                                        <p className="text-xs text-slate-500 mt-0.5">{profile.department || "Karyawan"} • {profile.position || "-"}</p>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-slate-900">
                                        {format(new Date(journal.date), "EEEE, dd MMM yyyy", { locale: id })}
                                    </span>
                                    {!isEmployee && <span className="text-xs text-slate-400">Pengguna Tidak Dikenal</span>}
                                </div>
                            )}
                        </div>

                        {/* Top Right: Status & Date (for Admin) */}
                        <div className="flex flex-col items-end gap-1.5">
                            <JournalStatusBadge status={status} />
                            {!isEmployee && (
                                <span className="text-[10px] text-slate-400 font-medium">
                                    {format(new Date(journal.date), "d MMM yyyy", { locale: id })}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Divider for Employee View to separate Date from Content */}
                    {isEmployee && <div className="h-px bg-slate-100 -mx-5 md:-mx-5" />}

                    {/* Body Content */}
                    <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {isMobile ? journal.content : truncatedContent}
                    </div>

                    {/* Footer Info (Manager Notes, Obstacles, Backdated) */}
                    {(journal.manager_notes || journal.obstacles || isBackdated) && (
                        <div className="flex flex-col gap-2 mt-1">
                            {/* Manager Feedback */}
                            {journal.manager_notes && (
                                <div className={`text-xs p-3 rounded-md border ${status === 'need_revision' ? 'bg-orange-50 border-orange-100 text-orange-800' : 'bg-blue-50 border-blue-100 text-blue-800'}`}>
                                    <span className="font-semibold block mb-1">💬 Catatan Manager:</span>
                                    {journal.manager_notes}
                                </div>
                            )}

                            {/* Obstacles */}
                            {journal.obstacles && (
                                <div className="text-xs p-3 rounded-md bg-amber-50 border border-amber-100 text-amber-800">
                                    <span className="font-semibold block mb-1">⚠️ Kendala:</span>
                                    {journal.obstacles}
                                </div>
                            )}

                            {/* Backdated Tag */}
                            {isBackdated && (
                                <div className="flex items-center gap-1.5 text-[10px] text-amber-600 font-medium mt-1">
                                    <History className="w-3 h-3" />
                                    <span>Diisi terlambat: {format(parseISO(journal.created_at), "d MMM HH:mm")}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Actions Row */}
                    {showActions && (
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-1">
                            <div className="flex items-center gap-3">
                                {journal.duration > 0 && (
                                    <span className="text-xs text-slate-500 flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5" />
                                        {Math.floor(journal.duration / 60)}j {journal.duration % 60}m
                                    </span>
                                )}
                                {journal.mood && <span className="text-sm grayscale opacity-70 hover:grayscale-0 transition-all cursor-help" title="Mood">{journal.mood}</span>}
                            </div>

                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="sm" className="h-8 text-xs text-slate-600 hover:text-blue-600 hover:bg-blue-50" onClick={() => onView?.(journal)}>
                                    Detail
                                </Button>

                                {!isEmployee && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400">
                                                <MoreHorizontal className="w-4 h-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => onView?.(journal)}><Eye className="mr-2 h-4 w-4" /> Lihat Detail</DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => onDelete?.(journal)} className="text-red-600"><Trash2 className="mr-2 h-4 w-4" /> Hapus</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}

                                {isEmployee && !isLocked && (
                                    <>
                                        {canEdit && <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onEdit?.(journal)}><Pencil className="w-3.5 h-3.5" /></Button>}
                                        {canDelete && <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:bg-red-50" onClick={() => onDelete?.(journal)}><Trash2 className="w-3.5 h-3.5" /></Button>}
                                    </>
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
