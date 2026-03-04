import { useState } from "react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Plus, Clock, CheckCircle2, FileText, ChevronDown, Calendar, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import MobileNavigation from "@/components/MobileNavigation";
import { JournalHistoryItem } from "@/components/journal/JournalHistoryCard";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { DailyJournalForm, DailyJournalFormData } from "@/components/journal/DailyJournalForm";

interface Props {
    journals: JournalHistoryItem[];
    filterStatus: string;
    setFilterStatus: (val: string) => void;
    onSubmit: (data: DailyJournalFormData) => Promise<void>;
    isSubmitting: boolean;
    todayJournalData: any;
}

const extractTitleAndContent = (rawContent: string) => {
    if (!rawContent) return { title: "", content: "" };
    const match = rawContent.match(/^\*\*(.*?)\*\*\n\n([\s\S]*)$/);
    if (match) {
        return { title: match[1], content: match[2] };
    }
    return { title: "", content: rawContent };
};

export default function JurnalSayaMobile({
    journals,
    filterStatus,
    setFilterStatus,
    onSubmit,
    isSubmitting,
    todayJournalData
}: Props) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "approved":
                return <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-green-50 text-green-600"><CheckCircle2 className="w-3 h-3" /> Disetujui</span>;
            case "submitted":
                return <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-600"><Send className="w-3 h-3" /> Terkirim</span>;
            default:
                return <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-yellow-50 text-yellow-600"><Clock className="w-3 h-3" /> Draf/Pending</span>;
        }
    };

    const filteredJournals = journals.filter(j => {
        if (filterStatus === "Bulan Ini") {
            const date = new Date(j.date);
            const now = new Date();
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        }
        return true;
    });

    const handleFormSubmit = async (data: DailyJournalFormData) => {
        await onSubmit(data);
        setIsDialogOpen(false);
    };

    return (
        <div className="flex flex-col min-h-screen bg-[#F8FAFC] pb-[100px] font-sans">
            {/* Premium Dark Header */}
            <div className="bg-[#0F172A] text-white pt-[max(env(safe-area-inset-top),32px)] pb-12 px-6 rounded-b-[40px] shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white dark:bg-slate-900/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                <div className="relative z-10 flex justify-between items-start mb-6">
                    <div>
                        <h1 className="text-xl font-bold tracking-tight mb-1">Log Kerja</h1>
                        <p className="text-sm font-medium text-slate-400">Catat pekerjaan harian Anda.</p>
                    </div>

                    <button
                        onClick={() => setFilterStatus(filterStatus === "Bulan Ini" ? "Semua" : "Bulan Ini")}
                        className="flex items-center gap-2 bg-white dark:bg-slate-900/10 px-3 py-1.5 rounded-full border border-white/10 active:scale-95 transition-transform"
                    >
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">{filterStatus}</span>
                    </button>
                </div>
            </div>

            <div className="px-6 -mt-8 relative z-20">

                {/* List of Journals */}
                <div className="space-y-4">
                    {filteredJournals.length === 0 ? (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-100 dark:border-slate-800 text-center flex flex-col items-center justify-center shadow-sm">
                            <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                                <FileText className="w-6 h-6 text-slate-400" />
                            </div>
                            <span className="text-sm font-bold text-[#0F172A]">Belum Ada Log Kerja</span>
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Anda belum mencatat apapun di periode ini.</span>
                        </div>
                    ) : (
                        filteredJournals.map((journal) => {
                            const { title, content } = extractTitleAndContent(journal.content);
                            const formattedDate = format(new Date(journal.date), 'EEEE, d MMM yyyy', { locale: idLocale });
                            const isToday = journal.date === format(new Date(), 'yyyy-MM-dd');

                            return (
                                <div key={journal.id} className="bg-white dark:bg-slate-900 p-5 rounded-[20px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 dark:border-slate-800 relative group overflow-hidden">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <span className={cn(
                                                "text-[10px] font-bold uppercase tracking-wider mb-1 block",
                                                isToday ? "text-[#2563EB]" : "text-slate-400"
                                            )}>
                                                {isToday ? "Hari Ini" : formattedDate}
                                            </span>
                                            <h4 className="font-bold text-[#0F172A] text-sm leading-snug pr-4">
                                                {title || journal.project_category || "Log Kerja Harian"}
                                            </h4>
                                        </div>
                                        {getStatusBadge(journal.verification_status || 'submitted')}
                                    </div>

                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium line-clamp-2 leading-relaxed mb-3">
                                        {content}
                                    </p>

                                    <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider pt-3 border-t border-slate-50">
                                        <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-slate-300" /> {Math.floor((journal.duration || 0) / 60)} Jam {Math.round((journal.duration || 0) % 60)} Menit</span>
                                        <span className="flex items-center gap-1.5 text-slate-300">• {(journal as any).mood || '😊'}</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Floating Action Button */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                    <button className="fixed bottom-[100px] right-6 w-14 h-14 bg-[#2563EB] text-white rounded-full flex items-center justify-center shadow-[0_8px_20px_rgba(37,99,235,0.4)] hover:bg-[#1E40AF] active:scale-95 transition-all z-50 focus:outline-none">
                        <Plus className="w-6 h-6" />
                    </button>
                </DialogTrigger>
                <DialogContent className="max-w-[400px] mx-auto p-0 rounded-[24px] bg-slate-50 dark:bg-slate-800 sm:max-h-[90vh] overflow-y-auto w-[90%] left-1/2 -translate-x-1/2 border-none">
                    <div className="p-6">
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 tracking-tight">Tambah Log Pekerjaan</h2>
                        <DailyJournalForm
                            onSubmit={handleFormSubmit}
                            isSubmitting={isSubmitting}
                            initialData={todayJournalData}
                        />
                    </div>
                </DialogContent>
            </Dialog>

            <MobileNavigation />
        </div>
    );
}
