
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, Calendar, Filter, ArrowLeft, PenLine, FileText, CheckCircle2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import MobileNavigation from "@/components/MobileNavigation";
import { useIsMobile } from "@/hooks/useIsMobile";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Components
import { JournalHistoryCard, JournalHistoryItem } from "@/components/journal/JournalHistoryCard";
import { DailyJournalForm, DailyJournalFormData } from "@/components/journal/DailyJournalForm";

const extractTitleAndContent = (rawContent: string) => {
    if (!rawContent) return { title: "", content: "" };
    const match = rawContent.match(/^\*\*(.*?)\*\*\n\n([\s\S]*)$/);
    if (match) {
        return { title: match[1], content: match[2] };
    }
    return { title: "", content: rawContent };
};

export default function JurnalSaya() {
    const { user } = useAuth();
    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [filterStatus, setFilterStatus] = useState<string>("Bulan Ini");

    // ========== REACT QUERY ==========
    const {
        data: journals = [],
        isLoading,
    } = useQuery({
        queryKey: ['journals', 'employee', user?.id],
        queryFn: async () => {
            if (!user?.id) return [];

            const { data, error } = await supabase
                .from('work_journals')
                .select('*')
                .eq('user_id', user.id)
                .is('deleted_at', null)
                .order('date', { ascending: false });

            if (error) throw error;
            return (data || []) as unknown as JournalHistoryItem[];
        },
        enabled: !!user?.id,
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Handle Form Submission
    const handleSubmit = async (formData: DailyJournalFormData) => {
        setIsSubmitting(true);
        try {
            // Convert Hours to Minutes for DB
            const durationMinutes = Math.round(formData.duration * 60);

            const existing = journals.find(j => j.date === formData.date);
            const finalContent = formData.title ? `**${formData.title}**\n\n${formData.content}` : formData.content;

            if (existing) {
                // Update
                const { error } = await supabase
                    .from('work_journals')
                    .update({
                        content: finalContent,
                        duration: durationMinutes,
                        obstacles: formData.project_category,
                        verification_status: 'submitted',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);

                if (error) throw error;
                toast({ title: "Berhasil Diperbarui", description: "Jurnal harian Anda telah diperbarui." });
            } else {
                // Insert
                const { error } = await supabase
                    .from('work_journals')
                    .insert({
                        user_id: user?.id,
                        content: finalContent,
                        duration: durationMinutes,
                        obstacles: formData.project_category,
                        date: formData.date,
                        verification_status: 'submitted',
                        work_result: 'completed',
                        mood: '😊'
                    });

                if (error) throw error;
                toast({ title: "Berhasil Disubmit", description: "Jurnal Anda berhasil dicatat." });
            }

            // Refresh Data
            await queryClient.invalidateQueries({ queryKey: ['journals', 'employee', user?.id] });

        } catch (error: any) {
            console.error("Submit error:", error);
            toast({ variant: "destructive", title: "Error", description: error.message || "Gagal mengirim jurnal." });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Filter Logic
    const filteredJournals = journals.filter(j => {
        if (filterStatus === "Bulan Ini") {
            const date = new Date(j.date);
            const now = new Date();
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        }
        return true;
    });

    // Stats
    const approvedCount = journals.filter(j => j.verification_status === 'approved').length;
    const pendingCount = journals.filter(j => j.verification_status === 'submitted' || j.verification_status === 'pending').length;

    return (
        <div className={`min-h-screen pb-24 md:pb-12 ${isMobile ? 'bg-slate-50' : 'bg-slate-50 relative'} font-['Inter',sans-serif]`}>

            {/* Background Graphic */}
            <div className="absolute top-0 right-0 -z-0 w-[60vw] h-[40vh] bg-blue-100/40 rounded-full blur-[100px] pointer-events-none opacity-60 transform translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 left-0 -z-0 w-[40vw] h-[40vh] bg-purple-100/30 rounded-full blur-[100px] pointer-events-none opacity-60 transform -translate-x-1/2 translate-y-1/2"></div>

            <div className="w-full px-6 py-8 max-w-6xl mx-auto relative z-10">
                {/* Back Button */}
                <div className="mb-6">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/dashboard')}
                        className="text-slate-500 hover:text-slate-800 hover:bg-white bg-white/60 backdrop-blur-md border border-slate-200/60 rounded-xl transition-all shadow-sm"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Kembali ke Dashboard
                    </Button>
                </div>

                {/* Page Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white">
                                <PenLine className="w-5 h-5" />
                            </div>
                            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Jurnal Kerja Saya</h1>
                        </div>
                        <p className="text-slate-500 font-medium text-sm mt-3 max-w-md leading-relaxed">
                            Catat aktivitas, progress, dan tantangan yang Anda hadapi hari ini.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 bg-white px-5 py-3.5 rounded-2xl shadow-sm border border-slate-200">
                        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                            <Calendar className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Hari Ini</p>
                            <p className="text-sm font-bold text-slate-800">
                                {format(new Date(), "d MMMM yyyy", { locale: localeId })}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                    <div className="bg-white/70 backdrop-blur-md p-5 rounded-[24px] border border-white/40 shadow-sm relative overflow-hidden vibe-glass-card group">
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-5 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-12 pointer-events-none">
                            <FileText className="w-24 h-24 text-blue-600" />
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Jurnal</p>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-4xl font-extrabold text-slate-800">{journals.length}</h3>
                            <span className="text-sm font-semibold text-slate-500">Laporan</span>
                        </div>
                    </div>

                    <div className="bg-white/70 backdrop-blur-md p-5 rounded-[24px] border border-white/40 shadow-sm relative overflow-hidden vibe-glass-card group">
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-5 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-12 pointer-events-none">
                            <CheckCircle2 className="w-24 h-24 text-emerald-600" />
                        </div>
                        <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Disetujui</p>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-4xl font-extrabold text-emerald-600">{approvedCount}</h3>
                            <span className="text-sm font-semibold text-emerald-600/60">Laporan</span>
                        </div>
                    </div>

                    <div className="hidden md:block bg-white/70 backdrop-blur-md p-5 rounded-[24px] border border-white/40 shadow-sm relative overflow-hidden vibe-glass-card group">
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-5 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-12 pointer-events-none">
                            <Clock className="w-24 h-24 text-amber-600" />
                        </div>
                        <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1">Menunggu Review</p>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-4xl font-extrabold text-amber-600">{pendingCount}</h3>
                            <span className="text-sm font-semibold text-amber-600/60">Laporan</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column: Form */}
                    <div className="lg:col-span-12 xl:col-span-7">
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <DailyJournalForm
                                onSubmit={handleSubmit}
                                isSubmitting={isSubmitting}
                                initialData={(() => {
                                    const todayJournal = journals.find(j => j.date === format(new Date(), "yyyy-MM-dd"));
                                    if (!todayJournal) return undefined;

                                    const { title, content } = extractTitleAndContent(todayJournal.content);
                                    return {
                                        title: title,
                                        content: content,
                                        duration: (todayJournal.duration || 0) / 60,
                                        project_category: todayJournal.obstacles || todayJournal.project_category
                                    };
                                })()}
                            />
                        </div>
                    </div>

                    {/* Right Column: History */}
                    <div className="lg:col-span-12 xl:col-span-5">
                        <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                            <div className="flex items-center justify-between mb-5">
                                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    Riwayat Jurnal
                                </h2>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-9 gap-2 bg-white rounded-xl border-slate-200 text-slate-600 font-semibold shadow-sm">
                                            <Filter className="w-3.5 h-3.5" />
                                            {filterStatus}
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="rounded-xl border-slate-200 shadow-xl min-w-[140px]">
                                        <DropdownMenuItem onClick={() => setFilterStatus("Bulan Ini")} className="font-medium cursor-pointer rounded-lg">Bulan Ini</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setFilterStatus("Semua")} className="font-medium cursor-pointer rounded-lg">Semua Waktu</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div className="bg-white/40 rounded-2xl p-2 min-h-[400px]">
                                {isLoading ? (
                                    <div className="space-y-3">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="h-32 bg-white rounded-xl border border-slate-100 animate-pulse" />
                                        ))}
                                    </div>
                                ) : filteredJournals.length === 0 ? (
                                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                                        <div className="w-16 h-16 bg-slate-50 flex items-center justify-center mx-auto mb-4 rounded-2xl">
                                            <FolderOpen className="w-8 h-8 text-slate-300" />
                                        </div>
                                        <h3 className="text-base font-bold text-slate-700 mb-1">Belum Ada Aktivitas</h3>
                                        <p className="text-slate-500 text-sm">Jurnal yang dikirim akan muncul di sini.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 pb-4 scrollbar-thin scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300">
                                        {filteredJournals.map((journal) => (
                                            <JournalHistoryCard
                                                key={journal.id}
                                                journal={{
                                                    ...journal,
                                                    project_category: journal.project_category || journal.obstacles
                                                }}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {isMobile && <MobileNavigation />}
        </div>
    );
}
