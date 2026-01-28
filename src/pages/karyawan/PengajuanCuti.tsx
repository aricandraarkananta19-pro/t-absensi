import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft, FileText, Calendar, Plus, Clock, CheckCircle2,
  XCircle, AlertCircle, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useSystemSettings } from "@/hooks/useSystemSettings";

const leaveSchema = z.object({
  leave_type: z.string().min(1, "Pilih jenis cuti"),
  start_date: z.string().min(1, "Tanggal mulai harus diisi"),
  end_date: z.string().min(1, "Tanggal selesai harus diisi"),
  reason: z.string().min(10, "Alasan minimal 10 karakter"),
}).refine((data) => new Date(data.end_date) >= new Date(data.start_date), {
  message: "Tanggal selesai harus setelah tanggal mulai",
  path: ["end_date"],
});

type LeaveFormData = z.infer<typeof leaveSchema>;

interface LeaveRequest {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
}

const PengajuanCuti = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useSystemSettings();
  const [isLoading, setIsLoading] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [usedLeaveDays, setUsedLeaveDays] = useState(0);

  const form = useForm<LeaveFormData>({
    resolver: zodResolver(leaveSchema),
    defaultValues: {
      leave_type: "",
      start_date: "",
      end_date: "",
      reason: "",
    },
  });

  useEffect(() => {
    if (user) {
      fetchLeaveRequests();
      fetchUsedLeaveDays();
    }
  }, [user]);

  const fetchUsedLeaveDays = async () => {
    if (!user) return;

    const currentYear = new Date().getFullYear();
    const { data } = await supabase
      .from("leave_requests")
      .select("start_date, end_date")
      .eq("user_id", user.id)
      .eq("status", "approved")
      .eq("leave_type", "cuti")
      .gte("start_date", `${currentYear}-01-01`)
      .lte("end_date", `${currentYear}-12-31`);

    if (data) {
      const totalDays = data.reduce((acc, leave) => {
        const start = new Date(leave.start_date);
        const end = new Date(leave.end_date);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return acc + diffDays;
      }, 0);
      setUsedLeaveDays(totalDays);
    }
  };

  const fetchLeaveRequests = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setLeaveRequests(data);
    }
    setIsFetching(false);
  };

  const onSubmit = async (data: LeaveFormData) => {
    if (!user) return;
    setIsLoading(true);

    const { error } = await supabase.from("leave_requests").insert({
      user_id: user.id,
      leave_type: data.leave_type,
      start_date: data.start_date,
      end_date: data.end_date,
      reason: data.reason,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Gagal mengajukan cuti",
        description: error.message,
      });
    } else {
      toast({
        title: "Pengajuan berhasil",
        description: "Pengajuan cuti Anda sedang diproses.",
      });
      form.reset();
      setDialogOpen(false);
      fetchLeaveRequests();
    }

    setIsLoading(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("leave_requests")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Gagal menghapus",
        description: error.message,
      });
    } else {
      toast({
        title: "Berhasil dihapus",
        description: "Pengajuan cuti telah dibatalkan.",
      });
      fetchLeaveRequests();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-success text-success-foreground gap-1"><CheckCircle2 className="h-3 w-3" />Disetujui</Badge>;
      case "rejected":
        return <Badge className="bg-destructive text-destructive-foreground gap-1"><XCircle className="h-3 w-3" />Ditolak</Badge>;
      default:
        return <Badge className="bg-warning text-warning-foreground gap-1"><Clock className="h-3 w-3" />Menunggu</Badge>;
    }
  };

  const getLeaveTypeLabel = (type: string) => {
    switch (type) {
      case "cuti":
        return "Cuti Tahunan";
      case "sakit":
        return "Sakit";
      case "izin":
        return "Izin";
      default:
        return type;
    }
  };

  const calculateDays = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
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
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/20">
                  <FileText className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-foreground">Pengajuan Cuti</h1>
                  <p className="text-sm text-muted-foreground">Ajukan izin atau cuti</p>
                </div>
              </div>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Ajukan Cuti</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Pengajuan Cuti Baru</DialogTitle>
                  <DialogDescription>
                    Isi form di bawah untuk mengajukan cuti atau izin
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="leave_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Jenis Cuti</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih jenis cuti" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="cuti">Cuti Tahunan</SelectItem>
                              <SelectItem value="sakit">Sakit</SelectItem>
                              <SelectItem value="izin">Izin</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="start_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tanggal Mulai</FormLabel>
                            <FormControl>
                              <Input {...field} type="date" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="end_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tanggal Selesai</FormLabel>
                            <FormControl>
                              <Input {...field} type="date" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="reason"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Alasan</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Jelaskan alasan pengajuan cuti" rows={3} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex gap-3 pt-2">
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                        Batal
                      </Button>
                      <Button type="submit" className="flex-1" disabled={isLoading}>
                        {isLoading ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                        ) : (
                          "Ajukan"
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-2xl">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <Card className="border-border animate-fade-in">
              <CardContent className="pt-4 pb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-info">{Math.max(0, settings.maxLeaveDays - usedLeaveDays)}</div>
                  <p className="text-xs text-muted-foreground">Sisa Cuti</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <CardContent className="pt-4 pb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-success">
                    {leaveRequests.filter(l => l.status === "approved").length}
                  </div>
                  <p className="text-xs text-muted-foreground">Disetujui</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border animate-fade-in" style={{ animationDelay: "0.2s" }}>
              <CardContent className="pt-4 pb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-warning">
                    {leaveRequests.filter(l => l.status === "pending").length}
                  </div>
                  <p className="text-xs text-muted-foreground">Menunggu</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Leave Requests List */}
          <h2 className="text-lg font-semibold text-foreground mb-4">Riwayat Pengajuan</h2>

          {isFetching ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : leaveRequests.length === 0 ? (
            <Card className="border-border">
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground">Belum Ada Pengajuan</h3>
                <p className="text-muted-foreground mb-4">Anda belum mengajukan cuti atau izin</p>
                <Button onClick={() => setDialogOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Ajukan Cuti Pertama
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {leaveRequests.map((request, index) => (
                <Card
                  key={request.id}
                  className="border-border animate-fade-in hover:shadow-md transition-shadow"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-foreground">
                            {getLeaveTypeLabel(request.leave_type)}
                          </span>
                          {getStatusBadge(request.status)}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>
                            {new Date(request.start_date).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric"
                            })}
                            {" - "}
                            {new Date(request.end_date).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric"
                            })}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {calculateDays(request.start_date, request.end_date)} hari
                          </Badge>
                        </div>
                        {request.reason && (
                          <p className="text-sm text-muted-foreground">{request.reason}</p>
                        )}
                        {request.status === "rejected" && request.rejection_reason && (
                          <div className="mt-2 p-2 rounded bg-destructive/10 text-sm text-destructive">
                            <strong>Alasan ditolak:</strong> {request.rejection_reason}
                          </div>
                        )}
                      </div>
                      {request.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(request.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
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

export default PengajuanCuti;
