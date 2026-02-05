
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import EnterpriseLayout from "@/components/layout/EnterpriseLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    LayoutDashboard, Users, Clock, BarChart3, Building2, Shield, Key,
    Settings, Database, BookOpen, Search, CheckCircle2, AlertCircle,
    Trash2, Send, FileEdit, Download, Loader2, MoreHorizontal
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
            {/* New Enterprise Stats Bar */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 -mx-6 mb-6 mt-[-24px] sticky top-[60px] z-20 shadow-[0_4px_20px_-12px_rgba(0,0,0,0.1)]">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 max-w-7xl mx-auto">

                    {/* Key Metrics */}
                    <div className="flex items-center gap-6 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
                        <div className="flex items-center gap-3 shrink-0">
                            <div className="p-2 bg-slate-100 rounded-lg"><BookOpen className="w-5 h-5 text-slate-600" /></div>
                            <div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Hari Ini</p>
                                <p className="text-xl font-bold text-slate-900">{isLoadingStats ? "..." : stats.totalToday}</p>
                            </div>
                        </div>
                        <div className="w-px h-8 bg-slate-200 shrink-0" />
                        <div className="flex items-center gap-3 shrink-0">
                            <div className="p-2 bg-amber-50 rounded-lg"><Send className="w-5 h-5 text-amber-600" /></div>
                            <div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Menunggu</p>
                                <p className="text-xl font-bold text-amber-600">{isLoadingStats ? "..." : stats.pendingCount}</p>
                            </div>
                        </div>
                        <div className="w-px h-8 bg-slate-200 shrink-0" />
                        <div className="flex items-center gap-3 shrink-0">
                            <div className="p-2 bg-orange-50 rounded-lg"><AlertCircle className="w-5 h-5 text-orange-600" /></div>
                            <div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Revisi</p>
                                <p className="text-xl font-bold text-orange-600">{isLoadingStats ? "..." : stats.needsRevisionCount}</p>
                            </div>
                        </div>
                        <div className="w-px h-8 bg-slate-200 shrink-0 hidden md:block" />
                    </div>

                    {/* Actions Toolbar */}
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-[280px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Cari nama, role, atau isi jurnal..."
                                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 p-1">
                            {[
                                { key: 'all', label: 'Semua' },
                                { key: 'submitted', label: 'Baru' },
                                { key: 'need_revision', label: 'Revisi' },
                                { key: 'approved', label: 'Selesai' },
                            ].map(btn => (
                                <button
                                    key={btn.key}
                                    onClick={() => setFilterStatus(btn.key)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filterStatus === btn.key
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    {btn.label}
                                </button>
                            ))}
                        </div>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon" className="shrink-0 border-slate-200">
                                    <MoreHorizontal className="w-4 h-4 text-slate-600" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setIsExportOpen(true)}>
                                    <Download className="w-4 h-4 mr-2" /> Export Data
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setIsCleanupOpen(true)} className="text-red-600">
                                    <Trash2 className="w-4 h-4 mr-2" /> Bersihkan Data Lama
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>

            {/* Journal Feed */}
            <div className="max-w-5xl mx-auto pb-20 min-h-[500px]">
                {isLoadingList && journals.length === 0 ? (
                    <JournalSkeleton />
                ) : journals.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                            <BookOpen className="w-10 h-10 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900">Belum ada jurnal</h3>
                        <p className="text-slate-500 max-w-sm mx-auto mt-2 text-sm">
                            Tidak ada data jurnal yang ditemukan untuk filter yang dipilih. Coba ubah kata kunci atau status filter.
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
                                        isEmployee={false} // Enables Admin View (Profile Header)
                                        showActions={true}
                                        onEdit={() => handleEditJournal(journal)}
                                        onDelete={() => onOpenDelete(journal)}
                                        onView={() => handleViewJournal(journal)}
                                    />
                                </div>
                            );
                        })}

                        {isLoadingMore && (
                            <div className="py-8 flex justify-center">
                                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                            </div>
                        )}

                        {!hasMore && journals.length > 0 && (
                            <div className="py-8 text-center">
                                <span className="px-4 py-1.5 bg-slate-100 text-slate-400 text-[10px] font-medium uppercase tracking-widest rounded-full">
                                    End of List
                                </span>
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
