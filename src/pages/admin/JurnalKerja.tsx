
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import EnterpriseLayout from "@/components/layout/EnterpriseLayout";
import { Button } from "@/components/ui/button";
import {
    LayoutDashboard, Users, Clock, BarChart3, Building2, Shield, Key,
    Settings, Database, BookOpen, CheckCircle, Download, FileSpreadsheet, Trash2
} from "lucide-react";
import { ADMIN_MENU_SECTIONS } from "@/config/menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// Components
import { JournalCardData } from "@/components/journal/JournalCard";
import { JournalTable } from "@/components/journal/JournalTable";
import { JournalFilters } from "@/components/journal/JournalFilters";
import { JournalReviewDetail } from "@/components/journal/JournalReviewDetail"; // Reusing for Detail View Modal
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

// ========== DATA FETCHING ==========

const ITEMS_PER_PAGE = 20;

const journalQueryKeys = {
    adminList: (status: string, search: string, dept: string, date?: Date) =>
        ['journals', 'admin', 'list', status, search, dept, date] as const,
};

async function fetchAdminJournals({ pageParam = 0, status, search, dept, date }: { pageParam: number, status: string, search: string, dept: string, date?: Date }) {
    const from = pageParam * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    // 1. Fetch Journals (No Profile Join yet)
    let query = supabase
        .from('work_journals')
        .select('*', { count: 'exact' })
        .is('deleted_at', null)
        .order('date', { ascending: false })
        .range(from, to);

    // 2. Apply Filters

    // Status Filter
    if (status !== 'all') {
        query = query.eq('verification_status', status);
    }

    // Date Filter
    if (date) {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        query = query.gte('date', start.toISOString()).lte('date', end.toISOString());
    }

    // Search Filter (Content Only)
    if (search) {
        query = query.ilike('content', `%${search}%`);
    }

    // Execute Journal Query
    const { data: journals, error } = await query;
    if (error) throw error;
    if (!journals || journals.length === 0) return [];

    // 3. Manual Fetch Profiles
    const userIds = [...new Set(journals.map(j => j.user_id))];
    const profileMap = new Map<string, any>();

    if (userIds.length > 0) {
        let profileQuery = supabase
            .from('profiles')
            .select('user_id, full_name, avatar_url, department, position')
            .in('user_id', userIds);

        // Department Filter (Applied here)
        if (dept !== 'all') {
            profileQuery = profileQuery.eq('department', dept);
        }

        const { data: profiles } = await profileQuery;

        if (profiles) {
            profiles.forEach(p => profileMap.set(p.user_id, p));
        }
    }

    // 4. Merge Data & Filter by Department (if dept != all, exclude journals where profile not found)
    const formattedData = journals.map(journal => {
        const profile = profileMap.get(journal.user_id);

        // If filtering by department and no profile matches, return null (to be filtered out)
        if (dept !== 'all' && !profile) return null;

        return {
            ...journal,
            profiles: profile || { full_name: 'Unknown', avatar_url: null, department: '-', position: '-' }
        };
    }).filter(Boolean) as unknown as JournalCardData[];

    return formattedData;
}

const JurnalKerja = () => {
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

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 500);
        return () => clearTimeout(timer);
    }, [search]);

    // Data Fetching
    const {
        data: infiniteData,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading: isLoadingList,
    } = useInfiniteQuery({
        queryKey: journalQueryKeys.adminList(status, debouncedSearch, department, date),
        queryFn: ({ pageParam }) => fetchAdminJournals({ pageParam, status, search: debouncedSearch, dept: department, date }),
        initialPageParam: 0,
        getNextPageParam: (lastPage, allPages) => lastPage.length === ITEMS_PER_PAGE ? allPages.length : undefined,
    });

    const allJournals = infiniteData?.pages.flatMap(page => page) || [];

    // Infinite Scroll
    const observer = useRef<IntersectionObserver | null>(null);
    const lastElementRef = useCallback((node: HTMLDivElement) => {
        if (isLoadingList || isFetchingNextPage) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasNextPage) fetchNextPage();
        });
        if (node) observer.current.observe(node);
    }, [isLoadingList, isFetchingNextPage, hasNextPage, fetchNextPage]);


    // --- Actions ---

    const handleSelect = (id: string, checked: boolean) => {
        if (checked) {
            setSelectedIds(prev => [...prev, id]);
        } else {
            setSelectedIds(prev => prev.filter(item => item !== id));
        }
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(allJournals.map(j => j.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleBulkApprove = async () => {
        if (selectedIds.length === 0) return;

        try {
            const { error } = await supabase
                .from('work_journals')
                .update({
                    verification_status: 'approved',
                    status: 'approved'
                })
                .in('id', selectedIds);

            if (error) throw error;

            toast({ title: "Updated", description: `${selectedIds.length} journals approved.` });
            setSelectedIds([]);
            queryClient.invalidateQueries({ queryKey: ['journals', 'admin'] });
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

            const { error } = await supabase
                .from('work_journals')
                .update(updateData)
                .eq('id', id);

            if (error) throw error;

            toast({ title: "Success", description: `Journal ${action === 'approve' ? 'approved' : 'rejected'}.` });
            queryClient.invalidateQueries({ queryKey: ['journals', 'admin'] });

            if (viewJournal?.id === id) {
                setIsDetailOpen(false);
                setViewJournal(null);
            }

        } catch (err: any) {
            toast({ variant: "destructive", title: "Error", description: err.message });
        }
    };

    const menuSections = ADMIN_MENU_SECTIONS;

    return (
        <EnterpriseLayout
            title="Journal Management"
            subtitle="Review and manage employee daily journals."
            menuSections={menuSections}
            roleLabel="Administrator"
            showRefresh={true}
            showExport={false}
            onRefresh={() => queryClient.invalidateQueries({ queryKey: ['journals', 'admin'] })}
        >
            <div className="max-w-[1400px] mx-auto pb-20">

                {/* FILTERS */}
                <JournalFilters
                    search={search}
                    onSearchChange={setSearch}
                    status={status}
                    onStatusChange={setStatus}
                    department={department}
                    onDepartmentChange={setDepartment}
                    date={date}
                    onDateChange={setDate}
                    onReset={() => {
                        setSearch("");
                        setStatus("all");
                        setDepartment("all");
                        setDate(undefined);
                    }}
                />

                {/* ACTION BAR */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        {selectedIds.length > 0 && (
                            <Button
                                onClick={handleBulkApprove}
                                className="bg-blue-600 hover:bg-blue-700 text-white gap-2 transition-all animate-in fade-in zoom-in"
                            >
                                <CheckCircle className="w-4 h-4" />
                                Approve All Selected ({selectedIds.length})
                            </Button>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Export button removed */}
                    </div>
                </div>

                {/* TABLE */}
                <JournalTable
                    data={allJournals}
                    selectedIds={selectedIds}
                    onSelect={handleSelect}
                    onSelectAll={handleSelectAll}
                    onView={(journal) => {
                        setViewJournal(journal);
                        setIsDetailOpen(true);
                    }}
                    onApprove={(id) => handleSingleAction(id, 'approve')}
                    onReject={(id) => handleSingleAction(id, 'reject')}
                    isLoading={isLoadingList}
                />

                {/* INFINITE SCROLL SENTINEL */}
                <div ref={lastElementRef} className="h-4" />

                {/* DETAIL MODAL (USING REVIEW DETAIL COMPONENT) */}
                <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                    <DialogContent className="max-w-4xl h-[90vh] p-0 overflow-hidden flex flex-col gap-0">
                        <div className="flex-1 overflow-y-auto">
                            <JournalReviewDetail
                                journal={viewJournal}
                                onApprove={async (id) => handleSingleAction(id, 'approve')}
                                onReject={async (id) => handleSingleAction(id, 'reject')}
                                onRequestRevision={async (id) => handleSingleAction(id, 'reject')} // Map revise to reject for now or separate
                            />
                        </div>
                    </DialogContent>
                </Dialog>

            </div>
        </EnterpriseLayout>
    );
};

export default JurnalKerja;
