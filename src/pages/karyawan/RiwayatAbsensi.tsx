import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, Clock, CheckCircle2, XCircle, AlertCircle, LogIn, LogOut, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/useIsMobile";
import MobileNavigation from "@/components/MobileNavigation";
import { generateAttendancePeriod, DailyAttendanceStatus } from "@/lib/attendanceGenerator";
import { startOfMonth, endOfMonth, addMonths, subMonths, format, isToday } from "date-fns";
import { id } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

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

    const channel = supabase
      .channel('realtime-attendance-history')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance', filter: `user_id=eq.${user.id}` },
        () => {
          fetchAttendance(); // Refetch on change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, currentMonth, dateRange, viewMode]);

  useEffect(() => {
    if (user) {
      fetchAttendance();
    }
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

    // Fetch records
    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", user.id)
      .gte("clock_in", start.toISOString())
      .lte("clock_in", new Date(end.getTime() + 86400000).toISOString()) // Include end date fully
      .order("clock_in", { ascending: false });

    if (!error) {
      const normalized = generateAttendancePeriod(start, end, data || []);

      // Post-process for "Belum Pulang" logic
      const processed = normalized.map(item => {
        if (item.clockIn && !item.clockOut && isToday(new Date(item.date))) {
          // We can't change 'status' type easily on the fly without breaking interface or casting.
          // However, we can handle it in the UI rendering based on clockOut nullity.
          // Or we rely on 'present' status but render differently.
        }
        return item;
      });

      setAttendanceList(processed.reverse()); // Newest first
    }

    setIsLoading(false);
  };

  const handlePrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const handleNextMonth = () => {
    const next = addMonths(currentMonth, 1);
    const today = new Date();
    // Allow seeing next month (might have approved leaves)
    setCurrentMonth(next);
  };

  const getStatusBadge = (status: string, clockOut: string | null, date: string) => {
    // Override for "Not Clocked Out"
    if (status === 'present' && !clockOut && isToday(new Date(date))) {
      return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 gap-1 animate-pulse"><Clock className="h-3 w-3" />Belum Pulang</Badge>;
    }

    switch (status) {
      case "present":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 gap-1"><CheckCircle2 className="h-3 w-3" />Hadir</Badge>;
      case "late":
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 gap-1"><AlertCircle className="h-3 w-3" />Terlambat</Badge>;
      case "early_leave":
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 gap-1"><Clock className="h-3 w-3" />Pulang Cepat</Badge>;
      case "absent":
      case "alpha":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 gap-1"><XCircle className="h-3 w-3" />Alpha</Badge>;
      case "weekend":
        return <Badge variant="outline" className="text-slate-400 gap-1">Libur</Badge>;
      case "future":
        return <Badge variant="secondary" className="text-slate-300">-</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getIOSStatusBadge = (status: string, clockOut: string | null, date: string) => {
    if (status === 'present' && !clockOut && isToday(new Date(date))) {
      return (
        <span className="ios-status-badge info animate-pulse">
          <span className="dot" />
          <span>Belum Pulang</span>
        </span>
      );
    }

    switch (status) {
      case "present":
        return (
          <span className="ios-status-badge success">
            <span className="dot" />
            <span>Hadir</span>
          </span>
        );
      case "late":
        return (
          <span className="ios-status-badge warning">
            <span className="dot" />
            <span>Telat</span>
          </span>
        );
      case "absent":
      case "alpha":
        return (
          <span className="ios-status-badge error">
            <span className="dot bg-red-500" />
            <span className="text-red-600">Alpha</span>
          </span>
        );
      case "weekend":
        return (
          <span className="text-[11px] text-slate-400 font-medium px-2 py-1 bg-slate-100 rounded-lg">Libur</span>
        );
      default:
        return (
          <span className="ios-status-badge info">
            <span className="dot" />
            <span>{status === 'future' ? '-' : status}</span>
          </span>
        );
    }
  };

  const calculateDuration = (clockIn: string | null, clockOut: string | null) => {
    if (!clockIn) return "-";
    if (!clockOut) return "Berjalan";
    const start = new Date(clockIn);
    const end = new Date(clockOut);
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}j ${minutes}m`;
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  };

  // ==========================================
  // iOS MOBILE VIEW
  // ==========================================
  if (isMobile) {
    return (
      <div className="ios-mobile-container bg-slate-50">
        {/* iOS Header */}
        <header className="ios-header-slim sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200">
          <div className="flex flex-col gap-3 px-4 py-3 pt-[calc(env(safe-area-inset-top)+12px)]">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/dashboard")}
                className="ios-back-btn"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="flex-1">
                <h1 className="text-lg font-bold text-slate-900">Riwayat Absensi</h1>
              </div>
              <select
                className="text-xs bg-slate-100 rounded-lg py-1 px-2 border-none font-medium text-slate-600 focus:ring-0"
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as any)}
              >
                <option value="monthly">Bulanan</option>
                <option value="range">Range</option>
              </select>
            </div>

            {/* Controls */}
            {viewMode === 'monthly' ? (
              <div className="flex items-center justify-between bg-slate-100 rounded-xl p-1">
                <button onClick={handlePrevMonth} className="p-2 rounded-lg active:bg-white active:shadow-sm transition-all text-slate-500">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-sm font-semibold text-slate-700">
                  {format(currentMonth, "MMMM yyyy", { locale: id })}
                </span>
                <button onClick={handleNextMonth} className="p-2 rounded-lg active:bg-white active:shadow-sm transition-all text-slate-500">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-between bg-white border-slate-200 text-slate-700">
                    <span className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-slate-400" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>{format(dateRange.from, "d MMM")} - {format(dateRange.to, "d MMM")}</>
                        ) : format(dateRange.from, "d MMM")
                      ) : "Pilih Tanggal"}
                    </span>
                    <ChevronRight className="h-4 w-4 rotate-90 text-slate-400" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center">
                  <CalendarComponent
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={1}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
        </header>

        {/* List Content */}
        <div className="px-4 pb-24 pt-4 space-y-3 min-h-screen">
          {isLoading ? (
            <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
          ) : attendanceList.length > 0 ? (
            attendanceList.map((record, index) => (
              <div
                key={record.date}
                className={cn(
                  "bg-white rounded-2xl p-4 shadow-sm border border-slate-100 relative overflow-hidden active:scale-[0.98] transition-all",
                  record.status === 'weekend' && "opacity-60 bg-slate-50"
                )}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-[15px] font-bold text-slate-900">{record.formattedDate}</p>
                    <p className="text-xs text-slate-500">{record.dayName}</p>
                  </div>
                  {getIOSStatusBadge(record.status, record.clockOut, record.date)}
                </div>

                {record.status !== 'weekend' && record.status !== 'future' ? (
                  <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-2.5">
                    <div className="flex items-center gap-1.5 min-w-[60px]">
                      <LogIn className="w-3.5 h-3.5 text-green-600" />
                      <span className="text-sm font-semibold text-slate-700">{formatTime(record.clockIn)}</span>
                    </div>
                    <span className="text-slate-300">|</span>
                    <div className="flex items-center gap-1.5 min-w-[60px]">
                      <LogOut className="w-3.5 h-3.5 text-blue-600" />
                      <span className="text-sm font-semibold text-slate-700">{formatTime(record.clockOut)}</span>
                    </div>
                    <div className="ml-auto text-xs font-medium text-slate-400 bg-white px-2 py-1 rounded-md shadow-sm border border-slate-100">
                      {calculateDuration(record.clockIn, record.clockOut)}
                    </div>
                  </div>
                ) : (
                  record.status === 'absent' && <p className="text-xs text-red-500 font-medium bg-red-50 p-2 rounded-lg">Tidak ada catatan kehadiran</p>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-10 text-slate-400">Tidak ada data</div>
          )}
        </div>

        <MobileNavigation />
      </div>
    );
  }

  // ==========================================
  // DESKTOP VIEW
  // ==========================================
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
                      <span className="font-bold text-slate-700 text-lg">{record.formattedDate}</span>
                      <Badge variant="outline" className="font-normal text-slate-500">{record.dayName}</Badge>
                    </div>

                    {record.status !== 'weekend' && record.status !== 'future' && (
                      <div className="flex items-center gap-6 mt-2">
                        <span className="flex items-center gap-2 text-sm text-slate-600">
                          <LogIn className="w-4 h-4 text-green-600" />
                          Masuk: <span className="font-semibold">{formatTime(record.clockIn)}</span>
                        </span>
                        <span className="flex items-center gap-2 text-sm text-slate-600">
                          <LogOut className="w-4 h-4 text-blue-600" />
                          Pulang: <span className="font-semibold">{formatTime(record.clockOut)}</span>
                        </span>
                        <span className="text-xs font-semibold bg-slate-100 text-slate-500 px-2 py-1 rounded">
                          Durasi: {calculateDuration(record.clockIn, record.clockOut)}
                        </span>
                      </div>
                    )}
                    {record.status === 'absent' && <span className="text-sm text-red-500 font-medium block pt-1">Tidak Hadir</span>}
                  </div>

                  <div>
                    {getStatusBadge(record.status, record.clockOut, record.date)}
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
