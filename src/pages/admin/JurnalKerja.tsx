import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import EnterpriseLayout from "@/components/layout/EnterpriseLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
    LayoutDashboard, Users, Clock, BarChart3, Building2, Shield, Key,
    Settings, Database, BookOpen, Search, CheckCircle2, AlertCircle,
    Send, FileEdit, Trash2, Download, Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import JournalCard, { JournalCardData } from "@/components/journal/JournalCard"; // Default import + Type
import { DeleteJournalModal } from "@/components/journal/DeleteJournalModal";
import { JournalExportModal } from "@/components/journal/JournalExportModal";
import { JournalCleanupModal } from "@/components/journal/JournalCleanupModal";
import { JournalSkeleton } from "@/components/journal/JournalSkeleton";
import { JournalDetailView } from "@/components/journal/JournalDetailView";
import { Skeleton } from "@/components/ui/skeleton";

const ITEMS_PER_PAGE = 15;

const JurnalKerja = () => {
    const { user } = useAuth();

    // Data State
    const [journals, setJournals] = useState<JournalCardData[]>([]);
    const [stats, setStats] = useState({
        totalToday: 0,
        avgDuration: 0,
        pendingCount: 0,
        approvedCount: 0,
        needsRevisionCount: 0
    });

    // Loading State
    const [isLoadingList, setIsLoadingList] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isLoadingStats, setIsLoadingStats] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Filter & Pagination
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    // Edit/Delete state
    const [editingJournal, setEditingJournal] = useState<JournalCardData | null>(null);
    const [editContent, setEditContent] = useState("");
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [deleteJournal, setDeleteJournal] = useState<JournalCardData | null>(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // View detail state
    const [viewJournal, setViewJournal] = useState<JournalCardData | null>(null);
    const [isViewOpen, setIsViewOpen] = useState(false);

    // Export & Cleanup state
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [isCleanupOpen, setIsCleanupOpen] = useState(false);

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

    // Menu Configuration
    const menuSections = [
        {
            title: "Menu Utama",
            items: [
                { icon: LayoutDashboard, title: "Dashboard", href: "/dashboard" },
                { icon: Users, title: "Kelola Karyawan", href: "/admin/karyawan" },
                { icon: Clock, title: "Rekap Absensi", href: "/admin/absensi" },
                { icon: BookOpen, title: "Jurnal Kerja", href: "/admin/jurnal" },
                { icon: BarChart3, title: "Laporan", href: "/admin/laporan" },
            ],
        },
        {
            title: "Pengaturan",
            items: [
                { icon: Building2, title: "Departemen", href: "/admin/departemen" },
                { icon: Shield, title: "Kelola Role", href: "/admin/role" },
                { icon: Key, title: "Reset Password", href: "/admin/reset-password" },
                { icon: Settings, title: "Pengaturan", href: "/admin/pengaturan" },
                { icon: Database, title: "Export Database", href: "/admin/export-database" },
            ],
        },
    ];

    // Search Debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Reset list on filter change
    useEffect(() => {
        setPage(0);
        setJournals([]);
        setHasMore(true);
    }, [filterStatus, debouncedSearch]);

    // Initial Load & Realtime Stats
    useEffect(() => {
        fetchStats();

        // Real-time stats updates
        const channel = supabase
            .channel('admin-journal-stats')
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
            const { data, error } = await supabase.rpc('get_admin_journal_stats');
            if (!error && data && data.length > 0) {
                setStats({
                    totalToday: data[0].total_today || 0,
                    avgDuration: Number(data[0].avg_duration_today || 0),
                    pendingCount: data[0].pending_total || 0,
                    approvedCount: data[0].approved_total || 0,
                    needsRevisionCount: data[0].need_revision_total || 0
                });
            } else {
                // Fallback if RPC missing
                const todayStr = new Date().toISOString().split('T')[0];
                const { count: totalToday } = await supabase.from('work_journals').select('*', { count: 'exact', head: true }).eq('date', todayStr);

                // Approximate counts for fallback
                const { count: pending } = await supabase.from('work_journals').select('*', { count: 'exact', head: true }).or('verification_status.eq.submitted,verification_status.eq.draft');

                setStats(prev => ({
                    ...prev,
                    totalToday: totalToday || 0,
                    pendingCount: pending || 0
                }));
            }
        } catch (error) {
            console.error(error);
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

            if (filterStatus !== 'all') {
                if (filterStatus === 'submitted') {
                    // Include both old 'submitted' status and new verification_status
                    query = query.or(`verification_status.eq.submitted`);
                } else {
                    query = query.eq('verification_status', filterStatus);
                }
            }

            if (debouncedSearch) {
                query = query.ilike('content', `%${debouncedSearch}%`);
            }

            const { data: simpleData, error } = await query;

            if (error) throw error;

            if (simpleData && simpleData.length > 0) {
                const userIds = [...new Set(simpleData.map(j => j.user_id))];
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('user_id, full_name, avatar_url, department, position')
                    .in('user_id', userIds);

                const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

                const enrichedData = simpleData.map(journal => ({
                    ...journal,
                    profiles: profileMap.get(journal.user_id) || {
                        full_name: 'Unknown',
                        avatar_url: null,
                        department: null,
                        position: null
                    }
                }));

                setJournals(prev => {
                    const newData = enrichedData as unknown as JournalCardData[];
                    if (pageIndex === 0) return newData;
                    // Filter duplicates just in case
                    const existingIds = new Set(prev.map(j => j.id));
                    const uniqueNew = newData.filter(j => !existingIds.has(j.id));
                    return [...prev, ...uniqueNew];
                });

                if (simpleData.length < ITEMS_PER_PAGE) {
                    setHasMore(false);
                }
            } else {
                if (pageIndex === 0) setJournals([]);
                setHasMore(false);
            }
        } catch (error) {
            console.error("Error fetching journals:", error);
            toast({ variant: "destructive", title: "Gagal memuat data", description: "Periksa koneksi internet." });
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
        toast({ title: "Data Diperbarui", description: "Jurnal terbaru berhasil dimuat." });
    };

    // Actions
    const handleViewJournal = (journal: JournalCardData) => {
        setViewJournal(journal);
        setIsViewOpen(true);
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

            toast({ title: "Berhasil", description: "Jurnal berhasil diperbarui" });
            setIsEditOpen(false);
            setEditingJournal(null);

            // Optimistic update
            setJournals(prev => prev.map(j => j.id === editingJournal.id ? { ...j, content: editContent } : j));

        } catch (error: any) {
            toast({ variant: "destructive", title: "Gagal", description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteJournal = (journal: JournalCardData) => {
        setDeleteJournal(journal);
        setIsDeleteOpen(true);
    };

    const confirmDelete = async () => {
        if (!deleteJournal) return;
        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('work_journals')
                .delete()
                .eq('id', deleteJournal.id);

            if (error) throw error;

            toast({ title: "Berhasil", description: "Jurnal berhasil dihapus" });
            setIsDeleteOpen(false);
            setDeleteJournal(null);

            // UI update
            setJournals(prev => prev.filter(j => j.id !== deleteJournal.id));
            fetchStats(); // Update stats as well

        } catch (error: any) {
            toast({ variant: "destructive", title: "Gagal", description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <EnterpriseLayout
            title="Jurnal Kerja"
            subtitle="Insight harian tim dan aktivitas karyawan"
            menuSections={menuSections}
            roleLabel="Administrator"
            showRefresh={true}
            onRefresh={handleRefresh}
        >
            <div className="flex flex-col h-full space-y-6">
                {/* Stats Overview */}
                {isLoadingStats && stats.totalToday === 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-1">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 h-24 flex items-center justify-between">
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-20" />
                                    <Skeleton className="h-8 w-12" />
                                </div>
                                <Skeleton className="h-10 w-10 rounded-lg" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-1">
                        <Card className="bg-white shadow-sm border-slate-200">
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className="p-3 bg-indigo-50 rounded-xl">
                                    <BookOpen className="w-6 h-6 text-indigo-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Jurnal Hari Ini</p>
                                    <p className="text-2xl font-bold text-slate-900">{stats.totalToday}</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-gradient-to-br from-amber-50 to-white shadow-sm border-amber-200">
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className="p-3 bg-amber-100 rounded-xl">
                                    <Send className="w-6 h-6 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-amber-600 uppercase tracking-wide font-medium">Menunggu Review</p>
                                    <p className="text-2xl font-bold text-amber-700">{stats.pendingCount}</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-gradient-to-br from-orange-50 to-white shadow-sm border-orange-200">
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className="p-3 bg-orange-100 rounded-xl">
                                    <FileEdit className="w-6 h-6 text-orange-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-orange-600 uppercase tracking-wide font-medium">Perlu Revisi</p>
                                    <p className="text-2xl font-bold text-orange-700">{stats.needsRevisionCount}</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-gradient-to-br from-green-50 to-white shadow-sm border-green-200">
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className="p-3 bg-green-100 rounded-xl">
                                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-green-600 uppercase tracking-wide font-medium">Disetujui</p>
                                    <p className="text-2xl font-bold text-green-700">{stats.approvedCount}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Filters */}
                <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-sm -mx-4 px-4 md:static md:mx-0 md:px-0 md:bg-transparent">
                    <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="relative flex-1 min-w-[240px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Cari karyawan atau isi jurnal..."
                                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            {[
                                { key: 'all', label: 'Semua', icon: BookOpen },
                                { key: 'submitted', label: 'Menunggu', icon: Send },
                                { key: 'need_revision', label: 'Revisi', icon: AlertCircle },
                                { key: 'approved', label: 'Disetujui', icon: CheckCircle2 },
                            ].map(btn => {
                                const IconComponent = btn.icon;
                                const isActive = filterStatus === btn.key;
                                return (
                                    <Button
                                        key={btn.key}
                                        variant={isActive ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setFilterStatus(btn.key)}
                                        className={`gap-1.5 ${isActive ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'text-slate-600'}`}
                                    >
                                        <IconComponent className="w-4 h-4" />
                                        {btn.label}
                                    </Button>
                                );
                            })}
                        </div>

                        <div className="flex gap-2 ml-auto w-full md:w-auto mt-2 md:mt-0">
                            <Button
                                variant="outline"
                                className="gap-2 border-red-200 text-red-600 hover:bg-red-50 flex-1 md:flex-none"
                                onClick={() => setIsCleanupOpen(true)}
                            >
                                <Trash2 className="w-4 h-4" /> <span className="hidden md:inline">Bersihkan</span>
                            </Button>
                            <Button
                                variant="outline"
                                className="gap-2 border-slate-200 text-slate-600 hover:bg-slate-50 flex-1 md:flex-none"
                                onClick={() => setIsExportOpen(true)}
                            >
                                <Download className="w-4 h-4" /> <span className="hidden md:inline">Export</span>
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Journal List */}
                <div className="flex-1 overflow-y-auto pr-2 pb-20 custom-scrollbar scroll-smooth">
                    {isLoadingList && journals.length === 0 ? (
                        <JournalSkeleton />
                    ) : journals.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-xl border border-slate-200 border-dashed">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <BookOpen className="w-8 h-8 text-slate-300" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900">Tidak ada jurnal ditemukan</h3>
                            <p className="text-slate-500 max-w-sm mx-auto mt-1">
                                {filterStatus !== 'all'
                                    ? "Coba ubah status filter atau kata kunci pencarian."
                                    : "Belum ada data jurnal yang masuk saat ini."}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {journals.map((journal, index) => {
                                const isLast = index === journals.length - 1;
                                return (
                                    <div key={journal.id} ref={isLast ? lastJournalElementRef : null}>
                                        <JournalCard
                                            journal={journal}
                                            isEmployee={false}
                                            showProfile={true}
                                            showActions={true}
                                            onView={handleViewJournal}
                                            onEdit={handleEditJournal}
                                            onDelete={handleDeleteJournal}
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

            {/* Enterprise Journal Detail View */}
            <JournalDetailView
                journalId={viewJournal?.id || null}
                isOpen={isViewOpen}
                onClose={() => setIsViewOpen(false)}
                onUpdate={() => {
                    fetchJournals(page);
                    fetchStats();
                    setIsViewOpen(false);
                }}
            />

            {/* Edit Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>✏️ Edit Jurnal</DialogTitle>
                        <DialogDescription>
                            Edit konten jurnal dari {editingJournal?.profiles?.full_name}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            placeholder="Konten jurnal..."
                            className="min-h-[150px]"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditOpen(false)}>Batal</Button>
                        <Button onClick={handleSaveEdit} disabled={isSubmitting}>
                            {isSubmitting ? "Menyimpan..." : "Simpan"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Modal */}
            <DeleteJournalModal
                open={isDeleteOpen}
                onOpenChange={setIsDeleteOpen}
                onConfirm={confirmDelete}
                isDeleting={isSubmitting}
                journalDate={deleteJournal
                    ? format(new Date(deleteJournal.date), "d MMMM yyyy", { locale: id })
                    : undefined
                }
            />

            {/* Export Modal */}
            <JournalExportModal
                open={isExportOpen}
                onOpenChange={setIsExportOpen}
            />

            {/* Cleanup Modal */}
            <JournalCleanupModal
                open={isCleanupOpen}
                onOpenChange={setIsCleanupOpen}
            />
        </EnterpriseLayout >
    );
};

export default JurnalKerja;
