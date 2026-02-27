
import { useState } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
    MoreHorizontal, Eye, CheckCircle2, XCircle, Calendar, User2
} from "lucide-react";
import { JournalCardData } from "@/components/journal/JournalCard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
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
import { cn } from "@/lib/utils";

interface JournalTableProps {
    data: JournalCardData[];
    selectedIds: string[];
    onSelect: (id: string, checked: boolean) => void;
    onSelectAll: (checked: boolean) => void;
    onView: (journal: JournalCardData) => void;
    onApprove: (id: string) => void;
    onReject: (id: string) => void;
    isLoading?: boolean;
}

// Status badge config
const STATUS_MAP: Record<string, { label: string; className: string; dot: string }> = {
    approved: {
        label: "Disetujui",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
        dot: "bg-emerald-500"
    },
    need_revision: {
        label: "Revisi",
        className: "bg-orange-50 text-orange-700 border-orange-200",
        dot: "bg-orange-500"
    },
    rejected: {
        label: "Ditolak",
        className: "bg-red-50 text-red-700 border-red-200",
        dot: "bg-red-500"
    },
    submitted: {
        label: "Pending",
        className: "bg-amber-50 text-amber-700 border-amber-200",
        dot: "bg-amber-500"
    },
    pending: {
        label: "Pending",
        className: "bg-amber-50 text-amber-700 border-amber-200",
        dot: "bg-amber-500"
    }
};

function StatusBadge({ status }: { status: string }) {
    const config = STATUS_MAP[status] || STATUS_MAP.submitted;
    return (
        <span className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border",
            config.className
        )}>
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", config.dot)} />
            {config.label}
        </span>
    );
}

export function JournalTable({
    data,
    selectedIds,
    onSelect,
    onSelectAll,
    onView,
    onApprove,
    onReject,
    isLoading = false
}: JournalTableProps) {
    const isAllSelected = data.length > 0 && selectedIds.length === data.length;
    const isSomeSelected = selectedIds.length > 0 && selectedIds.length < data.length;

    if (isLoading) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex items-center gap-4 animate-pulse">
                            <div className="h-5 w-5 bg-slate-100 rounded" />
                            <div className="h-8 w-8 bg-slate-100 rounded-full" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 w-1/3 bg-slate-100 rounded" />
                                <div className="h-3 w-1/5 bg-slate-50 rounded" />
                            </div>
                            <div className="h-6 w-20 bg-slate-100 rounded-full" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white/70 backdrop-blur-md md:bg-white rounded-[24px] md:rounded-2xl border border-slate-100 md:border-slate-200 shadow-sm overflow-hidden vibe-glass-card md:vibe-glass-card-none">
            {/* Desktop View */}
            <div className="hidden md:block">
                <Table>
                    <TableHeader>
                        <TableRow className="border-b border-slate-100 bg-slate-50/60 hover:bg-slate-50/60">
                            <TableHead className="w-[48px] pl-5">
                                <Checkbox
                                    checked={isAllSelected || (isSomeSelected ? "indeterminate" : false)}
                                    onCheckedChange={(checked) => onSelectAll(!!checked)}
                                    className="border-slate-300"
                                />
                            </TableHead>
                            <TableHead className="min-w-[200px]">
                                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Karyawan</span>
                            </TableHead>
                            <TableHead className="min-w-[120px]">
                                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tanggal</span>
                            </TableHead>
                            <TableHead className="min-w-[130px]">
                                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Departemen</span>
                            </TableHead>
                            <TableHead className="hidden lg:table-cell">
                                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Ringkasan Aktivitas</span>
                            </TableHead>
                            <TableHead className="min-w-[110px]">
                                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status</span>
                            </TableHead>
                            <TableHead className="w-[60px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-40 text-center">
                                    <div className="flex flex-col items-center justify-center gap-3">
                                        <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center">
                                            <Calendar className="h-7 w-7 text-slate-300" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-500">Tidak ada jurnal</p>
                                            <p className="text-xs text-slate-400 mt-0.5">Jurnal yang sesuai filter akan ditampilkan di sini</p>
                                        </div>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            data.map((journal, idx) => {
                                const isSelected = selectedIds.includes(journal.id);
                                const profile = (journal as any).profiles || {};
                                const status = journal.verification_status || 'submitted';
                                const contentPreview = journal.content.length > 60
                                    ? journal.content.substring(0, 60) + "..."
                                    : journal.content;

                                return (
                                    <TableRow
                                        key={journal.id}
                                        className={cn(
                                            "group transition-all duration-200 hover:bg-blue-50/40 cursor-pointer border-b border-slate-100 last:border-b-0",
                                            isSelected && "bg-blue-50/60 hover:bg-blue-50/70"
                                        )}
                                        onClick={() => onView(journal)}
                                    >
                                        <TableCell className="pl-5 py-4" onClick={(e) => e.stopPropagation()}>
                                            <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={(checked) => onSelect(journal.id, !!checked)}
                                                className="border-slate-300"
                                            />
                                        </TableCell>

                                        {/* Employee */}
                                        <TableCell className="py-4">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-9 w-9 border-2 border-white shadow-sm">
                                                    <AvatarImage src={profile.avatar_url} />
                                                    <AvatarFallback className="text-[11px] font-bold bg-gradient-to-br from-slate-600 to-slate-800 text-white">
                                                        {profile.full_name?.substring(0, 2).toUpperCase() || "?"}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-sm font-semibold text-slate-900 truncate">
                                                        {profile.full_name || "Unknown"}
                                                    </span>
                                                    <span className="text-[11px] text-slate-400">
                                                        {profile.position || "Karyawan"}
                                                    </span>
                                                </div>
                                            </div>
                                        </TableCell>

                                        {/* Date */}
                                        <TableCell className="py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-slate-700">
                                                    {format(new Date(journal.date), "d MMM yyyy", { locale: localeId })}
                                                </span>
                                                <span className="text-[11px] text-slate-400">
                                                    {format(new Date(journal.date), "EEEE", { locale: localeId })}
                                                </span>
                                            </div>
                                        </TableCell>

                                        {/* Department */}
                                        <TableCell className="py-4">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-medium border border-slate-200/60">
                                                {profile.department || "General"}
                                            </span>
                                        </TableCell>

                                        {/* Content */}
                                        <TableCell className="hidden lg:table-cell py-4 max-w-[300px]">
                                            <p className="text-sm text-slate-600 truncate leading-relaxed" title={journal.content}>
                                                {contentPreview}
                                            </p>
                                        </TableCell>

                                        {/* Status */}
                                        <TableCell className="py-4">
                                            <StatusBadge status={status} />
                                        </TableCell>

                                        {/* Actions */}
                                        <TableCell className="py-4 pr-5" onClick={(e) => e.stopPropagation()}>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        className="h-8 w-8 p-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-100"
                                                    >
                                                        <span className="sr-only">Menu</span>
                                                        <MoreHorizontal className="h-4 w-4 text-slate-500" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-xl border-slate-200">
                                                    <DropdownMenuItem onClick={() => onView(journal)} className="gap-2 rounded-lg">
                                                        <Eye className="h-4 w-4 text-slate-500" /> Lihat Detail
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => onApprove(journal.id)} className="gap-2 rounded-lg text-emerald-600 focus:text-emerald-700">
                                                        <CheckCircle2 className="h-4 w-4" /> Setujui
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => onReject(journal.id)} className="gap-2 rounded-lg text-red-600 focus:text-red-700">
                                                        <XCircle className="h-4 w-4" /> Tolak
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden flex flex-col p-4 space-y-4">
                {/* Select All Checkbox Mobile */}
                {data.length > 0 && (
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                checked={isAllSelected || (isSomeSelected ? "indeterminate" : false)}
                                onCheckedChange={(checked) => onSelectAll(!!checked)}
                                className="border-slate-300"
                                id="mobile-select-all"
                            />
                            <label htmlFor="mobile-select-all" className="text-sm font-semibold text-slate-600">
                                Pilih Semua
                            </label>
                        </div>
                    </div>
                )}

                {data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 border border-slate-100 rounded-2xl">
                        <Calendar className="h-8 w-8 text-slate-300 mb-3" />
                        <p className="text-sm font-semibold text-slate-500">Tidak ada jurnal</p>
                        <p className="text-xs text-slate-400 mt-1">Jurnal akan muncul di sini</p>
                    </div>
                ) : (
                    data.map((journal) => {
                        const isSelected = selectedIds.includes(journal.id);
                        const profile = (journal as any).profiles || {};
                        const status = journal.verification_status || 'submitted';

                        return (
                            <div
                                key={journal.id}
                                className={cn(
                                    "flex flex-col p-4 bg-white border border-slate-100 rounded-2xl shadow-sm gap-3 cursor-pointer hover:shadow-md transition-all relative overflow-hidden",
                                    isSelected && "ring-2 ring-blue-500 border-transparent bg-blue-50/20"
                                )}
                                onClick={() => onView(journal)}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div onClick={(e) => e.stopPropagation()}>
                                            <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={(checked) => onSelect(journal.id, !!checked)}
                                                className="border-slate-300"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-8 w-8 shadow-sm">
                                                <AvatarImage src={profile.avatar_url} />
                                                <AvatarFallback className="text-[10px] font-bold bg-slate-800 text-white">
                                                    {profile.full_name?.substring(0, 2).toUpperCase() || "?"}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="text-sm font-bold text-slate-800 line-clamp-1">{profile.full_name || "Unknown"}</p>
                                                <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                                                    {profile.department || "Karyawan"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <StatusBadge status={status} />
                                </div>
                                <div className="bg-slate-50 rounded-xl p-3 flex justify-between items-center border border-slate-100">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Tanggal</span>
                                        <span className="text-xs font-bold text-slate-800">{format(new Date(journal.date), "d MMM yyyy", { locale: localeId })}</span>
                                    </div>
                                    <div className="flex flex-col text-right">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Ringkasan</span>
                                        <span className="text-xs font-semibold text-slate-600 line-clamp-1 max-w-[120px]">{journal.content || "-"}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Footer */}
            {data.length > 0 && (
                <div className="bg-slate-50/60 px-5 py-3.5 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-xs text-slate-500 font-medium">
                        Menampilkan <span className="font-semibold text-slate-700">{data.length}</span> jurnal
                        {selectedIds.length > 0 && (
                            <> · <span className="text-blue-600 font-semibold">{selectedIds.length} dipilih</span></>
                        )}
                    </p>
                </div>
            )}
        </div>
    );
}
