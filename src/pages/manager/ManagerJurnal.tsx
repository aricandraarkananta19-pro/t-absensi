
import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import EnterpriseLayout from "@/components/layout/EnterpriseLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
    LayoutDashboard, Clock, BarChart3, FileCheck, BookOpen, Search,
    Filter, AlertCircle, CheckCircle2, FileEdit, Ghost, Calendar, Briefcase, List,
    Inbox, Flame, Bell, History
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { JournalReviewDetail } from "@/components/journal/JournalReviewDetail";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";

// --- Types ---
type TabType = 'all' | 'pending' | 'urgent' | 'recent';

interface JournalProfile {
    full_name: string | null;
    avatar_url: string | null;
    department: string | null;
    position: string | null;
}

interface JournalData {
    id: string;
    user_id: string;
    content: string;
    work_result: string | null;
    status: string;
    verification_status: string;
    created_at: string;
    date: string;
    profiles: JournalProfile;
}

// --- Tab Config ---
const TAB_CONFIG: Record<TabType, {
    label: string;
    sublabel: string;
    icon: React.ElementType;
    activeColor: string;
    dotColor: string;
    animate?: boolean;
}> = {
    all: {
        label: "Semua",
        sublabel: "Total jurnal",
        icon: List,
        activeColor: "text-slate-800 bg-white border-slate-200",
        dotColor: "bg-slate-400"
    },
    urgent: {
        label: "Urgent",
        sublabel: "> 24 jam",
        icon: Flame,
        activeColor: "text-red-700 bg-red-50 border-red-200",
        dotColor: "bg-red-500",
        animate: true
    },
    pending: {
        label: "Pending",
        sublabel: "Perlu review",
        icon: Bell,
        activeColor: "text-amber-700 bg-amber-50 border-amber-200",
        dotColor: "bg-amber-500"
    },
    recent: {
        label: "Terbaru",
        sublabel: "48 jam terakhir",
        icon: History,
        activeColor: "text-blue-700 bg-blue-50 border-blue-200",
        dotColor: "bg-blue-500"
    },
};

// --- Fetcher Functions ---

async function fetchCounts(managerId: string) {
    if (!managerId) return { all: 0, pending: 0, urgent: 0, recent: 0 };

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

    const allQuery = supabase
        .from('work_journals')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null);

    const urgentQuery = supabase
        .from('work_journals')
        .select('id', { count: 'exact', head: true })
        .eq('verification_status', 'pending')
        .lt('created_at', twentyFourHoursAgo)
        .is('deleted_at', null);

    const pendingQuery = supabase
        .from('work_journals')
        .select('id', { count: 'exact', head: true })
        .in('verification_status', ['pending'])
        .is('deleted_at', null);

    const recentQuery = supabase
        .from('work_journals')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', fortyEightHoursAgo)
        .is('deleted_at', null);

    const [all, urgent, pending, recent] = await Promise.all([
        allQuery, urgentQuery, pendingQuery, recentQuery
    ]);

    return {
        all: all.count || 0,
        urgent: urgent.count || 0,
        pending: pending.count || 0,
        recent: recent.count || 0
    };
}

async function fetchJournalPage(
    managerId: string,
    page: number,
    pageSize: number,
    search: string,
    tab: TabType
) {
    if (!managerId) return { data: [], count: 0 };

    let query = supabase
        .from('work_journals')
        .select('*', { count: 'exact' })
        .is('deleted_at', null);

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

    if (tab === 'urgent') {
        query = query.eq('verification_status', 'pending').lt('created_at', twentyFourHoursAgo);
    } else if (tab === 'recent') {
        query = query.gte('created_at', fortyEightHoursAgo);
    } else if (tab === 'pending') {
        query = query.in('verification_status', ['pending']);
    }

    if (search) {
        query = query.ilike('content', `%${search}%`);
    }

    const from = page * pageSize;
    const to = from + pageSize - 1;

    if (tab === 'recent' || tab === 'all') {
        query = query.order('created_at', { ascending: false });
    } else {
        query = query.order('created_at', { ascending: true });
    }

    const { data: journals, error, count } = await query.range(from, to);

    if (error) throw error;
    if (!journals || journals.length === 0) return { data: [], count: 0 };

    const userIds = [...new Set(journals.map(j => j.user_id))];
    const profileMap = new Map<string, JournalProfile>();

    if (userIds.length > 0) {
        const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, full_name, avatar_url, department, position')
            .in('user_id', userIds);

        if (profiles) {
            profiles.forEach(p => profileMap.set(p.user_id, p));
        }
    }

    const formattedData: JournalData[] = journals.map(j => {
        const profile = profileMap.get(j.user_id) || {
            full_name: 'Unknown User',
            avatar_url: null,
            department: '-',
            position: '-'
        };
        return { ...j, profiles: profile };
    });

    return { data: formattedData, count: count || 0 };
}

// --- Status Badge Component ---
function StatusDot({ status }: { status: string }) {
    const colorMap: Record<string, string> = {
        approved: "bg-emerald-500",
        pending: "bg-amber-500",
        submitted: "bg-amber-500",
        rejected: "bg-red-500",
        need_revision: "bg-orange-500"
    };
    const labelMap: Record<string, string> = {
        approved: "Disetujui",
        pending: "Pending",
        submitted: "Pending",
        rejected: "Ditolak",
        need_revision: "Revisi"
    };
    const bgMap: Record<string, string> = {
        approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
        pending: "bg-amber-50 text-amber-700 border-amber-200",
        submitted: "bg-amber-50 text-amber-700 border-amber-200",
        rejected: "bg-red-50 text-red-700 border-red-200",
        need_revision: "bg-orange-50 text-orange-700 border-orange-200"
    };
    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${bgMap[status] || bgMap.pending}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${colorMap[status] || colorMap.pending}`} />
            {labelMap[status] || "Pending"}
        </span>
    );
}

const ManagerJurnal = () => {
    const { user } = useAuth();

    // State
    const [activeTab, setActiveTab] = useState<TabType>('all');
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [selectedJournalId, setSelectedJournalId] = useState<string | null>(null);

    // Counts State
    const [counts, setCounts] = useState({ all: 0, urgent: 0, pending: 0, recent: 0 });

    // Pagination/Data State
    const [journals, setJournals] = useState<JournalData[]>([]);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const PAGE_SIZE = 20;

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(0);
            setJournals([]);
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    // Reset on Tab Change
    useEffect(() => {
        setPage(0);
        setJournals([]);
        setHasMore(true);
        setSelectedJournalId(null);
    }, [activeTab]);

    // Data Fetching
    const loadJournals = async (isRefresh = false) => {
        if (!user?.id) return;
        if (isRefresh) setIsLoading(true);

        try {
            const countData = await fetchCounts(user.id);
            setCounts(countData);

            const { data, count } = await fetchJournalPage(
                user.id,
                page,
                PAGE_SIZE,
                debouncedSearch,
                activeTab
            );

            setJournals(prev => {
                if (page === 0) return data;
                const existingIds = new Set(prev.map(p => p.id));
                const uniqueNew = data.filter(d => !existingIds.has(d.id));
                return [...prev, ...uniqueNew];
            });

            setHasMore(data.length === PAGE_SIZE);

            if ((page === 0 || isRefresh) && data.length > 0 && !selectedJournalId) {
                setSelectedJournalId(data[0].id);
            }
        } catch (error: any) {
            console.error("Fetch error:", error);
            toast({ variant: "destructive", title: "Error", description: "Gagal memuat jurnal" });
        } finally {
            if (isRefresh) setIsLoading(false);
        }
    };

    useEffect(() => {
        loadJournals(page === 0);
    }, [user?.id, page, debouncedSearch, activeTab]);

    // Realtime Subscription
    useEffect(() => {
        const channel = supabase
            .channel('manager-journal-list-realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'work_journals' },
                () => {
                    setPage(0);
                    setTimeout(() => loadJournals(true), 500);
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const selectedJournal = useMemo(() =>
        journals.find(j => j.id === selectedJournalId),
        [journals, selectedJournalId]
    );

    const handleAction = async (id: string, action: 'approve' | 'reject', reason?: string) => {
        try {
            const status = action === 'approve' ? 'approved' : 'rejected';
            if (activeTab === 'pending' || activeTab === 'urgent') {
                setJournals(prev => prev.filter(j => j.id !== id));
                if (selectedJournalId === id) setSelectedJournalId(null);
            } else {
                setJournals(prev => prev.map(j => j.id === id ? { ...j, verification_status: status, status: status } : j));
            }

            const { error } = await supabase
                .from('work_journals')
                .update({
                    verification_status: status,
                    status: status,
                    manager_notes: reason
                })
                .eq('id', id);

            if (error) throw error;

            toast({
                title: "Berhasil",
                description: action === 'approve' ? 'Jurnal telah disetujui.' : 'Jurnal telah ditolak.'
            });
            loadJournals(false);
        } catch (e: any) {
            toast({ variant: "destructive", title: "Error", description: e.message });
            loadJournals(true);
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

    return (
        <EnterpriseLayout
            title="Jurnal Tim"
            subtitle="Tinjau dan kelola aktivitas tim Anda."
            menuSections={menuSections}
            roleLabel="Manager"
            showRefresh={true}
            onRefresh={() => { setPage(0); loadJournals(true); }}
        >
            <div className="flex h-[calc(100vh-140px)] -mt-4 gap-5">

                {/* LEFT SIDEBAR - LIST */}
                <div className="w-[420px] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm shrink-0 overflow-hidden">

                    {/* Search & Tabs Header */}
                    <div className="p-4 border-b border-slate-100 space-y-3 shrink-0">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Cari jurnal karyawan..."
                                className="pl-10 bg-slate-50 border-slate-200 h-10 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        {/* Tab Buttons */}
                        <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100/60 rounded-xl">
                            {(Object.keys(TAB_CONFIG) as TabType[]).map((tab) => {
                                const config = TAB_CONFIG[tab];
                                const isActive = activeTab === tab;
                                const count = counts[tab];

                                return (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-lg transition-all duration-200 border ${isActive
                                            ? `${config.activeColor} shadow-sm`
                                            : 'text-slate-500 border-transparent hover:bg-white/60'
                                            }`}
                                    >
                                        <span className="text-[10px] font-bold uppercase tracking-wider mb-1">{config.label}</span>
                                        <div className="flex items-center gap-1">
                                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? config.dotColor : 'bg-slate-300'} ${config.animate && count > 0 ? 'animate-pulse' : ''}`} />
                                            <span className="text-base font-bold leading-none">{count}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Scrollable List */}
                    <div className="flex-1 overflow-y-auto bg-slate-50/30 p-3 space-y-2">
                        {isLoading && journals.length === 0 ? (
                            // Skeleton
                            [1, 2, 3].map(i => (
                                <div key={i} className="flex gap-3 p-4 bg-white rounded-xl border border-slate-100">
                                    <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                                    <div className="space-y-2 flex-1">
                                        <Skeleton className="h-4 w-3/4" />
                                        <Skeleton className="h-3 w-1/2" />
                                    </div>
                                </div>
                            ))
                        ) : journals.length === 0 ? (
                            // Empty State
                            <div className="flex flex-col items-center justify-center h-full py-16">
                                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                                    {activeTab === 'urgent' ? <AlertCircle className="h-8 w-8 text-slate-300" /> :
                                        activeTab === 'recent' ? <Clock className="h-8 w-8 text-slate-300" /> :
                                            <Inbox className="h-8 w-8 text-slate-300" />}
                                </div>
                                <p className="text-sm font-semibold text-slate-500 text-center px-8">
                                    {activeTab === 'urgent' ? "Tidak ada jurnal urgent! 👍" :
                                        activeTab === 'recent' ? "Belum ada jurnal baru 48 jam terakhir." :
                                            activeTab === 'pending' ? "Semua jurnal sudah ditinjau." :
                                                "Tidak ada jurnal ditemukan."}
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                    {activeTab === 'urgent' ? "Semua jurnal telah ditinjau tepat waktu" : "Coba ubah filter atau tab"}
                                </p>
                            </div>
                        ) : (
                            // List
                            <>
                                {journals.map((journal) => {
                                    const isSelected = selectedJournalId === journal.id;
                                    return (
                                        <div
                                            key={journal.id}
                                            onClick={() => setSelectedJournalId(journal.id)}
                                            className={`relative group cursor-pointer transition-all duration-200 rounded-xl border p-3.5 ${isSelected
                                                ? 'bg-white border-blue-400 shadow-md ring-2 ring-blue-100'
                                                : 'bg-white border-slate-200 hover:border-blue-200 hover:shadow-sm'
                                                }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <Avatar className="h-10 w-10 border-2 border-white shadow-sm shrink-0">
                                                    <AvatarImage src={journal.profiles.avatar_url || ""} />
                                                    <AvatarFallback className="bg-gradient-to-br from-slate-600 to-slate-800 text-white font-bold text-xs">
                                                        {journal.profiles.full_name?.charAt(0).toUpperCase() || "?"}
                                                    </AvatarFallback>
                                                </Avatar>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <h4 className={`text-sm font-semibold truncate pr-2 ${isSelected ? 'text-blue-700' : 'text-slate-900'}`}>
                                                            {journal.profiles.full_name || "Unknown User"}
                                                        </h4>
                                                        <span className="text-[10px] text-slate-400 shrink-0 tabular-nums">
                                                            {formatDistanceToNow(new Date(journal.created_at), { addSuffix: true, locale: id })}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 mb-2">
                                                        <span className="text-[10px] text-slate-400 font-medium truncate">
                                                            {journal.profiles.department || "-"}
                                                        </span>
                                                        <span className="text-slate-200">•</span>
                                                        <StatusDot status={journal.verification_status} />
                                                    </div>

                                                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                                        {journal.content}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {hasMore && journals.length > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full text-xs text-slate-500 hover:text-blue-600 rounded-xl h-9 mt-1"
                                        onClick={() => setPage(p => p + 1)}
                                    >
                                        Muat lebih banyak...
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* RIGHT SIDE - DETAIL VIEW */}
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col items-center justify-center">
                    {selectedJournal ? (
                        <div className="w-full h-full flex flex-col">
                            <JournalReviewDetail
                                journal={selectedJournal}
                                onApprove={async (id) => handleAction(id, 'approve')}
                                onReject={async (id, reason) => handleAction(id, 'reject', reason)}
                                onRequestRevision={async (id, reason) => handleAction(id, 'reject', reason)}
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-8">
                            <div className="w-24 h-24 rounded-3xl bg-slate-50 flex items-center justify-center mb-5">
                                <BookOpen className="h-12 w-12 text-slate-200" />
                            </div>
                            <p className="text-base font-semibold text-slate-400">Pilih jurnal untuk melihat detail</p>
                            <p className="text-sm text-slate-300 mt-1">Klik pada jurnal di daftar sebelah kiri</p>
                        </div>
                    )}
                </div>

            </div>
        </EnterpriseLayout>
    );
};

export default ManagerJurnal;
