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

export function JournalStatusBadge({ status, showIcon = true }: { status: string; showIcon?: boolean }) {
    const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.submitted;
    const IconComponent = config.icon;

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Badge
                        className={`${config.className} font-medium text-[10px] uppercase tracking-wide px-2.5 py-1 cursor-help transition-colors`}
                    >
                        {showIcon && <IconComponent className="w-3 h-3 mr-1" />}
                        {config.label}
                    </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                    {config.description}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
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

    // Edit rules for employee
    const canEdit = isEmployee
        ? ['draft', 'need_revision'].includes(status)
        : true; // Managers/Admins can always edit

    // Delete rules for employee
    const canDelete = isEmployee
        ? status === 'draft'
        : true; // Managers/Admins can always delete

    const isLocked = status === 'approved';

    // Backdated logic: If created_at is more than 1 day after date
    const isBackdated = isAfter(startOfDay(parseISO(journal.created_at)), addDays(startOfDay(parseISO(journal.date)), 1));

    // Truncate content for preview
    const truncatedContent = journal.content.length > 150
        ? journal.content.substring(0, 150) + "..."
        : journal.content;

    return (
        <Card className={`
            bg-white border text-left
            ${isMobile
                ? 'border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] rounded-2xl mb-3'
                : 'border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 rounded-xl'
            }
            transition-all duration-200 overflow-hidden group w-full cursor-pointer active:scale-[0.99]
            ${isLocked ? 'bg-slate-50/50' : ''}
        `}
            onClick={() => {
                if (isMobile && canEdit) onEdit?.(journal);
                else if (isMobile) onView?.(journal);
            }}
        >
            <CardContent className="p-0">
                <div className="flex flex-col md:flex-row">
                    {/* Date Strip - Desktop Only */}
                    {!isMobile && (
                        <div className="w-24 bg-white border-r border-slate-100 flex flex-col items-center justify-center py-6 shrink-0 group-hover:bg-slate-50/50 transition-colors">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                                {format(new Date(journal.date), "MMM", { locale: id })}
                            </span>
                            <span className="text-4xl font-bold text-slate-800 leading-none tracking-tight">
                                {format(new Date(journal.date), "dd")}
                            </span>
                            <span className="text-[10px] font-medium text-slate-400 mt-2 bg-slate-100 px-2 py-0.5 rounded-full">
                                {format(new Date(journal.date), "EEEE", { locale: id })}
                            </span>
                        </div>
                    )}

                    {/* Content Area */}
                    <div className={`flex-1 ${isMobile ? 'p-4' : 'p-5'}`}>

                        {/* Mobile Header: Date & Status */}
                        {isMobile && (
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-slate-900">
                                        {format(new Date(journal.date), "EEEE, dd MMM yyyy", { locale: id })}
                                    </span>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        {journal.mood && <span className="text-sm">{journal.mood}</span>}
                                        {journal.duration > 0 && (
                                            <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                                                <Clock className="w-3 h-3" />
                                                {Math.floor(journal.duration / 60)}j {journal.duration % 60}m
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div onClick={(e) => e.stopPropagation()}>
                                    {/* Mobile Menu */}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 -mr-2">
                                                <MoreHorizontal className="w-5 h-5" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48">
                                            <DropdownMenuItem onClick={() => onView?.(journal)}>
                                                <Eye className="w-4 h-4 mr-2" /> Lihat Detail
                                            </DropdownMenuItem>
                                            {canEdit && (
                                                <DropdownMenuItem onClick={() => onEdit?.(journal)}>
                                                    <Pencil className="w-4 h-4 mr-2" /> Edit Jurnal
                                                </DropdownMenuItem>
                                            )}
                                            {canDelete && (
                                                <>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        onClick={() => onDelete?.(journal)}
                                                        className="text-red-600"
                                                    >
                                                        <Trash2 className="w-4 h-4 mr-2" /> Hapus Jurnal
                                                    </DropdownMenuItem>
                                                </>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        )}

                        {/* Top Badge Row (Desktop & Mobile) */}
                        <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <JournalStatusBadge status={status} /> {/* Re-add Badge here */}
                                {journal.work_result && (
                                    <Badge className={`${WORK_RESULT_LABELS[journal.work_result].className} text-[10px] uppercase font-medium border-0`}>
                                        {WORK_RESULT_LABELS[journal.work_result].label}
                                    </Badge>
                                )}
                                {isBackdated && (
                                    <Badge variant="outline" className="text-[10px] text-amber-600 bg-amber-50 border-amber-200 gap-1 px-2">
                                        <History className="w-3 h-3" />
                                        Terlambat
                                    </Badge>
                                )}
                            </div>

                            {/* Desktop Actions */}
                            {!isMobile && showActions && (
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {/* Quick Actions (visible on hover) */}
                                    {canEdit && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                                            onClick={() => onEdit?.(journal)}
                                        >
                                            <Pencil className="w-3.5 h-3.5 mr-1" />
                                            Edit
                                        </Button>
                                    )}

                                    {canDelete && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                                            onClick={() => onDelete?.(journal)}
                                        >
                                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                                            Hapus
                                        </Button>
                                    )}

                                    {/* More Actions Dropdown */}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600">
                                                <MoreHorizontal className="w-4 h-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48">
                                            <DropdownMenuItem onClick={() => onView?.(journal)}>
                                                <Eye className="w-4 h-4 mr-2" /> Lihat Detail
                                            </DropdownMenuItem>
                                            {canEdit && (
                                                <DropdownMenuItem onClick={() => onEdit?.(journal)}>
                                                    <Pencil className="w-4 h-4 mr-2" /> Edit Jurnal
                                                </DropdownMenuItem>
                                            )}
                                            {canDelete && (
                                                <>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        onClick={() => onDelete?.(journal)}
                                                        className="text-red-600 focus:text-red-700"
                                                    >
                                                        <Trash2 className="w-4 h-4 mr-2" /> Hapus Jurnal
                                                    </DropdownMenuItem>
                                                </>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            )}

                            {/* Status indicator for locked journals */}
                            {isLocked && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="flex items-center gap-1 text-[10px] text-green-600 bg-green-50 px-2 py-1 rounded-full">
                                                <CheckCircle2 className="w-3 h-3" />
                                                <span className="hidden sm:inline">Terkunci</span>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            Jurnal yang sudah disetujui tidak dapat diubah.
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                        </div>

                        {/* Content Preview */}
                        <p className={`
                            text-slate-700 leading-relaxed 
                            ${isMobile ? 'text-sm line-clamp-2 mt-2' : 'text-sm whitespace-pre-wrap'}
                        `}>
                            {isMobile ? journal.content : truncatedContent}
                        </p>

                        {/* Obstacles Section */}
                        {journal.obstacles && (
                            <div className="mt-3 p-2.5 bg-amber-50/50 border border-amber-100 rounded-lg">
                                <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-1">
                                    Kendala / Catatan
                                </p>
                                <p className="text-xs text-slate-600">{journal.obstacles}</p>
                            </div>
                        )}

                        {/* Manager Feedback (Highlighted for revisions) */}
                        {journal.manager_notes && (
                            <div className={`
                                mt-3 p-3 rounded-lg text-sm border
                                ${status === 'need_revision'
                                    ? 'bg-orange-50 border-orange-200'
                                    : 'bg-blue-50/50 border-blue-100'
                                }
                            `}>
                                <p className={`text-[10px] font-semibold mb-1 uppercase tracking-wide ${status === 'need_revision' ? 'text-orange-700' : 'text-blue-700'
                                    }`}>
                                    {status === 'need_revision' ? '⚠️ Catatan Revisi dari Manager:' : '💬 Catatan Manager:'}
                                </p>
                                <p className="text-slate-600 text-sm">{journal.manager_notes}</p>
                            </div>
                        )}

                        {/* Helpful hint for editable journals */}
                        {isEmployee && status === 'draft' && (
                            <p className="mt-3 text-[10px] text-slate-400 italic flex items-center gap-1">
                                <FileEdit className="w-3 h-3" />
                                Jurnal ini masih draft. Anda dapat mengedit atau mengirimnya kapan saja.
                            </p>
                        )}

                        {isEmployee && status === 'need_revision' && (
                            <p className="mt-3 text-[10px] text-orange-500 italic flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Jurnal ini perlu direvisi. Silakan edit dan kirim ulang.
                            </p>
                        )}

                        {isEmployee && status === 'approved' && (
                            <p className="mt-3 text-[10px] text-green-600 italic flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Jurnal telah disetujui dan terkunci.
                            </p>
                        )}

                        {isBackdated && (
                            <p className="mt-3 text-[10px] text-amber-500 italic flex items-center gap-1">
                                <History className="w-3 h-3" />
                                Jurnal ini diisi terlambat ({format(parseISO(journal.created_at), "d MMM")}).
                            </p>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card >
    );
}

export default JournalCard;
