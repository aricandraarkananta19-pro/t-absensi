import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import EnterpriseLayout from "@/components/layout/EnterpriseLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    LayoutDashboard, Clock, BarChart3, FileCheck, BookOpen, Search,
    Calendar as CalendarIcon, CheckCircle2, XCircle, MessageSquare,
    AlertCircle, Filter, TrendingUp, Users, CheckSquare, Pencil, Trash2,
    Eye, Send, FileEdit, RefreshCw
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
import { format, startOfWeek, endOfWeek, isWithinInterval, subWeeks } from "date-fns";
import { id } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { JournalStatusBadge } from "@/components/journal/JournalCard";
import { DeleteJournalModal } from "@/components/journal/DeleteJournalModal";
import { JournalExportModal } from "@/components/journal/JournalExportModal";
import { FileDown } from "lucide-react";

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

// Work result labels
const WORK_RESULT_LABELS = {
    completed: { label: "Selesai", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    progress: { label: "Progress", className: "bg-blue-50 text-blue-700 border-blue-200" },
    pending: { label: "Tertunda", className: "bg-amber-50 text-amber-700 border-amber-200" }
};

const ManagerJurnal = () => {
    const { user } = useAuth();
    const [journals, setJournals] = useState<JournalEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [selectedWeek, setSelectedWeek] = useState(new Date());

    // Review Modal State
    const [selectedJournal, setSelectedJournal] = useState<JournalEntry | null>(null);
    const [reviewNote, setReviewNote] = useState("");
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Edit/Delete state
    const [editingJournal, setEditingJournal] = useState<JournalEntry | null>(null);
    const [editContent, setEditContent] = useState("");
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [deleteJournal, setDeleteJournal] = useState<JournalEntry | null>(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    // Export state
    const [isExportOpen, setIsExportOpen] = useState(false);

    useEffect(() => {
        fetchJournals();

        const channel = supabase
            .channel('manager-journal-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'work_journals'
                },
                () => {
                    fetchJournals();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchJournals = async () => {
        setIsLoading(true);
        try {
            const { data: simpleData, error: simpleError } = await supabase
                .from('work_journals')
                .select('*')
                .order('date', { ascending: false });

            if (simpleError) throw simpleError;

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

                setJournals(enrichedData as unknown as JournalEntry[]);
            } else {
                setJournals([]);
            }
        } catch (error) {
            console.error("Error fetching journals:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await fetchJournals();
        setIsRefreshing(false);
        toast({ title: "Data Diperbarui", description: "Jurnal terbaru berhasil dimuat." });
    };

    const handleOpenReview = (journal: JournalEntry) => {
        setSelectedJournal(journal);
        setReviewNote(journal.manager_notes || "");
        setIsReviewOpen(true);
    };

    const handleSubmitReview = async (status: 'approved' | 'need_revision') => {
        if (!selectedJournal) return;

        if (status === 'need_revision' && !reviewNote.trim()) {
            toast({
                variant: "destructive",
                title: "Catatan Wajib Diisi",
                description: "Berikan alasan mengapa jurnal perlu direvisi."
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('work_journals' as any)
                .update({
                    verification_status: status,
                    manager_notes: reviewNote
                })
                .eq('id', selectedJournal.id);

            if (error) throw error;

            toast({
                title: status === 'approved' ? "✅ Jurnal Disetujui" : "📝 Revisi Diminta",
                description: status === 'approved'
                    ? "Jurnal telah diverifikasi dan terkunci."
                    : "Karyawan akan melihat catatan dan merevisi jurnal.",
            });

            // Optimistic update
            setJournals(prev => prev.map(j =>
                j.id === selectedJournal.id
                    ? { ...j, verification_status: status, manager_notes: reviewNote }
                    : j
            ));

            setIsReviewOpen(false);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Gagal", description: error.message });
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

            toast({ title: "Berhasil", description: "Jurnal berhasil diperbarui" });
            setIsEditOpen(false);
            setEditingJournal(null);
            fetchJournals();
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
            fetchJournals();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Gagal", description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const getInitials = (name: string) => {
        return name.split(" ").map(n => n.charAt(0)).slice(0, 2).join("").toUpperCase();
    };

    const filteredJournals = journals.filter(journal => {
        const fullName = journal.profiles?.full_name || '';
        const content = journal.content || '';

        const matchesSearch =
            fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            content.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = filterStatus === 'all' || filterStatus === 'summary' || journal.verification_status === filterStatus;

        return matchesSearch && matchesStatus;
    });

    // Weekly Analytics
    const getWeeklyStats = () => {
        const start = startOfWeek(selectedWeek, { weekStartsOn: 1 });
        const end = endOfWeek(selectedWeek, { weekStartsOn: 1 });

        const weeklyJournals = journals.filter(j =>
            isWithinInterval(new Date(j.date), { start, end })
        );

        const uniqueUsers = new Set(weeklyJournals.map(j => j.user_id));
        const approvedCount = weeklyJournals.filter(j => j.verification_status === 'approved').length;

        const dailyActivity = [0, 1, 2, 3, 4, 5, 6].map(offset => {
            const date = new Date(start);
            date.setDate(start.getDate() + offset);
            const dateStr = format(date, 'yyyy-MM-dd');
            const count = weeklyJournals.filter(j => j.date === dateStr).length;
            return {
                day: format(date, 'EEE', { locale: id }),
                entries: count
            };
        });

        const userCounts: Record<string, { count: number, name: string, avatar: string | null }> = {};
        weeklyJournals.forEach(j => {
            if (!userCounts[j.user_id]) {
                userCounts[j.user_id] = {
                    count: 0,
                    name: j.profiles?.full_name || 'Unknown',
                    avatar: j.profiles?.avatar_url || null
                };
            }
            userCounts[j.user_id].count += 1;
        });

        const sortedContributors = Object.values(userCounts)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        return {
            total: weeklyJournals.length,
            activeUsers: uniqueUsers.size,
            approvalRate: weeklyJournals.length > 0 ? Math.round((approvedCount / weeklyJournals.length) * 100) : 0,
            dailyActivity,
            sortedContributors
        };
    };

    const weeklyStats = getWeeklyStats();
    const pendingCount = journals.filter(j => j.verification_status === 'submitted').length;
    const approvedCountGlobal = journals.filter(j => j.verification_status === 'approved').length;
    const needsRevisionCount = journals.filter(j => j.verification_status === 'need_revision').length;

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
            subtitle="Review & monitoring aktivitas harian tim"
            menuSections={menuSections}
            roleLabel="Manager"
            showRefresh={true}
            onRefresh={handleRefresh}
        >
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card className="bg-white shadow-sm border-slate-200">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500 font-medium">Total Entri</p>
                            <p className="text-2xl font-bold text-slate-800">{journals.length}</p>
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
                            <p className="text-2xl font-bold text-amber-700">{pendingCount}</p>
                        </div>
                        <div className="p-3 bg-amber-100 rounded-lg">
                            <AlertCircle className="w-5 h-5 text-amber-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-orange-50 to-white shadow-sm border-orange-200">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-sm text-orange-600 font-medium">Perlu Revisi</p>
                            <p className="text-2xl font-bold text-orange-700">{needsRevisionCount}</p>
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
                            <p className="text-2xl font-bold text-green-700">{approvedCountGlobal}</p>
                        </div>
                        <div className="p-3 bg-green-100 rounded-lg">
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tab Navigation */}
            <div className="bg-white rounded-xl border border-slate-200 p-2 mb-6 shadow-sm">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setFilterStatus('all')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${filterStatus !== 'summary'
                            ? "bg-blue-600 text-white shadow-md"
                            : "text-slate-500 hover:bg-slate-50"
                            }`}
                    >
                        <BookOpen className="w-4 h-4" />
                        Entri Jurnal
                    </button>
                    <button
                        onClick={() => setFilterStatus('summary')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${filterStatus === 'summary'
                            ? "bg-blue-600 text-white shadow-md"
                            : "text-slate-500 hover:bg-slate-50"
                            }`}
                    >
                        <TrendingUp className="w-4 h-4" />
                        Rekap & Insight
                    </button>
                </div>
            </div>

            {/* Actions Bar (Export) */}
            <div className="flex justify-end mb-4">
                <Button variant="outline" onClick={() => setIsExportOpen(true)} className="gap-2 bg-white border-slate-200 text-slate-700 shadow-sm hover:bg-slate-50">
                    <FileDown className="w-4 h-4" />
                    Export Laporan
                </Button>
            </div>

            {
                filterStatus === 'summary' ? (
                    <div className="space-y-6">
                        {/* Weekly Analytics Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <h3 className="text-lg font-bold text-slate-800">
                                📊 Ringkasan Mingguan: {format(startOfWeek(selectedWeek, { weekStartsOn: 1 }), "d MMM", { locale: id })} - {format(endOfWeek(selectedWeek, { weekStartsOn: 1 }), "d MMM yyyy", { locale: id })}
                            </h3>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => setSelectedWeek(d => subWeeks(d, 1))}>
                                    Minggu Lalu
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setSelectedWeek(new Date())}>
                                    Minggu Ini
                                </Button>
                            </div>
                        </div>

                        {/* Analytics Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-4">
                                <Card className="bg-blue-50/50 border-blue-100 shadow-sm">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-blue-100 rounded-lg">
                                                <TrendingUp className="w-4 h-4 text-blue-700" />
                                            </div>
                                            <p className="text-sm font-medium text-blue-900">Total Jurnal</p>
                                        </div>
                                        <p className="text-2xl font-bold text-blue-900">{weeklyStats.total}</p>
                                    </CardContent>
                                </Card>
                                <Card className="bg-indigo-50/50 border-indigo-100 shadow-sm">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-indigo-100 rounded-lg">
                                                <Users className="w-4 h-4 text-indigo-700" />
                                            </div>
                                            <p className="text-sm font-medium text-indigo-900">Karyawan Aktif</p>
                                        </div>
                                        <p className="text-2xl font-bold text-indigo-900">{weeklyStats.activeUsers}</p>
                                    </CardContent>
                                </Card>
                                <Card className="bg-emerald-50/50 border-emerald-100 shadow-sm">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-emerald-100 rounded-lg">
                                                <CheckSquare className="w-4 h-4 text-emerald-700" />
                                            </div>
                                            <p className="text-sm font-medium text-emerald-900">Approval Rate</p>
                                        </div>
                                        <p className="text-2xl font-bold text-emerald-900">{weeklyStats.approvalRate}%</p>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card className="md:col-span-2 shadow-sm border-slate-200">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base">Aktivitas Harian</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-[250px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={weeklyStats.dailyActivity}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                                <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                                <Bar dataKey="entries" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Leaderboard */}
                        <Card className="shadow-sm border-slate-200">
                            <CardHeader>
                                <CardTitle className="text-base">🏆 Top Kontributor Mingguan</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {weeklyStats.sortedContributors.map((contributor, index) => (
                                        <div key={index} className="flex items-center justify-between border-b border-slate-50 last:border-0 pb-3 last:pb-0">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-xs ${index === 0 ? 'bg-yellow-100 text-yellow-700' :
                                                    index === 1 ? 'bg-slate-100 text-slate-600' :
                                                        index === 2 ? 'bg-amber-100 text-amber-700' :
                                                            'bg-slate-50 text-slate-500'
                                                    }`}>
                                                    {index + 1}
                                                </div>
                                                <Avatar className="h-10 w-10 border border-slate-100">
                                                    <AvatarImage src={contributor.avatar || ""} />
                                                    <AvatarFallback className="bg-blue-50 text-blue-600 font-semibold">{getInitials(contributor.name)}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-800">{contributor.name}</p>
                                                    <p className="text-xs text-slate-500">{contributor.count} jurnal</p>
                                                </div>
                                            </div>
                                            <Badge variant="secondary" className="bg-blue-50 text-blue-600">Aktif</Badge>
                                        </div>
                                    ))}
                                    {weeklyStats.sortedContributors.length === 0 && (
                                        <p className="text-center text-sm text-slate-500 py-4">Belum ada data minggu ini.</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                ) : (
                    <>
                        {/* Filters */}
                        <div className="mb-6 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <div className="relative flex-1 w-full md:max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    type="text"
                                    placeholder="Cari nama atau isi jurnal..."
                                    className="pl-9 bg-slate-50 border-slate-200"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
                                {[
                                    { key: 'all', label: 'Semua', className: 'bg-slate-800 hover:bg-slate-700' },
                                    { key: 'submitted', label: 'Perlu Review', className: 'bg-amber-600 hover:bg-amber-700 border-amber-600' },
                                    { key: 'need_revision', label: 'Perlu Revisi', className: 'bg-orange-600 hover:bg-orange-700 border-orange-600' },
                                    { key: 'approved', label: 'Disetujui', className: 'bg-green-600 hover:bg-green-700 border-green-600' }
                                ].map(btn => (
                                    <Button
                                        key={btn.key}
                                        variant={filterStatus === btn.key ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setFilterStatus(btn.key)}
                                        className={filterStatus === btn.key ? btn.className : "text-slate-600"}
                                    >
                                        {btn.label}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* List */}
                        {isLoading ? (
                            <div className="text-center py-12">
                                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                                <p className="text-slate-500">Memuat data...</p>
                            </div>
                        ) : filteredJournals.length === 0 ? (
                            <div className="text-center py-16 bg-white rounded-xl border border-slate-200 border-dashed">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Filter className="w-6 h-6 text-slate-300" />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-800">Tidak ada data</h3>
                                <p className="text-slate-500">Sesuaikan filter atau tunggu update terbaru.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {filteredJournals.map((journal) => (
                                    <div key={journal.id} className="group relative bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md hover:border-slate-300 transition-all">
                                        {/* Top Right: Status & Actions */}
                                        <div className="absolute top-4 right-4 flex items-center gap-2">
                                            {journal.verification_status === 'submitted' && (
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleOpenReview(journal)}
                                                    className="bg-blue-600 text-white hover:bg-blue-700 shadow-sm h-8 text-xs gap-1"
                                                >
                                                    <Eye className="w-3 h-3" /> Review
                                                </Button>
                                            )}
                                            {journal.verification_status !== 'submitted' && (
                                                <>
                                                    <JournalStatusBadge status={journal.verification_status} />
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600"
                                                        onClick={() => handleOpenReview(journal)}
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                </>
                                            )}
                                        </div>

                                        <div className="flex gap-4">
                                            <Avatar className="h-11 w-11 border border-slate-100 shadow-sm">
                                                <AvatarImage src={journal.profiles?.avatar_url || ""} />
                                                <AvatarFallback className="bg-blue-50 text-blue-600 font-semibold">{getInitials(journal.profiles?.full_name || "")}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 pr-28">
                                                <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 mb-2">
                                                    <h4 className="text-sm font-bold text-slate-800">{journal.profiles?.full_name}</h4>
                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <span>{journal.profiles?.position || "Staff"}</span>
                                                        <span>•</span>
                                                        <span className="flex items-center gap-1">
                                                            <CalendarIcon className="w-3 h-3" />
                                                            {format(new Date(journal.date), "d MMM yyyy", { locale: id })}
                                                        </span>
                                                        {journal.mood && <span>{journal.mood}</span>}
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap gap-2 mb-3">
                                                    {journal.work_result && (
                                                        <Badge className={`text-[10px] uppercase ${WORK_RESULT_LABELS[journal.work_result]?.className || ''}`}>
                                                            {WORK_RESULT_LABELS[journal.work_result]?.label}
                                                        </Badge>
                                                    )}
                                                    {journal.duration > 0 && (
                                                        <span className="text-[10px] text-slate-400 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded">
                                                            <Clock className="w-3 h-3" />
                                                            {Math.floor(journal.duration / 60)}j {journal.duration % 60}m
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                                    {journal.content}
                                                </div>

                                                {/* Obstacles */}
                                                {journal.obstacles && (
                                                    <div className="mt-3 p-2.5 bg-amber-50/50 border border-amber-100 rounded-lg text-xs">
                                                        <p className="font-semibold text-amber-700 mb-1">Kendala:</p>
                                                        <p className="text-slate-600">{journal.obstacles}</p>
                                                    </div>
                                                )}

                                                {journal.manager_notes && (
                                                    <div className={`mt-3 flex items-start gap-2 p-2.5 rounded-lg border ${journal.verification_status === 'need_revision'
                                                        ? 'bg-orange-50 border-orange-200'
                                                        : 'bg-blue-50/50 border-blue-100'
                                                        }`}>
                                                        <MessageSquare className={`w-4 h-4 mt-0.5 shrink-0 ${journal.verification_status === 'need_revision' ? 'text-orange-600' : 'text-blue-600'
                                                            }`} />
                                                        <div>
                                                            <p className={`text-xs font-semibold mb-1 ${journal.verification_status === 'need_revision' ? 'text-orange-700' : 'text-blue-700'
                                                                }`}>
                                                                Catatan Manager:
                                                            </p>
                                                            <p className="text-xs text-slate-600">{journal.manager_notes}</p>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="gap-1 text-blue-600 hover:bg-blue-50 h-7 text-xs"
                                                        onClick={() => handleEditJournal(journal)}
                                                    >
                                                        <Pencil className="w-3 h-3" /> Edit
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="gap-1 text-red-600 hover:bg-red-50 h-7 text-xs"
                                                        onClick={() => handleDeleteJournal(journal)}
                                                    >
                                                        <Trash2 className="w-3 h-3" /> Hapus
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )
            }

            {/* Review Modal */}
            <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
                <DialogContent className="sm:max-w-[540px]">
                    <DialogHeader>
                        <DialogTitle>📋 Review Jurnal Kerja</DialogTitle>
                        <DialogDescription>
                            Berikan feedback atau verifikasi laporan aktivitas karyawan.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedJournal && (
                        <div className="space-y-4 py-4">
                            {/* Employee info */}
                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={selectedJournal.profiles?.avatar_url || ""} />
                                    <AvatarFallback className="bg-blue-50 text-blue-600">{getInitials(selectedJournal.profiles?.full_name || "")}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-semibold text-slate-800">{selectedJournal.profiles?.full_name}</p>
                                    <p className="text-xs text-slate-500">
                                        {format(new Date(selectedJournal.date), "EEEE, d MMMM yyyy", { locale: id })}
                                    </p>
                                </div>
                            </div>

                            {/* Journal content */}
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 max-h-60 overflow-y-auto">
                                <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedJournal.content}</p>

                                {selectedJournal.obstacles && (
                                    <div className="mt-3 pt-3 border-t border-slate-200">
                                        <p className="text-xs font-semibold text-amber-700 mb-1">Kendala:</p>
                                        <p className="text-xs text-slate-600">{selectedJournal.obstacles}</p>
                                    </div>
                                )}
                            </div>

                            {/* Manager notes input */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">
                                    Catatan Manager
                                    <span className="text-slate-400 font-normal ml-1">(wajib untuk revisi)</span>
                                </label>
                                <Textarea
                                    placeholder="Tulis feedback, saran, atau alasan revisi..."
                                    value={reviewNote}
                                    onChange={(e) => setReviewNote(e.target.value)}
                                    className="resize-none"
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsReviewOpen(false)} disabled={isSubmitting}>
                            Batal
                        </Button>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <Button
                                onClick={() => handleSubmitReview('need_revision')}
                                disabled={isSubmitting}
                                variant="outline"
                                className="flex-1 sm:flex-none border-orange-300 text-orange-600 hover:bg-orange-50 gap-1"
                            >
                                <AlertCircle className="w-4 h-4" /> Minta Revisi
                            </Button>
                            <Button
                                onClick={() => handleSubmitReview('approved')}
                                disabled={isSubmitting}
                                className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white gap-1"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                {isSubmitting ? "Menyimpan..." : "Setujui"}
                            </Button>
                        </div>
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
                        <Button onClick={handleSaveEdit} disabled={isSubmitting}>Simpan</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Export Modal */}
            <JournalExportModal
                open={isExportOpen}
                onOpenChange={setIsExportOpen}
            />
        </EnterpriseLayout >
    );
};

export default ManagerJurnal;
