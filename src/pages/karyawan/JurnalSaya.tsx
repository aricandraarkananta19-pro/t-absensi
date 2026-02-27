
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, Calendar, Filter, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import MobileNavigation from "@/components/MobileNavigation";
import { useIsMobile } from "@/hooks/useIsMobile";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// New Components
import { JournalHistoryCard, JournalHistoryItem } from "@/components/journal/JournalHistoryCard";
import { DailyJournalForm, DailyJournalFormData } from "@/components/journal/DailyJournalForm";

export default function JurnalSaya() {
    const { user } = useAuth();
    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [filterStatus, setFilterStatus] = useState<string>("This Month");

    // ========== REACT QUERY ==========
    const {
        data: journals = [],
        isLoading,
    } = useQuery({
        queryKey: ['journals', 'employee', user?.id],
        queryFn: async () => {
            if (!user?.id) return [];

            // We select title as well now
            const { data, error } = await supabase
                .from('work_journals' as any)
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

            // Check if journal exists for this date to prevent duplicates (optional, or update?)
            // For now, we append/create new. 
            // If strict 1 journal per day:
            const existing = journals.find(j => j.date === formData.date);

            if (existing) {
                // Update existing
                const finalContent = formData.title ? `**${formData.title}**\n\n${formData.content}` : formData.content;

                const { error } = await supabase
                    .from('work_journals' as any)
                    .update({
                        // title: formData.title, // Removed
                        content: finalContent,
                        duration: durationMinutes,
                        // We store category in obstacles for now as metadata or text
                        obstacles: formData.project_category,
                        verification_status: 'submitted',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);

                if (error) throw error;
                toast({ title: "Journal Updated", description: "Your daily journal has been updated." });
            } else {
                // Insert New
                // Title column does not exist in DB, so we prepend it to content to save it.
                const finalContent = formData.title ? `**${formData.title}**\n\n${formData.content}` : formData.content;

                const { error } = await supabase
                    .from('work_journals' as any)
                    .insert({
                        user_id: user?.id,
                        // title: formData.title, // Removed
                        content: finalContent,
                        duration: durationMinutes,
                        obstacles: formData.project_category, // Storing category here
                        date: formData.date,
                        verification_status: 'submitted',
                        work_result: 'completed', // Default
                        mood: '😊' // Default
                    });

                if (error) throw error;
                toast({ title: "Journal Submitted", description: "Your journal has been successfully logged." });
            }

            // Refresh Data
            await queryClient.invalidateQueries({ queryKey: ['journals', 'employee', user?.id] });

        } catch (error: any) {
            console.error("Submit error:", error);
            toast({ variant: "destructive", title: "Error", description: error.message || "Failed to submit journal." });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Filter Logic (Simple implementation)
    const filteredJournals = journals.filter(j => {
        if (filterStatus === "This Month") {
            const date = new Date(j.date);
            const now = new Date();
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        }
        return true;
    });

    return (
        <div className={`min-h-screen pb-24 md:pb-12 ${isMobile ? 'bg-slate-50/50' : 'bg-slate-50/50 relative'} font-['Inter',sans-serif]`}>

            {/* Background Graphic Abstract - Subtle SaaS Effect */}
            <div className="absolute top-0 right-0 -z-0 w-[60vw] h-[40vh] bg-blue-100/40 rounded-full blur-[100px] pointer-events-none opacity-60 transform translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 left-0 -z-0 w-[40vw] h-[40vh] bg-purple-100/30 rounded-full blur-[100px] pointer-events-none opacity-60 transform -translate-x-1/2 translate-y-1/2"></div>

            {/* Mobile/Tablet Header Padding */}
            <div className={`
                 px-6 py-6 md:py-8 max-w-5xl mx-auto relative z-10
            `}>
                {/* Back Button */}
                <div className="mb-6">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/dashboard')}
                        className="text-slate-500 hover:text-slate-800 hover:bg-white/50 border border-transparent hover:border-slate-200/60 rounded-xl transition-all shadow-sm bg-white border-slate-100"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Kembali ke Dashboard
                    </Button>
                </div>

                {/* Page Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                    <div>
                        <h1 className="text-3xl lg:text-4xl font-extrabold text-slate-800 tracking-tight">Jurnal Kerja Saya</h1>
                        <p className="text-slate-500 font-medium text-sm mt-2 max-w-md">Catat dan pantau aktivitas kerjamu. Transparansi adalah kunci kolaborasi yang baik.</p>
                    </div>

                    <div className="flex items-center gap-4 bg-white/70 backdrop-blur-md px-5 py-3 rounded-2xl shadow-sm border border-white/40">
                        <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hari Ini</p>
                            <p className="text-sm font-extrabold text-slate-700">
                                {format(new Date(), "MMMM d, yyyy")}
                            </p>
                        </div>
                        <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100/50">
                            <Calendar className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                <div className="space-y-10">
                    {/* 1. Log Activity Form */}
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <DailyJournalForm
                            onSubmit={handleSubmit}
                            isSubmitting={isSubmitting}
                            // We could pass today's journal if it exists to edit it
                            initialData={journals.find(j => j.date === format(new Date(), "yyyy-MM-dd")) ? {
                                title: journals.find(j => j.date === format(new Date(), "yyyy-MM-dd"))?.title,
                                content: journals.find(j => j.date === format(new Date(), "yyyy-MM-dd"))?.content,
                                duration: (journals.find(j => j.date === format(new Date(), "yyyy-MM-dd"))?.duration || 0) / 60,
                                project_category: journals.find(j => j.date === format(new Date(), "yyyy-MM-dd"))?.project_category || journals.find(j => j.date === format(new Date(), "yyyy-MM-dd"))?.obstacles // Map obstacles back to category
                            } : undefined}
                        />
                    </div>

                    {/* 2. History Section */}
                    <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100 mt-12">
                        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200/50">
                            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Riwayat Log</h2>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="h-10 text-sm gap-2 bg-white/70 backdrop-blur-md border-white/40 shadow-sm hover:bg-white rounded-xl font-semibold text-slate-600 focus:ring-4 focus:ring-slate-100 transition-all">
                                        <Filter className="w-4 h-4" />
                                        Periode: <span className="font-extrabold text-slate-800">{filterStatus}</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-xl border border-slate-100 shadow-xl pb-1">
                                    <DropdownMenuItem onClick={() => setFilterStatus("This Month")} className="font-medium focus:bg-slate-50 py-2 cursor-pointer">Bulan Ini</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setFilterStatus("All Time")} className="font-medium focus:bg-slate-50 py-2 cursor-pointer">Semua Waktu</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        {isLoading ? (
                            <div className="space-y-4">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-40 bg-slate-100 rounded-xl animate-pulse" />
                                ))}
                            </div>
                        ) : filteredJournals.length === 0 ? (
                            <div className="text-center py-16 bg-white/40 backdrop-blur-sm rounded-[24px] border border-dashed border-slate-300 shadow-sm">
                                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <FolderOpen className="w-8 h-8 text-slate-400" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-700 mb-1">Belum Ada Catatan</h3>
                                <p className="text-slate-500 font-medium text-sm">Jurnal yang berhasil dikirim akan muncul di sini.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {filteredJournals.map((journal) => (
                                    <JournalHistoryCard
                                        key={journal.id}
                                        journal={{
                                            ...journal,
                                            project_category: journal.project_category || journal.obstacles // Map obstacles to category for display
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {isMobile && <MobileNavigation />}
        </div>
    );
}
