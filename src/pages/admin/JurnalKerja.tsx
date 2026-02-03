
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import EnterpriseLayout from "@/components/layout/EnterpriseLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    LayoutDashboard, Users, Clock, BarChart3, Building2, Shield, Key,
    Settings, Database, BookOpen, Search, Filter, Calendar as CalendarIcon,
    CheckCircle2, AlertCircle, TrendingUp, User
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
    status: string;
    manager_notes?: string;
    verification_status?: string;
    profiles: {
        full_name: string;
        avatar_url: string | null;
        department: string | null;
        position: string | null;
    };
}

const JurnalKerja = () => {
    const { user } = useAuth();
    const [journals, setJournals] = useState<JournalEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [stats, setStats] = useState({
        totalToday: 0,
        avgDuration: 0,
        participationRate: 0
    });

    const menuSections = [
        {
            title: "Menu Utama",
            items: [
                { icon: LayoutDashboard, title: "Dashboard", href: "/dashboard" },
                { icon: Users, title: "Kelola Karyawan", href: "/admin/karyawan" },
                { icon: Clock, title: "Rekap Absensi", href: "/admin/absensi" },
                { icon: BookOpen, title: "Jurnal Kerja", href: "/admin/jurnal" }, // New Item
                { icon: BarChart3, title: "Laporan", href: "/admin/laporan" },
            ],
        },
        {
            title: "Pengaturan",
            items: [
                { icon: Building2, title: "Departemen", href: "/admin/departemen" },
                { icon: Shield, title: "Kelola Role", href: "/admin/role" },
                { icon: Key, title: "Reset Password", href: "/admin/reset-password" },
                { icon: Settings, title: "Pengaturan", href: "/admin/pengaturan" },
                { icon: Database, title: "Export Database", href: "/admin/export-database" },
            ],
        },
    ];

    useEffect(() => {
        fetchJournals();
    }, []);

    const fetchJournals = async () => {
        setIsLoading(true);
        try {
            // Fetch Journals with Profiles
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
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                // Cast to any/unknown to bypass complex joined type checking issue in this scaffold
                const typedData = data as unknown as JournalEntry[];
                setJournals(typedData);
                calculateStats(typedData);
            }
        } catch (error) {
            console.error("Error fetching journals:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const calculateStats = (data: JournalEntry[]) => {
        const todayStr = new Date().toISOString().split('T')[0];
        const todayJournals = data.filter(j => j.date === todayStr);

        const totalDuration = todayJournals.reduce((acc, curr) => acc + (curr.duration || 0), 0);
        const avgDuration = todayJournals.length > 0 ? Math.round(totalDuration / todayJournals.length) : 0;

        setStats({
            totalToday: todayJournals.length,
            avgDuration: avgDuration,
            participationRate: 0 // Need total employees for this, skipping for now or fetching separately
        });
    };

    const getInitials = (name: string) => {
        return name.split(" ").map(n => n.charAt(0)).slice(0, 2).join("").toUpperCase();
    };

    const filteredJournals = journals.filter(journal =>
        journal.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        journal.content.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <EnterpriseLayout
            title="Jurnal Kerja"
            subtitle="Insight harian tim dan aktivitas karyawan"
            menuSections={menuSections}
            roleLabel="Administrator"
            showRefresh={true}
            onRefresh={fetchJournals}
        >
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card className="bg-white shadow-sm border-slate-200">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-indigo-50 rounded-xl">
                            <BookOpen className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Jurnal Hari Ini</p>
                            <p className="text-2xl font-bold text-slate-900">{stats.totalToday}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white shadow-sm border-slate-200">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-emerald-50 rounded-xl">
                            <Clock className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Rata-rata Durasi</p>
                            <p className="text-2xl font-bold text-slate-900">
                                {Math.floor(stats.avgDuration / 60)}j {stats.avgDuration % 60}m
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white shadow-sm border-slate-200">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-amber-50 rounded-xl">
                            <TrendingUp className="w-6 h-6 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Status Tim</p>
                            <p className="text-2xl font-bold text-slate-900">Active</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="mb-6 flex flex-wrap items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="relative flex-1 min-w-[240px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Cari karyawan atau isi jurnal..."
                        className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" className="gap-2 border-slate-200 text-slate-600">
                        <Filter className="w-4 h-4" /> Filter
                    </Button>
                    <Button variant="outline" className="gap-2 border-slate-200 text-slate-600">
                        <CalendarIcon className="w-4 h-4" /> Tanggal
                    </Button>
                    <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                        <Database className="w-4 h-4" /> Export Data
                    </Button>
                </div>
            </div>

            {/* Journal List */}
            <div className="space-y-4">
                {isLoading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                        <p className="text-slate-500">Memuat data jurnal...</p>
                    </div>
                ) : filteredJournals.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-xl border border-slate-200 border-dashed">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <BookOpen className="w-8 h-8 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900">Belum ada jurnal</h3>
                        <p className="text-slate-500 max-w-sm mx-auto mt-1">
                            Belum ada data jurnal yang ditemukan untuk kriteria pencarian ini.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {filteredJournals.map((journal) => (
                            <Card key={journal.id} className="overflow-hidden hover:shadow-md transition-shadow border-slate-200">
                                <CardContent className="p-0">
                                    <div className="flex flex-col md:flex-row">
                                        {/* Left: User Info */}
                                        <div className="p-4 md:w-64 border-b md:border-b-0 md:border-r border-slate-100 bg-slate-50/50 flex flex-row md:flex-col items-center md:items-start gap-4 shrink-0">
                                            <Avatar className="h-10 w-10 md:h-12 md:w-12 border border-white shadow-sm">
                                                <AvatarImage src={journal.profiles?.avatar_url || ""} />
                                                <AvatarFallback className="bg-indigo-100 text-indigo-600 font-semibold">
                                                    {getInitials(journal.profiles?.full_name || "Unknown")}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0 text-left">
                                                <p className="font-semibold text-slate-900 truncate">
                                                    {journal.profiles?.full_name || "Unknown User"}
                                                </p>
                                                <p className="text-xs text-slate-500 truncate">
                                                    {journal.profiles?.department || "No Dept"} • {journal.profiles?.position || "Karyawan"}
                                                </p>
                                                <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                                                    <CalendarIcon className="w-3 h-3" />
                                                    {format(new Date(journal.date), "EEEE, d MMM yyyy", { locale: id })}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right: Content */}
                                        <div className="p-4 md:p-6 flex-1">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    {journal.status === 'approved' && (
                                                        <Badge className="bg-green-50 text-green-700 border-green-200">Disetujui</Badge>
                                                    )}
                                                    {journal.status === 'reviewed' && (
                                                        <Badge className="bg-blue-50 text-blue-700 border-blue-200">Direview</Badge>
                                                    )}
                                                    {journal.status === 'rejected' && (
                                                        <Badge className="bg-red-50 text-red-700 border-red-200">Ditolak</Badge>
                                                    )}
                                                    {(!journal.status || journal.status === 'submitted') && (
                                                        <Badge variant="outline" className="text-slate-500 border-slate-200">Menunggu</Badge>
                                                    )}
                                                </div>

                                                <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {Math.floor(journal.duration / 60)}h {journal.duration % 60}m
                                                </span>
                                            </div>

                                            <p className="text-slate-700 leading-relaxed text-sm whitespace-pre-wrap">
                                                {journal.content}
                                            </p>

                                            {/* Manager Notes */}
                                            {/* @ts-ignore - Notes might be missing in type def but present in DB/Cast */}
                                            {journal.manager_notes && (
                                                <div className="mt-4 p-3 bg-yellow-50/50 border border-yellow-100 rounded-lg text-sm">
                                                    <p className="text-xs font-semibold text-yellow-700 mb-1">Catatan Manager:</p>
                                                    <p className="text-slate-600">{journal.manager_notes}</p>
                                                </div>
                                            )}

                                            {/* AI Insight Placeholder */}
                                            {/* <div className="mt-4 p-3 bg-gradient-to-r from-slate-50 to-white border border-slate-100 rounded-lg flex gap-3">
                                                <Sparkles className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                                                <p className="text-xs text-slate-500">
                                                    <span className="font-medium text-indigo-900">AI Insight:</span> Fokus pada pengembangan fitur baru. Produktivitas tinggi.
                                                </p>
                                            </div> */}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </EnterpriseLayout>
    );
};

export default JurnalKerja;
