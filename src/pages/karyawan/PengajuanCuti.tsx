import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft, FileText, Calendar, Plus, Clock, CheckCircle2,
  XCircle, AlertCircle, Trash2, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useIsMobile } from "@/hooks/useIsMobile";
import MobileNavigation from "@/components/MobileNavigation";
import KaryawanWorkspaceLayout from "@/components/layout/KaryawanWorkspaceLayout";
import PengajuanCutiMobile from "./PengajuanCutiMobile";

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
  const isMobile = useIsMobile();
  const [isLoading, setIsLoading] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [usedLeaveDays, setUsedLeaveDays] = useState(0);

  const maxLeaveDays = settings.maxLeaveDays || 12;
  const remainingLeave = Math.max(0, maxLeaveDays - usedLeaveDays);

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
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Gagal membatalkan",
        description: error.message,
      });
    } else {
      toast({
        title: "Berhasil dibatalkan",
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
      case "cuti": return "Cuti Tahunan";
      case "sakit": return "Sakit";
      case "izin": return "Izin";
      default: return type;
    }
  };

  const getLeaveTypeIcon = (type: string) => {
    switch (type) {
      case "cuti": return "bg-gradient-to-br from-blue-500/20 to-blue-500/10";
      case "sakit": return "bg-gradient-to-br from-red-500/20 to-red-500/10";
      case "izin": return "bg-gradient-to-br from-purple-500/20 to-purple-500/10";
      default: return "bg-gradient-to-br from-gray-500/20 to-gray-500/10";
    }
  };

  const calculateDays = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  // ==========================================
  // SHARED PAGE CONTENT
  // ==========================================
  const pageContent = (
    <div className="w-full max-w-5xl mx-auto space-y-10">
      {/* Title + Action Button */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">Izin & Cuti</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-1">Ajukan permohonan cuti, sakit, atau izin.</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl px-6 h-12 shadow-lg shadow-slate-900/20 gap-2 active:scale-95 transition-all duration-300 w-full sm:w-auto">
              <Plus className="h-5 w-5 text-white" /> Buat Pengajuan
            </Button>
          </DialogTrigger>
          <DialogContent className="mx-4 rounded-[24px] max-w-md border-0 shadow-2xl p-0 overflow-hidden bg-white dark:bg-slate-900/90 backdrop-blur-xl">
            <DialogHeader className="px-6 py-6 pb-2">
              <DialogTitle className="text-xl font-extrabold text-slate-800 dark:text-slate-100">Form Pengajuan</DialogTitle>
              <DialogDescription className="text-slate-500 dark:text-slate-400 font-medium">
                Isi form di bawah untuk mengajukan cuti atau izin.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="px-6 pb-6 space-y-4">
                <FormField
                  control={form.control}
                  name="leave_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-widest">Jenis Cuti</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12 bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 rounded-xl focus:ring-blue-500/20 font-medium text-slate-700 dark:text-slate-200">
                            <SelectValue placeholder="Pilih jenis" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl border-slate-200 dark:border-slate-700 shadow-xl">
                          <SelectItem value="cuti" className="py-2.5 font-medium cursor-pointer">Cuti Tahunan</SelectItem>
                          <SelectItem value="sakit" className="py-2.5 font-medium cursor-pointer">Sakit</SelectItem>
                          <SelectItem value="izin" className="py-2.5 font-medium cursor-pointer">Izin</SelectItem>
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
                        <FormLabel className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-widest">Mulai</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" className="h-12 bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 rounded-xl focus:ring-blue-500/20 font-medium text-slate-700 dark:text-slate-200" />
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
                        <FormLabel className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-widest">Selesai</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" className="h-12 bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 rounded-xl focus:ring-blue-500/20 font-medium text-slate-700 dark:text-slate-200" />
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
                      <FormLabel className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-widest">Keterangan Tambahan</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Berikan alasan atau detail singkat..." rows={3} className="bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 rounded-xl focus:ring-blue-500/20 font-medium text-slate-700 dark:text-slate-200 resize-none" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-3 pt-4 mt-2 border-t border-slate-100 dark:border-slate-800">
                  <Button type="button" variant="outline" className="flex-1 rounded-xl h-12 font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200" onClick={() => setDialogOpen(false)}>
                    Batal
                  </Button>
                  <Button type="submit" className="flex-1 rounded-xl h-12 font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20" disabled={isLoading}>
                    {isLoading ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      "Kirim Pengajuan"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Section with Visual Budget Ring Chart */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Ring Chart Card */}
        <div className="bg-white dark:bg-slate-900/70 backdrop-blur-md rounded-[28px] p-6 shadow-sm border border-slate-200/50 dark:border-slate-800/50 flex flex-col justify-between">
          <div className="flex items-center justify-between w-full h-full">
            <div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Kuota Tahunan</p>
              <div className="flex items-baseline gap-1.5 font-sans">
                <h3 className={cn("text-4xl font-black tracking-tighter", remainingLeave <= 3 ? "text-amber-500" : "text-slate-800 dark:text-white")}>{remainingLeave}</h3>
                <span className="text-xs font-bold text-slate-400">Hari</span>
              </div>
              <div className="mt-3 text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg w-fit border border-slate-200/50 dark:border-slate-700/50">
                {usedLeaveDays} Hari Terpakai
              </div>
            </div>

            <div className="relative w-[110px] h-[110px] flex items-center justify-center">
              <svg className="w-full h-full -rotate-90 drop-shadow-sm" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="38" fill="none" stroke="#F1F5F9" strokeWidth="12" className="dark:stroke-slate-800" />
                <circle
                  cx="50" cy="50" r="38" fill="none"
                  stroke={remainingLeave <= 3 ? "#F59E0B" : "#10B981"}
                  strokeWidth="12" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 38}
                  strokeDashoffset={(2 * Math.PI * 38) - ((Math.min(100, Math.round((usedLeaveDays / maxLeaveDays) * 100)) / 100) * (2 * Math.PI * 38))}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-base font-black tracking-tight text-slate-800 dark:text-slate-200">{maxLeaveDays > 0 ? 100 - Math.min(100, Math.round((usedLeaveDays / maxLeaveDays) * 100)) : 0}%</span>
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Sisa</span>
              </div>
            </div>
          </div>
        </div>

        {/* Existing Mini Stats */}
        <div className="bg-white dark:bg-slate-900/70 backdrop-blur-md rounded-[28px] p-6 shadow-sm border border-slate-200/50 dark:border-slate-800/50 flex flex-col justify-center relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 transition-transform group-hover:scale-110" />
          <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-3 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Disetujui</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-5xl font-black text-emerald-600 tracking-tighter">
              {leaveRequests.filter(l => l.status === "approved").length}
            </h3>
            <span className="text-xs font-bold text-emerald-600/60 uppercase tracking-wider">Pengajuan</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/70 backdrop-blur-md rounded-[28px] p-6 shadow-sm border border-slate-200/50 dark:border-slate-800/50 flex flex-col justify-center relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 transition-transform group-hover:scale-110" />
          <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Menunggu</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-5xl font-black text-amber-500 tracking-tighter">
              {leaveRequests.filter(l => l.status === "pending").length}
            </h3>
            <span className="text-xs font-bold text-amber-500/60 uppercase tracking-wider">Pengajuan</span>
          </div>
        </div>
      </div>

      {/* Leave Requests List */}
      <div>
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/50 dark:border-slate-700/50">
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Riwayat Pengajuan</h3>
        </div>

        {isFetching ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-blue-600" />
          </div>
        ) : leaveRequests.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900/40 backdrop-blur-sm rounded-[24px] border border-dashed border-slate-300 shadow-sm">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800/80 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-1">Belum Ada Pengajuan</h3>
            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mb-6">Anda belum pernah mengajukan cuti atau izin sebelumnya.</p>
            <Button
              onClick={() => setDialogOpen(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl px-6 h-12 shadow-md gap-2 active:scale-95"
            >
              <Plus className="h-5 w-5" />
              Buat Pengajuan Baru
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {leaveRequests.map((request, index) => (
              <div
                key={request.id}
                className="bg-white dark:bg-slate-900/70 backdrop-blur-md rounded-[20px] p-5 lg:p-6 border border-white/40 shadow-sm hover:shadow-md transition-all duration-300 group"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-4 lg:gap-6">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${getLeaveTypeIcon(request.leave_type)} border border-white/50 backdrop-blur-sm shadow-sm`}>
                    <FileText className={`h-5 w-5 ${request.leave_type === "cuti" ? "text-blue-600" :
                      request.leave_type === "sakit" ? "text-red-600" : "text-purple-600"
                      }`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                      <span className="font-extrabold text-slate-800 dark:text-slate-100 text-lg">
                        {getLeaveTypeLabel(request.leave_type)}
                      </span>
                      {getStatusBadge(request.status)}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">
                      <div className="flex items-center gap-1.5 bg-slate-100/50 dark:bg-slate-800/50 px-2 py-1 rounded-lg">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {new Date(request.start_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                          {" - "}
                          {new Date(request.end_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      <span className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm rounded-lg text-slate-600 dark:text-slate-300">
                        {calculateDays(request.start_date, request.end_date)} hari kerja
                      </span>
                    </div>

                    {request.reason && (
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-300 pl-1 border-l-2 border-slate-200 dark:border-slate-700">{request.reason}</p>
                    )}

                    {request.status === "rejected" && request.rejection_reason && (
                      <div className="mt-3 p-3 rounded-xl bg-red-50/50 border border-red-100 text-sm font-medium text-red-600 flex gap-2 items-start">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <p><strong>Ditolak:</strong> {request.rejection_reason}</p>
                      </div>
                    )}
                  </div>

                  {request.status === "pending" && (
                    <div className="pt-2 sm:pt-0 border-t sm:border-0 border-slate-100 dark:border-slate-800 mt-2 sm:mt-0 flex justify-end">
                      <Button
                        variant="ghost"
                        onClick={() => handleDelete(request.id)}
                        className="bg-red-50 hover:bg-red-100 text-red-600 rounded-xl h-10 w-10 p-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // Desktop view with KaryawanWorkspaceLayout
  if (!isMobile) {
    return (
      <KaryawanWorkspaceLayout>
        {pageContent}
      </KaryawanWorkspaceLayout>
    );
  }

  // Mobile view
  return (
    <PengajuanCutiMobile
      leaveRequests={leaveRequests}
      usedLeaveDays={usedLeaveDays}
      maxLeaveDays={settings.maxLeaveDays}
      onOpenNewRequest={() => setDialogOpen(true)}
    />
  );
};

export default PengajuanCuti;
