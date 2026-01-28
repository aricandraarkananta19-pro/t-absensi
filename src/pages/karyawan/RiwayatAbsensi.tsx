import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
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
                  {records.map((record, index) => (
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
