
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FileDown, Calendar as CalendarIcon, FileSpreadsheet, BookOpen, Sparkles, Building2, Loader2, CheckCircle2 } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, isSameDay } from "date-fns";
import { id } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DateRange } from "react-day-picker";

interface JournalExportModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function JournalExportModal({ open, onOpenChange }: JournalExportModalProps) {
    // ---- STATE ----
    const [formatType, setFormatType] = useState<"pdf_summary" | "pdf_detail" | "excel">("pdf_summary");
    const [scope, setScope] = useState<"all" | "approved" | "pending">("approved");
    const [department, setDepartment] = useState<string>("all");
    const [status, setStatus] = useState<"idle" | "fetching" | "generating" | "complete">("idle");
    const [departmentsList, setDepartmentsList] = useState<string[]>([]);

    // Period Selection
    const [periodType, setPeriodType] = useState<"this_week" | "this_month" | "last_month" | "custom">("this_week");
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: startOfWeek(new Date(), { weekStartsOn: 1 }),
        to: endOfWeek(new Date(), { weekStartsOn: 1 })
    });

    // ---- EFFECTS ----
    useEffect(() => {
        if (open) {
            fetchDepartments();
            setPeriodType("this_week");
            setDateRange({
                from: startOfWeek(new Date(), { weekStartsOn: 1 }),
                to: endOfWeek(new Date(), { weekStartsOn: 1 })
            });
            setStatus("idle");
        }
    }, [open]);

    // Handle Period Presets
    const handlePeriodChange = (type: "this_week" | "this_month" | "last_month" | "custom") => {
        setPeriodType(type);
        const today = new Date();

        switch (type) {
            case "this_week":
                setDateRange({
                    from: startOfWeek(today, { weekStartsOn: 1 }),
                    to: endOfWeek(today, { weekStartsOn: 1 })
                });
                break;
            case "this_month":
                setDateRange({
                    from: startOfMonth(today),
                    to: endOfMonth(today)
                });
                break;
            case "last_month":
                const lastMonth = subMonths(today, 1);
                setDateRange({
                    from: startOfMonth(lastMonth),
                    to: endOfMonth(lastMonth)
                });
                break;
            case "custom":
                // Keep existing or reset if empty
                if (!dateRange?.from) setDateRange({ from: today, to: today });
                break;
        }
    };

    const fetchDepartments = async () => {
        try {
            const { data } = await supabase.from('profiles').select('department');
            if (data) {
                const uniqueDepts = [...new Set(data.map(d => d.department).filter(Boolean))];
                setDepartmentsList(uniqueDepts.sort());
            }
        } catch (e) {
            console.error("Failed to fetch departments", e);
        }
    };

    // ---- EXPORT LOGIC ----
    const handleExport = async () => {
        if (!dateRange?.from || !dateRange?.to) {
            toast({ variant: "destructive", title: "Periode Invalid", description: "Mohon pilih rentang tanggal." });
            return;
        }

        setStatus("fetching");

        try {
            // 1. Dynamic Import for Performance
            const [jsPDF, autoTable] = await Promise.all([
                import("jspdf").then(m => m.default),
                import("jspdf-autotable").then(m => m.default)
            ]);

            // 2. Fetch Journals - CRITICAL: Exclude soft-deleted items
            let query = supabase
                .from('work_journals')
                .select(`id, date, content, work_result, obstacles, mood, verification_status, user_id`)
                .is('deleted_at', null) // CRITICAL: Exclude soft-deleted items
                .gte('date', format(dateRange.from, 'yyyy-MM-dd'))
                .lte('date', format(dateRange.to, 'yyyy-MM-dd'))
                .order('date', { ascending: true });

            if (scope === 'approved') query = query.eq('verification_status', 'approved');
            // if (scope === 'pending') query = query.eq('verification_status', 'submitted'); // Optional

            const { data: rawJournals, error: journalError } = await query;
            if (journalError) throw journalError;

            if (!rawJournals || rawJournals.length === 0) {
                toast({ variant: "destructive", title: "Data Kosong", description: "Tidak ada jurnal di periode ini." });
                setStatus("idle");
                return;
            }

            // 3. Fetch Profiles & Filter by Department
            const userIds = [...new Set(rawJournals.map(j => j.user_id))];

            let profileQuery = supabase.from('profiles').select('user_id, full_name, position, department').in('user_id', userIds);
            if (department !== 'all') {
                profileQuery = profileQuery.eq('department', department);
            }

            const { data: profiles, error: profileError } = await profileQuery;
            if (profileError) throw profileError;

            if (!profiles || profiles.length === 0) {
                toast({ variant: "destructive", title: "Filter Departemen", description: "Tidak ada karyawan di departemen ini yang memiliki jurnal." });
                setStatus("idle");
                return;
            }

            const profileMap = new Map(profiles.map(p => [p.user_id, p]));

            // 4. Merge & Final Filter
            // Only keep journals where we found a profile (handles department filtering)
            const finalData = rawJournals
                .filter(j => profileMap.has(j.user_id))
                .map(journal => ({
                    ...journal,
                    profiles: profileMap.get(journal.user_id) || { full_name: 'Unknown', position: '-', department: '-' }
                }));

            if (finalData.length === 0) {
                toast({ variant: "destructive", title: "Data Kosong", description: "Tidak ada data setelah filter departemen diterapkan." });
                setStatus("idle");
                return;
            }

            setStatus("generating");

            // 5. Generate Report
            const fileName = `Report_${department === 'all' ? 'All' : department}_${format(dateRange.from, 'ddMM')}-${format(dateRange.to, 'ddMM')}`;

            if (formatType === 'pdf_summary') {
                await generateSummaryPDF(finalData, jsPDF, fileName);
            } else if (formatType === 'pdf_detail') {
                await generateDetailPDF(finalData, jsPDF, autoTable, fileName);
            } else {
                await generateExcel(finalData, fileName);
            }

            toast({ title: "Selesai", description: "Laporan berhasil diunduh." });
            setStatus("complete");
            setTimeout(() => {
                onOpenChange(false);
                setStatus("idle");
            }, 1000);

        } catch (error: any) {
            console.error("Export Error:", error);
            toast({ variant: "destructive", title: "Gagal Export", description: error.message || "Terjadi kesalahan sistem." });
            setStatus("idle");
        }
    };

    // ---- GENERATORS ----
    const generateSummaryPDF = async (data: any[], jsPDF: any, fileName: string) => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        let yPos = 20;

        const centerText = (text: string, y: number, fontSize = 12, font = "normal", color = 0) => {
            doc.setFontSize(fontSize);
            doc.setFont("helvetica", font);
            doc.setTextColor(color);
            const textWidth = doc.getTextWidth(text);
            doc.text(text, (pageWidth - textWidth) / 2, y);
        };

        // Title
        centerText("Executive Work Journal Summary", yPos, 22, "bold");
        yPos += 10;

        // Metadata
        const dateStr = dateRange?.from && dateRange?.to ?
            `${format(dateRange.from, "d MMMM", { locale: id })} - ${format(dateRange.to, "d MMMM yyyy", { locale: id })}` : "Periode Custom";

        centerText(`Period: ${dateStr}`, yPos, 10, "normal", 100);
        yPos += 7;
        centerText(`Department: ${department === 'all' ? 'All Departments' : department}`, yPos, 10, "normal", 100);
        yPos += 20;

        // Metrics
        const uniqueUsers = new Set(data.map(d => d.profiles.full_name)).size;
        const totalEntries = data.length;
        const completedCount = data.filter(d => d.work_result === 'completed').length;
        const completionRate = totalEntries > 0 ? Math.round((completedCount / totalEntries) * 100) : 0;

        const boxWidth = 40;
        const startX = (pageWidth - (boxWidth * 3 + 20)) / 2;

        const metrics = [
            { label: "Active Employees", val: uniqueUsers },
            { label: "Total Entries", val: totalEntries },
            { label: "Completion Rate", val: `${completionRate}%` }
        ];

        metrics.forEach((m, i) => {
            const x = startX + (i * (boxWidth + 10));
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(x, yPos, boxWidth, 30, 3, 3, "FD");

            doc.setFontSize(9);
            doc.setTextColor(100);
            doc.text(m.label, x + (boxWidth / 2), yPos + 10, { align: 'center' });

            doc.setFontSize(16);
            doc.setTextColor(15, 23, 42);
            doc.setFont("helvetica", "bold");
            doc.text(String(m.val), x + (boxWidth / 2), yPos + 22, { align: 'center' });
        });

        yPos += 45;

        // Divider
        doc.setDrawColor(226, 232, 240);
        doc.line(20, yPos, pageWidth - 20, yPos);
        yPos += 20;

        // Employee Breakdown
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text("Activity Breakdown By Employee", 20, yPos);
        yPos += 15;

        const empMap: Record<string, any> = {};
        data.forEach(d => {
            const name = d.profiles.full_name;
            if (!empMap[name]) empMap[name] = { total: 0, completed: 0, obstacles: 0 };
            empMap[name].total++;
            if (d.work_result === 'completed') empMap[name].completed++;
            if (d.obstacles) empMap[name].obstacles++;
        });

        // Simple List
        Object.keys(empMap).sort().forEach((name) => {
            if (yPos > 270) { doc.addPage(); yPos = 20; }

            const stats = empMap[name];
            const rate = Math.round((stats.completed / stats.total) * 100);

            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(226, 232, 240);
            // doc.roundedRect(20, yPos, pageWidth - 40, 15, 2, 2, "S");

            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(30, 41, 59);
            doc.text(name, 20, yPos);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`${stats.total} entries`, 100, yPos);
            doc.text(`${rate}% success`, 140, yPos);

            if (stats.obstacles > 0) {
                doc.setTextColor(220, 38, 38);
                doc.text(`${stats.obstacles} issues`, 180, yPos);
            } else {
                doc.setTextColor(22, 163, 74);
                doc.text("Smooth", 180, yPos);
            }

            yPos += 10;
        });

        doc.save(`${fileName}_Summary.pdf`);
    };

    const generateDetailPDF = async (data: any[], jsPDF: any, autoTable: any, fileName: string) => {
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text("Detailed Work Journal Log", 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(100);
        const dateStr = dateRange?.from && dateRange?.to ?
            `${format(dateRange.from, "d MMM yyyy", { locale: id })} - ${format(dateRange.to, "d MMM yyyy", { locale: id })}` : "";
        doc.text(`Period: ${dateStr}`, 14, 28);

        const tableBody = data.map(item => [
            format(new Date(item.date), "dd/MM"),
            item.profiles.full_name,
            item.profiles.department || "-",
            item.content,
            item.work_result,
            item.obstacles || "-"
        ]);

        autoTable(doc, {
            startY: 35,
            head: [['Date', 'Name', 'Dept', 'Activity', 'Result', 'Issues']],
            body: tableBody,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2 },
            columnStyles: {
                0: { cellWidth: 15 },
                1: { cellWidth: 25 },
                2: { cellWidth: 20 },
                3: { cellWidth: 'auto' }, // Activity gets remaining space
                4: { cellWidth: 20 },
                5: { cellWidth: 30 },
            }
        });

        doc.save(`${fileName}_Detail.pdf`);
    };

    const generateExcel = async (data: any[], fileName: string) => {
        const headers = ["Tanggal", "Nama Karyawan", "Departemen", "Posisi", "Aktivitas", "Hasil Kerja", "Kendala", "Mood", "Status"];
        const rows = data.map(item => [
            item.date,
            `"${item.profiles.full_name.replace(/"/g, '""')}"`,
            `"${item.profiles.department?.replace(/"/g, '""') || ''}"`,
            `"${item.profiles.position?.replace(/"/g, '""') || ''}"`,
            `"${item.content.replace(/"/g, '""')}"`,
            item.work_result,
            `"${item.obstacles?.replace(/"/g, '""') || ''}"`,
            item.mood,
            item.verification_status
        ]);

        const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `${fileName}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { if (status === 'idle') onOpenChange(v) }}>
            <DialogContent className="sm:max-w-[600px] gap-0 p-0 overflow-hidden bg-white">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <FileDown className="w-5 h-5 text-blue-600" />
                        Export Laporan Jurnal
                    </DialogTitle>
                    <DialogDescription>
                        Unduh data jurnal kinerja tim dalam format yang Anda butuhkan.
                    </DialogDescription>
                </DialogHeader>

                <div className="p-6 grid gap-6">
                    {/* 1. Format Selection */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                            { id: 'pdf_summary', label: 'Summary', icon: Sparkles, color: 'text-purple-600', bg: 'bg-purple-50', activeBorder: 'border-purple-500' },
                            { id: 'pdf_detail', label: 'Detailed Log', icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-50', activeBorder: 'border-blue-500' },
                            { id: 'excel', label: 'Excel / CSV', icon: FileSpreadsheet, color: 'text-green-600', bg: 'bg-green-50', activeBorder: 'border-green-500' }
                        ].map((item) => (
                            <div
                                key={item.id}
                                onClick={() => setFormatType(item.id as any)}
                                className={cn(
                                    "cursor-pointer flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all gap-2 text-center h-24",
                                    formatType === item.id
                                        ? `${item.activeBorder} ${item.bg}`
                                        : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                                )}
                            >
                                <item.icon className={cn("w-6 h-6", item.color)} />
                                <span className={cn("text-xs font-bold text-slate-700")}>{item.label}</span>
                            </div>
                        ))}
                    </div>

                    <div className="grid sm:grid-cols-2 gap-6">
                        {/* 2. Period Selection */}
                        <div className="space-y-3">
                            <Label className="text-xs font-bold text-slate-500 uppercase">Periode Waktu</Label>
                            <Select value={periodType} onValueChange={(v: any) => handlePeriodChange(v)}>
                                <SelectTrigger className="h-10">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="this_week">Minggu Ini</SelectItem>
                                    <SelectItem value="this_month">Bulan Ini</SelectItem>
                                    <SelectItem value="last_month">Bulan Lalu</SelectItem>
                                    <SelectItem value="custom">Custom Range</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Date Picker Display */}
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !dateRange && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
                                        {dateRange?.from ? (
                                            dateRange.to ? (
                                                <span className="text-xs">
                                                    {format(dateRange.from, "d MMM", { locale: id })} - {format(dateRange.to, "d MMM yyyy", { locale: id })}
                                                </span>
                                            ) : (
                                                format(dateRange.from, "d MMM yyyy", { locale: id })
                                            )
                                        ) : (
                                            <span>Pilih Tanggal</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        initialFocus
                                        mode="range"
                                        defaultMonth={dateRange?.from}
                                        selected={dateRange}
                                        onSelect={(range) => {
                                            setDateRange(range);
                                            if (range?.from && range?.to) setPeriodType('custom');
                                        }}
                                        numberOfMonths={2}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* 3. Filter Options */}
                        <div className="space-y-3">
                            <Label className="text-xs font-bold text-slate-500 uppercase">Filter Data</Label>

                            {/* Department */}
                            <Select value={department} onValueChange={setDepartment}>
                                <SelectTrigger className="h-10">
                                    <Building2 className="w-3.5 h-3.5 mr-2 text-slate-400" />
                                    <SelectValue placeholder="Semua Departemen" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Departemen</SelectItem>
                                    {departmentsList.map(d => (
                                        <SelectItem key={d} value={d}>{d}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* Scope */}
                            <Select value={scope} onValueChange={(v: any) => setScope(v)}>
                                <SelectTrigger className="h-10">
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-slate-400" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="approved">Hanya Disetujui (Approved)</SelectItem>
                                    <SelectItem value="all">Semua Status</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-6 pt-2 bg-slate-50 border-t border-slate-100 gap-3">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={status !== 'idle'}>
                        Batal
                    </Button>
                    <Button
                        onClick={handleExport}
                        disabled={status !== 'idle' || !dateRange?.from || !dateRange?.to}
                        className={cn(
                            "min-w-[140px] gap-2 transition-all",
                            status === 'complete' ? "bg-green-600 hover:bg-green-700" : "bg-slate-900 hover:bg-slate-800"
                        )}
                    >
                        {status === 'idle' && <><FileDown className="w-4 h-4" /> Download Report</>}
                        {status === 'fetching' && <><Loader2 className="w-4 h-4 animate-spin" /> Mengambil Data...</>}
                        {status === 'generating' && <><Loader2 className="w-4 h-4 animate-spin" /> Menulis PDF...</>}
                        {status === 'complete' && <><CheckCircle2 className="w-4 h-4" /> Selesai!</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
