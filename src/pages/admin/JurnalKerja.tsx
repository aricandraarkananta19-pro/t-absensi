
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import EnterpriseLayout from "@/components/layout/EnterpriseLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    LayoutDashboard, Users, Clock, BarChart3, Building2, Shield, Key,
    Settings, Database, BookOpen, Search, CheckCircle2, AlertCircle,
    Trash2, Send, FileEdit, Download, Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// Shared Components
import { JournalCard, JournalCardData, JournalStatusBadge } from "@/components/journal/JournalCard";
import { DeleteJournalModal } from "@/components/journal/DeleteJournalModal";
import { JournalExportModal } from "@/components/journal/JournalExportModal";
import { JournalCleanupModal } from "@/components/journal/JournalCleanupModal";
import { JournalSkeleton } from "@/components/journal/JournalSkeleton";
import { JournalDetailView } from "@/components/journal/JournalDetailView";
import { JournalFormModal } from "@/components/journal/JournalFormModal";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { id } from "date-fns/locale";

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
    // Status filter keys match database status or 'all'
    const [filterStatus, setFilterStatus] = useState("all");
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    // Actions State
    const [editingJournal, setEditingJournal] = useState<JournalCardData | null>(null);
    const [editContent, setEditContent] = useState("");
    const [isEditOpen, setIsEditOpen] = useState(false);

    const [deleteJournal, setDeleteJournal] = useState<JournalCardData | null>(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [viewJournal, setViewJournal] = useState<JournalCardData | null>(null);
    const [isViewOpen, setIsViewOpen] = useState(false);

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

    // Reset list on filter/search change
    useEffect(() => {
        setPage(0);
        setJournals([]);
        setHasMore(true);
    }, [filterStatus, debouncedSearch]);

    // Initial Load & Realtime
    useEffect(() => {
        fetchStats();
        /*
        const channel = supabase
            .channel('admin-journal-stats')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'work_journals' }, () => {
                fetchStats();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
        */
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
                // Fallback
                const todayStr = new Date().toISOString().split('T')[0];
                const { count: totalToday } = await supabase
                    .from('work_journals')
                    .select('*', { count: 'exact', head: true })
                    .is('deleted_at', null) // Consistency: Ignore deleted
                    .eq('date', todayStr);

                setStats(prev => ({ ...prev, totalToday: totalToday || 0 }));
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
                .is('deleted_at', null) // CRITICAL FIX: Don't show soft-deleted items
                .order('date', { ascending: false })
                .range(from, to);

            if (filterStatus !== 'all') {
                if (filterStatus === 'submitted') {
                    query = query.or(`verification_status.eq.submitted,status.eq.submitted`);
                } else {
                    query = query.or(`verification_status.eq.${filterStatus},status.eq.${filterStatus}`);
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

                // Transform to JournalCardData
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
                    if (pageIndex === 0) return enrichedData as unknown as JournalCardData[];
                    return [...prev, ...enrichedData as unknown as JournalCardData[]];
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

    // --- Actions ---

    // VIEW
    const handleViewJournal = (journal: JournalCardData) => {
        setViewJournal(journal);
        setIsViewOpen(true);
    };

    // EDIT
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
                .update({
                    content: editContent,
                    updated_at: new Date().toISOString()
                })
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

    // DELETE (Soft Delete implementation)
    const onOpenDelete = (journal: JournalCardData) => {
        setDeleteJournal(journal);
        setIsDeleteOpen(true);
    };

    const confirmDelete = async () => {
        if (!deleteJournal) return;
        setIsSubmitting(true);
        try {
            // CRITICAL FIX: Use Soft Delete
            const { error } = await supabase
                .from('work_journals')
                .update({
                    deleted_at: new Date().toISOString(),
                    verification_status: 'archived'
                })
                .eq('id', deleteJournal.id);

            if (error) throw error;

            toast({ title: "Berhasil", description: "Jurnal berhasil diarsipkan." });
            setIsDeleteOpen(false);
            setDeleteJournal(null);

            // UI update (Remove off list)
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
            showRefresh={false}
            onRefresh={handleRefresh}
        >
            {/* Stats Overview */}
            {isLoadingStats && stats.totalToday === 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
            <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-sm pb-4 pt-2 -mx-4 px-4 md:static md:mx-0 md:px-0 md:bg-transparent">
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
                            { key: 'need_revision', label: 'Perlu Revisi', icon: AlertCircle },
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
            <div className="h-[calc(100vh-320px)] overflow-y-auto pr-2 pb-20 custom-scrollbar relative">
                {isLoadingList && journals.length === 0 ? (
                    <JournalSkeleton />
                ) : journals.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-xl border border-slate-200 border-dashed">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <BookOpen className="w-8 h-8 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900">Tidak ada jurnal ditemukan</h3>
                        <p className="text-slate-500 max-w-sm mx-auto mt-1">
                            Tidak ada data jurnal yang cocok dengan filter pencarian.
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
                                >
                                    <JournalCard
                                        journal={journal}
                                        isAdmin={true}
                                        showActions={true}
                                        onEdit={() => handleEditJournal(journal)}
                                        onDelete={() => onOpenDelete(journal)}
                                        onView={() => handleViewJournal(journal)}
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

            {/* Shared Journal Detail View */}
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

            {/* Edit Dialog (Simplified for Admin) */}
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

            {/* Delete Confirmation Modal (Now supports Soft Delete context) */}
            <DeleteJournalModal
                open={isDeleteOpen}
                onOpenChange={setIsDeleteOpen}
                onConfirm={confirmDelete}
                isDeleting={isSubmitting}
                journalDate={deleteJournal
                    ? format(new Date(deleteJournal.date), "d MMMM yyyy", { locale: id })
                    : undefined
                }
                isSoftDelete={true} // Admin deleting affects this now
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
