import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import EnterpriseLayout from "@/components/layout/EnterpriseLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
    LayoutDashboard, Users, Clock, BarChart3, Building2, Shield, Key,
    Settings, Database, BookOpen, Search, Calendar as CalendarIcon,
    CheckCircle2, AlertCircle, Pencil, Trash2, Send, FileEdit,
    Eye, Download, MessageSquare, Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { JournalStatusBadge } from "@/components/journal/JournalCard";
import { DeleteJournalModal } from "@/components/journal/DeleteJournalModal";
import { JournalExportModal } from "@/components/journal/JournalExportModal";
import { JournalCleanupModal } from "@/components/journal/JournalCleanupModal";
import { JournalSkeleton } from "@/components/journal/JournalSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

interface JournalEntry {
    id: string;
    content: string;
    date: string;
    duration: number;
    user_id: string;
    status: string;
    manager_notes?: string;
    verification_status?: string;
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

// Work result labels
const WORK_RESULT_LABELS: Record<string, { label: string, className: string }> = {
    completed: { label: "Selesai", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    progress: { label: "Dalam Progress", className: "bg-blue-50 text-blue-700 border-blue-200" },
    pending: { label: "Tertunda", className: "bg-amber-50 text-amber-700 border-amber-200" }
};

const ITEMS_PER_PAGE = 15;

const JurnalKerja = () => {
    const { user } = useAuth();

    // Data State
    const [journals, setJournals] = useState<JournalEntry[]>([]);
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
    const [editingJournal, setEditingJournal] = useState<JournalEntry | null>(null);
    const [editContent, setEditContent] = useState("");
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [deleteJournal, setDeleteJournal] = useState<JournalEntry | null>(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // View detail state
    const [viewJournal, setViewJournal] = useState<JournalEntry | null>(null);
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
                .order('date', { ascending: false })
                .range(from, to);

            if (filterStatus !== 'all') {
                if (filterStatus === 'submitted') {
                    // Handle legacy status if needed, or just verification_status
                    query = query.or(`verification_status.eq.submitted,status.eq.submitted`);
                } else {
                    // query = query.eq('verification_status', filterStatus);
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
                    if (pageIndex === 0) return enrichedData as unknown as JournalEntry[];
                    return [...prev, ...enrichedData as unknown as JournalEntry[]];
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
    const handleViewJournal = (journal: JournalEntry) => {
        setViewJournal(journal);
        setIsViewOpen(true);
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

    const handleDeleteJournal = (journal: JournalEntry) => {
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

    const getInitials = (name: string) => {
        if (!name) return "??";
        return name.split(" ").map(n => n.charAt(0)).slice(0, 2).join("").toUpperCase();
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
                    <div className="grid grid-cols-1 gap-4">
                        {journals.map((journal, index) => {
                            const isLast = index === journals.length - 1;
                            const status = journal.verification_status || journal.status || 'submitted';

                            return (
                                <Card
                                    key={`${journal.id}-${index}`}
                                    ref={isLast ? lastJournalElementRef : null}
                                    className="overflow-hidden hover:shadow-md transition-all border-slate-200 group"
                                >
                                    <CardContent className="p-0">
                                        <div className="flex flex-col md:flex-row">
                                            {/* Left: User Info */}
                                            <div className="p-4 md:w-64 border-b md:border-b-0 md:border-r border-slate-100 bg-gradient-to-br from-slate-50 to-white flex flex-row md:flex-col items-center md:items-start gap-4 shrink-0">
                                                <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                                                    <AvatarImage src={journal.profiles?.avatar_url || ""} />
                                                    <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold">
                                                        {getInitials(journal.profiles?.full_name || "Unknown")}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0 text-left">
                                                    <p className="font-semibold text-slate-900 truncate">
                                                        {journal.profiles?.full_name || "Unknown User"}
                                                    </p>
                                                    <p className="text-xs text-slate-500 truncate">
                                                        {journal.profiles?.department || "No Dept"} • {journal.profiles?.position || "Staff"}
                                                    </p>
                                                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                                                        <CalendarIcon className="w-3 h-3" />
                                                        {format(new Date(journal.date), "EEE, d MMM yyyy", { locale: id })}
                                                    </div>
                                                    {journal.mood && (
                                                        <div className="mt-1 text-lg">{journal.mood}</div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Right: Content */}
                                            <div className="p-4 md:p-5 flex-1 relative">
                                                <div className="flex items-start justify-between mb-3 gap-3">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <JournalStatusBadge status={status} />

                                                        {journal.work_result && WORK_RESULT_LABELS[journal.work_result] && (
                                                            <Badge className={`text-[10px] uppercase ${WORK_RESULT_LABELS[journal.work_result].className}`}>
                                                                {WORK_RESULT_LABELS[journal.work_result].label}
                                                            </Badge>
                                                        )}
                                                    </div>

                                                    {journal.duration > 0 && (
                                                        <span className="text-xs font-medium text-slate-400 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded">
                                                            <Clock className="w-3 h-3" />
                                                            {Math.floor(journal.duration / 60)}h {journal.duration % 60}m
                                                        </span>
                                                    )}
                                                </div>

                                                <p className="text-slate-700 leading-relaxed text-sm whitespace-pre-wrap line-clamp-3 mb-3">
                                                    {journal.content}
                                                </p>

                                                {/* Obstacles */}
                                                {journal.obstacles && (
                                                    <div className="mt-3 p-2.5 bg-amber-50/50 border border-amber-100 rounded-lg text-xs">
                                                        <p className="font-semibold text-amber-700 mb-1">Kendala:</p>
                                                        <p className="text-slate-600">{journal.obstacles}</p>
                                                    </div>
                                                )}

                                                {/* Manager Notes */}
                                                {journal.manager_notes && (
                                                    <div className={`mt-3 flex items-start gap-2 p-2.5 rounded-lg border ${status === 'need_revision'
                                                        ? 'bg-orange-50 border-orange-200'
                                                        : 'bg-blue-50/50 border-blue-100'
                                                        }`}>
                                                        <MessageSquare className={`w-4 h-4 mt-0.5 shrink-0 ${status === 'need_revision' ? 'text-orange-600' : 'text-blue-600'}`} />
                                                        <div>
                                                            <p className={`text-xs font-semibold mb-1 ${status === 'need_revision' ? 'text-orange-700' : 'text-blue-700'}`}>
                                                                Catatan Manager:
                                                            </p>
                                                            <p className="text-xs text-slate-600">{journal.manager_notes}</p>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Admin Actions */}
                                                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="gap-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 h-8"
                                                        onClick={() => handleViewJournal(journal)}
                                                    >
                                                        <Eye className="w-3.5 h-3.5" /> Lihat
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="gap-1 text-blue-600 border-blue-200 hover:bg-blue-50 h-8"
                                                        onClick={() => handleEditJournal(journal)}
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" /> Edit
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="gap-1 text-red-600 border-red-200 hover:bg-red-50 h-8"
                                                        onClick={() => handleDeleteJournal(journal)}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" /> Hapus
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
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

            {/* View Detail Dialog */}
            <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>📋 Detail Jurnal</DialogTitle>
                    </DialogHeader>
                    {viewJournal && (
                        <div className="space-y-4 py-4">
                            {/* Employee info */}
                            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                                <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                                    <AvatarImage src={viewJournal.profiles?.avatar_url || ""} />
                                    <AvatarFallback className="bg-blue-50 text-blue-600">{getInitials(viewJournal.profiles?.full_name || "")}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                    <p className="font-bold text-slate-800">{viewJournal.profiles?.full_name}</p>
                                    <p className="text-sm text-slate-500">
                                        {viewJournal.profiles?.department} • {viewJournal.profiles?.position}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        {format(new Date(viewJournal.date), "EEEE, d MMMM yyyy", { locale: id })}
                                    </p>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <JournalStatusBadge status={viewJournal.verification_status || viewJournal.status || 'submitted'} />
                                    {viewJournal.mood && <span className="text-xl">{viewJournal.mood}</span>}
                                </div>
                            </div>

                            {/* Work Result */}
                            {viewJournal.work_result && (
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-slate-500">Hasil Kerja:</span>
                                    <Badge className={WORK_RESULT_LABELS[viewJournal.work_result]?.className}>
                                        {WORK_RESULT_LABELS[viewJournal.work_result]?.label}
                                    </Badge>
                                </div>
                            )}

                            {/* Content */}
                            <div className="bg-white p-4 rounded-xl border border-slate-200">
                                <p className="text-sm font-semibold text-slate-700 mb-2">Aktivitas:</p>
                                <p className="text-slate-700 whitespace-pre-wrap">{viewJournal.content}</p>
                            </div>

                            {/* Obstacles */}
                            {viewJournal.obstacles && (
                                <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                                    <p className="text-sm font-semibold text-amber-700 mb-2">Kendala / Catatan:</p>
                                    <p className="text-slate-700">{viewJournal.obstacles}</p>
                                </div>
                            )}

                            {/* Manager Notes */}
                            {viewJournal.manager_notes && (
                                <div className={`p-4 rounded-xl border ${(viewJournal.verification_status || viewJournal.status) === 'need_revision'
                                    ? 'bg-orange-50 border-orange-200'
                                    : 'bg-blue-50 border-blue-200'
                                    }`}>
                                    <p className={`text-sm font-semibold mb-2 ${(viewJournal.verification_status || viewJournal.status) === 'need_revision'
                                        ? 'text-orange-700'
                                        : 'text-blue-700'
                                        }`}>
                                        Catatan Manager:
                                    </p>
                                    <p className="text-slate-700">{viewJournal.manager_notes}</p>
                                </div>
                            )}

                            {/* Duration */}
                            {viewJournal.duration > 0 && (
                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                    <Clock className="w-4 h-4" />
                                    Durasi: {Math.floor(viewJournal.duration / 60)} jam {viewJournal.duration % 60} menit
                                </div>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsViewOpen(false)}>Tutup</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
