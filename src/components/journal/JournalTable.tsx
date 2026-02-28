import { useState } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
    MoreHorizontal, Eye, CheckCircle2, XCircle, Calendar,
    LayoutGrid, List, AlignJustify, Clock, Target, ShieldAlert
} from "lucide-react";
import { JournalCardData } from "@/components/journal/JournalCard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const STATUS_MAP: Record<string, { label: string; bg: string; text: string; dot: string; border: string }> = {
    approved: {
        label: "Approved",
        bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", border: "border-emerald-200"
    },
    need_revision: {
        label: "Revisi",
        bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500", border: "border-orange-200"
    },
    rejected: {
        label: "Ditolak",
        bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500", border: "border-rose-200"
    },
    submitted: {
        label: "Pending",
        bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", border: "border-amber-200"
    },
    pending: {
        label: "Pending",
        bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", border: "border-amber-200"
    }
};

function StatusPill({ status }: { status: string }) {
    const config = STATUS_MAP[status] || STATUS_MAP.submitted;
    return (
        <span className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase border",
            config.bg, config.text, config.border
        )}>
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", config.dot)} />
            {config.label}
        </span>
    );
}

// Format the content
const extractTitleAndContent = (rawContent: string) => {
    if (!rawContent) return { title: "Aktivitas Tanpa Judul", content: "-" };
    const match = rawContent.match(/^\*\*(.*?)\*\*\n\n([\s\S]*)$/);
    if (match) {
        return { title: match[1], content: match[2] };
    }
    return { title: "Aktivitas Harian", content: rawContent };
};

export function JournalTable({
    data, selectedIds, onSelect, onSelectAll, onView, onApprove, onReject, isLoading = false
}: JournalTableProps) {
    const [viewMode, setViewMode] = useState<"card" | "table">("card");
    const isAllSelected = data.length > 0 && selectedIds.length === data.length;
    const isSomeSelected = selectedIds.length > 0 && selectedIds.length < data.length;

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="bg-white rounded-[20px] p-6 border border-slate-100 shadow-sm col-span-1 animate-pulse h-48" />
                ))}
            </div>
        );
    }

    // Toggle Bar
    const renderViewToggle = () => (
        <div className="flex items-center justify-between mb-4">
            <h3 className="hidden sm:block text-sm font-bold text-slate-800 tracking-tight">
                {data.length} Jurnal Ditemukan
            </h3>
            <div className="flex items-center gap-2 bg-slate-100/80 p-1 rounded-xl shadow-inner ml-auto border border-slate-200/50">
                <button
                    onClick={() => setViewMode("card")}
                    className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                        viewMode === "card" ? "bg-white text-slate-800 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    <LayoutGrid className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Cards</span>
                </button>
                <button
                    onClick={() => setViewMode("table")}
                    className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                        viewMode === "table" ? "bg-white text-slate-800 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    <AlignJustify className="w-3.5 h-3.5" /> <span className="hidden sm:inline">List</span>
                </button>
            </div>
        </div>
    );

    const renderEmptyState = () => (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-dashed border-slate-300 rounded-[24px]">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                <Calendar className="h-8 w-8 text-slate-300" />
            </div>
            <p className="text-base font-bold text-slate-800 mb-1">Ruang Kerja Kosong</p>
            <p className="text-sm font-medium text-slate-500">Belum ada jurnal yang sesuai di kategori ini.</p>
        </div>
    );

    // --- CARD VIEW (DEFAULT PREMIUM) ---
    if (viewMode === "card") {
        return (
            <div className="w-full">
                {renderViewToggle()}
                {data.length === 0 ? renderEmptyState() : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {data.map((journal) => {
                            const isSelected = selectedIds.includes(journal.id);
                            const profile = (journal as any).profiles || {};
                            const status = journal.verification_status || 'submitted';
                            const { title, content } = extractTitleAndContent(journal.content);

                            return (
                                <div
                                    key={journal.id}
                                    className={cn(
                                        "group bg-white rounded-[20px] p-6 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden flex flex-col cursor-pointer",
                                        isSelected
                                            ? "border-2 border-primary/50 shadow-[0_8px_30px_rgba(37,99,235,0.12)] bg-primary/5"
                                            : "border border-slate-200/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_32px_-4px_rgba(0,0,0,0.08)] hover:border-slate-300"
                                    )}
                                    onClick={() => onView(journal)}
                                >
                                    {/* Checkbox overlay top right */}
                                    <div className="absolute top-4 right-4 z-10" onClick={e => e.stopPropagation()}>
                                        <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={(checked) => onSelect(journal.id, !!checked)}
                                            className={cn("w-5 h-5 rounded-md border-slate-300", isSelected ? "data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground" : "opacity-0 group-hover:opacity-100 transition-opacity")}
                                        />
                                    </div>

                                    {/* Header: User Info */}
                                    <div className="flex items-center gap-3 mb-4 pr-8">
                                        <Avatar className="h-12 w-12 border-2 border-white shadow-sm shrink-0">
                                            <AvatarImage src={profile.avatar_url} />
                                            <AvatarFallback className="font-bold text-sm bg-slate-800 text-white">
                                                {profile.full_name?.substring(0, 2).toUpperCase() || "?"}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0">
                                            <p className="text-[15px] font-bold text-slate-900 truncate">{profile.full_name || "Unknown"}</p>
                                            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] font-semibold text-slate-500">
                                                <span>{profile.department || "General"}</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-300" />
                                                <span>{format(new Date(journal.date), "dd MMM, EEE", { locale: localeId })}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Body: Title & Content */}
                                    <div className="flex-1 mb-6">
                                        <h4 className="text-[15px] font-bold text-slate-800 mb-1.5 line-clamp-1">{title}</h4>
                                        <p className="text-[13px] leading-relaxed text-slate-600 line-clamp-3 font-medium">
                                            {content}
                                        </p>
                                    </div>

                                    {/* Footer: Tags & Actions */}
                                    <div className="mt-auto pt-4 border-t border-slate-100/80 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <StatusPill status={status} />
                                            {journal.duration && journal.duration > 0 && (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold border border-slate-200/50">
                                                    <Clock className="w-3 h-3" />
                                                    {Math.floor(journal.duration / 60)}j {journal.duration % 60}m
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex opacity-0 group-hover:opacity-100 transition-opacity duration-300" onClick={e => e.stopPropagation()}>
                                            {status === 'pending' || status === 'submitted' ? (
                                                <div className="flex items-center gap-1">
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-full" onClick={(e) => { e.stopPropagation(); onApprove(journal.id); }}>
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    </Button>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full">
                                                                <MoreHorizontal className="w-4 h-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-40 rounded-xl shadow-xl">
                                                            <DropdownMenuItem onClick={() => onView(journal)} className="font-medium text-xs"><Eye className="w-3.5 h-3.5 mr-2" /> Detail Penuh</DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onClick={() => onReject(journal.id)} className="font-medium text-xs text-rose-600 focus:text-rose-700"><XCircle className="w-3.5 h-3.5 mr-2" /> Tolak Jurnal</DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            ) : (
                                                <Button size="sm" variant="ghost" className="h-8 text-xs font-bold text-blue-600 hover:bg-blue-50 hover:text-blue-700 rounded-full px-3 transition-colors" onClick={() => onView(journal)}>
                                                    Detail &rarr;
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    // --- COMPACT TABLE VIEW ---
    return (
        <div className="w-full">
            {renderViewToggle()}
            <div className="bg-white rounded-[24px] border border-slate-200/60 shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="border-b border-slate-100 bg-slate-50/50 hover:bg-slate-50/50">
                            <TableHead className="w-[48px] pl-6 py-4">
                                <Checkbox
                                    checked={isAllSelected || (isSomeSelected ? "indeterminate" : false)}
                                    onCheckedChange={(checked) => onSelectAll(!!checked)}
                                    className="border-slate-300 rounded-[4px]"
                                />
                            </TableHead>
                            <TableHead className="py-4"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Karyawan</span></TableHead>
                            <TableHead className="py-4"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Aktivitas</span></TableHead>
                            <TableHead className="py-4"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Waktu</span></TableHead>
                            <TableHead className="py-4"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center block">Status</span></TableHead>
                            <TableHead className="w-[60px] py-4 pr-6"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.length === 0 ? (
                            <TableRow><TableCell colSpan={6}>{renderEmptyState()}</TableCell></TableRow>
                        ) : (
                            data.map((journal) => {
                                const isSelected = selectedIds.includes(journal.id);
                                const profile = (journal as any).profiles || {};
                                const status = journal.verification_status || 'submitted';
                                const { title } = extractTitleAndContent(journal.content);

                                return (
                                    <TableRow
                                        key={journal.id}
                                        className={cn(
                                            "group cursor-pointer border-b border-slate-100/80 transition-all hover:bg-slate-50/70",
                                            isSelected && "bg-primary/5 hover:bg-primary/10"
                                        )}
                                        onClick={() => onView(journal)}
                                    >
                                        <TableCell className="pl-6 py-4" onClick={(e) => e.stopPropagation()}>
                                            <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={(checked) => onSelect(journal.id, !!checked)}
                                                className="border-slate-300 rounded-[4px]"
                                            />
                                        </TableCell>
                                        <TableCell className="py-4 max-w-[200px]">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8 shadow-sm">
                                                    <AvatarImage src={profile.avatar_url} />
                                                    <AvatarFallback className="text-[10px] font-bold bg-slate-800 text-white">
                                                        {profile.full_name?.substring(0, 2).toUpperCase() || "?"}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-[13px] font-bold text-slate-800 line-clamp-1 truncate">{profile.full_name}</span>
                                                    <span className="text-[11px] font-semibold text-slate-400">{profile.department || "General"}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-4 max-w-[300px]">
                                            <span className="text-[13px] font-semibold text-slate-700 line-clamp-1">{title}</span>
                                        </TableCell>
                                        <TableCell className="py-4">
                                            <div className="flex flex-col">
                                                <span className="text-[12px] font-bold text-slate-700">{format(new Date(journal.date), "d MMM yyyy", { locale: localeId })}</span>
                                                <span className="text-[10px] font-semibold text-slate-400">{journal.duration ? `${Math.floor(journal.duration / 60)}j ${journal.duration % 60}m` : "-"}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-4 text-center">
                                            <StatusPill status={status} />
                                        </TableCell>
                                        <TableCell className="py-4 pr-6 text-right" onClick={(e) => e.stopPropagation()}>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-xl border-slate-200/80">
                                                    <DropdownMenuItem onClick={() => onView(journal)} className="font-semibold text-xs"><Eye className="h-3.5 w-3.5 mr-2" /> Lihat Detail</DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    {status === 'pending' || status === 'submitted' ? (
                                                        <>
                                                            <DropdownMenuItem onClick={() => onApprove(journal.id)} className="font-semibold text-xs text-emerald-600 focus:text-emerald-700 focus:bg-emerald-50"><CheckCircle2 className="h-3.5 w-3.5 mr-2" /> Setujui Langsung</DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => onReject(journal.id)} className="font-semibold text-xs text-rose-600 focus:text-rose-700 focus:bg-rose-50"><XCircle className="h-3.5 w-3.5 mr-2" /> Tolak</DropdownMenuItem>
                                                        </>
                                                    ) : null}
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
        </div>
    );
}
