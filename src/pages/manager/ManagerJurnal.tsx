
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import EnterpriseLayout from "@/components/layout/EnterpriseLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    LayoutDashboard, Clock, BarChart3, FileCheck, BookOpen, Search,
    Calendar as CalendarIcon, Clock as ClockIcon
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface JournalEntry {
    id: string;
    content: string;
    date: string;
    duration: number;
    user_id: string;
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

    useEffect(() => {
        fetchJournals();
    }, []);

    const fetchJournals = async () => {
        setIsLoading(true);
        try {
            // In a real app, Managers should only see their own department or team
            // For now, fetching all journals as per initial "Team Pulse" scope
            // We could filter by RLS policy on backend if department structure exists
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

    const getInitials = (name: string) => {
        return name.split(" ").map(n => n.charAt(0)).slice(0, 2).join("").toUpperCase();
    };

    const filteredJournals = journals.filter(journal =>
        journal.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        journal.content.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const menuSections = [
        {
            title: "Menu Utama",
            items: [
                { icon: LayoutDashboard, title: "Dashboard", href: "/manager" },
                { icon: Clock, title: "Rekap Absensi", href: "/manager/absensi" },
                { icon: BookOpen, title: "Jurnal Tim", href: "/manager/jurnal" }, // New
                { icon: BarChart3, title: "Laporan", href: "/manager/laporan" },
                { icon: FileCheck, title: "Kelola Cuti", href: "/manager/cuti" },
            ],
        },
    ];

    return (
        <EnterpriseLayout
            title="Update Tim"
            subtitle="Monitor aktivitas harian anggota tim"
            menuSections={menuSections}
            roleLabel="Manager"
            showRefresh={true}
            onRefresh={fetchJournals}
        >
            <div className="mb-6 flex items-center justify-between">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Cari aktivitas..."
                        className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {isLoading ? (
                <div className="text-center py-12">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                </div>
            ) : filteredJournals.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-slate-200 border-dashed">
                    <p className="text-slate-500">Belum ada update dari tim.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredJournals.map((journal) => (
                        <Card key={journal.id} className="overflow-hidden border-slate-200 shadow-sm hover:shadow-md transition-all">
                            <CardContent className="p-5">
                                <div className="flex gap-4">
                                    <Avatar className="h-10 w-10 border border-slate-100">
                                        <AvatarImage src={journal.profiles?.avatar_url || ""} />
                                        <AvatarFallback className="bg-blue-50 text-blue-600 font-semibold">{getInitials(journal.profiles?.full_name || "")}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h4 className="text-sm font-bold text-slate-800">{journal.profiles?.full_name}</h4>
                                                <p className="text-xs text-slate-500">{journal.profiles?.position || "Team Member"}</p>
                                            </div>
                                            <Badge variant="secondary" className="text-[10px] text-slate-500 bg-slate-100 gap-1 opacity-80">
                                                <CalendarIcon className="w-3 h-3" />
                                                {format(new Date(journal.date), "d MMM", { locale: id })}
                                            </Badge>
                                        </div>

                                        <div className="mt-3 text-sm text-slate-700 leading-relaxed bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                                            {journal.content}
                                        </div>

                                        <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                                            <span className="flex items-center gap-1">
                                                <ClockIcon className="w-3 h-3" />
                                                Durasi: {Math.floor(journal.duration / 60)}j {journal.duration % 60}m
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </EnterpriseLayout>
    );
};

export default ManagerJurnal;
