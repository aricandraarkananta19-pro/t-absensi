
import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import {
    Clock,
    Calendar as CalendarIcon,
    User,
    Briefcase,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    MessageSquare,
    Loader2,
    X,
    Trash2
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/useIsMobile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
} from "@/components/ui/drawer";
import { JournalStatusBadge } from "@/components/journal/JournalCard";

// Types
interface JournalDetail {
    id: string;
    content: string;
    date: string;
    duration: number;
    user_id: string;
    status: string; // legacy
    verification_status: string;
    work_result?: 'completed' | 'progress' | 'pending';
    obstacles?: string;
    mood?: string;
    manager_notes?: string;
    profiles: {
        full_name: string;
        avatar_url: string | null;
        department: string | null;
        position: string | null;
    };
}

interface JournalDetailViewProps {
    journalId: string | null;
    isOpen: boolean;
    onClose: () => void;
    onUpdate?: () => void; // Callback to refresh parent list
}

export function JournalDetailView({ journalId, isOpen, onClose, onUpdate }: JournalDetailViewProps) {
    // -------------------------------------------------------------------------
    // 1. STATE & HOOKS
    // -------------------------------------------------------------------------
    const { isAdminOrManager } = useAuth();
    const isMobile = useIsMobile();

    // Determine screen size for Tablet vs Desktop logic (simplified)
    const [isTablet, setIsTablet] = useState(false);
    useEffect(() => {
        const checkTablet = () => {
            setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
        };
        checkTablet();
        window.addEventListener('resize', checkTablet);
        return () => window.removeEventListener('resize', checkTablet);
    }, []);

    const [journal, setJournal] = useState<JournalDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDeleted, setIsDeleted] = useState(false);

    // Action States
    const [note, setNote] = useState("");
    const [actionLoading, setActionLoading] = useState(false);
    const [showRevisionInput, setShowRevisionInput] = useState(false);

    // Abort Controller for race condition prevention
    const abortControllerRef = useRef<AbortController | null>(null);

    // -------------------------------------------------------------------------
    // 2. DATA FETCHING (Isolated from List)
    // -------------------------------------------------------------------------
    useEffect(() => {
        if (!isOpen || !journalId) {
            setJournal(null);
            setError(null);
            setIsDeleted(false);
            setNote("");
            setShowRevisionInput(false);
            return;
        }

        const fetchDetail = async () => {
            // Cancel previous request
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            abortControllerRef.current = new AbortController();

            setLoading(true);
            setError(null);

            try {
                const { data, error } = await supabase
                    .from('work_journals')
                    .select(`
                        id, content, date, duration, user_id, status, verification_status,
                        work_result, obstacles, mood, manager_notes,
                        profiles:user_id ( full_name, avatar_url, department, position )
                    `)
                    .eq('id', journalId)
                    .maybeSingle();

                if (abortControllerRef.current?.signal.aborted) return;

                if (error) throw error;

                if (!data) {
                    setIsDeleted(true);
                    setError("Jurnal tidak ditemukan atau telah dihapus.");
                } else {
                    setJournal(data as unknown as JournalDetail);
                    setNote(data.manager_notes || "");
                }
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.error("Detail Fetch Error:", err);
                    setError("Gagal memuat detail jurnal.");
                }
            } finally {
                if (!abortControllerRef.current?.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        fetchDetail();

        // 3. REAL-TIME SAFETY (Listen for deletes on this specific ID)
        const channel = supabase
            .channel(`detail-${journalId}`)
            .on('postgres_changes', {
                event: 'DELETE',
                schema: 'public',
                table: 'work_journals',
                filter: `id=eq.${journalId}`
            }, () => {
                setIsDeleted(true);
                toast({ variant: "destructive", title: "Data Hilang", description: "Jurnal ini baru saja dihapus oleh sistem/admin lain." });
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'work_journals',
                filter: `id=eq.${journalId}`
            }, (payload) => {
                // Optional: Auto-update content if changed elsewhere
                // For now, we respect "DO NOT re-render active detail view" unless we want full sync
                // But typically detail view SHOULD show latest data.
                // We will just update status if changed
                setJournal(prev => prev ? ({ ...prev, ...payload.new } as JournalDetail) : null);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            if (abortControllerRef.current) abortControllerRef.current.abort();
        };
    }, [journalId, isOpen]);

    // -------------------------------------------------------------------------
    // 4. ACTIONS
    // -------------------------------------------------------------------------
    const handleAction = async (newStatus: 'approved' | 'need_revision') => {
        if (!journal) return;

        // Validation for revision
        if (newStatus === 'need_revision' && !note.trim()) {
            toast({ variant: "destructive", title: "Wajib diisi", description: "Mohon berikan catatan revisi untuk karyawan." });
            return;
        }

        setActionLoading(true);
        try {
            const { error } = await supabase
                .from('work_journals')
                .update({
                    verification_status: newStatus,
                    manager_notes: note.trim() || null,
                    status: newStatus // Sync legacy status
                })
                .eq('id', journal.id);

            if (error) throw error;

            toast({
                title: newStatus === 'approved' ? "Jurnal Disetujui" : "Permintaan Revisi Terkirim",
                description: "Status jurnal berhasil diperbarui."
            });

            // Update local state immediately
            setJournal(prev => prev ? ({ ...prev, verification_status: newStatus, manager_notes: note }) : null);
            setShowRevisionInput(false);

            // Notify parent to refresh list
            onUpdate?.();

        } catch (err: any) {
            toast({ variant: "destructive", title: "Gagal memproses", description: err.message });
        } finally {
            setActionLoading(false);
        }
    };

    // -------------------------------------------------------------------------
    // 5. UI COMPONENTS (Sections)
    // -------------------------------------------------------------------------

    const ContentRender = () => {
        if (loading) return (
            <div className="space-y-6 p-1">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-32" />
                    </div>
                </div>
                <Skeleton className="h-[200px] w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
            </div>
        );

        if (error || isDeleted || !journal) return (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 bg-red-50 rounded-xl border border-red-100 p-8">
                <div className="bg-red-100 p-3 rounded-full">
                    <Trash2 className="w-8 h-8 text-red-600" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-red-900">
                        {isDeleted ? "Jurnal Telah Dihapus" : "Gagal Memuat Data"}
                    </h3>
                    <p className="text-sm text-red-700 mt-1 max-w-xs mx-auto">
                        {isDeleted
                            ? "Entri jurnal ini tidak lagi tersedia di database."
                            : "Terjadi kesalahan saat mengambil detail jurnal."}
                    </p>
                </div>
                <Button variant="outline" onClick={onClose} className="border-red-200 text-red-700 bg-white hover:bg-red-50">
                    Tutup
                </Button>
            </div>
        );

        const status = journal.verification_status || journal.status || 'submitted';

        return (
            <div className="space-y-8 pb-20"> {/* pb-20 for sticky footer space */}

                {/* HEAD & META */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-white border-2 border-slate-200 overflow-hidden shadow-sm flex items-center justify-center text-slate-400">
                            {journal.profiles.avatar_url
                                ? <img src={journal.profiles.avatar_url} alt="Ava" className="h-full w-full object-cover" />
                                : <User className="w-6 h-6" />
                            }
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 text-lg">{journal.profiles.full_name}</h3>
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                <Briefcase className="w-3.5 h-3.5" />
                                <span>{journal.profiles.position || "Staff"}</span>
                                <span className="mx-1">•</span>
                                <span className="bg-slate-200 px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold">
                                    {journal.profiles.department || "General"}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <JournalStatusBadge status={status} />
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                            <CalendarIcon className="w-3.5 h-3.5" />
                            {format(new Date(journal.date), "d MMM yyyy", { locale: id })}
                        </div>
                    </div>
                </div>

                {/* SECTION 1: MAIN CONTENT */}
                <section>
                    <div className="flex items-center gap-2 mb-3">
                        <div className="h-6 w-1 bg-blue-600 rounded-full" />
                        <h4 className="font-bold text-slate-800 text-base">Ringkasan Pekerjaan</h4>
                    </div>
                    <div className="prose prose-slate max-w-none">
                        <p className="text-slate-700 leading-relaxed text-[15px] whitespace-pre-wrap bg-white p-0">
                            {journal.content}
                        </p>
                    </div>
                </section>

                {/* SECTION 2: WORK RESULT & OBSTACLES */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white border-2 border-slate-50 rounded-xl p-4 shadow-sm">
                        <h5 className="text-xs font-bold text-slate-400 uppercase mb-2">Hasil Pekerjaan</h5>
                        <div className="flex items-center gap-3">
                            {journal.work_result === 'completed' && <CheckCircle2 className="w-6 h-6 text-green-500" />}
                            {journal.work_result === 'progress' && <Loader2 className="w-6 h-6 text-blue-500" />}
                            {journal.work_result === 'pending' && <AlertTriangle className="w-6 h-6 text-amber-500" />}
                            <div>
                                <p className="font-semibold text-slate-700 capitalize">
                                    {journal.work_result === 'completed' ? 'Selesai' :
                                        journal.work_result === 'progress' ? 'Dalam Progress' : 'Tertunda'}
                                </p>
                                <p className="text-xs text-slate-400">Status penyelesaian tugas</p>
                            </div>
                        </div>
                    </div>

                    {journal.obstacles ? (
                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                            <h5 className="text-xs font-bold text-amber-700 uppercase mb-2 flex items-center gap-2">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Kendala Dihadapi
                            </h5>
                            <p className="text-sm text-slate-700">
                                {journal.obstacles}
                            </p>
                        </div>
                    ) : (
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center justify-center text-slate-400 text-sm italic">
                            Tidak ada kendala yang dilaporkan.
                        </div>
                    )}
                </div>

                {/* SECTION 3: METADATA & MOOD */}
                <section className="bg-slate-50/50 rounded-xl p-4 border border-slate-100">
                    <div className="flex flex-wrap gap-6 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-blue-500" />
                            <span className="font-medium">Durasi Kerja:</span>
                            <span>{Math.floor(journal.duration / 60)}j {journal.duration % 60}m</span>
                        </div>
                        {journal.mood && (
                            <div className="flex items-center gap-2">
                                <span className="font-medium">Mood:</span>
                                <span className="text-lg leading-none">{journal.mood}</span>
                            </div>
                        )}
                    </div>
                </section>

                {/* MANAGER NOTES DISPLAY */}
                {journal.manager_notes && !showRevisionInput && (
                    <div className={`p-4 rounded-xl border-l-4 ${status === 'need_revision' ? 'bg-orange-50 border-orange-400' : 'bg-blue-50 border-blue-400'}`}>
                        <h5 className={`font-bold text-sm mb-1 ${status === 'need_revision' ? 'text-orange-900' : 'text-blue-900'}`}>Catatan Manager</h5>
                        <p className="text-sm text-slate-700">{journal.manager_notes}</p>
                    </div>
                )}
            </div>
        );
    };

    const FooterActions = () => {
        if (!isAdminOrManager || isDeleted || loading || !journal) return (
            <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={onClose}>Tutup</Button>
            </div>
        );

        // If Revision Input is Open
        if (showRevisionInput) {
            return (
                <div className="space-y-3 w-full animate-in slide-in-from-bottom-5">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-orange-700 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            Alasan Revisi
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => setShowRevisionInput(false)} className="h-6 w-6 p-0 rounded-full">
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                    <Textarea
                        placeholder="Tuliskan catatan revisi untuk karyawan..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="bg-white min-h-[80px]"
                        autoFocus
                    />
                    <div className="flex justify-end gap-3">
                        <Button
                            onClick={() => handleAction('need_revision')}
                            disabled={actionLoading || !note.trim()}
                            className="bg-orange-600 hover:bg-orange-700 text-white"
                        >
                            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Kirim Revisi"}
                        </Button>
                    </div>
                </div>
            );
        }

        // Standard Actions
        return (
            <div className="flex gap-3 justify-end w-full">
                <Button variant="outline" onClick={onClose} className="mr-auto text-slate-500">
                    Tutup
                </Button>

                {journal.verification_status !== 'need_revision' && (
                    <Button
                        variant="outline"
                        onClick={() => setShowRevisionInput(true)}
                        className="border-orange-200 text-orange-700 hover:bg-orange-50"
                        disabled={actionLoading}
                    >
                        Minta Revisi
                    </Button>
                )}

                {journal.verification_status !== 'approved' && (
                    <Button
                        onClick={() => handleAction('approved')}
                        disabled={actionLoading}
                        className="bg-green-600 hover:bg-green-700 text-white min-w-[120px]"
                    >
                        {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Setujui Jurnal"}
                    </Button>
                )}
            </div>
        );
    };

    // -------------------------------------------------------------------------
    // 6. RESPONSIVE WRAPPER LOGIC
    // -------------------------------------------------------------------------

    // Desktop: Sheet (Right Drawer)
    if (!isMobile && !isTablet) {
        return (
            <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <SheetContent className="sm:max-w-xl w-[720px] overflow-y-auto flex flex-col gap-0 p-0">
                    <SheetHeader className="p-6 border-b border-slate-100 bg-white sticky top-0 z-10">
                        <SheetTitle>Detail Jurnal</SheetTitle>
                    </SheetHeader>
                    <div className="flex-1 overflow-y-auto p-6 bg-white">
                        <ContentRender />
                    </div>
                    <div className="p-6 border-t border-slate-100 bg-white sticky bottom-0 z-10 shadow-[0_-5px_20px_-10px_rgba(0,0,0,0.05)]">
                        <FooterActions />
                    </div>
                </SheetContent>
            </Sheet>
        );
    }

    // Tablet: Center Modal (Dialog)
    if (isTablet) {
        return (
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                    <DialogHeader className="p-6 pb-2">
                        <DialogTitle>Detail Jurnal</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto p-6">
                        <ContentRender />
                    </div>
                    <div className="p-6 pt-4 border-t bg-slate-50">
                        <FooterActions />
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    // Mobile: Bottom Drawer
    return (
        <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DrawerContent className="max-h-[96vh] flex flex-col">
                <DrawerHeader className="text-left border-b border-slate-100">
                    <DrawerTitle>Detail Jurnal</DrawerTitle>
                </DrawerHeader>
                <div className="flex-1 overflow-y-auto p-4 bg-white">
                    <ContentRender />
                </div>
                <div className="p-4 border-t border-slate-100 bg-white pb-8">
                    <FooterActions />
                </div>
            </DrawerContent>
        </Drawer>
    );
}
