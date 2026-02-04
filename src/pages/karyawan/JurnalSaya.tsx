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

// New Components
import { JournalCard, JournalCardData, JournalStatusBadge } from "@/components/journal/JournalCard";
import { JournalFormModal, JournalFormData } from "@/components/journal/JournalFormModal";
import { JournalForm } from "@/components/journal/JournalForm";
import { DeleteJournalModal } from "@/components/journal/DeleteJournalModal";
import { EmptyJournalState } from "@/components/journal/EmptyJournalState";

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

    // Modal States
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [editingJournal, setEditingJournal] = useState<JournalCardData | null>(null);
    const [deletingJournal, setDeletingJournal] = useState<JournalCardData | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (user) fetchJournals();
    }, [user]);

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
                    fetchJournals();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const fetchJournals = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('work_journals' as any)
                .select('*')
                .eq('user_id', user?.id)
                .order('date', { ascending: false });

            if (error) throw error;
            if (data) setJournals(data as unknown as JournalCardData[]);
        } catch (error) {
            console.error("Error fetching journals:", error);
            toast({
                variant: "destructive",
                title: "Gagal memuat jurnal",
                description: "Silakan coba lagi."
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await fetchJournals();
        setIsRefreshing(false);
        toast({ title: "Data diperbarui", description: "Jurnal berhasil dimuat ulang." });
    };

    // CRUD Operations
    const handleSaveJournal = async (data: JournalFormData, isDraft: boolean, isSilent: boolean = false) => {
        if (!isSilent) setIsSubmitting(true);
        try {
            const status = isDraft ? 'draft' : 'submitted';
            let savedData = null;

            if (editingJournal) {
                // UPDATE existing journal
                const { data: updated, error } = await supabase
                    .from('work_journals' as any)
                    .update({
                        content: data.content,
                        work_result: data.work_result,
                        obstacles: data.obstacles,
                        mood: data.mood,
                        date: data.date, // Add date update
                        verification_status: status,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', editingJournal.id)
                    .select()
                    .single();

                if (error) throw error;
                savedData = updated;

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
                        date: data.date, // Use selected date
                        duration: 0,
                        status: 'completed',
                        verification_status: status
                    })
                    .select()
                    .single();

                if (error) throw error;
                savedData = inserted;

                if (!isSilent) {
                    toast({
                        title: isDraft ? "Draft Tersimpan ✨" : "Jurnal Terkirim 🚀",
                        description: isDraft
                            ? "Jurnal disimpan sebagai draft. Kirim saat sudah siap."
                            : "Jurnal akan direview oleh Manager."
                    });
                }
            }

            if (!isSilent) {
                setIsFormOpen(false);
                setEditingJournal(null);
            } else {
                // If auto-save (silent), update the editingJournal so next save is an Update
                if (savedData) {
                    setEditingJournal(savedData as unknown as JournalCardData);
                }
            }

            fetchJournals();
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
            const { error } = await supabase
                .from('work_journals' as any)
                .delete()
                .eq('id', deletingJournal.id);

            if (error) throw error;

            toast({
                title: "Jurnal Dihapus",
                description: "Jurnal berhasil dihapus."
            });

            setIsDeleteOpen(false);
            setDeletingJournal(null);
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

    // Open modals
    const openCreateModal = () => {
        setEditingJournal(null);
        setIsFormOpen(true);
    };

    const openEditModal = (journal: JournalCardData) => {
        setEditingJournal(journal);
        setIsFormOpen(true);
    };

    const openDeleteModal = (journal: JournalCardData) => {
        setDeletingJournal(journal);
        setIsDeleteOpen(true);
    };

    // Stats calculation
    const stats = {
        total: journals.length,
        approved: journals.filter(j => j.verification_status === 'approved').length,
        pending: journals.filter(j => j.verification_status === 'submitted').length,
        needsRevision: journals.filter(j => j.verification_status === 'need_revision').length,
        draft: journals.filter(j => j.verification_status === 'draft').length
    };

    // Filter journals
    const filteredJournals = journals.filter(j =>
        filterStatus === 'all' || j.verification_status === filterStatus
    );

    // Get count for each tab
    const getTabCount = (key: string) => {
        if (key === 'all') return journals.length;
        return journals.filter(j => j.verification_status === key).length;
    };

    // Derived existing dates for duplicate checking
    const existingDates = journals.map(j => j.date);

    // Tablet/Desktop Split View helpers

    // Check for large screen (Desktop) where side-panel is visible
    const [isDesktop, setIsDesktop] = useState(false);

    useEffect(() => {
        const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024); // lg breakpoint
        checkDesktop();
        window.addEventListener('resize', checkDesktop);
        return () => window.removeEventListener('resize', checkDesktop);
    }, []);

    // Tablet/Desktop Split View helpers
    const handleJournalSelect = (journal: JournalCardData) => {
        // Use Modal for Mobile (<640) AND Tablet (<1024)
        // Only use Side Panel for Desktop (>=1024)
        if (!isDesktop) {
            openEditModal(journal);
        } else {
            setEditingJournal(journal);
        }
    };

    const handleCreateNew = () => {
        if (!isDesktop) {
            openCreateModal();
        } else {
            setEditingJournal(null); // Clears form for new entry, side panel shows "New" state implicitly or keeps old? 
            // Actually side panel needs to know we want to create new.
            // The current side panel logic shows "New" if editingJournal is null.
            // But we might want to ensure it grabs focus or scrolls.
            // Ideally we need a state 'isCreating'. 
            // But for now, setting editingJournal(null) allows the form to render empty.
            // We should just ensure form is visible.
        }
    };

    const handleRequestEdit = (date: string) => {
        const journal = journals.find(j => j.date === date);
        if (journal) {
            if (!isDesktop) {
                setEditingJournal(journal);
                setIsFormOpen(true);
            } else {
                setEditingJournal(journal);
            }
        }
    };

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

                        {/* Stats Row - Responsive: Scroll on mobile, Grid on desktop */}
                        {/* FIX: Use grid-cols-2 for Tablet (< lg), grid-cols-4 for Desktop (lg) */}
                        <div className={`
                            ${isMobile
                                ? 'flex overflow-x-auto pb-4 gap-3 no-scrollbar -mx-4 px-4 snap-x'
                                : 'grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4'
                            }
                        `}>
                            {/* Card 1: Total */}
                            <Card className={`
                                border-slate-100 shadow-sm bg-white shrink-0
                                ${isMobile ? 'w-[140px] snap-start' : ''}
                            `}>
                                <CardContent className="p-4 flex flex-col justify-center text-left">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1.5 bg-slate-50 rounded-md">
                                            <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                                        </div>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total</p>
                                    </div>
                                    <span className="text-2xl font-bold text-slate-900">{stats.total}</span>
                                </CardContent>
                            </Card>

                            {/* Card 2: Approved */}
                            <Card className={`
                                border-green-100 shadow-sm bg-green-50/30 shrink-0
                                ${isMobile ? 'w-[140px] snap-start' : ''}
                            `}>
                                <CardContent className="p-4 flex flex-col justify-center text-left">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1.5 bg-green-100 rounded-md">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                                        </div>
                                        <p className="text-[10px] text-green-600 font-bold uppercase tracking-wider">Disetujui</p>
                                    </div>
                                    <span className="text-2xl font-bold text-green-700">{stats.approved}</span>
                                </CardContent>
                            </Card>

                            {/* Card 3: Pending */}
                            <Card className={`
                                border-amber-100 shadow-sm bg-amber-50/30 shrink-0
                                ${isMobile ? 'w-[140px] snap-start' : ''}
                            `}>
                                <CardContent className="p-4 flex flex-col justify-center text-left">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1.5 bg-amber-100 rounded-md">
                                            <Send className="w-3.5 h-3.5 text-amber-600" />
                                        </div>
                                        <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">Menunggu</p>
                                    </div>
                                    <span className="text-2xl font-bold text-amber-700">{stats.pending}</span>
                                </CardContent>
                            </Card>

                            {/* Card 4: Revision */}
                            <Card className={`
                                border-orange-100 shadow-sm bg-orange-50/30 shrink-0
                                ${isMobile ? 'w-[140px] snap-start' : ''}
                            `}>
                                <CardContent className="p-4 flex flex-col justify-center text-left">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1.5 bg-orange-100 rounded-md">
                                            <AlertCircle className="w-3.5 h-3.5 text-orange-600" />
                                        </div>
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
                                                ${isActive
                                                    ? "bg-blue-600 text-white shadow-md"
                                                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                                                }
                                            `}
                                        >
                                            <IconComponent className="w-3.5 h-3.5" />
                                            {tab.label}
                                            {count > 0 && (
                                                <span className={`
                                                    text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1
                                                    ${isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}
                                                `}>
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
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-32 bg-slate-100 rounded-xl animate-pulse" />
                                ))}
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
                                        className={`transition-all duration-200 ${editingJournal?.id === journal.id && !isMobile ? 'ring-2 ring-blue-500 rounded-xl transform scale-[1.01]' : ''}`}
                                    >
                                        <JournalCard
                                            journal={journal}
                                            isEmployee={true}
                                            showActions={!isMobile} // On mobile, actions are in menu
                                            onEdit={handleJournalSelect}
                                            onDelete={openDeleteModal}
                                            onView={handleJournalSelect}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Helpful Guidance (Desktop Only) */}
                        {!isMobile && journals.length > 0 && (
                            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4">
                                <p className="text-sm text-blue-800"><strong>💡 Petunjuk:</strong></p>
                                <ul className="text-xs text-blue-700 mt-2 space-y-1 list-disc list-inside">
                                    <li>Pilih jurnal dari daftar untuk melihat detail atau mengeditnya.</li>
                                    <li>Klik tombol <strong>+ Tulis Jurnal</strong> untuk membuat jurnal baru.</li>
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN: Form/Details (Tablet/Desktop Only) */}
                    <div className="hidden lg:block lg:col-span-5">
                        <div className="sticky top-24">
                            <Card className="border-slate-200 shadow-lg overflow-hidden flex flex-col max-h-[calc(100vh-120px)]">
                                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                    <div className="flex flex-col gap-1">
                                        <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                                            {editingJournal
                                                ? (editingJournal.verification_status === 'need_revision' ? '✏️ Revisi Jurnal' : '📝 Detail Jurnal')
                                                : (
                                                    <span className="flex items-center gap-2">
                                                        <BookOpen className="w-5 h-5 text-blue-600" />
                                                        Apa yang Anda kerjakan hari ini?
                                                    </span>
                                                )
                                            }
                                        </h3>
                                        {!editingJournal && (
                                            <p className="text-xs text-slate-500 font-medium ml-7">
                                                Catat aktivitas kerja Anda sekarang. Jangan menunggu pulang.
                                            </p>
                                        )}
                                    </div>
                                    {editingJournal && (
                                        <Button variant="ghost" size="sm" onClick={() => setEditingJournal(null)} className="h-8 text-xs text-slate-500">
                                            Buat Baru
                                        </Button>
                                    )}
                                </div>
                                <div className="p-0 flex-1 overflow-hidden">
                                    <div className="h-full px-6 py-4 flex flex-col">
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
                                            managerNotes={editingJournal?.manager_notes}
                                            onSave={handleSaveJournal}
                                            onCancel={() => setEditingJournal(null)}
                                            isSubmitting={isSubmitting}
                                            existingDates={existingDates}
                                            onRequestEdit={handleRequestEdit}
                                        />
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>

            {/* Create/Edit Modal */}
            <JournalFormModal
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
                onSave={handleSaveJournal}
                isEditing={!!editingJournal}
                isRevision={editingJournal?.verification_status === 'need_revision'}
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
                journalDate={deletingJournal
                    ? format(new Date(deletingJournal.date), "d MMMM yyyy", { locale: id })
                    : undefined
                }
            />

            {isMobile && <MobileNavigation />}
        </div>
    );
}
