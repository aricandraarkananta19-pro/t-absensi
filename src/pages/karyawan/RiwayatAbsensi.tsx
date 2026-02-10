
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  Download, FileSpreadsheet, FileText, Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import MobileNavigation from "@/components/MobileNavigation";
import { generateAttendancePeriod, DailyAttendanceStatus } from "@/lib/attendanceGenerator";
import { startOfMonth, endOfMonth, addMonths, subMonths, format } from "date-fns";
import { id } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { AttendanceStats } from "@/components/attendance/AttendanceStats";
import { AttendanceHistoryTable } from "@/components/attendance/AttendanceHistoryTable";
import { exportAttendanceExcel, exportAttendanceHRPDF } from "@/lib/attendanceExportUtils";
import { toast } from "@/hooks/use-toast";

const RiwayatAbsensi = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();

  // View Mode: 'monthly' or 'range'
  const [viewMode, setViewMode] = useState<'monthly' | 'range'>('monthly');

  // State for Selection
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });

  const [attendanceList, setAttendanceList] = useState<DailyAttendanceStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Realtime Subscription
  useEffect(() => {
    if (!user) return;

    let timeoutId: NodeJS.Timeout;

    const channel = supabase.channel('realtime-attendance-history')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance', filter: `user_id=eq.${user.id}` }, () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          fetchAttendance();
        }, 1000);
      })
      .subscribe();

    return () => {
      clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    if (user) fetchAttendance();
  }, [user, currentMonth, dateRange, viewMode]);

  const fetchAttendance = async () => {
    if (!user) return;
    setIsLoading(true);

    let start: Date, end: Date;

    if (viewMode === 'monthly') {
      start = startOfMonth(currentMonth);
      end = endOfMonth(currentMonth);
    } else {
      if (!dateRange?.from) { setIsLoading(false); return; }
      start = dateRange.from;
      end = dateRange.to || dateRange.from;
    }

    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", user.id)
      .gte("clock_in", start.toISOString())
      .lte("clock_in", new Date(end.getTime() + 86400000).toISOString())
      .order("clock_in", { ascending: false });

    if (!error) {
      const normalized = generateAttendancePeriod(start, end, data || []);
      setAttendanceList(normalized); // Show oldest first (Tanggal 1 diatas)
    }
    setIsLoading(false);
  };

  const handlePrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));

  // Stats Check
  const stats = useMemo(() => {
    return {
      present: attendanceList.filter(l => ['present', 'late', 'early_leave'].includes(l.status)).length,
      late: attendanceList.filter(l => l.status === 'late').length,
      absent: attendanceList.filter(l => ['absent', 'alpha'].includes(l.status)).length,
      leave: attendanceList.filter(l => ['leave', 'permission'].includes(l.status)).length,
      totalDays: attendanceList.length
    };
  }, [attendanceList]);

  const handleExport = (type: 'excel' | 'pdf') => {
    const reportTitle = `Riwayat_Absensi_${user?.email}_${format(currentMonth, 'MMM_yyyy')}`;

    // Construct data for export util
    const exportData = {
      period: viewMode === 'monthly' ? format(currentMonth, "MMMM yyyy", { locale: id }) : "Custom Range",
      periodStart: viewMode === 'monthly' ? format(startOfMonth(currentMonth), "yyyy-MM-dd") : format(dateRange?.from || new Date(), "yyyy-MM-dd"),
      periodEnd: viewMode === 'monthly' ? format(endOfMonth(currentMonth), "yyyy-MM-dd") : format(dateRange?.to || new Date(), "yyyy-MM-dd"),
      totalEmployees: 1,
      totalPresent: stats.present,
      totalAbsent: stats.absent,
      totalLate: stats.late,
      totalLeave: stats.leave,
      employees: [{
        name: user?.email || "Employee",
        department: "-",
        present: stats.present,
        absent: stats.absent,
        late: stats.late,
        leave: stats.leave,
        absentDates: [],
        lateDates: [],
        leaveDates: [],
        remarks: "-"
      }],
      leaveRequests: []
    };

    if (type === 'excel') exportAttendanceExcel(exportData, reportTitle);
    if (type === 'pdf') exportAttendanceHRPDF(exportData, reportTitle);

    toast({ title: "Export Berhasil", description: `Laporan ${type.toUpperCase()} telah diunduh.` });
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="-ml-2 text-slate-500 hover:text-slate-900">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Riwayat Kehadiran</h1>
              <p className="text-sm text-slate-500">Rekapitulasi absensi bulanan Anda</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="bg-slate-100 p-1 rounded-lg flex">
              <button
                onClick={() => setViewMode('monthly')}
                className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-all", viewMode === 'monthly' ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-900")}
              >
                Bulanan
              </button>
              <button
                onClick={() => setViewMode('range')}
                className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-all", viewMode === 'range' ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-900")}
              >
                Periode
              </button>
            </div>

            {/* Export Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-9">
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('excel')}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('pdf')}>
                  <FileText className="w-4 h-4 mr-2" /> PDF Document
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Filter Bar */}
        <Card className="border-slate-200 shadow-sm sticky top-[73px] z-20">
          <CardContent className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
            {viewMode === 'monthly' ? (
              <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
                <Button variant="outline" size="icon" onClick={handlePrevMonth}><ChevronLeft className="w-4 h-4" /></Button>
                <span className="text-lg font-bold w-48 text-center text-slate-800">{format(currentMonth, "MMMM yyyy", { locale: id })}</span>
                <Button variant="outline" size="icon" onClick={handleNextMonth}><ChevronRight className="w-4 h-4" /></Button>
              </div>
            ) : (
              <div className="flex items-center gap-4 w-full">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full sm:w-[280px] justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>{format(dateRange.from, "d MMM yyyy")} - {format(dateRange.to, "d MMM yyyy")}</>
                        ) : (
                          format(dateRange.from, "d MMM yyyy")
                        )
                      ) : (
                        <span>Pilih rentang tanggal</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Section */}
        <AttendanceStats stats={stats} loading={isLoading} />

        {/* Table Section */}
        <AttendanceHistoryTable data={attendanceList} isLoading={isLoading} />
      </main>

      {isMobile && <MobileNavigation />}
    </div>
  );
};

export default RiwayatAbsensi;
