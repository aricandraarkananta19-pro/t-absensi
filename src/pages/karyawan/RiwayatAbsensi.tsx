import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  Clock, CheckCircle2, XCircle, AlertCircle, LogIn, LogOut, Briefcase, CalendarOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import MobileNavigation from "@/components/MobileNavigation";
import { generateAttendancePeriod, DailyAttendanceStatus } from "@/lib/attendanceGenerator";
import { startOfMonth, endOfMonth, addMonths, subMonths, format, isToday } from "date-fns";
import { id } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

// Brand Colors & Status Helpers
const getStatusColor = (status: string, isWeekend: boolean) => {
  if (isWeekend) return "bg-slate-100 border-slate-200 text-slate-400";
  switch (status) {
    case 'present': return "bg-emerald-50 border-emerald-100 text-emerald-700";
    case 'late': return "bg-amber-50 border-amber-100 text-amber-700";
    case 'early_leave': return "bg-blue-50 border-blue-100 text-blue-700";
    case 'absent': return "bg-red-50 border-red-100 text-red-700";
    case 'leave': return "bg-purple-50 border-purple-100 text-purple-700";
    case 'permission': return "bg-indigo-50 border-indigo-100 text-indigo-700";
    default: return "bg-slate-50 border-slate-100 text-slate-600";
  }
};

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
    const channel = supabase.channel('realtime-attendance-history')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance', filter: `user_id=eq.${user.id}` }, () => fetchAttendance())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, currentMonth, dateRange, viewMode]);

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
      // Use employee created_at if possible, but fallback to '2000-01-01' is fine for personal history as it just limits "Absent" generation
      const normalized = generateAttendancePeriod(start, end, data || []);
      setAttendanceList(normalized.reverse()); // Show newest first
    }
    setIsLoading(false);
  };

  const handlePrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));

  // Stats Check
  const stats = useMemo(() => {
    return {
      present: attendanceList.filter(l => l.status === 'present' || l.status === 'late' || l.status === 'early_leave').length,
      late: attendanceList.filter(l => l.status === 'late').length,
      absent: attendanceList.filter(l => l.status === 'absent' || l.status === 'alpha').length,
      leave: attendanceList.filter(l => l.status === 'leave' || l.status === 'permission').length,
    };
  }, [attendanceList]);

  const formatTime = (dateString: string | null) => {
    if (!dateString) return "--:--";
    return new Date(dateString).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  };

  // --- RENDER HELPERS ---
  const renderStatusIcon = (status: string, isWeekend: boolean, date: string) => {
    if (isToday(new Date(date)) && status === 'present' && !isWeekend) return <Clock className="h-4 w-4 text-emerald-600 animate-pulse" />;
    if (isWeekend) return <CalendarOff className="h-4 w-4 text-slate-300" />;

    switch (status) {
      case 'present': return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
      case 'late': return <AlertCircle className="h-4 w-4 text-amber-600" />;
      case 'early_leave': return <Clock className="h-4 w-4 text-blue-600" />;
      case 'absent': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'leave': return <Briefcase className="h-4 w-4 text-purple-600" />;
      default: return <Clock className="h-4 w-4 text-slate-300" />;
    }
  };

  const renderStatusText = (status: string, isWeekend: boolean) => {
    if (isWeekend) return "Libur Akhir Pekan";
    switch (status) {
      case 'present': return "Hadir Tepat Waktu";
      case 'late': return "Terlambat";
      case 'early_leave': return "Pulang Cepat";
      case 'absent': return "Tidak Hadir (Alpha)";
      case 'leave': return "Cuti / Izin";
      case 'future': return "Belum Berjalan";
      default: return "Tidak Ada Data";
    }
  };

  if (isMobile) {
    return (
      <div className="min-h-screen bg-slate-50 pb-24">
        {/* Native-like Header */}
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between px-4 py-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="-ml-2 text-slate-700">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex flex-col items-center">
              <h1 className="text-sm font-semibold text-slate-900">Riwayat Absensi</h1>
              <div className="flex items-center gap-2 text-xs text-slate-500" onClick={() => setViewMode(viewMode === 'monthly' ? 'range' : 'monthly')}>
                {viewMode === 'monthly' ? format(currentMonth, "MMMM yyyy", { locale: id }) : "Custom Range"}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="opacity-0 cursor-default">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </div>

          {/* Month Navigator (Only in Monthly Mode) */}
          {viewMode === 'monthly' && (
            <div className="flex items-center justify-between px-4 pb-3">
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-slate-200" onClick={handlePrevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-bold text-slate-800">{format(currentMonth, "MMMM yyyy", { locale: id })}</span>
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-slate-200" onClick={handleNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </header>

        {/* Summary Dashboard */}
        <div className="px-4 py-4 grid grid-cols-4 gap-2">
          <div className="bg-white rounded-xl p-2.5 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-bold text-emerald-600">{stats.present}</span>
            <span className="text-[10px] font-medium text-slate-500 uppercase mt-1">Hadir</span>
          </div>
          <div className="bg-white rounded-xl p-2.5 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-bold text-amber-500">{stats.late}</span>
            <span className="text-[10px] font-medium text-slate-500 uppercase mt-1">Telat</span>
          </div>
          <div className="bg-white rounded-xl p-2.5 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-bold text-red-500">{stats.absent}</span>
            <span className="text-[10px] font-medium text-slate-500 uppercase mt-1">Alpha</span>
          </div>
          <div className="bg-white rounded-xl p-2.5 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-bold text-purple-500">{stats.leave}</span>
            <span className="text-[10px] font-medium text-slate-500 uppercase mt-1">Cuti</span>
          </div>
        </div>

        {/* Timeline List */}
        <div className="px-4 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-8"><div className="animate-spin h-8 w-8 border-4 border-blue-600 rounded-full border-t-transparent"></div></div>
          ) : attendanceList.length > 0 ? (
            attendanceList.map((record, i) => {
              const isWeekendItem = record.status === 'weekend';
              const isFuture = record.status === 'future';
              if (isFuture) return null; // Optional: hide future

              return (
                <div key={record.date}
                  className={cn(
                    "relative flex items-center bg-white rounded-xl p-3 shadow-sm border transition-all",
                    getStatusColor(record.status, isWeekendItem),
                    isWeekendItem && "opacity-80"
                  )}
                >
                  {/* Left: Date Box */}
                  <div className="flex flex-col items-center justify-center w-12 h-12 bg-white/50 rounded-lg border border-black/5 shrink-0 mr-4">
                    <span className={cn("text-lg font-bold leading-none",
                      isWeekendItem ? "text-red-500" : "text-slate-800"
                    )}>
                      {format(new Date(record.date), "d")}
                    </span>
                    <span className="text-[10px] font-medium text-slate-500 uppercase mt-0.5">
                      {format(new Date(record.date), "EEE", { locale: id })}
                    </span>
                  </div>

                  {/* Middle: Status & Times */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      {renderStatusIcon(record.status, isWeekendItem, record.date)}
                      <span className={cn("text-xs font-bold truncate",
                        isWeekendItem ? "text-slate-400" :
                          record.status === 'absent' ? "text-red-600" :
                            record.status === 'late' ? "text-amber-600" : "text-slate-700"
                      )}>
                        {renderStatusText(record.status, isWeekendItem)}
                      </span>
                    </div>
                    {!isWeekendItem && record.status !== 'absent' ? (
                      <div className="flex items-center gap-3 text-xs text-slate-600">
                        <div className="flex items-center gap-1">
                          <LogIn className="h-3 w-3 text-emerald-500" />
                          <span className="font-mono">{formatTime(record.clockIn)}</span>
                        </div>
                        <div className="bg-slate-300 w-px h-3" />
                        <div className="flex items-center gap-1">
                          <LogOut className="h-3 w-3 text-blue-500" />
                          <span className="font-mono">{formatTime(record.clockOut)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-400 italic">
                        {isWeekendItem ? "Tidak ada jadwal kerja" : "Tidak ada catatan"}
                      </div>
                    )}
                  </div>

                  {/* Right: Duration or Indicator */}
                  {!isWeekendItem && record.clockIn && record.clockOut && (
                    <div className="text-[10px] font-medium text-slate-400 bg-white/60 px-2 py-1 rounded border border-black/5">
                      {(() => {
                        const start = new Date(record.clockIn);
                        const end = new Date(record.clockOut);
                        const diffMs = end.getTime() - start.getTime();
                        const hours = Math.floor(diffMs / (1000 * 60 * 60));
                        return `${hours}h`;
                      })()}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-slate-400">
              <CalendarOff className="h-10 w-10 mx-auto mb-2 opacity-20" />
              <p>Belum ada absensi bulan ini</p>
            </div>
          )}
        </div>

        <MobileNavigation />
      </div>
    );
  }

  // DESKTOP REMAINS PRETTY MUCH THE SAME, JUST CLEANED UP
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Riwayat Kehadiran</h1>
              <p className="text-sm text-slate-500">Lihat semua catatan absensi Anda</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 p-1 rounded-lg border border-slate-200">
            <Button
              variant={viewMode === 'monthly' ? 'white' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('monthly')}
              className={viewMode === 'monthly' ? 'shadow-sm text-blue-700' : 'text-slate-500'}
            >
              Bulanan
            </Button>
            <Button
              variant={viewMode === 'range' ? 'white' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('range')}
              className={viewMode === 'range' ? 'shadow-sm text-blue-700' : 'text-slate-500'}
            >
              Custom Range
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Controls */}
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4 flex justify-between items-center">
              {viewMode === 'monthly' ? (
                <div className="flex items-center gap-4">
                  <Button variant="outline" size="icon" onClick={handlePrevMonth}><ChevronLeft className="w-4 h-4" /></Button>
                  <span className="text-lg font-semibold w-48 text-center">{format(currentMonth, "MMMM yyyy", { locale: id })}</span>
                  <Button variant="outline" size="icon" onClick={handleNextMonth}><ChevronRight className="w-4 h-4" /></Button>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-[300px] justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
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

          {/* List */}
          <div className="grid gap-4">
            {attendanceList.map((record) => (
              <Card key={record.date} className={cn("border-slate-200 shadow-sm transition-all hover:shadow-md", record.status === 'weekend' && "bg-slate-50 opacity-70")}>
                <CardContent className="p-5 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-700 text-lg">{format(new Date(record.date), "d MMM yyyy", { locale: id })}</span>
                      <Badge variant="outline" className="font-normal text-slate-500">{record.dayName}</Badge>
                    </div>

                    {record.status !== 'weekend' && record.status !== 'future' && (
                      <div className="flex items-center gap-6 mt-2">
                        <span className="flex items-center gap-2 text-sm text-slate-600">
                          <LogIn className="w-4 h-4 text-emerald-600" />
                          Masuk: <span className="font-semibold">{formatTime(record.clockIn)}</span>
                        </span>
                        <span className="flex items-center gap-2 text-sm text-slate-600">
                          <LogOut className="w-4 h-4 text-blue-600" />
                          Pulang: <span className="font-semibold">{formatTime(record.clockOut)}</span>
                        </span>
                      </div>
                    )}
                    {record.status === 'absent' && <span className="text-sm text-red-500 font-medium block pt-1">Tidak Hadir (Alpha)</span>}
                  </div>

                  <div>
                    <Badge className={cn("px-3 py-1",
                      record.status === 'present' ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200" :
                        record.status === 'late' ? "bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200" :
                          record.status === 'absent' ? "bg-red-100 text-red-700 hover:bg-red-200 border-red-200" :
                            "bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200"
                    )}>
                      {renderStatusText(record.status, record.status === 'weekend')}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default RiwayatAbsensi;
