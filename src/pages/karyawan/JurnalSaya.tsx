import { useState, useEffect } from "react";
import {
    BookOpen, Calendar, Clock, CheckCircle2, AlertCircle,
    Plus, FileEdit, Send, Eye, RefreshCw, Filter
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import MobileNavigation from "@/components/MobileNavigation";
import { useIsMobile } from "@/hooks/useIsMobile";
import { toast } from "@/hooks/use-toast";

// Components
import { JournalCard, JournalCardData, JournalStatusBadge } from "@/components/journal/JournalCard";
import { JournalFormModal, JournalFormData } from "@/components/journal/JournalFormModal";
import { JournalForm } from "@/components/journal/JournalForm";
import { DeleteJournalModal } from "@/components/journal/DeleteJournalModal";
import { EmptyJournalState } from "@/components/journal/EmptyJournalState";
import { JournalSummaryView } from "@/components/journal/JournalSummaryView";

// Status filter tabs with counts
const STATUS_TABS = [
    { key: 'all', label: 'Semua', icon: BookOpen },
    { key: 'submitted', label: 'Menunggu', icon: Send },
    { key: 'need_revision', label: 'Perlu Revisi', icon: AlertCircle },
    { key: 'approved', label: 'Disetujui', icon: CheckCircle2 },
    { key: 'draft', label: 'Draft', icon: FileEdit },
];

export default function JurnalSaya() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const [journals, setJournals] = useState<JournalCardData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [filterStatus, setFilterStatus] = useState("all");

    // UI States
    const [isFormOpen, setIsFormOpen] = useState(false); // Mobile Modal
    const [showDesktopForm, setShowDesktopForm] = useState(false); // Desktop Form Visibility
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    // Data States
    const [editingJournal, setEditingJournal] = useState<JournalCardData | null>(null);
    const [deletingJournal, setDeletingJournal] = useState<JournalCardData | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (user?.id) fetchJournals();
    }, [user?.id]); // Only refetch if user ID changes, not just reference

    // Real-time subscription
    useEffect(() => {
        const channel = supabase
            .channel('employee-journal-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'work_journals',
                    filter: `user_id=eq.${user?.id}`
                },
                () => {
                    fetchJournals(true);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const fetchJournals = async (isBackground = false) => {
        if (!user?.id) return;

        // SMART LOADING: Only show skeleton if we have NO data.
        // If we already have data, keep showing it while we refresh (UI Stability).
        const shouldShowSkeleton = !isBackground && journals.length === 0;

        if (shouldShowSkeleton) {
            setIsLoading(true);
        } else {
            setIsRefreshing(true); // Show spinner in header instead of wiping content
        }

        try {
            const { data, error } = await supabase
                .from('work_journals' as any)
                .select('*')
                .eq('user_id', user.id)
                .is('deleted_at', null)
                .order('date', { ascending: false });

            if (error) throw error;

            if (data) {
                setJournals(data as unknown as JournalCardData[]);
            }
        } catch (error) {
            console.error("Error fetching journals:", error);
            if (!isBackground && !isRefreshing) {
                toast({
                    variant: "destructive",
                    title: "Gagal memuat jurnal",
                    description: "Silakan coba lagi."
                });
            }
        } finally {
            if (shouldShowSkeleton) {
                setIsLoading(false);
            } else {
                setIsRefreshing(false);
            }
        }
    };

    // Sync editingJournal with latest data from journals list (Real-time consistency)
    useEffect(() => {
        if (editingJournal && journals.length > 0) {
            const updated = journals.find(j => j.id === editingJournal.id);
            // Only update if there are meaningful changes to status or content
            if (updated && (
                updated.verification_status !== editingJournal.verification_status ||
                updated.manager_notes !== editingJournal.manager_notes ||
                updated.content !== editingJournal.content
            )) {
                setEditingJournal(updated);
            }
        }
    }, [journals]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await fetchJournals(false);
        setIsRefreshing(false);
        toast({ title: "Data diperbarui", description: "Jurnal berhasil dimuat ulang." });
    };

    const handleSaveJournal = async (data: JournalFormData, isDraft: boolean, isSilent: boolean = false) => {
        if (!isSilent) setIsSubmitting(true);
        try {
            const status = isDraft ? 'draft' : 'submitted';
            let savedData: JournalCardData | null = null;
            let actionType: 'create' | 'update' = 'create';

            if (editingJournal) {
                actionType = 'update';
                // UPDATE existing journal
                const { data: updated, error } = await supabase
                    .from('work_journals' as any)
                    .update({
                        content: data.content,
                        work_result: data.work_result,
                        obstacles: data.obstacles,
                        mood: data.mood,
                        date: data.date,
                        verification_status: status,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', editingJournal.id)
                    .select()
                    .single();

                if (error) throw error;
                savedData = updated as unknown as JournalCardData;

                if (!isSilent) {
                    toast({
                        title: isDraft ? "Draft Tersimpan" : "Jurnal Diperbarui",
                        description: isDraft
                            ? "Perubahan disimpan sebagai draft."
                            : editingJournal.verification_status === 'need_revision'
                                ? "Jurnal dikirm ulang untuk review Manager."
                                : "Jurnal berhasil diperbarui."
                    });
                }
            } else {
                // CREATE new journal
                const { data: inserted, error } = await supabase
                    .from('work_journals' as any)
                    .insert({
                        user_id: user?.id,
                        content: data.content,
                        work_result: data.work_result,
                        obstacles: data.obstacles,
                        mood: data.mood,
                        date: data.date,
                        duration: 0,
                        status: 'completed', // Legacy status
                        verification_status: status
                    })
                    .select()
                    .single();

                if (error) throw error;
                savedData = inserted as unknown as JournalCardData;
                actionType = 'create';

                if (!isSilent) {
                    toast({
                        title: isDraft ? "Draft Tersimpan ✨" : "Jurnal Terkirim 🚀",
                        description: isDraft
                            ? "Jurnal disimpan sebagai draft. Kirim saat sudah siap."
                            : "Jurnal akan direview oleh Manager."
                    });
                }
            }

            // Immediate State Update
            if (savedData) {
                setJournals(prev => {
                    const newList = [...prev];
                    if (actionType === 'update') {
                        const index = newList.findIndex(j => j.id === savedData!.id);
                        if (index !== -1) newList[index] = savedData!;
                    } else {
                        newList.unshift(savedData!);
                        newList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                    }
                    return newList;
                });

                if (filterStatus !== 'all' && filterStatus !== savedData.verification_status) {
                    setFilterStatus('all');
                }
            }

            if (!isSilent) {
                setIsFormOpen(false);
                setShowDesktopForm(false);
                setEditingJournal(null);
            } else {
                if (savedData) {
                    setEditingJournal(savedData);
                }
            }

            return savedData;
        } catch (error: any) {
            console.error("Save error:", error);
            if (!isSilent) {
                toast({
                    variant: "destructive",
                    title: "Gagal Menyimpan",
                    description: error.message
                });
            }
        } finally {
            if (!isSilent) setIsSubmitting(false);
        }
    };

    const handleDeleteJournal = async () => {
        if (!deletingJournal) return;

        setIsSubmitting(true);
        try {
            const isDraft = deletingJournal.verification_status === 'draft';
            let error;

            if (isDraft) {
                const { error: deleteError } = await supabase
                    .from('work_journals' as any)
                    .delete()
                    .eq('id', deletingJournal.id);
                error = deleteError;
            } else {
                const { error: updateError } = await supabase
                    .from('work_journals' as any)
                    .update({
                        deleted_at: new Date().toISOString(),
                        verification_status: 'archived'
                    })
                    .eq('id', deletingJournal.id);
                error = updateError;
            }

            if (error) throw error;

            toast({
                title: "Jurnal Dihapus",
                description: isDraft ? "Draft berhasil dihapus permanen." : "Jurnal berhasil diarsipkan."
            });

            setIsDeleteOpen(false);
            setDeletingJournal(null);

            // If we were editing this journal, close existing form
            if (editingJournal?.id === deletingJournal.id) {
                setEditingJournal(null);
                setShowDesktopForm(false);
                setIsFormOpen(false);
            }

            fetchJournals();
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Gagal Menghapus",
                description: error.message
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const openDeleteModal = (journal: JournalCardData) => {
        setDeletingJournal(journal);
        setIsDeleteOpen(true);
    };

    // Desktop/Mobile Helper
    const [isDesktop, setIsDesktop] = useState(false);
    useEffect(() => {
        const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
        checkDesktop();
        window.addEventListener('resize', checkDesktop);
        return () => window.removeEventListener('resize', checkDesktop);
    }, []);

    const handleJournalSelect = (journal: JournalCardData) => {
        if (!isDesktop) {
            setEditingJournal(journal);
            setIsFormOpen(true);
        } else {
            setEditingJournal(journal);
            setShowDesktopForm(true);
        }
    };

    const handleCreateNew = () => {
        if (!isDesktop) {
            setEditingJournal(null);
            setIsFormOpen(true);
        } else {
            setEditingJournal(null);
            setShowDesktopForm(true);
        }
    };

    const handleRightPanelCancel = () => {
        setShowDesktopForm(false);
        setEditingJournal(null);
    };

    const handleRequestEdit = (date: string) => {
        const journal = journals.find(j => j.date === date);
        if (journal) {
            handleJournalSelect(journal);
        }
    };

    // Derived Data
    const stats = {
        total: journals.length,
        approved: journals.filter(j => j.verification_status === 'approved').length,
        pending: journals.filter(j => j.verification_status === 'submitted').length,
        needsRevision: journals.filter(j => j.verification_status === 'need_revision').length,
        draft: journals.filter(j => j.verification_status === 'draft').length
    };

    const filteredJournals = journals.filter(j =>
        filterStatus === 'all' || j.verification_status === filterStatus
    );

    const getTabCount = (key: string) => {
        if (key === 'all') return journals.length;
        return journals.filter(j => j.verification_status === key).length;
    };

    const existingDates = journals.map(j => j.date);
    const todayString = format(new Date(), 'yyyy-MM-dd');
    const todayJournal = journals.find(j => j.date === todayString);

    return (
        <div className={`min-h-screen pb-24 md:pb-8 ${isMobile ? 'bg-white' : 'bg-slate-50/50'}`}>
            {/* Header */}
            <div className={`
                bg-white/90 backdrop-blur-xl border-b border-slate-100/50 sticky top-0 z-30 px-4 py-3 md:px-6 md:py-5 
                transition-all duration-200
                ${isMobile ? 'shadow-[0_4px_20px_-12px_rgba(0,0,0,0.05)]' : ''}
            `}>
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                                {format(new Date(), "EEEE, d MMMM yyyy", { locale: id })}
                            </span>
                        </div>
                        <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
                            {isMobile ? "Work Journal" : "Jurnal Aktivitas Saya"}
                        </h1>
                        <p className="text-xs text-slate-500 mt-0.5 font-medium">
                            {isMobile ? "Daily activity log" : "Catat dan kelola laporan kerja harian Anda"}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="text-slate-500 hover:text-slate-700"
                        >
                            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button
                            onClick={handleCreateNew}
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-md rounded-full px-4"
                        >
                            <Plus className="w-4 h-4" />
                            {!isMobile && "Tulis Jurnal"}
                        </Button>
                        {!isMobile && (
                            <Button
                                onClick={() => navigate('/dashboard')}
                                variant="outline"
                                size="sm"
                                className="border-slate-200"
                            >
                                Kembali
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 py-6 md:px-6">

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* LEFT COLUMN: Stats & List */}
                    <div className="lg:col-span-7 space-y-6">

                        {/* Stats Row */}
                        <div className={`
                            ${isMobile
                                ? 'flex overflow-x-auto pb-4 gap-3 no-scrollbar -mx-4 px-4 snap-x'
                                : 'grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4'
                            }
                        `}>
                            <Card className={`border-slate-100 shadow-sm bg-white shrink-0 ${isMobile ? 'w-[140px] snap-start' : ''}`}>
                                <CardContent className="p-4 flex flex-col justify-center text-left">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1.5 bg-slate-50 rounded-md"><BookOpen className="w-3.5 h-3.5 text-slate-500" /></div>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total</p>
                                    </div>
                                    <span className="text-2xl font-bold text-slate-900">{stats.total}</span>
                                </CardContent>
                            </Card>
                            <Card className={`border-green-100 shadow-sm bg-green-50/30 shrink-0 ${isMobile ? 'w-[140px] snap-start' : ''}`}>
                                <CardContent className="p-4 flex flex-col justify-center text-left">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1.5 bg-green-100 rounded-md"><CheckCircle2 className="w-3.5 h-3.5 text-green-600" /></div>
                                        <p className="text-[10px] text-green-600 font-bold uppercase tracking-wider">Disetujui</p>
                                    </div>
                                    <span className="text-2xl font-bold text-green-700">{stats.approved}</span>
                                </CardContent>
                            </Card>
                            <Card className={`border-amber-100 shadow-sm bg-amber-50/30 shrink-0 ${isMobile ? 'w-[140px] snap-start' : ''}`}>
                                <CardContent className="p-4 flex flex-col justify-center text-left">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1.5 bg-amber-100 rounded-md"><Send className="w-3.5 h-3.5 text-amber-600" /></div>
                                        <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">Menunggu</p>
                                    </div>
                                    <span className="text-2xl font-bold text-amber-700">{stats.pending}</span>
                                </CardContent>
                            </Card>
                            <Card className={`border-orange-100 shadow-sm bg-orange-50/30 shrink-0 ${isMobile ? 'w-[140px] snap-start' : ''}`}>
                                <CardContent className="p-4 flex flex-col justify-center text-left">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1.5 bg-orange-100 rounded-md"><AlertCircle className="w-3.5 h-3.5 text-orange-600" /></div>
                                        <p className="text-[10px] text-orange-600 font-bold uppercase tracking-wider">Revisi</p>
                                    </div>
                                    <span className="text-2xl font-bold text-orange-700">{stats.needsRevision}</span>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Filter Tabs */}
                        <div className="bg-white rounded-xl border border-slate-200 p-1.5 shadow-sm overflow-hidden">
                            <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
                                {STATUS_TABS.map((tab) => {
                                    const count = getTabCount(tab.key);
                                    const isActive = filterStatus === tab.key;
                                    const IconComponent = tab.icon;
                                    return (
                                        <button
                                            key={tab.key}
                                            onClick={() => setFilterStatus(tab.key)}
                                            className={`
                                                flex items-center gap-2 px-3 py-2 rounded-lg text-xs md:text-sm font-medium 
                                                transition-all whitespace-nowrap flex-shrink-0
                                                ${isActive ? "bg-blue-600 text-white shadow-md" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"}
                                            `}
                                        >
                                            <IconComponent className="w-3.5 h-3.5" />
                                            {tab.label}
                                            {count > 0 && (
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1 ${isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                                                    {count}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Journal List */}
                        {isLoading ? (
                            <div className="space-y-4">
                                {[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-100 rounded-xl animate-pulse" />)}
                            </div>
                        ) : filteredJournals.length === 0 ? (
                            <EmptyJournalState
                                variant={filterStatus === 'all' ? 'default' : 'filter'}
                                title={filterStatus !== 'all' ? `Tidak ada jurnal "${STATUS_TABS.find(t => t.key === filterStatus)?.label}"` : undefined}
                                onCta={handleCreateNew}
                                ctaLabel="Tulis Jurnal Pertama"
                            />
                        ) : (
                            <div className="space-y-3 md:space-y-4">
                                {filteredJournals.map((journal) => (
                                    <div
                                        key={journal.id}
                                        className={`transition-all duration-200 ${editingJournal?.id === journal.id && showDesktopForm ? 'ring-2 ring-blue-500 rounded-xl transform scale-[1.01]' : ''}`}
                                    >
                                        <JournalCard
                                            journal={journal}
                                            isEmployee={true}
                                            showActions={!isMobile}
                                            onEdit={handleJournalSelect}
                                            onDelete={openDeleteModal}
                                            onView={handleJournalSelect}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Helpful Guidance (Desktop Only) */}
                        {!isMobile && journals.length > 0 && !showDesktopForm && (
                            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4">
                                <p className="text-sm text-blue-800"><strong>💡 Petunjuk:</strong></p>
                                <ul className="text-xs text-blue-700 mt-2 space-y-1 list-disc list-inside">
                                    <li>Pilih jurnal dari daftar untuk melihat detail.</li>
                                    <li>Hari ini: <strong>{todayJournal ? 'Sudah mengisi' : 'Belum mengisi'}</strong>.</li>
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN: Form/Details (Tablet/Desktop Only) */}
                    <div className="hidden lg:block lg:col-span-5 h-[calc(100vh-140px)] sticky top-28">
                        <Card className="h-full border-slate-200 shadow-lg flex flex-col bg-white overflow-hidden">
                            {/* MODE 1: FORM (Creating or Editing) */}
                            {showDesktopForm ? (
                                <>
                                    <div className="shrink-0 p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center z-10">
                                        <div className="flex flex-col gap-1">
                                            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                                                {editingJournal
                                                    ? ((editingJournal.verification_status === 'submitted' || editingJournal.verification_status === 'approved') ? '📋 Detail Jurnal' : '✏️ Edit Jurnal')
                                                    : <span className="flex items-center gap-2"><BookOpen className="w-5 h-5 text-blue-600" /> Isi Jurnal Baru</span>
                                                }
                                            </h3>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={handleRightPanelCancel} className="h-8 text-xs text-slate-500 hover:text-red-500">
                                            Tutup
                                        </Button>
                                    </div>
                                    <div className="flex-1 min-h-0 relative">
                                        <JournalForm
                                            initialData={editingJournal ? {
                                                content: editingJournal.content,
                                                work_result: editingJournal.work_result,
                                                obstacles: editingJournal.obstacles,
                                                mood: editingJournal.mood,
                                                date: editingJournal.date
                                            } : undefined}
                                            isEditing={!!editingJournal}
                                            isRevision={editingJournal?.verification_status === 'need_revision'}
                                            isReadOnly={editingJournal ? (editingJournal.verification_status === 'approved') : false}
                                            managerNotes={editingJournal?.manager_notes}
                                            onSave={async (d, draft, silent) => { await handleSaveJournal(d, draft, silent); }}
                                            onCancel={handleRightPanelCancel}
                                            isSubmitting={isSubmitting}
                                            existingDates={existingDates}
                                            onRequestEdit={handleRequestEdit}
                                        />
                                    </div>
                                </>
                            ) : todayJournal ? (
                                /* MODE 2: SUMMARY VIEW (Today's Journal Exists) */
                                <JournalSummaryView
                                    journal={todayJournal}
                                    onAction={(j) => handleJournalSelect(j)}
                                />
                            ) : (
                                /* MODE 3: EMPTY STATE (Create CTA) */
                                <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50/30">
                                    <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6 shadow-sm border border-blue-100 animate-pulse">
                                        <BookOpen className="w-10 h-10 text-blue-500" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Halo, {user?.email?.split('@')[0]}!</h2>
                                    <p className="text-slate-500 mb-8 max-w-xs leading-relaxed">
                                        Anda belum mengisi jurnal hari ini. Yuk catat aktivitas kerjamu sekarang.
                                    </p>
                                    <Button
                                        onClick={handleCreateNew}
                                        size="lg"
                                        className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-200/50 text-white rounded-full px-8 h-12"
                                    >
                                        <Plus className="w-5 h-5" />
                                        Mulai Tulis Jurnal
                                    </Button>
                                </div>
                            )}
                        </Card>
                    </div>
                </div>
            </div>

            {/* Create/Edit Modal (Mobile) */}
            <JournalFormModal
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
                onSave={async (d, draft, silent) => { await handleSaveJournal(d, draft, silent); }}
                isEditing={!!editingJournal}
                isRevision={editingJournal?.verification_status === 'need_revision'}
                isReadOnly={editingJournal ? (editingJournal.verification_status === 'approved') : false}
                managerNotes={editingJournal?.manager_notes}
                initialData={editingJournal ? {
                    content: editingJournal.content,
                    work_result: editingJournal.work_result,
                    obstacles: editingJournal.obstacles,
                    mood: editingJournal.mood,
                    date: editingJournal.date
                } : undefined}
                existingDates={existingDates}
                onRequestEdit={handleRequestEdit}
                isDateLocked={editingJournal ? editingJournal.verification_status !== 'draft' : false}
            />

            {/* Delete Confirmation Modal */}
            <DeleteJournalModal
                open={isDeleteOpen}
                onOpenChange={setIsDeleteOpen}
                onConfirm={handleDeleteJournal}
                isDeleting={isSubmitting}
                journalDate={deletingJournal ? format(new Date(deletingJournal.date), "d MMMM yyyy", { locale: id }) : undefined}
                isSoftDelete={deletingJournal?.verification_status !== 'draft'} // Pass this prop to Modal to change text
            />

            {isMobile && <MobileNavigation />}
        </div>
    );
}
