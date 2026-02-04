
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
    MessageSquare, AlertCircle, Filter, MoreHorizontal, TrendingUp, Users, CheckSquare
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
import { format, startOfWeek, endOfWeek, isWithinInterval, subWeeks } from "date-fns";
import { id } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

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
    const [selectedWeek, setSelectedWeek] = useState(new Date());

    // Review Modal State
    const [selectedJournal, setSelectedJournal] = useState<JournalEntry | null>(null);
    const [reviewNote, setReviewNote] = useState("");
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchJournals();

        const channel = supabase
            .channel('manager-journal-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'work_journals'
                },
                () => {
                    fetchJournals();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchJournals = async () => {
        setIsLoading(true);
        try {
            console.log('Manager: Fetching journals...');

            // Simple query without join
            const { data: simpleData, error: simpleError } = await supabase
                .from('work_journals')
                .select('*')
                .order('date', { ascending: false });

            console.log('Manager query result:', { data: simpleData, error: simpleError });

            if (simpleError) {
                console.error('Query error:', simpleError);
                throw simpleError;
            }

            if (simpleData && simpleData.length > 0) {
                // Get unique user IDs
                const userIds = [...new Set(simpleData.map(j => j.user_id))];

                // Fetch profiles separately
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('user_id, full_name, avatar_url, department, position')
                    .in('user_id', userIds);

                const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

                const enrichedData = simpleData.map(journal => ({
                    ...journal,
                    profiles: profileMap.get(journal.user_id) || {
                        full_name: 'Unknown',
                        avatar_url: null,
                        department: null,
                        position: null
                    }
                }));

                console.log('Manager enriched data:', enrichedData);
                setJournals(enrichedData as unknown as JournalEntry[]);
            } else {
                console.log('Manager: No journals found');
                setJournals([]);
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

    const handleSubmitReview = async (status: 'approved' | 'need_revision') => {
        if (!selectedJournal) return;

        // Enforce mandatory notes for Revision
        if (status === 'need_revision' && !reviewNote.trim()) {
            toast({
                variant: "destructive",
                title: "Gagal Menyimpan",
                description: "Catatan wajib diisi jika meminta revisi."
            });
            return;
        }

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
                title: status === 'approved' ? "Jurnal Disetujui" : "Permintaan Revisi Terkirim",
                description: status === 'approved'
                    ? "Status jurnal telah diperbarui menjadi Disetujui."
                    : "Karyawan akan menerima notifikasi untuk merevisi jurnal.",
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
                return <Badge className="bg-green-50 text-green-700 border-green-200">Disetujui</Badge>;
            case 'need_revision':
            case 'rejected': // legacy
                return <Badge className="bg-orange-50 text-orange-700 border-orange-200">Perlu Revisi</Badge>;
            case 'submitted':
                return <Badge className="bg-blue-50 text-blue-700 border-blue-200">Menunggu</Badge>;
            default:
                return <Badge variant="outline" className="text-slate-400">{status}</Badge>;
        }
    };

    const filteredJournals = journals.filter(journal => {
        const fullName = journal.profiles?.full_name || '';
        const content = journal.content || '';

        const matchesSearch =
            fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            content.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = filterStatus === 'all' || filterStatus === 'summary' || journal.verification_status === filterStatus;

        return matchesSearch && matchesStatus;
    });

    // Weekly Analytics Logic
    const getWeeklyStats = () => {
        const start = startOfWeek(selectedWeek, { weekStartsOn: 1 });
        const end = endOfWeek(selectedWeek, { weekStartsOn: 1 });

        const weeklyJournals = journals.filter(j =>
            isWithinInterval(new Date(j.date), { start, end })
        );

        const uniqueUsers = new Set(weeklyJournals.map(j => j.user_id));
        const approvedCount = weeklyJournals.filter(j => j.verification_status === 'approved').length;

        // Activity per Day for Chart
        const dailyActivity = [0, 1, 2, 3, 4, 5, 6].map(offset => {
            const date = new Date(start);
            date.setDate(start.getDate() + offset);
            const dateStr = format(date, 'yyyy-MM-dd');
            const count = weeklyJournals.filter(j => j.date === dateStr).length;
            return {
                day: format(date, 'EEE', { locale: id }),
                entries: count
            };
        });

        // Top 3 Contributors
        const userCounts: Record<string, { count: number, name: string, avatar: string | null }> = {};
        weeklyJournals.forEach(j => {
            if (!userCounts[j.user_id]) {
                userCounts[j.user_id] = {
                    count: 0,
                    name: j.profiles?.full_name || 'Unknown',
                    avatar: j.profiles?.avatar_url || null
                };
            }
            userCounts[j.user_id].count += 1;
        });

        const sortedContributors = Object.values(userCounts)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        return {
            total: weeklyJournals.length,
            activeUsers: uniqueUsers.size,
            approvalRate: weeklyJournals.length > 0 ? Math.round((approvedCount / weeklyJournals.length) * 100) : 0,
            dailyActivity,
            sortedContributors
        };
    };

    const weeklyStats = getWeeklyStats();

    const pendingCount = journals.filter(j => j.verification_status === 'submitted').length;
    const approvedCountGlobal = journals.filter(j => j.verification_status === 'approved').length;

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

    return (
        <EnterpriseLayout
            title="Jurnal Tim"
            subtitle="Review & monitoring aktivitas harian"
            menuSections={menuSections}
            roleLabel="Manager"
            showRefresh={true}
            onRefresh={fetchJournals}
        >
            {/* Stats Cards (Operational Focus) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card className="bg-white shadow-sm border-slate-200">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-500 font-medium">Total Entri</p>
                            <p className="text-2xl font-bold text-slate-800">{journals.length}</p>
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
                            <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
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
                            <p className="text-2xl font-bold text-green-600">{approvedCountGlobal}</p>
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
                    {/* Weekly Analytics Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <h3 className="text-lg font-bold text-slate-800">
                            Ringkasan Mingguan: {format(startOfWeek(selectedWeek, { weekStartsOn: 1 }), "d MMM", { locale: id })} - {format(endOfWeek(selectedWeek, { weekStartsOn: 1 }), "d MMM yyyy", { locale: id })}
                        </h3>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => setSelectedWeek(d => subWeeks(d, 1))}>
                                Minggu Lalu
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setSelectedWeek(new Date())}>
                                Minggu Ini
                            </Button>
                        </div>
                    </div>

                    {/* Analytics Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Column 1: Insight Stats */}
                        <div className="space-y-4">
                            <Card className="bg-blue-50/50 border-blue-100 shadow-sm">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-blue-100 rounded-lg">
                                            <TrendingUp className="w-4 h-4 text-blue-700" />
                                        </div>
                                        <p className="text-sm font-medium text-blue-900">Total Jurnal</p>
                                    </div>
                                    <p className="text-2xl font-bold text-blue-900">{weeklyStats.total}</p>
                                    <p className="text-xs text-blue-700 mt-1">Minggu ini</p>
                                </CardContent>
                            </Card>
                            <Card className="bg-indigo-50/50 border-indigo-100 shadow-sm">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-indigo-100 rounded-lg">
                                            <Users className="w-4 h-4 text-indigo-700" />
                                        </div>
                                        <p className="text-sm font-medium text-indigo-900">Karyawan Aktif</p>
                                    </div>
                                    <p className="text-2xl font-bold text-indigo-900">{weeklyStats.activeUsers}</p>
                                    <p className="text-xs text-indigo-700 mt-1">Mengisi jurnal</p>
                                </CardContent>
                            </Card>
                            <Card className="bg-emerald-50/50 border-emerald-100 shadow-sm">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-emerald-100 rounded-lg">
                                            <CheckSquare className="w-4 h-4 text-emerald-700" />
                                        </div>
                                        <p className="text-sm font-medium text-emerald-900">Approval Rate</p>
                                    </div>
                                    <p className="text-2xl font-bold text-emerald-900">{weeklyStats.approvalRate}%</p>
                                    <p className="text-xs text-emerald-700 mt-1">Telah direview</p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Column 2: Weekly Activity Chart */}
                        <Card className="md:col-span-2 shadow-sm border-slate-200">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">Aktivitas Harian</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[250px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={weeklyStats.dailyActivity}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis
                                                dataKey="day"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#64748b', fontSize: 12 }}
                                                dy={10}
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#64748b', fontSize: 12 }}
                                            />
                                            <RechartsTooltip
                                                cursor={{ fill: '#f8fafc' }}
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Bar
                                                dataKey="entries"
                                                fill="#4f46e5"
                                                radius={[4, 4, 0, 0]}
                                                barSize={32}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Leaderboard / Contributor List */}
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader>
                            <CardTitle className="text-base">Top Kontributor Mingguan</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {weeklyStats.sortedContributors.map((contributor, index) => (
                                    <div key={index} className="flex items-center justify-between border-b border-slate-50 last:border-0 pb-3 last:pb-0">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                                                {index + 1}
                                            </div>
                                            <Avatar className="h-10 w-10 border border-slate-100">
                                                <AvatarImage src={contributor.avatar || ""} />
                                                <AvatarFallback className="bg-blue-50 text-blue-600 font-semibold">{getInitials(contributor.name)}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800">{contributor.name}</p>
                                                <p className="text-xs text-slate-500">{contributor.count} jurnal minggu ini</p>
                                            </div>
                                        </div>
                                        <Badge variant="secondary" className="bg-slate-100 text-slate-600">Active</Badge>
                                    </div>
                                ))}
                                {weeklyStats.sortedContributors.length === 0 && (
                                    <p className="text-center text-sm text-slate-500 py-4">Belum ada data kontributor minggu ini.</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
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
            {filterStatus !== 'summary' && (
                isLoading ? (
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
                ))}

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
                                <label className="text-sm font-medium text-slate-700">
                                    Catatan Manager
                                    <span className="text-slate-400 font-normal ml-1">(Wajib untuk Revisi)</span>
                                </label>
                                <Textarea
                                    placeholder="Tulis alasan revisi atau pesan..."
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
                            <Button
                                onClick={() => handleSubmitReview('need_revision')}
                                disabled={isSubmitting}
                                variant="outline"
                                className="flex-1 sm:flex-none border-orange-300 text-orange-600 hover:bg-orange-50"
                            >
                                Minta Revisi
                            </Button>
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
