import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, Clock, CheckCircle2, XCircle, AlertCircle, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/useIsMobile";
import MobileNavigation from "@/components/MobileNavigation";

interface AttendanceRecord {
  id: string;
  clock_in: string;
  clock_out: string | null;
  status: string;
  created_at: string;
}

const RiwayatAbsensi = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchAttendance();
    }
  }, [user]);

  const fetchAttendance = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", user.id)
      .order("clock_in", { ascending: false })
      .limit(30);

    if (!error && data) {
      setAttendance(data);
    }
    setIsLoading(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return <Badge className="bg-success text-success-foreground gap-1"><CheckCircle2 className="h-3 w-3" />Hadir</Badge>;
      case "late":
        return <Badge className="bg-warning text-warning-foreground gap-1"><AlertCircle className="h-3 w-3" />Terlambat</Badge>;
      case "early_leave":
        return <Badge className="bg-info text-info-foreground gap-1"><Clock className="h-3 w-3" />Pulang Awal</Badge>;
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
      case "early_leave":
        return (
          <div className="ios-status-badge info">
            <span className="dot" />
            <span>Pulang Awal</span>
          </div>
        );
      default:
        return (
          <div className="ios-status-badge info">
            <span className="dot" />
            <span>{status}</span>
          </div>
        );
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatDateShort = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const calculateDuration = (clockIn: string, clockOut: string | null) => {
    if (!clockOut) return "-";

    const start = new Date(clockIn);
    const end = new Date(clockOut);
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}j ${minutes}m`;
  };

  // Group attendance by month
  const groupedAttendance = attendance.reduce((acc, record) => {
    const month = new Date(record.clock_in).toLocaleDateString("id-ID", {
      month: "long",
      year: "numeric"
    });
    if (!acc[month]) {
      acc[month] = [];
    }
    acc[month].push(record);
    return acc;
  }, {} as Record<string, AttendanceRecord[]>);

  // ==========================================
  // iOS MOBILE VIEW
  // ==========================================
  if (isMobile) {
    return (
      <div className="ios-mobile-container">
        {/* iOS Header */}
        <header className="ios-header" style={{ paddingBottom: "24px" }}>
          <div className="relative z-10">
            {/* Back Button Row */}
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => navigate("/dashboard")}
                className="p-2 -ml-2 rounded-full bg-white/10 active:bg-white/20 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-white" />
              </button>
              <div>
                <h1 className="text-lg font-semibold text-white">Riwayat Kehadiran</h1>
                <p className="text-sm text-white/70">30 hari terakhir</p>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="px-4 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : attendance.length === 0 ? (
            <div className="ios-card p-8 text-center">
              <XCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground">Belum Ada Riwayat</h3>
              <p className="text-muted-foreground">Data kehadiran Anda akan muncul di sini</p>
            </div>
          ) : (
            Object.entries(groupedAttendance).map(([month, records], monthIndex) => (
              <div key={month} className="mb-6">
                <h3 className="ios-section-header">{month}</h3>
                <div className="ios-list">
                  {records.map((record, index) => (
                    <div
                      key={record.id}
                      className="ios-list-item"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <div className={`ios-list-icon ${record.status === "present"
                          ? "bg-gradient-to-br from-green-500/20 to-green-500/10"
                          : record.status === "late"
                            ? "bg-gradient-to-br from-orange-500/20 to-orange-500/10"
                            : "bg-gradient-to-br from-blue-500/20 to-blue-500/10"
                        }`}>
                        {record.status === "present" ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : record.status === "late" ? (
                          <AlertCircle className="h-4 w-4 text-orange-500" />
                        ) : (
                          <Clock className="h-4 w-4 text-blue-500" />
                        )}
                      </div>
                      <div className="ios-list-content flex-1 min-w-0">
                        <p className="ios-list-title text-sm">
                          {formatDateShort(record.clock_in)}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <LogIn className="h-3 w-3 text-green-500" />
                            {formatTime(record.clock_in)}
                          </span>
                          <span className="text-muted-foreground text-xs">→</span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <LogOut className="h-3 w-3 text-blue-500" />
                            {record.clock_out ? formatTime(record.clock_out) : "-"}
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-muted-foreground">
                            {calculateDuration(record.clock_in, record.clock_out)}
                          </span>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {getIOSStatusBadge(record.status)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* iOS Bottom Navigation */}
        <MobileNavigation />
      </div>
    );
  }

  // ==========================================
  // DESKTOP VIEW (Original - Unchanged)
  // ==========================================
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info">
                <Calendar className="h-5 w-5 text-info-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Riwayat Kehadiran</h1>
                <p className="text-sm text-muted-foreground">30 hari terakhir</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-2xl">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : attendance.length === 0 ? (
            <Card className="border-border">
              <CardContent className="py-12 text-center">
                <XCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground">Belum Ada Riwayat</h3>
                <p className="text-muted-foreground">Data kehadiran Anda akan muncul di sini</p>
              </CardContent>
            </Card>
          ) : (
            Object.entries(groupedAttendance).map(([month, records], monthIndex) => (
              <div key={month} className="mb-8 animate-fade-in" style={{ animationDelay: `${monthIndex * 0.1}s` }}>
                <h2 className="text-lg font-semibold text-foreground mb-4">{month}</h2>
                <div className="space-y-3">
                  {records.map((record) => (
                    <Card
                      key={record.id}
                      className="border-border hover:shadow-md transition-shadow"
                    >
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">
                              {formatDate(record.clock_in)}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5 text-success" />
                                {formatTime(record.clock_in)}
                              </span>
                              <span>→</span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5 text-info" />
                                {record.clock_out ? formatTime(record.clock_out) : "-"}
                              </span>
                              <span className="text-xs bg-muted px-2 py-0.5 rounded">
                                {calculateDuration(record.clock_in, record.clock_out)}
                              </span>
                            </div>
                          </div>
                          <div>
                            {getStatusBadge(record.status)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default RiwayatAbsensi;
