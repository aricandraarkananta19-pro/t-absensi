
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, BookOpen, ChevronRight, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface WorkInsightProps {
    userId?: string;
}

export function WorkInsightWidget({ userId }: WorkInsightProps) {
    const navigate = useNavigate();
    const [journalStats, setJournalStats] = useState({
        total: 0,
        completed: 0,
        pending: 0,
        streak: 0
    });
    const [recentJournals, setRecentJournals] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (userId) {
            fetchStats();
        }
    }, [userId]);

    const fetchStats = async () => {
        try {
            const today = new Date();
            const startOfWeek = new Date(today.getDate() - today.getDay()); // Sunday

            // Fetch Recent Journals
            const { data: recent } = await supabase
                .from('work_journals' as any)
                .select('*')
                .eq('user_id', userId)
                .order('date', { ascending: false })
                .limit(3);

            if (recent) setRecentJournals(recent);

            // Simple mock stats for now (replace with real aggregation later)
            setJournalStats({
                total: recent?.length || 0,
                completed: recent?.length || 0, // Mock
                pending: 0, // Needs attendance comparison to be accurate
                streak: 3 // Mock
            });

        } catch (error) {
            console.error("Error fetching journal stats:", error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return <div className="h-32 w-full animate-pulse bg-slate-100 rounded-xl" />;
    }

    return (
        <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
            <CardHeader className="pb-3 border-b border-slate-50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-50 rounded-lg">
                            <BookOpen className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div>
                            <CardTitle className="text-base text-slate-800">Work Insights</CardTitle>
                            <CardDescription className="text-xs">Jurnal aktivitas harian</CardDescription>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50" onClick={() => navigate('/karyawan/jurnal')}>
                        See All <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="pt-4">
                {recentJournals.length === 0 ? (
                    <div className="text-center py-6 text-slate-500">
                        <Sparkles className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                        <p className="text-sm">Belum ada jurnal minggu ini.</p>
                        <Button variant="link" className="text-indigo-600 text-xs mt-1" onClick={() => navigate('/karyawan/absensi')}>
                            Mulai Journaling dari Clock Out
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {recentJournals.map((journal) => (
                            <div key={journal.id} className="group flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 cursor-pointer" onClick={() => navigate('/karyawan/jurnal')}>
                                <div className="mt-1">
                                    {journal.verification_status === 'approved' ? (
                                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    ) : journal.verification_status === 'reviewed' ? (
                                        <CheckCircle2 className="h-4 w-4 text-blue-500" />
                                    ) : (
                                        <AlertCircle className="h-4 w-4 text-amber-500" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-900 line-clamp-1 group-hover:text-indigo-700 transition-colors">
                                        {journal.content}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                            {new Date(journal.date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                                        </span>
                                        {journal.duration > 0 && (
                                            <span className="text-[10px] text-slate-400">
                                                • {Math.floor(journal.duration / 60)}h {journal.duration % 60}m
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Mock AI Insight (Future Phase) */}
                {recentJournals.length > 0 && (
                    <div className="mt-4 bg-gradient-to-r from-indigo-50 to-blue-50 p-3 rounded-lg border border-indigo-100 flex gap-3">
                        <Sparkles className="h-4 w-4 text-indigo-600 mt-0.5 shrink-0" />
                        <p className="text-xs text-slate-600 leading-snug">
                            <span className="font-semibold text-indigo-700">AI Summary:</span> Minggu ini fokus utama Anda adalah perbaikan bug sistem (60%) dan meeting koordinasi (20%). Kerja bagus!
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
