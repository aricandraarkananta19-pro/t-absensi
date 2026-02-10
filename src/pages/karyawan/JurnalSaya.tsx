
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
        <div className={`min-h-screen pb-24 md:pb-12 ${isMobile ? 'bg-white' : 'bg-slate-50/50'}`}>

            {/* Mobile/Tablet Header Padding */}
            <div className={`
                 px-6 py-6 md:py-8 max-w-5xl mx-auto
            `}>
                {/* Back Button */}
                <div className="mb-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/dashboard')}
                        className="text-slate-500 hover:text-slate-900 hover:bg-slate-100/50 pl-0 -ml-3"
                    >
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Back to Dashboard
                    </Button>
                </div>

                {/* Page Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">My Daily Journal</h1>
                        <p className="text-slate-500 mt-1">Track your progress and log your daily contributions.</p>
                    </div>

                    <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100">
                        <div className="text-right">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Today's Date</p>
                            <p className="text-sm font-semibold text-slate-900">
                                {format(new Date(), "MMMM d, yyyy")}
                            </p>
                        </div>
                        <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                            <Calendar className="w-5 h-5" />
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
                    <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-slate-900">My Journal History</h2>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="h-9 text-sm gap-2 bg-white border-slate-200">
                                        <Filter className="w-3.5 h-3.5" />
                                        Filter by: <span className="font-semibold text-slate-900">{filterStatus}</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => setFilterStatus("This Month")}>This Month</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setFilterStatus("All Time")}>All Time</DropdownMenuItem>
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
                            <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                <p className="text-slate-500 font-medium">No journals found for this period.</p>
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
