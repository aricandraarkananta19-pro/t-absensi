
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
    Calendar as CalendarIcon, Clock as ClockIcon, CheckCircle2, XCircle,
    MessageSquare, AlertCircle, Filter, MoreHorizontal
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
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

interface JournalEntry {
    id: string;
    content: string;
    date: string;
    duration: number;
    user_id: string;
    verification_status: string; // submitted, approved, reviewed, rejected
    manager_notes?: string;
    profiles: {
        full_name: string;
        avatar_url: string | null;
        department: string | null;
        position: string | null;
    };
}

const ManagerJurnal = () => {
    const { user } = useAuth();
    const [journals, setJournals] = useState<JournalEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");

    // Review Modal State
    const [selectedJournal, setSelectedJournal] = useState<JournalEntry | null>(null);
    const [reviewNote, setReviewNote] = useState("");
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchJournals();
    }, []);

    const fetchJournals = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('work_journals' as any)
                .select(`
                    *,
                    profiles:user_id (
                        full_name,
                        avatar_url,
                        department,
                        position
                    )
                `)
                .order('date', { ascending: false });

            if (error) throw error;

            if (data) {
                const typedData = data as unknown as JournalEntry[];
                setJournals(typedData);
            }
        } catch (error) {
            console.error("Error fetching journals:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenReview = (journal: JournalEntry) => {
        setSelectedJournal(journal);
        setReviewNote(journal.manager_notes || "");
        setIsReviewOpen(true);
    };

    const handleSubmitReview = async (status: 'approved' | 'rejected' | 'reviewed') => {
        if (!selectedJournal) return;
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
                title: status === 'approved' ? "Jurnal Disetujui" : "Jurnal Direview",
                description: "Status jurnal telah diperbarui.",
            });

            // Optimistic update
            setJournals(prev => prev.map(j =>
                j.id === selectedJournal.id
                    ? { ...j, verification_status: status, manager_notes: reviewNote }
                    : j
            ));

            setIsReviewOpen(false);
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Gagal Mengupdate",
                description: error.message
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const getInitials = (name: string) => {
        return name.split(" ").map(n => n.charAt(0)).slice(0, 2).join("").toUpperCase();
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved':
                return <Badge className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100">Disetujui</Badge>;
            case 'rejected':
                return <Badge className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100">Ditolak</Badge>;
            case 'reviewed':
                return <Badge className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100">Direview</Badge>;
            default:
                return <Badge variant="outline" className="text-slate-500 border-slate-200">Menunggu</Badge>;
        }
    };

    const filteredJournals = journals.filter(journal => {
        const matchesSearch =
            journal.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            journal.content.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = filterStatus === 'all' || journal.verification_status === filterStatus;

        return matchesSearch && matchesStatus;
    });

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

    const stats = {
        total: journals.length,
        pending: journals.filter(j => j.verification_status === 'submitted').length,
        approved: journals.filter(j => j.verification_status === 'approved').length
    };

    return (
        <EnterpriseLayout
            title="Jurnal Tim"
            subtitle="Review & monitoring aktivitas harian"
            menuSections={menuSections}
            roleLabel="Manager"
            showRefresh={true}
            onRefresh={fetchJournals}
        >
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card className="bg-white shadow-sm border-slate-200">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500 font-medium">Total Entri</p>
                            <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg">
                            <BookOpen className="w-5 h-5 text-slate-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white shadow-sm border-slate-200">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500 font-medium">Perlu Review</p>
                            <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
                        </div>
                        <div className="p-3 bg-amber-50 rounded-lg">
                            <AlertCircle className="w-5 h-5 text-amber-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white shadow-sm border-slate-200">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500 font-medium">Disetujui</p>
                            <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
                        </div>
                        <div className="p-3 bg-green-50 rounded-lg">
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-4 border-b border-slate-200 mb-6">
                <button
                    onClick={() => setFilterStatus('all')} // Reset to list view
                    className={`pb-3 text-sm font-medium transition-colors relative ${filterStatus !== 'summary' ? "text-blue-600" : "text-slate-500 hover:text-slate-700"
                        }`}
                >
                    Entri Jurnal
                    {filterStatus !== 'summary' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
                    )}
                </button>
                <button
                    onClick={() => setFilterStatus('summary')}
                    className={`pb-3 text-sm font-medium transition-colors relative ${filterStatus === 'summary' ? "text-blue-600" : "text-slate-500 hover:text-slate-700"
                        }`}
                >
                    Rekap & Insight
                    {filterStatus === 'summary' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
                    )}
                </button>
            </div>

            {filterStatus === 'summary' ? (
                <div className="space-y-6">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 text-center">
                        <BarChart3 className="w-12 h-12 text-blue-200 mx-auto mb-3" />
                        <h3 className="text-lg font-semibold text-blue-900">Weekly Insight</h3>
                        <p className="text-blue-600/80 max-w-sm mx-auto mt-1 mb-4">
                            Fitur analitik mingguan sedang disiapkan. Anda akan dapat melihat tren produktivitas tim di sini.
                        </p>
                        <Button variant="outline" className="border-blue-200 text-blue-600 bg-white" onClick={() => setFilterStatus('all')}>
                            Kembali ke Daftar Entri
                        </Button>
                    </div>
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
                            <Button
                                variant={filterStatus === 'all' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setFilterStatus('all')}
                                className={filterStatus === 'all' ? "bg-slate-800 hover:bg-slate-700" : "text-slate-600"}
                            >
                                Semua
                            </Button>
                            <Button
                                variant={filterStatus === 'submitted' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setFilterStatus('submitted')}
                                className={filterStatus === 'submitted' ? "bg-amber-600 hover:bg-amber-700 border-amber-600" : "text-slate-600"}
                            >
                                Menunggu
                            </Button>
                            <Button
                                variant={filterStatus === 'approved' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setFilterStatus('approved')}
                                className={filterStatus === 'approved' ? "bg-green-600 hover:bg-green-700 border-green-600" : "text-slate-600"}
                            >
                                Disetujui
                            </Button>
                        </div>
                    </div>
                </>
            )}

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
                        <div key={journal.id} className="group relative bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all">
                            <div className="absolute top-4 right-4">
                                {journal.verification_status === 'submitted' && (
                                    <Button size="sm" onClick={() => handleOpenReview(journal)} className="bg-blue-600 text-white hover:bg-blue-700 shadow-sm h-8 text-xs">
                                        Review
                                    </Button>
                                )}
                                {journal.verification_status !== 'submitted' && (
                                    <div className="flex items-center gap-2">
                                        {getStatusBadge(journal.verification_status)}
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" onClick={() => handleOpenReview(journal)}>
                                            <MoreHorizontal className="w-4 h-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-4">
                                <Avatar className="h-10 w-10 border border-slate-100">
                                    <AvatarImage src={journal.profiles?.avatar_url || ""} />
                                    <AvatarFallback className="bg-blue-50 text-blue-600 font-semibold">{getInitials(journal.profiles?.full_name || "")}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 pr-24">
                                    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 mb-2">
                                        <h4 className="text-sm font-bold text-slate-800">{journal.profiles?.full_name}</h4>
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <span>{journal.profiles?.position || "Staff"}</span>
                                            <span>•</span>
                                            <span className="flex items-center gap-1">
                                                <CalendarIcon className="w-3 h-3" />
                                                {format(new Date(journal.date), "d MMM yyyy", { locale: id })}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                        {journal.content}
                                    </div>

                                    {(journal.manager_notes) && (
                                        <div className="mt-3 flex items-start gap-2 bg-yellow-50/50 p-2.5 rounded-lg border border-yellow-100">
                                            <MessageSquare className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
                                            <div>
                                                <p className="text-xs font-semibold text-yellow-700">Catatan:</p>
                                                <p className="text-xs text-slate-600">{journal.manager_notes}</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
                                        <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded">
                                            <ClockIcon className="w-3 h-3" />
                                            {Math.floor(journal.duration / 60)}j {journal.duration % 60}m
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Review Modal */}
            <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Review Jurnal Kerja</DialogTitle>
                        <DialogDescription>
                            Berikan feedback atau setujui laporan aktivitas ini.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedJournal && (
                        <div className="space-y-4 py-4">
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 max-h-60 overflow-y-auto">
                                <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedJournal.content}</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Catatan Manager (Opsional)</label>
                                <Textarea
                                    placeholder="Tulis pesan untuk karyawan..."
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
                            {/* <Button 
                                variant="destructive" 
                                onClick={() => handleSubmitReview('rejected')} 
                                disabled={isSubmitting}
                                className="flex-1 sm:flex-none"
                            >
                                Tolak
                            </Button> */}
                            <Button
                                onClick={() => handleSubmitReview('approved')}
                                disabled={isSubmitting}
                                className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white"
                            >
                                {isSubmitting ? "Menyimpan..." : "Setujui"}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </EnterpriseLayout>
    );
};

export default ManagerJurnal;
