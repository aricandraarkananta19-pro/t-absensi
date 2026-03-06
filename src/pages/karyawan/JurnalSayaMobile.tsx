import { useState } from "react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Plus, Clock, CheckCircle2, FileText, Calendar, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import MobileNavigation from "@/components/MobileNavigation";
import { JournalHistoryItem } from "@/components/journal/JournalHistoryCard";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { DailyJournalForm, DailyJournalFormData } from "@/components/journal/DailyJournalForm";
import { useTheme } from "@/contexts/ThemeContext";

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

const getCategoryBadge = (category: string) => {
    const defaultBadge = { emoji: "📝", label: "Pekerjaan", bg: "bg-slate-100/80 text-slate-600 border-slate-200" };
    if (!category) return defaultBadge;

    const catLower = category.toLowerCase();
    if (catLower.includes('dev') || catLower.includes('code')) return { emoji: "👨‍💻", label: "Development", bg: "bg-blue-50/80 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200/50 dark:border-blue-500/20" };
    if (catLower.includes('meet') || catLower.includes('rapat')) return { emoji: "🤝", label: "Meeting", bg: "bg-purple-50/80 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200/50 dark:border-purple-500/20" };
    if (catLower.includes('design') || catLower.includes('desain')) return { emoji: "🎨", label: "Design", bg: "bg-pink-50/80 dark:bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-200/50 dark:border-pink-500/20" };
    if (catLower.includes('learn') || catLower.includes('belajar')) return { emoji: "📚", label: "Learning", bg: "bg-amber-50/80 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200/50 dark:border-amber-500/20" };

    return defaultBadge;
};

export default function JurnalSayaMobile({
    journals,
    filterStatus,
    setFilterStatus,
    onSubmit,
    isSubmitting,
    todayJournalData
}: Props) {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const { isDark } = useTheme();

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "approved":
                return <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/20 shadow-sm"><CheckCircle2 className="w-3 h-3" /> Disetujui</span>;
            case "submitted":
                return <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-500/20 shadow-sm"><Send className="w-3 h-3" /> Terkirim</span>;
            default:
                return <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200/50 dark:border-amber-500/20 shadow-sm"><Clock className="w-3 h-3" /> Pending</span>;
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
        setIsDrawerOpen(false);
    };

    return (
        <div className={cn("flex flex-col min-h-screen pb-[120px] font-sans animate-in fade-in slide-in-from-bottom-4 duration-500", isDark ? "bg-[#0F172A]" : "bg-[#F8FAFC]")}>
            {/* Premium Header */}
            <div className={cn("text-white pt-[max(env(safe-area-inset-top),32px)] pb-12 px-6 rounded-b-[40px] shadow-lg relative overflow-hidden", isDark ? "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-b border-slate-800/80" : "bg-gradient-to-br from-[#0F172A] to-[#1e293b]")}>
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                <div className="relative z-10 flex justify-between items-start mb-2">
                    <div>
                        <h1 className="text-[26px] font-black tracking-tighter mb-1">Jurnal Timeline</h1>
                        <p className="text-sm font-semibold text-slate-400">Jejak aktivitas harian Anda.</p>
                    </div>

                    <button
                        onClick={() => setFilterStatus(filterStatus === "Bulan Ini" ? "Semua" : "Bulan Ini")}
                        className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 active:scale-95 transition-transform"
                    >
                        <Calendar className="w-3.5 h-3.5 text-indigo-300" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-100">{filterStatus}</span>
                    </button>
                </div>
            </div>

            <div className="px-5 -mt-6 relative z-20">
                {/* Timeline Layout */}
                <div className={cn("space-y-0 relative", journals.length > 0 && "before:absolute before:inset-y-4 before:left-[17px] before:w-[2px] before:bg-gradient-to-b before:from-indigo-500/50 before:via-slate-200 dark:before:via-slate-700/50 before:to-transparent")}>
                    {filteredJournals.length === 0 ? (
                        <div className={cn("rounded-[32px] p-8 mt-6 border text-center flex flex-col items-center justify-center shadow-lg backdrop-blur-xl relative overflow-hidden", isDark ? "bg-slate-800/80 border-slate-700/50" : "bg-white/90 border-slate-200/50")}>
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                            <div className={cn("w-16 h-16 rounded-[20px] flex items-center justify-center mb-4 rotate-3 shadow-sm", isDark ? "bg-slate-700/80" : "bg-indigo-50")}>
                                <FileText className={cn("w-8 h-8", isDark ? "text-slate-400" : "text-indigo-500")} />
                            </div>
                            <span className={cn("text-base font-black tracking-tight", isDark ? "text-white" : "text-slate-800")}>Belum Ada Cerita Hari Ini</span>
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-2">Ketuk tombol + untuk mulai menulis jurnal.</span>
                        </div>
                    ) : (
                        filteredJournals.map((journal, index) => {
                            const { title, content } = extractTitleAndContent(journal.content);
                            const formattedDate = format(new Date(journal.date), 'EEEE, d MMM', { locale: idLocale });
                            const isToday = journal.date === format(new Date(), 'yyyy-MM-dd');
                            const badgeInfo = getCategoryBadge(journal.project_category || title);

                            return (
                                <div key={journal.id} className="relative pl-12 py-3 group">
                                    {/* Timeline Node */}
                                    <div className={cn(
                                        "absolute left-[12px] top-6 w-3 h-3 rounded-full border-2 shadow-[0_0_10px_rgba(0,0,0,0.1)] z-10 transition-transform group-hover:scale-125",
                                        isToday ? "bg-indigo-500 border-white dark:border-slate-900 shadow-indigo-500/40" : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600"
                                    )} />

                                    <div className={cn("p-5 rounded-[24px] shadow-[0_8px_30px_rgba(0,0,0,0.04)] border relative overflow-hidden transition-all active:scale-[0.98]", isDark ? "bg-slate-800/90 backdrop-blur-md border-slate-700/50" : "bg-white/90 backdrop-blur-md border-slate-200/50")}>
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-2">
                                                {/* Glass Category Pill */}
                                                <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-xl border backdrop-blur-md", badgeInfo.bg)}>
                                                    <span className="text-xs">{badgeInfo.emoji}</span>
                                                    <span className="text-[10px] font-black uppercase tracking-widest">{badgeInfo.label}</span>
                                                </div>
                                                <span className={cn(
                                                    "text-[10px] font-bold uppercase tracking-wider ml-1",
                                                    isToday ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"
                                                )}>
                                                    {isToday ? "Hari Ini" : formattedDate}
                                                </span>
                                            </div>
                                            {getStatusBadge(journal.verification_status || 'submitted')}
                                        </div>

                                        {title && <h4 className={cn("font-black text-[15px] leading-snug mb-2 tracking-tight", isDark ? "text-white" : "text-slate-800")}>{title}</h4>}

                                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-4">
                                            {content}
                                        </p>

                                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest pt-3 border-t border-slate-100 dark:border-slate-700/50">
                                            <span className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/50 px-2.5 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800"><Clock className="w-3.5 h-3.5 text-indigo-400" /> {Math.floor((journal.duration || 0) / 60)}j {Math.round((journal.duration || 0) % 60)}m</span>
                                            <span className="flex items-center gap-1.5 text-2xl drop-shadow-sm">{(journal as any).mood || '😎'}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Bouncy Bottom Sheet using Vaul Drawer */}
            <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
                <DrawerTrigger asChild>
                    <button className="fixed bottom-[110px] right-6 w-[60px] h-[60px] bg-indigo-600 text-white rounded-[22px] rotate-3 hover:rotate-0 flex items-center justify-center shadow-[0_12px_30px_rgba(79,70,229,0.4)] hover:bg-indigo-500 active:scale-90 transition-all z-50 focus:outline-none focus:ring-4 focus:ring-indigo-500/20">
                        <Plus className="w-7 h-7" />
                    </button>
                </DrawerTrigger>
                <DrawerContent className={cn("p-0 rounded-t-[32px] border-none shadow-[0_-20px_60px_rgba(0,0,0,0.1)]", isDark ? "bg-slate-900" : "bg-white")}>
                    <div className="px-6 pb-8 pt-4">
                        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
                        <h2 className={cn("text-2xl font-black mb-1 tracking-tight", isDark ? "text-white" : "text-slate-800")}>Tambah Log</h2>
                        <p className="text-sm font-semibold text-slate-500 mb-6">Ceritakan pencapaian Anda hari ini.</p>

                        <div className="max-h-[70vh] overflow-y-auto px-1 pb-4 hide-scrollbar">
                            <DailyJournalForm
                                onSubmit={handleFormSubmit}
                                isSubmitting={isSubmitting}
                                initialData={todayJournalData}
                            />
                        </div>
                    </div>
                </DrawerContent>
            </Drawer>

            <MobileNavigation />

            <style>{`
                .hide-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .hide-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
}
