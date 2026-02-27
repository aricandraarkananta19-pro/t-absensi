
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
        remarks: "-",
        dailyStatus: {}
      }],
      leaveRequests: []
    };

    if (type === 'excel') exportAttendanceExcel(exportData, reportTitle);
    if (type === 'pdf') exportAttendanceHRPDF(exportData, reportTitle);

    toast({ title: "Export Berhasil", description: `Laporan ${type.toUpperCase()} telah diunduh.` });
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20 font-['Inter',sans-serif] relative overflow-x-hidden text-slate-900">

      {/* Background Graphic Abstract */}
      <div className="absolute top-0 right-0 -z-0 w-[60vw] h-[40vh] bg-blue-100/40 rounded-full blur-[100px] pointer-events-none opacity-60 transform translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 left-0 -z-0 w-[40vw] h-[40vh] bg-emerald-100/30 rounded-full blur-[100px] pointer-events-none opacity-60 transform -translate-x-1/2 translate-y-1/2"></div>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10 space-y-8">

        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex flex-col items-start gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="text-slate-500 hover:text-slate-800 hover:bg-white/50 border border-transparent hover:border-slate-200/60 rounded-xl transition-all shadow-sm bg-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Kembali ke Dashboard
            </Button>
            <div>
              <h1 className="text-3xl lg:text-4xl font-extrabold text-slate-800 tracking-tight">Riwayat Kehadiran</h1>
              <p className="text-slate-500 font-medium text-sm mt-2 max-w-md">Pantau rekam jejak presensi Anda secara transparan dan real-time.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 bg-white/70 backdrop-blur-md p-2 rounded-[20px] shadow-sm border border-white/40 vibe-glass-card">
            {/* View Mode Toggle */}
            <div className="bg-slate-100/50 p-1.5 rounded-xl flex gap-1">
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

            <div className="w-px h-8 bg-slate-200/60 hidden sm:block mx-1"></div>

            {/* Export Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-10 px-4 rounded-xl border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition-all">
                  <Download className="w-4 h-4 text-slate-500" />
                  <span className="hidden sm:inline">Unduh Laporan</span>
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
        </header>

        {/* Filter Bar */}
        <div className="bg-white/70 backdrop-blur-md border border-white/60 shadow-lg shadow-slate-200/40 rounded-[24px] p-5 sm:p-6 lg:p-8 vibe-glass-card">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/50">

            {viewMode === 'monthly' ? (
              <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start pt-4 sm:pt-0 pr-0 sm:pr-8">
                <Button variant="outline" size="icon" onClick={handlePrevMonth} className="rounded-xl border-slate-200 hover:bg-slate-100 bg-white shadow-sm"><ChevronLeft className="w-4 h-4 text-slate-600" /></Button>
                <span className="text-xl font-extrabold w-48 text-center text-slate-800 tracking-tight">{format(currentMonth, "MMMM yyyy", { locale: id })}</span>
                <Button variant="outline" size="icon" onClick={handleNextMonth} className="rounded-xl border-slate-200 hover:bg-slate-100 bg-white shadow-sm"><ChevronRight className="w-4 h-4 text-slate-600" /></Button>
              </div>
            ) : (
              <div className="flex items-center gap-4 w-full pt-4 sm:pt-0 pb-4 sm:pb-0">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full sm:w-[320px] justify-start text-left font-semibold rounded-xl border-slate-200 bg-white h-12 shadow-sm text-slate-700", !dateRange && "text-slate-400")}>
                      <CalendarIcon className="mr-3 h-5 w-5 text-blue-500" />
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

            <div className="w-full sm:w-auto flex-1 pl-0 sm:pl-8 pt-4 sm:pt-0">
              <div className="flex items-center justify-between sm:justify-end gap-3 text-sm font-semibold text-slate-500">
                <span className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/30"></div> Total: {stats.totalDays} Hari</span>
                <span className="flex items-center gap-2"><Filter className="w-4 h-4" /> Filter Aktif</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <AttendanceStats stats={stats} loading={isLoading} />
        </div>

        {/* Table Section */}
        <div className="bg-white/80 backdrop-blur-md rounded-[32px] border border-white shadow-xl shadow-slate-200/40 overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100 p-2 sm:p-6">
          <AttendanceHistoryTable data={attendanceList} isLoading={isLoading} />
        </div>
      </div>

      {isMobile && <MobileNavigation />}
    </div>
  );
};

export default RiwayatAbsensi;
