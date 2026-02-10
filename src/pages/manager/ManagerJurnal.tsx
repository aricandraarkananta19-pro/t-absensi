
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
    Filter, AlertCircle, CheckCircle2, FileEdit, Ghost, Calendar, Briefcase, List
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

// --- Fetcher Functions ---

// 1. Fetch Counts for Badges
async function fetchCounts(managerId: string) {
    if (!managerId) return { all: 0, pending: 0, urgent: 0, recent: 0 };

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

    // All: All journals
    const allQuery = supabase
        .from('work_journals')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null);

    // Urgent: Pending AND > 24h ago
    const urgentQuery = supabase
        .from('work_journals')
        .select('id', { count: 'exact', head: true })
        .eq('verification_status', 'pending')
        .lt('created_at', twentyFourHoursAgo)
        .is('deleted_at', null);

    // Pending: All 'pending'
    const pendingQuery = supabase
        .from('work_journals')
        .select('id', { count: 'exact', head: true })
        .in('verification_status', ['pending'])
        .is('deleted_at', null);

    // Recent: Created > 48h ago (Newest)
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

// 2. Fetch Journal List
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

    // Apply Tab Filters
    if (tab === 'urgent') {
        // Urgent: Pending AND older than 24h
        query = query.eq('verification_status', 'pending').lt('created_at', twentyFourHoursAgo);
    } else if (tab === 'recent') {
        // Recent: All journals created in last 48h
        query = query.gte('created_at', fortyEightHoursAgo);
    } else if (tab === 'pending') {
        // Pending
        query = query.in('verification_status', ['pending']);
    }
    // tab === 'all' -> No filter on verification_status

    // Filter by Search (Content)
    if (search) {
        query = query.ilike('content', `%${search}%`);
    }

    // Pagination
    const from = page * pageSize;
    const to = from + pageSize - 1;

    // Order
    if (tab === 'recent' || tab === 'all') {
        query = query.order('created_at', { ascending: false });
    } else {
        query = query.order('created_at', { ascending: true }); // Process oldest first for pending/urgent
    }

    const { data: journals, error, count } = await query.range(from, to);

    if (error) throw error;
    if (!journals || journals.length === 0) return { data: [], count: 0 };

    // Fetch Profiles
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

    // Merge
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
            // 1. Fetch Counts (Always update)
            const countData = await fetchCounts(user.id);
            setCounts(countData);

            // 2. Fetch Page
            const { data, count } = await fetchJournalPage(
                user.id,
                page,
                PAGE_SIZE,
                debouncedSearch,
                activeTab
            );

            setJournals(prev => {
                if (page === 0) return data;
                // De-dupe
                const existingIds = new Set(prev.map(p => p.id));
                const uniqueNew = data.filter(d => !existingIds.has(d.id));
                return [...prev, ...uniqueNew];
            });

            setHasMore(data.length === PAGE_SIZE);

            // Auto-select first item if none selected and we have data
            if ((page === 0 || isRefresh) && data.length > 0 && !selectedJournalId) {
                setSelectedJournalId(data[0].id);
            }
        } catch (error: any) {
            console.error("Fetch error:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to load journals" });
        } finally {
            if (isRefresh) setIsLoading(false);
        }
    };

    // Initial Load & Page Change
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

                    // Refresh counts and list (resetting list to page 0 to avoid holes)
                    setPage(0);
                    // Slight delay to ensure DB is consistent
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
            // Optimistic update
            // Only convert status in list, do not remove if tab is 'all' or 'recent'
            // But if pending/urgent, we might want to remove
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

            toast({ title: "Success", description: `Journal ${status}.` });
            loadJournals(false); // Background refresh counts
        } catch (e: any) {
            toast({ variant: "destructive", title: "Error", description: e.message });
            loadJournals(true); // Revert/Reload on error
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
            title="Journal Reviews"
            subtitle="Review and manage team activities."
            menuSections={menuSections}
            roleLabel="Manager"
            showRefresh={true}
            onRefresh={() => { setPage(0); loadJournals(true); }}
        >
            <div className="flex h-[calc(100vh-140px)] -mt-4 gap-6">

                {/* LEFT SIDEBAR - LIST */}
                <div className="w-[420px] flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm shrink-0 overflow-hidden">
                    {/* Header/Tabs */}
                    <div className="p-4 border-b border-slate-100 bg-white z-10 space-y-4">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Cari nama karyawan atau isi jurnal..."
                                className="pl-9 bg-slate-50 border-slate-200 h-10"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        {/* Summary Badges Tabs */}
                        <div className="flex p-1 bg-slate-100 rounded-lg gap-1">
                            <button
                                onClick={() => setActiveTab('all')}
                                className={`flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-md transition-all border border-transparent ${activeTab === 'all'
                                    ? 'bg-white text-slate-800 shadow-sm border-slate-200'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                    }`}
                            >
                                <div className="text-[10px] uppercase font-bold tracking-wider mb-0.5">All</div>
                                <div className="flex items-center gap-1.5">
                                    <List className="h-3 w-3 text-slate-500" />
                                    <span className="text-lg font-bold leading-none">{counts.all}</span>
                                </div>
                            </button>

                            <button
                                onClick={() => setActiveTab('urgent')}
                                className={`flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-md transition-all border border-transparent ${activeTab === 'urgent'
                                    ? 'bg-white text-red-600 shadow-sm border-slate-200'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                    }`}
                            >
                                <div className="text-[10px] uppercase font-bold tracking-wider mb-0.5">Urgent</div>
                                <div className="flex items-center gap-1.5">
                                    <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></div>
                                    <span className="text-lg font-bold leading-none">{counts.urgent}</span>
                                </div>
                            </button>

                            <button
                                onClick={() => setActiveTab('pending')}
                                className={`flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-md transition-all border border-transparent ${activeTab === 'pending'
                                    ? 'bg-white text-amber-600 shadow-sm border-slate-200'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                    }`}
                            >
                                <div className="text-[10px] uppercase font-bold tracking-wider mb-0.5">Pending</div>
                                <div className="flex items-center gap-1.5">
                                    <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                                    <span className="text-lg font-bold leading-none">{counts.pending}</span>
                                </div>
                            </button>

                            <button
                                onClick={() => setActiveTab('recent')}
                                className={`flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-md transition-all border border-transparent ${activeTab === 'recent'
                                    ? 'bg-white text-blue-600 shadow-sm border-slate-200'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                    }`}
                            >
                                <div className="text-[10px] uppercase font-bold tracking-wider mb-0.5">Recent</div>
                                <div className="flex items-center gap-1.5">
                                    <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                                    <span className="text-lg font-bold leading-none">{counts.recent}</span>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Scrollable List */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50 p-3 space-y-3">
                        {isLoading && journals.length === 0 ? (
                            // SKELETON
                            [1, 2, 3].map(i => (
                                <div key={i} className="flex gap-4 p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
                                    <Skeleton className="h-10 w-10 rounded-full" />
                                    <div className="space-y-2 flex-1">
                                        <Skeleton className="h-4 w-3/4" />
                                        <Skeleton className="h-3 w-1/2" />
                                    </div>
                                </div>
                            ))
                        ) : journals.length === 0 ? (
                            // EMPTY STATE
                            <div className="flex flex-col items-center justify-center h-full py-10 opacity-60">
                                <div className="bg-slate-100 p-4 rounded-full mb-4">
                                    {activeTab === 'urgent' ? <AlertCircle className="h-8 w-8 text-slate-400" /> :
                                        activeTab === 'recent' ? <Clock className="h-8 w-8 text-slate-400" /> :
                                            <FileCheck className="h-8 w-8 text-slate-400" />}
                                </div>
                                <p className="text-sm font-medium text-slate-900 text-center px-6">
                                    {activeTab === 'urgent' ? "Bagus! Tidak ada jurnal urgent." :
                                        activeTab === 'recent' ? "Belum ada jurnal baru 48 jam terakhir." :
                                            "Tidak ada jurnal."}
                                </p>
                            </div>
                        ) : (
                            // LIST
                            journals.map((journal) => (
                                <div
                                    key={journal.id}
                                    onClick={() => setSelectedJournalId(journal.id)}
                                    className={`relative group cursor-pointer transition-all duration-200 rounded-xl border p-3 hover:shadow-md ${selectedJournalId === journal.id
                                        ? 'bg-white border-blue-500 shadow-md ring-1 ring-blue-500/20'
                                        : 'bg-white border-slate-200 hover:border-blue-300'
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <Avatar className="h-10 w-10 border border-slate-100">
                                            <AvatarImage src={journal.profiles.avatar_url || ""} />
                                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white font-bold text-xs">
                                                {journal.profiles.full_name?.charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start">
                                                <h4 className={`text-sm font-bold truncate pr-2 ${selectedJournalId === journal.id ? 'text-blue-700' : 'text-slate-900'
                                                    }`}>
                                                    {journal.profiles.full_name || "Unknown User"}
                                                </h4>
                                                <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-1">
                                                    {formatDistanceToNow(new Date(journal.created_at), { addSuffix: true, locale: id })}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2 mt-0.5 mb-2">
                                                <Badge
                                                    variant="secondary"
                                                    className="h-5 px-1.5 text-[10px] font-medium bg-slate-100 text-slate-600 border-slate-200"
                                                >
                                                    {journal.profiles.department || "-"}
                                                </Badge>
                                                {journal.verification_status === 'pending' && (
                                                    <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-amber-200 text-amber-600 bg-amber-50">
                                                        Review Needed
                                                    </Badge>
                                                )}
                                                {journal.verification_status === 'approved' && (
                                                    <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-emerald-200 text-emerald-600 bg-emerald-50">
                                                        Approved
                                                    </Badge>
                                                )}
                                                {journal.verification_status === 'rejected' && (
                                                    <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-red-200 text-red-600 bg-red-50">
                                                        Rejected
                                                    </Badge>
                                                )}
                                            </div>

                                            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                                {journal.content}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                        {hasMore && journals.length > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full text-xs text-slate-500"
                                onClick={() => setPage(p => p + 1)}
                            >
                                Load more...
                            </Button>
                        )}
                    </div>
                </div>

                {/* RIGHT SIDE - DETAIL VIEW */}
                <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col items-center justify-center">
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
                        <div className="flex flex-col items-center justify-center text-slate-300 p-8">
                            <Ghost className="h-24 w-24 mb-4 opacity-20" />
                            <p className="text-lg font-medium text-slate-400">Pilih jurnal untuk melihat detail</p>
                        </div>
                    )}
                </div>

            </div>
        </EnterpriseLayout>
    );
};

export default ManagerJurnal;
