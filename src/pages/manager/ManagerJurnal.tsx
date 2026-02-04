import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import EnterpriseLayout from "@/components/layout/EnterpriseLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    LayoutDashboard, Clock, BarChart3, FileCheck, BookOpen, Search,
    Calendar as CalendarIcon, CheckCircle2, AlertCircle, TrendingUp, Pencil,
    Eye, MessageSquare, Loader2, FileEdit
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { JournalStatusBadge } from "@/components/journal/JournalCard";
import { JournalSkeleton, JournalStatsSkeleton } from "@/components/journal/JournalSkeleton";

// Interfaces
interface JournalEntry {
    id: string;
    content: string;
    date: string;
    duration: number;
    user_id: string;
    verification_status: string;
    manager_notes?: string;
    work_result?: 'completed' | 'progress' | 'pending';
    obstacles?: string;
    mood?: string;
    profiles: {
        full_name: string;
        avatar_url: string | null;
        department: string | null;
        position: string | null;
    };
}

interface JournalStats {
    total_entries: number;
    pending_review: number;
    need_revision: number;
    approved: number;
}

const WORK_RESULT_LABELS: Record<string, { label: string, className: string }> = {
    completed: { label: "Selesai", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    progress: { label: "Progress", className: "bg-blue-50 text-blue-700 border-blue-200" },
    pending: { label: "Tertunda", className: "bg-amber-50 text-amber-700 border-amber-200" }
};

const ITEMS_PER_PAGE = 15;

const ManagerJurnal = () => {
    const { user } = useAuth();

    // Data State
    const [journals, setJournals] = useState<JournalEntry[]>([]);
    const [stats, setStats] = useState<JournalStats | null>(null);

    // Loading States
    const [isLoadingList, setIsLoadingList] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isLoadingStats, setIsLoadingStats] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Filter & Pagination
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(0);

    // Modal States
    const [selectedJournal, setSelectedJournal] = useState<JournalEntry | null>(null);
    const [reviewNote, setReviewNote] = useState("");
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [editingJournal, setEditingJournal] = useState<JournalEntry | null>(null);
    const [editContent, setEditContent] = useState("");
    const [isEditOpen, setIsEditOpen] = useState(false);

    // Refs for Infinite Scroll
    const observer = useRef<IntersectionObserver | null>(null);
    const lastJournalElementRef = useCallback((node: HTMLDivElement) => {
        if (isLoadingList || isLoadingMore) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setPage(prevPage => prevPage + 1);
            }
        });
        if (node) observer.current.observe(node);
    }, [isLoadingList, isLoadingMore, hasMore]);

    // Handle Search Debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 500); // 500ms debounce
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Reset when filters change
    useEffect(() => {
        setPage(0);
        setJournals([]);
        setHasMore(true);
        // We do trigger fetch via the page dependency, but we need to ensure state is clean
    }, [filterStatus, debouncedSearch]);

    // Initial Stats Load
    useEffect(() => {
        fetchStats();
        // Setup Realtime Subscription for stats updates only
        const channel = supabase
            .channel('manager-journal-stats')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'work_journals' }, () => {
                fetchStats();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    // Fetch List Effect
    useEffect(() => {
        fetchJournals(page);
    }, [page, filterStatus, debouncedSearch]);

    const fetchStats = async () => {
        setIsLoadingStats(true);
        try {
            // Try to use the optimized RPC
            const { data, error } = await supabase.rpc('get_manager_journal_stats');

            if (!error && data && data.length > 0) {
                setStats(data[0]);
            } else {
                // Fallback
                console.warn("RPC fetch failed, using fallback stats count method");
                const { count: total } = await supabase.from('work_journals').select('*', { count: 'exact', head: true });
                const { count: pending } = await supabase.from('work_journals').select('*', { count: 'exact', head: true }).eq('verification_status', 'submitted');
                const { count: revision } = await supabase.from('work_journals').select('*', { count: 'exact', head: true }).eq('verification_status', 'need_revision');
                const { count: approved } = await supabase.from('work_journals').select('*', { count: 'exact', head: true }).eq('verification_status', 'approved');

                setStats({
                    total_entries: total || 0,
                    pending_review: pending || 0,
                    need_revision: revision || 0,
                    approved: approved || 0
                });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingStats(false);
        }
    };

    const fetchJournals = async (pageIndex: number) => {
        // Prevent duplicate calls if already loading same page type
        // if (pageIndex === page && (isLoadingList || isLoadingMore) && pageIndex !== 0) return;

        if (pageIndex === 0) setIsLoadingList(true);
        else setIsLoadingMore(true);

        try {
            const from = pageIndex * ITEMS_PER_PAGE;
            const to = from + ITEMS_PER_PAGE - 1;

            let query = supabase
                .from('work_journals')
                .select('*')
                .order('date', { ascending: false })
                .range(from, to);

            // Apply Filters
            if (filterStatus !== 'all' && filterStatus !== 'summary') {
                query = query.eq('verification_status', filterStatus);
            }

            // Search Strategy:
            // 1. If searching, we prioritize finding content.
            // 2. Ideally we search profiles too, but for speed we stick to content server-side first.
            if (debouncedSearch) {
                query = query.ilike('content', `%${debouncedSearch}%`);
            }

            const { data: journalData, error } = await query;

            if (error) throw error;

            if (journalData && journalData.length > 0) {
                // Efficiently join profiles manually for just this page
                const userIds = [...new Set(journalData.map(j => j.user_id))];
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('user_id, full_name, avatar_url, department, position')
                    .in('user_id', userIds);

                const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

                const enrichedData = journalData.map(journal => ({
                    ...journal,
                    profiles: profileMap.get(journal.user_id) || {
                        full_name: 'Unknown User',
                        avatar_url: null,
                        department: null,
                        position: null
                    }
                }));

                setJournals(prev => {
                    // Safety check to avoid duplicates if strict mode double-invokes
                    if (pageIndex === 0) return enrichedData as unknown as JournalEntry[];

                    // Simple append
                    return [...prev, ...enrichedData as unknown as JournalEntry[]];
                });

                if (journalData.length < ITEMS_PER_PAGE) {
                    setHasMore(false);
                }
            } else {
                if (pageIndex === 0) setJournals([]);
                setHasMore(false);
            }

        } catch (error) {
            console.error("Error loading journals:", error);
            toast({ variant: "destructive", title: "Masalah Koneksi", description: "Gagal memuat data jurnal." });
        } finally {
            setIsLoadingList(false);
            setIsLoadingMore(false);
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        setPage(0);
        await Promise.all([fetchStats(), fetchJournals(0)]);
        setIsRefreshing(false);
        toast({ title: "Updated", description: "Data terbaru berhasil diambil." });
    };

    const handleOpenReview = (journal: JournalEntry) => {
        setSelectedJournal(journal);
        setReviewNote(journal.manager_notes || "");
        setIsReviewOpen(true);
    };

    const handleSubmitReview = async (status: 'approved' | 'need_revision') => {
        if (!selectedJournal) return;
        if (status === 'need_revision' && !reviewNote.trim()) {
            toast({ variant: "destructive", title: "Catatan Wajib", description: "Berikan alasan revisi." });
            return;
        }

        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('work_journals')
                .update({
                    verification_status: status,
                    manager_notes: reviewNote
                })
                .eq('id', selectedJournal.id);

            if (error) throw error;

            toast({ title: status === 'approved' ? "Disetujui" : "Revisi Diminta" });

            // Optimistic Update
            setJournals(prev => prev.map(j =>
                j.id === selectedJournal.id
                    ? { ...j, verification_status: status, manager_notes: reviewNote }
                    : j
            ));

            fetchStats(); // Background update stats
            setIsReviewOpen(false);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditJournal = (journal: JournalEntry) => {
        setEditingJournal(journal);
        setEditContent(journal.content);
        setIsEditOpen(true);
    };

    const handleSaveEdit = async () => {
        if (!editingJournal || !editContent.trim()) return;
        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('work_journals')
                .update({ content: editContent })
                .eq('id', editingJournal.id);

            if (error) throw error;

            toast({ title: "Berhasil", description: "Konten diperbarui." });

            setJournals(prev => prev.map(j =>
                j.id === editingJournal.id ? { ...j, content: editContent } : j
            ));

            setIsEditOpen(false);
        } catch (e: any) {
            toast({ variant: "destructive", title: "Gagal", description: e.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const getInitials = (name: string) => name ? name.split(" ").map(n => n.charAt(0)).slice(0, 2).join("").toUpperCase() : "??";

    const menuSections = [
        {
            title: "Menu Utama",
            items: [
                { icon: LayoutDashboard, title: "Dashboard", href: "/manager" },
                { icon: Clock, title: "Rekap Absensi", href: "/manager/absensi" },
                { icon: BookOpen, title: "Jurnal Tim", href: "/manager/jurnal" },
                { icon: BarChart3, title: "Laporan", href: "/manager/laporan" },
                { icon: FileCheck, title: "Kelola Cuti", href: "/manager/cuti" },
            ],
        },
    ];

    return (
        <EnterpriseLayout
            title="Jurnal Tim"
            subtitle="Monitoring & Review Aktivitas"
            menuSections={menuSections}
            roleLabel="Manager"
            showRefresh={true}
            onRefresh={handleRefresh}
        >
            {/* 1. Stats Area */}
            {isLoadingStats && !stats ? (
                <JournalStatsSkeleton />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <Card className="bg-white shadow-sm border-slate-200">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-500 font-medium">Total Entri</p>
                                <p className="text-2xl font-bold text-slate-800">{stats?.total_entries || 0}</p>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg">
                                <BookOpen className="w-5 h-5 text-slate-600" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-amber-50 to-white shadow-sm border-amber-200">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div>
                                <p className="text-sm text-amber-600 font-medium">Perlu Review</p>
                                <p className="text-2xl font-bold text-amber-700">{stats?.pending_review || 0}</p>
                            </div>
                            <div className="p-3 bg-amber-100 rounded-lg">
                                <AlertCircle className="w-5 h-5 text-amber-600" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-orange-50 to-white shadow-sm border-orange-200">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div>
                                <p className="text-sm text-orange-600 font-medium">Revisi</p>
                                <p className="text-2xl font-bold text-orange-700">{stats?.need_revision || 0}</p>
                            </div>
                            <div className="p-3 bg-orange-100 rounded-lg">
                                <FileEdit className="w-5 h-5 text-orange-600" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-green-50 to-white shadow-sm border-green-200">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div>
                                <p className="text-sm text-green-600 font-medium">Disetujui</p>
                                <p className="text-2xl font-bold text-green-700">{stats?.approved || 0}</p>
                            </div>
                            <div className="p-3 bg-green-100 rounded-lg">
                                <CheckCircle2 className="w-5 h-5 text-green-600" />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* 2. Navigation & Filters */}
            <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-sm pb-4 pt-2 -mx-4 px-4 md:static md:mx-0 md:px-0 md:bg-transparent">
                <div className="bg-white rounded-xl border border-slate-200 p-2 mb-4 shadow-sm">
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between p-2">
                        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto scrollbar-hide">
                            {[
                                { key: 'all', label: 'Semua', className: 'bg-slate-800' },
                                { key: 'submitted', label: 'Perlu Review', className: 'bg-amber-600 hover:bg-amber-700 border-amber-600' },
                                { key: 'need_revision', label: 'Revisi', className: 'bg-orange-600 hover:bg-orange-700 border-orange-600' },
                                { key: 'approved', label: 'Disetujui', className: 'bg-green-600 hover:bg-green-700 border-green-600' }
                            ].map(btn => (
                                <Button
                                    key={btn.key}
                                    variant={filterStatus === btn.key ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setFilterStatus(btn.key)}
                                    className={`whitespace-nowrap ${filterStatus === btn.key ? btn.className : "text-slate-600"}`}
                                >
                                    {btn.label}
                                </Button>
                            ))}
                        </div>
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Cari isi jurnal..."
                                className="pl-9 h-9 bg-slate-50"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Journal List (Scrollable Container) */}
            <div className="h-[calc(100vh-320px)] overflow-y-auto pr-2 pb-20 custom-scrollbar relative">
                {isLoadingList && journals.length === 0 ? (
                    <JournalSkeleton />
                ) : journals.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <FileCheck className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-700">Tidak ada jurnal</h3>
                        <p className="text-slate-500 max-w-sm">
                            {filterStatus !== 'all' ? 'Coba ubah filter atau status pencarian Anda.' : 'Belum ada data jurnal yang masuk hari ini.'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {journals.map((journal, index) => {
                            const isLast = index === journals.length - 1;
                            return (
                                <div
                                    key={`${journal.id}-${index}`}
                                    ref={isLast ? lastJournalElementRef : null}
                                    className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all relative group"
                                >
                                    {/* Actions & Status */}
                                    <div className="absolute top-4 right-4 flex items-center gap-2">
                                        <JournalStatusBadge status={journal.verification_status} />
                                        <Button
                                            size="sm"
                                            variant={journal.verification_status === 'submitted' ? 'default' : 'ghost'}
                                            className={journal.verification_status === 'submitted' ? "bg-blue-600 h-8 text-xs hover:bg-blue-700 text-white" : "h-8 w-8 p-0"}
                                            onClick={() => handleOpenReview(journal)}
                                        >
                                            {journal.verification_status === 'submitted' ? (
                                                <> <Eye className="w-3 h-3 mr-1" /> Review </>
                                            ) : (
                                                <Eye className="w-4 h-4 text-slate-400" />
                                            )}
                                        </Button>
                                    </div>

                                    {/* Content */}
                                    <div className="flex gap-4">
                                        <Avatar className="h-11 w-11 border border-slate-100 shrink-0">
                                            <AvatarImage src={journal.profiles?.avatar_url || ""} />
                                            <AvatarFallback className="bg-blue-50 text-blue-600 font-bold">
                                                {getInitials(journal.profiles?.full_name || "?")}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 pr-2 md:pr-24">
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mb-2">
                                                <h4 className="text-sm font-bold text-slate-800">{journal.profiles?.full_name}</h4>
                                                <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                                                    <span>{journal.profiles?.position || "Staff"}</span>
                                                    <span>•</span>
                                                    <span className="flex items-center gap-1">
                                                        <CalendarIcon className="w-3 h-3" />
                                                        {format(new Date(journal.date), "d MMM yyyy", { locale: id })}
                                                    </span>
                                                    {journal.mood && <span className="text-base">{journal.mood}</span>}
                                                </div>
                                            </div>

                                            {journal.work_result && (
                                                <Badge className={`mb-2 text-[10px] uppercase ${WORK_RESULT_LABELS[journal.work_result]?.className || ''}`}>
                                                    {WORK_RESULT_LABELS[journal.work_result]?.label}
                                                </Badge>
                                            )}

                                            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap mb-3">
                                                {journal.content}
                                            </p>

                                            {journal.obstacles && (
                                                <div className="p-2.5 bg-amber-50/50 border border-amber-100 rounded-lg text-xs mb-3">
                                                    <p className="font-semibold text-amber-700 mb-1">Kendala:</p>
                                                    <p className="text-slate-600">{journal.obstacles}</p>
                                                </div>
                                            )}

                                            {journal.manager_notes && (
                                                <div className="flex items-start gap-2 p-2.5 rounded-lg border bg-blue-50/30 border-blue-100">
                                                    <MessageSquare className="w-4 h-4 mt-0.5 text-blue-600 shrink-0" />
                                                    <div>
                                                        <p className="text-xs font-semibold text-blue-700 mb-0.5">Catatan Manager:</p>
                                                        <p className="text-xs text-slate-600">{journal.manager_notes}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Desktop Edit Button */}
                                    <div className="hidden group-hover:flex absolute bottom-4 right-4 gap-2">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => handleEditJournal(journal)}>
                                            <Pencil className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}

                        {isLoadingMore && (
                            <div className="py-4 text-center">
                                <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
                                <span className="text-xs text-slate-400 mt-1 block">Memuat lebih banyak...</span>
                            </div>
                        )}

                        {!isLoadingMore && !hasMore && journals.length > 0 && (
                            <div className="py-8 text-center text-slate-400 text-xs border-t border-dashed border-slate-200 mt-4">
                                — Semua data ditampilkan —
                            </div>
                        )}

                        {/* Safe pad for mobile bottom */}
                        <div className="h-10 md:h-0"></div>
                    </div>
                )}
            </div>

            {/* Review Dialog */}
            <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
                <DialogContent className="sm:max-w-[540px]">
                    <DialogHeader>
                        <DialogTitle>📋 Review Jurnal</DialogTitle>
                        <DialogDescription>Verifikasi aktivitas {selectedJournal?.profiles?.full_name}</DialogDescription>
                    </DialogHeader>

                    {selectedJournal && (
                        <div className="space-y-4">
                            <div className="bg-slate-50 p-4 rounded-lg border max-h-40 overflow-y-auto custom-scrollbar text-sm text-slate-700 whitespace-pre-wrap">
                                {selectedJournal.content}
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Catatan (Opsional untuk Approve)</label>
                                <Textarea
                                    value={reviewNote}
                                    onChange={e => setReviewNote(e.target.value)}
                                    placeholder="Berikan feedback atau alasan revisi..."
                                    className="resize-none"
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsReviewOpen(false)}>Batal</Button>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <Button variant="outline" className="flex-1 sm:flex-none border-orange-200 text-orange-700 hover:bg-orange-50" onClick={() => handleSubmitReview('need_revision')} disabled={isSubmitting}>
                                Minta Revisi
                            </Button>
                            <Button className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white" onClick={() => handleSubmitReview('approved')} disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="animate-spin w-4 h-4" /> : "Setujui"}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Edit Jurnal</DialogTitle></DialogHeader>
                    <Textarea value={editContent} onChange={e => setEditContent(e.target.value)} className="min-h-[150px]" />
                    <DialogFooter>
                        <Button onClick={handleSaveEdit} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="animate-spin w-4 h-4" /> : "Simpan Perubahan"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </EnterpriseLayout>
    );
};

export default ManagerJurnal;
