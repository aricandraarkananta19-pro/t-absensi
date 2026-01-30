import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, Clock, CheckCircle2, XCircle, AlertCircle, LogIn, LogOut, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/useIsMobile";
import MobileNavigation from "@/components/MobileNavigation";
import { generateAttendancePeriod, DailyAttendanceStatus } from "@/lib/attendanceGenerator";
import { startOfMonth, endOfMonth, addMonths, subMonths, format } from "date-fns";
import { id } from "date-fns/locale";

const RiwayatAbsensi = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();

  // State for Month Selection
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const [attendanceList, setAttendanceList] = useState<DailyAttendanceStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchAttendance();
    }
  }, [user, currentMonth]);

  const fetchAttendance = async () => {
    if (!user) return;
    setIsLoading(true);

    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);

    // Fetch records for the selected month
    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", user.id)
      .gte("clock_in", start.toISOString())
      .lte("clock_in", end.toISOString())
      .order("clock_in", { ascending: false });

    if (!error) {
      // GENERATE COMPLETE PERIOD (The solution to the User's request)
      const normalized = generateAttendancePeriod(start, end, data || []);
      // Sort descending (newest first) for history view
      setAttendanceList(normalized.reverse());
    }

    setIsLoading(false);
  };

  const handlePrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const handleNextMonth = () => {
    const next = addMonths(currentMonth, 1);
    const today = new Date();
    if (next <= endOfMonth(today)) {
      setCurrentMonth(next);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return <Badge className="bg-success text-success-foreground gap-1"><CheckCircle2 className="h-3 w-3" />Hadir</Badge>;
      case "late":
        return <Badge className="bg-warning text-warning-foreground gap-1"><AlertCircle className="h-3 w-3" />Terlambat</Badge>;
      case "early_leave":
        return <Badge className="bg-info text-info-foreground gap-1"><Clock className="h-3 w-3" />Pulang Awal</Badge>;
      case "absent":
      case "alpha":
        return <Badge className="bg-destructive text-destructive-foreground gap-1"><XCircle className="h-3 w-3" />Alpha</Badge>;
      case "weekend":
        return <Badge variant="outline" className="text-muted-foreground gap-1">Libur</Badge>;
      case "future":
        return <Badge variant="secondary" className="text-muted-foreground">-</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getIOSStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return (
          <div className="ios-status-badge success">
            <span className="dot" />
            <span>Hadir</span>
          </div>
        );
      case "late":
        return (
          <div className="ios-status-badge warning">
            <span className="dot" />
            <span>Terlambat</span>
          </div>
        );
      case "absent":
      case "alpha":
        return (
          <div className="ios-status-badge error">
            <span className="dot bg-red-500" />
            <span className="text-red-600">Alpha</span>
          </div>
        );
      case "weekend":
        return (
          <div className="text-xs text-muted-foreground font-medium px-2 py-1 bg-gray-100 rounded-full">
            Libur
          </div>
        );
      default:
        return (
          <div className="ios-status-badge info">
            <span className="dot" />
            <span>{status === 'future' ? '-' : status}</span>
          </div>
        );
    }
  };

  const calculateDuration = (clockIn: string | null, clockOut: string | null) => {
    if (!clockIn || !clockOut) return "-";
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
  // iOS MOBILE VIEW - Native Feel
  // ==========================================
  if (isMobile) {
    return (
      <div className="ios-mobile-container">
        {/* iOS Header - Slim 56px */}
        <header className="ios-header-slim">
          <div className="relative z-10">
            {/* Back Button Row */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/dashboard")}
                className="ios-back-btn"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="ios-header-title">Riwayat Kehadiran</h1>
                <p className="ios-header-subtitle truncate">Periode Lengkap</p>
              </div>
            </div>

            {/* Month Selector - Compact */}
            <div className="flex items-center justify-between bg-white/10 rounded-xl p-1.5 mt-3">
              <button onClick={handlePrevMonth} className="p-2 text-white hover:bg-white/10 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-white font-medium text-[15px]">
                {format(currentMonth, "MMMM yyyy", { locale: id })}
              </span>
              <button onClick={handleNextMonth} className="p-2 text-white hover:bg-white/10 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Content - Employee List Cards */}
        <div className="pt-4 pb-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="ios-employee-list">
              {attendanceList.map((record, index) => (
                <div
                  key={record.date}
                  className={`ios-employee-card ${record.status === 'weekend' ? 'opacity-60' : ''}`}
                  style={{ animationDelay: `${index * 0.03}s` }}
                >
                  {/* Status Icon */}
                  <div className={`ios-employee-avatar ${record.status === "present" ? "bg-gradient-to-br from-green-500 to-green-600" :
                      record.status === "late" ? "bg-gradient-to-br from-orange-500 to-orange-600" :
                        record.status === "absent" || record.status === "alpha" ? "bg-gradient-to-br from-red-500 to-red-600" :
                          "bg-slate-300"
                    }`}>
                    {record.status === "present" ? <CheckCircle2 className="h-5 w-5 text-white" /> :
                      record.status === "late" ? <AlertCircle className="h-5 w-5 text-white" /> :
                        record.status === "absent" || record.status === "alpha" ? <XCircle className="h-5 w-5 text-white" /> :
                          <Calendar className="h-5 w-5 text-white" />}
                  </div>

                  {/* Info */}
                  <div className="ios-employee-info">
                    <p className="ios-employee-name">{record.formattedDate}</p>

                    {record.status !== 'weekend' && record.status !== 'future' && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="flex items-center gap-1 text-[12px] text-slate-500">
                          <LogIn className="h-3 w-3 text-green-500" />
                          {formatTime(record.clockIn)}
                        </span>
                        <span className="text-slate-400 text-[11px]">→</span>
                        <span className="flex items-center gap-1 text-[12px] text-slate-500">
                          <LogOut className="h-3 w-3 text-blue-500" />
                          {formatTime(record.clockOut)}
                        </span>
                        {record.clockIn && record.clockOut && (
                          <span className="text-[11px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">
                            {calculateDuration(record.clockIn, record.clockOut)}
                          </span>
                        )}
                      </div>
                    )}
                    {record.status === 'weekend' && <p className="ios-employee-dept">Hari Libur</p>}
                    {record.status === 'absent' && <p className="text-[12px] text-red-500 mt-0.5">Tidak ada kehadiran</p>}
                  </div>

                  {/* Status Badge */}
                  <div className="flex-shrink-0">
                    {record.status === "present" && (
                      <span className="ios-status-badge present"><span className="dot" />Hadir</span>
                    )}
                    {record.status === "late" && (
                      <span className="ios-status-badge late"><span className="dot" />Telat</span>
                    )}
                    {(record.status === "absent" || record.status === "alpha") && (
                      <span className="ios-status-badge absent"><span className="dot" />Alpha</span>
                    )}
                    {record.status === "weekend" && (
                      <span className="text-[11px] text-slate-400 font-medium px-2 py-1 bg-slate-100 rounded-lg">Libur</span>
                    )}
                    {record.status === "future" && (
                      <span className="text-[11px] text-slate-400 font-medium">-</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* iOS Bottom Navigation */}
        <MobileNavigation />
      </div>
    );
  }

  // ==========================================
  // DESKTOP VIEW
  // ==========================================
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info">
                  <Calendar className="h-5 w-5 text-info-foreground" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-foreground">Riwayat Kehadiran</h1>
                  <p className="text-sm text-muted-foreground">Periode: {format(currentMonth, "MMMM yyyy", { locale: id })}</p>
                </div>
              </div>
            </div>

            {/* Desktop Month Selector */}
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
              <Button variant="ghost" size="sm" onClick={handlePrevMonth}><ChevronLeft className="h-4 w-4" /></Button>
              <div className="w-40 text-center font-medium">
                {format(currentMonth, "MMMM yyyy", { locale: id })}
              </div>
              <Button variant="ghost" size="sm" onClick={handleNextMonth}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-3xl">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-4">
              {attendanceList.map((record, index) => (
                <Card
                  key={record.date}
                  className={`border-border hover:shadow-md transition-shadow ${record.status === 'weekend' ? 'bg-slate-50 opacity-70' : ''}`}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {record.formattedDate} <span className="text-muted-foreground ml-2 font-normal">({record.dayName})</span>
                        </p>

                        {record.status !== 'weekend' && record.status !== 'future' && (
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 text-success" />
                              {formatTime(record.clockIn)}
                            </span>
                            <span>→</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 text-info" />
                              {formatTime(record.clockOut)}
                            </span>
                            {record.clockIn && record.clockOut && (
                              <span className="text-xs bg-muted px-2 py-0.5 rounded">
                                {calculateDuration(record.clockIn, record.clockOut)}
                              </span>
                            )}
                          </div>
                        )}
                        {record.status === 'absent' && <p className="text-xs text-red-500 mt-2 font-medium">Tidak Hadir (Alpa)</p>}
                      </div>
                      <div>
                        {getStatusBadge(record.status)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default RiwayatAbsensi;
