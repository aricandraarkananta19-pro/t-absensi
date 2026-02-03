
import { useState, useEffect } from "react";
import {
    BookOpen, Calendar, Clock, CheckCircle2, AlertCircle,
    Filter, Search, ChevronLeft, ChevronRight, MoreHorizontal, Plus, PenClassName
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import MobileNavigation from "@/components/MobileNavigation";
import { useIsMobile } from "@/hooks/useIsMobile";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

// Brand Colors from Design System
const BRAND_COLORS = {
    blue: "#1A5BA8",
    lightBlue: "#00A0E3",
    green: "#7DC242",
};

interface JournalEntry {
    id: string;
    content: string;
    date: string;
    duration: number;
    status: string;
    verification_status: string;
    manager_notes?: string;
    created_at: string;
}

export default function JurnalSaya() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const [journals, setJournals] = useState<JournalEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState("all");

    // New Journal State
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newJournalContent, setNewJournalContent] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (user) fetchJournals();
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
            if (data) setJournals(data as unknown as JournalEntry[]);
        } catch (error) {
            console.error("Error fetching journals:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateJournal = async () => {
        if (!newJournalContent.trim()) {
            toast({ variant: "destructive", title: "Gagal", description: "Konten jurnal tidak boleh kosong" });
            return;
        }
        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('work_journals' as any)
                .insert({
                    user_id: user?.id,
                    content: newJournalContent,
                    date: new Date().toISOString().split('T')[0],
                    duration: 0, // Default 0 for manual entries not tied to clock out
                    status: 'completed',
                    verification_status: 'submitted'
                });

            if (error) throw error;

            toast({ title: "Berhasil", description: "Jurnal berhasil ditambahkan" });
            setNewJournalContent("");
            setIsAddOpen(false);
            fetchJournals();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Gagal Mengirim", description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved':
                return <Badge className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 uppercase text-[10px]">Disetujui</Badge>;
            case 'reviewed':
                return <Badge className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 uppercase text-[10px]">Direview</Badge>;
            default: // submitted
                return <Badge className="bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 uppercase text-[10px]">Terkirim</Badge>;
        }
    };

    const stats = {
        total: journals.length,
        approved: journals.filter(j => j.verification_status === 'approved').length,
        pending: journals.filter(j => j.verification_status === 'submitted').length
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-24 md:pb-8">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 py-4 md:px-6 md:py-5">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Jurnal Aktivitas</h1>
                        <p className="text-xs text-slate-500 mt-1">Rekap harian aktivitas kerja Anda</p>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => setIsAddOpen(true)} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                            <Plus className="w-4 h-4" />
                            {!isMobile && "Tulis Jurnal"}
                        </Button>
                        {!isMobile && (
                            <Button onClick={() => navigate('/karyawan/dashboard')} variant="outline" size="sm">
                                Kembali
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 py-6 md:px-6 space-y-6">

                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                    <Card className="border-slate-200 shadow-sm">
                        <CardContent className="p-4 flex flex-col justify-center h-full">
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Total Jurnal</p>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-2xl font-bold text-slate-900">{stats.total}</span>
                                <span className="text-xs text-slate-400">Entri</span>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-slate-200 shadow-sm">
                        <CardContent className="p-4 flex flex-col justify-center h-full">
                            <p className="text-xs text-green-600 font-medium uppercase tracking-wide">Disetujui</p>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-2xl font-bold text-slate-900">{stats.approved}</span>
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="col-span-2 md:col-span-1 border-slate-200 shadow-sm">
                        <CardContent className="p-4 flex flex-col justify-center h-full">
                            <p className="text-xs text-amber-600 font-medium uppercase tracking-wide">Menunggu</p>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-2xl font-bold text-slate-900">{stats.pending}</span>
                                <AlertCircle className="w-4 h-4 text-amber-500" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <div className="flex items-center justify-between gap-4 overflow-x-auto pb-2 md:pb-0">
                    <div className="flex gap-2">
                        {['all', 'submitted', 'approved'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`px-4 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap ${filterStatus === status
                                        ? "bg-slate-800 text-white shadow-md"
                                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                                    }`}
                            >
                                {status === 'all' ? 'Semua' : status === 'submitted' ? 'Menunggu' : 'Disetujui'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content List */}
                {isLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-200 rounded-xl animate-pulse" />)}
                    </div>
                ) : journals.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <BookOpen className="w-8 h-8 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-800">Belum ada jurnal</h3>
                        <p className="text-slate-500 max-w-xs mx-auto mt-2 text-sm mb-4">
                            Dokumentasikan pekerjaan Anda hari ini.
                        </p>
                        <Button onClick={() => setIsAddOpen(true)} variant="outline" className="border-blue-200 text-blue-600 hover:bg-blue-50">
                            Tulis Jurnal Pertama
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {journals
                            .filter(j => filterStatus === 'all' || j.verification_status === filterStatus)
                            .map((journal) => (
                                <Card key={journal.id} className="border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
                                    <CardContent className="p-0">
                                        <div className="flex">
                                            {/* Date Strip */}
                                            <div className="w-16 md:w-20 bg-slate-50 border-r border-slate-100 flex flex-col items-center justify-start py-4 shrink-0">
                                                <span className="text-xs font-bold text-slate-500 uppercase">
                                                    {format(new Date(journal.date), "MMM", { locale: id })}
                                                </span>
                                                <span className="text-xl md:text-2xl font-bold text-slate-800 mt-1">
                                                    {format(new Date(journal.date), "dd")}
                                                </span>
                                                <span className="text-[10px] text-slate-400 mt-1">
                                                    {format(new Date(journal.date), "eee", { locale: id })}
                                                </span>
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 p-4 md:p-5">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex items-center gap-2">
                                                        {getStatusBadge(journal.verification_status)}
                                                        {/* If duration is 0 (manual entry), don't show duration chip or show 'Manual' */}
                                                        {journal.duration > 0 ? (
                                                            <span className="text-[10px] text-slate-400 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-md">
                                                                <Clock className="w-3 h-3" />
                                                                {Math.floor(journal.duration / 60)}h {journal.duration % 60}m
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] text-slate-400 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-md">
                                                                <BookOpen className="w-3 h-3" /> Manual
                                                            </span>
                                                        )}
                                                    </div>
                                                    {/* Manager Notes Badge */}
                                                    {journal.manager_notes && (
                                                        <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-600 bg-blue-50">
                                                            1 Catatan Mgr
                                                        </Badge>
                                                    )}
                                                </div>

                                                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                                    {journal.content}
                                                </p>

                                                {/* Manager Feedback Section */}
                                                {journal.manager_notes && (
                                                    <div className="mt-4 p-3 bg-blue-50/50 border border-blue-100 rounded-lg text-sm">
                                                        <p className="text-xs font-semibold text-blue-700 mb-1">Catatan Manager:</p>
                                                        <p className="text-slate-600">{journal.manager_notes}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                    </div>
                )}
            </div>

            {/* Add Journal Modal */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Tulis Jurnal Aktivitas</DialogTitle>
                        <DialogDescription>
                            Catat pekerjaan yang Anda selesaikan hari ini.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Aktivitas Hari Ini</Label>
                            <Textarea
                                placeholder="Jelaskan apa saja yang Anda kerjakan..."
                                className="min-h-[150px]"
                                value={newJournalContent}
                                onChange={(e) => setNewJournalContent(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddOpen(false)} disabled={isSubmitting}>Batal</Button>
                        <Button onClick={handleCreateJournal} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
                            {isSubmitting ? "Menyimpan..." : "Simpan Jurnal"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {isMobile && <MobileNavigation />}
        </div>
    );
}
