import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import EnterpriseLayout from "@/components/layout/EnterpriseLayout";
import { JournalTable } from "@/components/journal/JournalTable";
import { JournalFilters } from "@/components/journal/JournalFilters";
import { JournalReviewDetail } from "@/components/journal/JournalReviewDetail";
import {
    Sheet,
    SheetContent,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, SlidersHorizontal, LayoutDashboard, Clock, BookOpen, BarChart3, FileCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { JournalCardData } from "@/components/journal/JournalCard";

// Manager has its own specific fetching needs, but for simplicity we keep it close to Admin but maybe scoped if needed.
const ITEMS_PER_PAGE = 20;

const ManagerJurnal = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [viewJournal, setViewJournal] = useState<JournalCardData | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    // Filters
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [status, setStatus] = useState("all");
    const [department, setDepartment] = useState("all");
    const [date, setDate] = useState<Date | undefined>(undefined);

    // Data State
    const [journals, setJournals] = useState<JournalCardData[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 500);
        return () => clearTimeout(timer);
    }, [search]);

    const fetchJournals = async () => {
        setIsLoading(true);
        try {
            let query = supabase
                .from('work_journals')
                .select('*', { count: 'exact' })
                .is('deleted_at', null)
                .order('date', { ascending: false });

            // Depending on status
            if (status !== 'all') {
                query = query.eq('verification_status', status);
            }

            if (date) {
                const start = new Date(date);
                start.setHours(0, 0, 0, 0);
                const end = new Date(date);
                end.setHours(23, 59, 59, 999);
                query = query.gte('date', start.toISOString()).lte('date', end.toISOString());
            }

            if (debouncedSearch) {
                query = query.ilike('content', `%${debouncedSearch}%`);
            }

            const { data, error } = await query;
            if (error) throw error;

            if (!data || data.length === 0) {
                setJournals([]);
                return;
            }

            const userIds = [...new Set(data.map((j: any) => j.user_id))];
            const profileMap = new Map<string, any>();

            if (userIds.length > 0) {
                let profileQuery = supabase
                    .from('profiles')
                    .select('user_id, full_name, avatar_url, department, position')
                    .in('user_id', userIds);

                if (department !== 'all') {
                    profileQuery = profileQuery.eq('department', department);
                }

                const { data: profiles } = await profileQuery;

                if (profiles) {
                    profiles.forEach(p => profileMap.set(p.user_id, p));
                }
            }

            const formattedData = data.map(journal => {
                const profile = profileMap.get(journal.user_id);
                if (department !== 'all' && !profile) return null;

                return {
                    ...journal,
                    profiles: profile || { full_name: 'Unknown', avatar_url: null, department: '-', position: '-' }
                };
            }).filter(Boolean) as unknown as JournalCardData[];

            setJournals(formattedData);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchJournals();
    }, [user, status, debouncedSearch, department, date]);

    // Handle Selection & Actions
    const handleSelect = (id: string, checked: boolean) => {
        if (checked) setSelectedIds(prev => [...prev, id]);
        else setSelectedIds(prev => prev.filter(item => item !== id));
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) setSelectedIds(journals.map(j => j.id));
        else setSelectedIds([]);
    };

    const handleBulkApprove = async () => {
        if (selectedIds.length === 0) return;
        try {
            const { error } = await supabase
                .from('work_journals')
                .update({ verification_status: 'approved', status: 'approved' })
                .in('id', selectedIds);

            if (error) throw error;
            toast({ title: "Berhasil", description: `${selectedIds.length} jurnal telah disetujui.` });
            setSelectedIds([]);
            fetchJournals();
        } catch (err: any) {
            toast({ variant: "destructive", title: "Error", description: err.message });
        }
    };

    const handleSingleAction = async (id: string, action: 'approve' | 'reject', reason?: string) => {
        try {
            const updateData: any = {
                verification_status: action === 'approve' ? 'approved' : 'rejected',
                status: action === 'approve' ? 'approved' : 'rejected'
            };

            const { error } = await supabase.from('work_journals').update(updateData).eq('id', id);
            if (error) throw error;

            toast({ title: "Berhasil", description: action === 'approve' ? 'Jurnal disetujui.' : 'Jurnal ditolak.' });
            fetchJournals();

            if (viewJournal?.id === id) {
                setIsDetailOpen(false);
                setViewJournal(null);
            }
        } catch (err: any) {
            toast({ variant: "destructive", title: "Error", description: err.message });
        }
    };

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

    // Stats for Insight Bar
    const pendingCount = journals.filter(j => j.verification_status === 'pending' || j.verification_status === 'submitted').length;
    const approvedCount = journals.filter(j => j.verification_status === 'approved').length;
    const totalJournals = journals.length;
    const approvalRate = totalJournals > 0 ? Math.round((approvedCount / (totalJournals || 1)) * 100) : 0;
    const uniqueUsersCount = new Set(journals.map((j: any) => j.user_id)).size;
    const avgPerUser = uniqueUsersCount > 0 ? Math.round(totalJournals / uniqueUsersCount) : 0;

    return (
        <EnterpriseLayout
            title="Jurnal Tim"
            subtitle="Tinjau dan kelola aktivitas kerja tim Anda di satu tempat."
            menuSections={menuSections}
            roleLabel="Manager"
            showRefresh={true}
            onRefresh={fetchJournals}
        >
            <div className="max-w-[1400px] mx-auto pb-20">

                {/* Summary Insight Bar (SaaS Workspace Style) */}
                <div className="bg-slate-900 text-white rounded-[24px] p-6 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden shadow-xl shadow-slate-900/10">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-[80px] pointer-events-none" />
                    <div className="absolute bottom-0 left-10 w-48 h-48 bg-purple-500/20 rounded-full blur-[60px] pointer-events-none" />

                    <div className="relative z-10 flex-1">
                        <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70 tracking-tight">
                            Sekilas Jurnal Tim
                        </h2>
                        <p className="text-slate-400 text-sm mt-1 font-medium max-w-sm">
                            {pendingCount > 0
                                ? `Ada ${pendingCount} jurnal yang menunggu review Anda. Mari selesaikan!`
                                : "Tim Anda luar biasa! Semua jurnal telah direview."}
                        </p>
                    </div>

                    <div className="relative z-10 flex items-center gap-6 md:gap-12 bg-white dark:bg-slate-900/10 backdrop-blur-md rounded-2xl px-8 py-5 border border-white/10">
                        <div className="flex flex-col">
                            <span className="text-slate-400 uppercase tracking-widest text-[10px] font-bold mb-1">Vol. Jurnal</span>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-2xl font-extrabold text-white">{totalJournals}</span>
                                <span className="text-xs text-slate-300 font-semibold">minggu ini</span>
                            </div>
                        </div>

                        <div className="w-[1px] h-10 bg-white dark:bg-slate-900/20 hidden sm:block" />

                        <div className="flex flex-col">
                            <span className="text-slate-400 uppercase tracking-widest text-[10px] font-bold mb-1">Approval Rate</span>
                            <div className="flex items-baseline gap-1.5">
                                <span className={cn("text-2xl font-extrabold", approvalRate >= 80 ? "text-emerald-400" : "text-amber-400")}>
                                    {approvalRate}%
                                </span>
                                <span className="text-xs text-slate-300 font-semibold">disetujui</span>
                            </div>
                        </div>

                        <div className="w-[1px] h-10 bg-white dark:bg-slate-900/20 hidden sm:block" />

                        <div className="flex flex-col">
                            <span className="text-slate-400 uppercase tracking-widest text-[10px] font-bold mb-1">Produktivitas</span>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-2xl font-extrabold text-blue-400">~{avgPerUser}</span>
                                <span className="text-xs text-slate-300 font-semibold">/karyawan</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* FILTERS */}
                <JournalFilters
                    search={search} onSearchChange={setSearch}
                    status={status} onStatusChange={setStatus}
                    department={department} onDepartmentChange={setDepartment}
                    date={date} onDateChange={setDate}
                    onReset={() => {
                        setSearch(""); setStatus("all"); setDepartment("all"); setDate(undefined);
                    }}
                />

                {/* ACTION BAR */}
                {selectedIds.length > 0 && (
                    <div className="flex items-center gap-3 mb-6 p-4 bg-blue-50/50 rounded-[20px] border border-blue-100 animate-in fade-in slide-in-from-top-2 duration-300 shadow-sm backdrop-blur-sm">
                        <div className="flex items-center gap-2">
                            <Badge className="bg-blue-600 text-white hover:bg-blue-600 h-8 px-4 text-xs font-bold rounded-xl shadow-sm">
                                {selectedIds.length} jurnal dipilih
                            </Badge>
                        </div>
                        <Button onClick={handleBulkApprove} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 rounded-xl h-9 px-5 font-bold shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 ml-auto md:ml-0">
                            <CheckCircle className="w-4 h-4" /> Setujui Semua
                        </Button>
                        <Button onClick={() => setSelectedIds([])} variant="ghost" size="sm" className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200 hover:bg-white dark:bg-slate-900 rounded-xl h-9 font-semibold">
                            Batal
                        </Button>
                    </div>
                )}

                {/* TABLE/CARDS WORKSPACE */}
                <JournalTable
                    data={journals}
                    selectedIds={selectedIds}
                    onSelect={handleSelect}
                    onSelectAll={handleSelectAll}
                    onView={(journal) => { setViewJournal(journal); setIsDetailOpen(true); }}
                    onApprove={(id) => handleSingleAction(id, 'approve')}
                    onReject={(id) => handleSingleAction(id, 'reject')}
                    isLoading={isLoading}
                />

                {/* SLIDE-IN DETAIL PANEL (PREMIUM MODE) */}
                <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                    <SheetContent className="w-full sm:max-w-[800px] p-0 border-l border-slate-200/60 shadow-2xl">
                        <div className="h-full overflow-y-auto bg-slate-50/50 dark:bg-slate-800/50">
                            {viewJournal && (
                                <JournalReviewDetail
                                    journal={viewJournal}
                                    onApprove={async (id) => handleSingleAction(id, 'approve')}
                                    onReject={async (id) => handleSingleAction(id, 'reject')}
                                    onRequestRevision={async (id) => handleSingleAction(id, 'reject')}
                                />
                            )}
                        </div>
                    </SheetContent>
                </Sheet>

            </div>
        </EnterpriseLayout>
    );
};

export default ManagerJurnal;
