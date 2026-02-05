/**
 * useJournalQuery - Enterprise-grade React Query hook for Work Journals
 * 
 * CRITICAL FEATURES:
 * - 10 minute staleTime (no refetch on navigation)
 * - keepPreviousData (no skeleton flash)
 * - Manual refresh only (user-triggered)
 * - Separate cache keys per module (admin vs employee vs manager)
 * 
 * This hook ensures journal data persists across navigation.
 */

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// ========== TYPES ==========

export interface JournalData {
    id: string;
    content: string;
    date: string;
    duration: number;
    verification_status: string;
    manager_notes?: string;
    work_result?: 'completed' | 'progress' | 'pending';
    obstacles?: string;
    mood?: '😊' | '😐' | '😣';
    created_at: string;
    updated_at?: string;
    user_id: string;
    profiles?: {
        full_name: string;
        avatar_url: string | null;
        department?: string | null;
        position?: string | null;
    };
}

export interface JournalStats {
    totalToday: number;
    avgDuration: number;
    pendingCount: number;
    approvedCount: number;
    needsRevisionCount: number;
}

interface JournalQueryParams {
    page?: number;
    pageSize?: number;
    status?: string;
    search?: string;
    userId?: string; // For employee view (my journals only)
}

// ========== QUERY KEYS ==========
// Separate keys ensure different modules don't share/override cache

export const journalKeys = {
    // Base key
    all: ['journals'] as const,

    // Admin journals list
    adminList: (params: JournalQueryParams) =>
        [...journalKeys.all, 'admin', 'list', params] as const,

    // Admin stats
    adminStats: () =>
        [...journalKeys.all, 'admin', 'stats'] as const,

    // Employee journals (my journals)
    employeeList: (userId: string, params: JournalQueryParams) =>
        [...journalKeys.all, 'employee', userId, 'list', params] as const,

    // Employee stats
    employeeStats: (userId: string) =>
        [...journalKeys.all, 'employee', userId, 'stats'] as const,

    // Manager journals
    managerList: (params: JournalQueryParams) =>
        [...journalKeys.all, 'manager', 'list', params] as const,

    // Manager stats
    managerStats: () =>
        [...journalKeys.all, 'manager', 'stats'] as const,

    // Single journal detail
    detail: (id: string) =>
        [...journalKeys.all, 'detail', id] as const,
};

// ========== FETCH FUNCTIONS ==========

const ITEMS_PER_PAGE = 15;

async function fetchAdminJournals(params: JournalQueryParams): Promise<JournalData[]> {
    const { page = 0, pageSize = ITEMS_PER_PAGE, status = 'all', search = '' } = params;
    const from = page * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
        .from('work_journals')
        .select('*')
        .is('deleted_at', null)
        .order('date', { ascending: false })
        .range(from, to);

    if (status !== 'all') {
        if (status === 'submitted') {
            query = query.or(`verification_status.eq.submitted,status.eq.submitted`);
        } else {
            query = query.or(`verification_status.eq.${status},status.eq.${status}`);
        }
    }

    if (search) {
        query = query.ilike('content', `%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) return [];

    // Fetch profiles
    const userIds = [...new Set(data.map(j => j.user_id))];
    const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url, department, position')
        .in('user_id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

    return data.map(journal => ({
        ...journal,
        profiles: profileMap.get(journal.user_id) || {
            full_name: 'Unknown',
            avatar_url: null,
            department: null,
            position: null
        }
    })) as JournalData[];
}

async function fetchAdminStats(): Promise<JournalStats> {
    const { data, error } = await supabase.rpc('get_admin_journal_stats');

    if (!error && data && data.length > 0) {
        return {
            totalToday: data[0].total_today || 0,
            avgDuration: Number(data[0].avg_duration_today || 0),
            pendingCount: data[0].pending_total || 0,
            approvedCount: data[0].approved_total || 0,
            needsRevisionCount: data[0].need_revision_total || 0
        };
    }

    // Fallback
    const todayStr = new Date().toISOString().split('T')[0];
    const { count: totalToday } = await supabase
        .from('work_journals')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
        .eq('date', todayStr);

    return {
        totalToday: totalToday || 0,
        avgDuration: 0,
        pendingCount: 0,
        approvedCount: 0,
        needsRevisionCount: 0
    };
}

async function fetchEmployeeJournals(userId: string, params: JournalQueryParams): Promise<JournalData[]> {
    const { page = 0, pageSize = ITEMS_PER_PAGE, status = 'all' } = params;
    const from = page * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
        .from('work_journals')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('date', { ascending: false })
        .range(from, to);

    if (status !== 'all') {
        query = query.eq('verification_status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []) as JournalData[];
}

// ========== HOOKS ==========

/**
 * Admin Journal List Hook
 * Cache key: ['journals', 'admin', 'list', params]
 */
export function useAdminJournals(params: JournalQueryParams = {}) {
    return useQuery({
        queryKey: journalKeys.adminList(params),
        queryFn: () => fetchAdminJournals(params),
        staleTime: 10 * 60 * 1000, // 10 minutes
        placeholderData: (previousData) => previousData, // Keep previous data while loading
    });
}

/**
 * Admin Journal Stats Hook
 * Cache key: ['journals', 'admin', 'stats']
 */
export function useAdminJournalStats() {
    return useQuery({
        queryKey: journalKeys.adminStats(),
        queryFn: fetchAdminStats,
        staleTime: 10 * 60 * 1000,
    });
}

/**
 * Employee Journal List Hook
 * Cache key: ['journals', 'employee', userId, 'list', params]
 */
export function useEmployeeJournals(params: JournalQueryParams = {}) {
    const { user } = useAuth();
    const userId = user?.id || '';

    return useQuery({
        queryKey: journalKeys.employeeList(userId, params),
        queryFn: () => fetchEmployeeJournals(userId, params),
        enabled: !!userId,
        staleTime: 10 * 60 * 1000,
        placeholderData: (previousData) => previousData,
    });
}

/**
 * Single Journal Detail Hook
 * Cache key: ['journals', 'detail', id]
 */
export function useJournalDetail(id: string | null) {
    return useQuery({
        queryKey: journalKeys.detail(id || ''),
        queryFn: async () => {
            if (!id) return null;

            const { data, error } = await supabase
                .from('work_journals')
                .select(`
                    id, content, date, duration, user_id, status, verification_status,
                    work_result, obstacles, mood, manager_notes, deleted_at,
                    profiles:user_id ( full_name, avatar_url, department, position )
                `)
                .eq('id', id)
                .maybeSingle();

            if (error) throw error;
            if (!data || data.deleted_at) return null;

            return data as unknown as JournalData;
        },
        enabled: !!id,
        staleTime: 5 * 60 * 1000, // 5 minutes for detail
    });
}

/**
 * Hook to invalidate/refresh journal data
 * Call this after create/update/delete operations
 */
export function useJournalInvalidation() {
    const queryClient = useQueryClient();

    return {
        // Invalidate all journal queries
        invalidateAll: () => {
            queryClient.invalidateQueries({ queryKey: journalKeys.all });
        },

        // Invalidate admin journals only
        invalidateAdmin: () => {
            queryClient.invalidateQueries({ queryKey: [...journalKeys.all, 'admin'] });
        },

        // Invalidate employee journals only
        invalidateEmployee: (userId: string) => {
            queryClient.invalidateQueries({ queryKey: [...journalKeys.all, 'employee', userId] });
        },

        // Invalidate single journal detail
        invalidateDetail: (id: string) => {
            queryClient.invalidateQueries({ queryKey: journalKeys.detail(id) });
        },

        // Refresh stats only
        refreshStats: () => {
            queryClient.invalidateQueries({ queryKey: journalKeys.adminStats() });
            queryClient.invalidateQueries({ queryKey: journalKeys.managerStats() });
        },
    };
}

export default {
    useAdminJournals,
    useAdminJournalStats,
    useEmployeeJournals,
    useJournalDetail,
    useJournalInvalidation,
};
