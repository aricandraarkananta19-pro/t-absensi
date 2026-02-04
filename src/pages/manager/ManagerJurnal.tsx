import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import EnterpriseLayout from "@/components/layout/EnterpriseLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    LayoutDashboard, Clock, BarChart3, FileCheck, BookOpen, Search,
    CheckCircle2, AlertCircle, FileEdit, Loader2, Filter
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
import { toast } from "@/hooks/use-toast";
import JournalCard, { JournalCardData } from "@/components/journal/JournalCard";
import { JournalSkeleton, JournalStatsSkeleton } from "@/components/journal/JournalSkeleton";

interface JournalStats {
    total_entries: number;
    pending_review: number;
    need_revision: number;
    approved: number;
}

const ITEMS_PER_PAGE = 15;

const ManagerJurnal = () => {
    const { user } = useAuth();

    // Data State
    const [journals, setJournals] = useState<JournalCardData[]>([]);
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
    const [selectedJournal, setSelectedJournal] = useState<JournalCardData | null>(null);
    const [reviewNote, setReviewNote] = useState("");
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [editingJournal, setEditingJournal] = useState<JournalCardData | null>(null);
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
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        setPage(0);
        setJournals([]);
        setHasMore(true);
    }, [filterStatus, debouncedSearch]);

    // Initial Stats Load
    useEffect(() => {
        fetchStats();
        const channel = supabase
            .channel('manager-journal-stats')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'work_journals' }, () => {
                fetchStats();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    // Fetch List
    useEffect(() => {
        fetchJournals(page);
    }, [page, filterStatus, debouncedSearch]);

    const fetchStats = async () => {
        setIsLoadingStats(true);
        try {
            const { data, error } = await supabase.rpc('get_manager_journal_stats');

            if (!error && data && data.length > 0) {
                setStats(data[0]);
            } else {
                // Fallback
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

            if (filterStatus !== 'all' && filterStatus !== 'summary') {
                query = query.eq('verification_status', filterStatus);
            }

            if (debouncedSearch) {
                query = query.ilike('content', `%${debouncedSearch}%`);
            }

            const { data: journalData, error } = await query;

            if (error) throw error;

            if (journalData && journalData.length > 0) {
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
                    const newData = enrichedData as unknown as JournalCardData[];
                    if (pageIndex === 0) return newData;
                    // Dedupe
                    const existingIds = new Set(prev.map(j => j.id));
                    const uniqueNew = newData.filter(j => !existingIds.has(j.id));
                    return [...prev, ...uniqueNew];
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

    const handleOpenReview = (journal: JournalCardData) => {
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

            fetchStats();
            setIsReviewOpen(false);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditJournal = (journal: JournalCardData) => {
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
            <div className="flex flex-col h-full space-y-6">
                {/* 1. Stats Area */}
                {isLoadingStats && !stats ? (
                    <JournalStatsSkeleton />
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-1">
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
                <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-sm -mx-4 px-4 md:static md:mx-0 md:px-0 md:bg-transparent">
                    <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-sm flex flex-col md:flex-row gap-4">
                        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto scrollbar-hide p-1">
                            {[
                                { key: 'all', label: 'Semua', className: 'bg-slate-800 text-white' },
                                { key: 'submitted', label: 'Perlu Review', className: 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600' },
                                { key: 'need_revision', label: 'Revisi', className: 'bg-orange-600 hover:bg-orange-700 text-white border-orange-600' },
                                { key: 'approved', label: 'Disetujui', className: 'bg-green-600 hover:bg-green-700 text-white border-green-600' }
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
                        <div className="relative flex-1 p-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Cari konten jurnal..."
                                className="pl-9 h-9 bg-slate-50 border-slate-200 focus-visible:ring-blue-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* 3. Journal List */}
                <div className="flex-1 overflow-y-auto pr-2 pb-20 custom-scrollbar scroll-smooth">
                    {isLoadingList && journals.length === 0 ? (
                        <JournalSkeleton />
                    ) : journals.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                <FileCheck className="w-8 h-8 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-700">Tidak ada jurnal</h3>
                            <p className="text-slate-500 max-w-sm">
                                {filterStatus !== 'all' ? 'Coba ubah filter atau status pencarian Anda.' : 'Belum ada data jurnal yang masuk.'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {journals.map((journal, index) => {
                                const isLast = index === journals.length - 1;
                                return (
                                    <div key={journal.id} ref={isLast ? lastJournalElementRef : null}>
                                        {/* Pass onView as the Review Trigger for Managers */}
                                        <JournalCard
                                            journal={journal}
                                            isEmployee={false}
                                            showProfile={true}
                                            showActions={true}
                                            onView={() => handleOpenReview(journal)}
                                            onEdit={() => handleEditJournal(journal)}
                                        />
                                    </div>
                                );
                            })}

                            {isLoadingMore && (
                                <div className="py-4 text-center">
                                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
                                    <span className="text-xs text-slate-400 mt-1 block">Memuat lebih banyak...</span>
                                </div>
                            )}

                            {!hasMore && journals.length > 0 && (
                                <div className="py-8 text-center text-slate-400 text-xs border-t border-dashed border-slate-200 mt-4">
                                    — Semua data ditampilkan —
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Review Dialog */}
            <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            📋 Review Jurnal
                            {selectedJournal?.profiles?.full_name && <span className="text-slate-500 font-normal text-sm">by {selectedJournal.profiles.full_name}</span>}
                        </DialogTitle>
                        <DialogDescription>Verifikasi dan berikan feedback untuk aktivitas ini.</DialogDescription>
                    </DialogHeader>

                    {selectedJournal && (
                        <div className="space-y-4 py-2">
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 max-h-[300px] overflow-y-auto w-full text-sm leading-relaxed text-slate-700 whitespace-pre-wrap font-sans">
                                {selectedJournal.content}
                            </div>
                            {selectedJournal.obstacles && (
                                <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 text-xs text-slate-700">
                                    <strong className="text-amber-700 block mb-1">Kendala:</strong>
                                    {selectedJournal.obstacles}
                                </div>
                            )}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Catatan Review (Opsional)</label>
                                <Textarea
                                    value={reviewNote}
                                    onChange={e => setReviewNote(e.target.value)}
                                    placeholder="Berikan apresiasi atau instruksi revisi..."
                                    className="resize-none min-h-[100px]"
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={() => setIsReviewOpen(false)}>Batal</Button>
                        <div className="flex gap-2 w-full sm:w-auto justify-end">
                            <Button
                                variant="outline"
                                className="border-orange-200 text-orange-700 hover:bg-orange-50 hover:text-orange-800"
                                onClick={() => handleSubmitReview('need_revision')}
                                disabled={isSubmitting}
                            >
                                Minta Revisi
                            </Button>
                            <Button
                                className="bg-green-600 hover:bg-green-700 text-white min-w-[100px]"
                                onClick={() => handleSubmitReview('approved')}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? <Loader2 className="animate-spin w-4 h-4" /> : "Setujui"}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Edit Jurnal (Manager Access)</DialogTitle></DialogHeader>
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
