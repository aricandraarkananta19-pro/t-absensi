import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Calendar, Check, X, Clock, Search,
  RefreshCw, FileText, User, Building2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, differenceInDays } from "date-fns";
import { id } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import EnterpriseLayout from "@/components/layout/EnterpriseLayout";
import { MANAGER_MENU_SECTIONS } from "@/config/menu";

interface LeaveRequest {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  reason: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  profile?: {
    full_name: string | null;
    department: string | null;
    position: string | null;
  } | null;
}

const ManagerCuti = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("pending");
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    fetchLeaveRequests();

    // Realtime subscription - DISABLED for stability (enterprise requirement)
    // Data refreshes only on: page load, manual refresh, after approve/reject actions
    /*
    const channel = supabase
      .channel("leave-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leave_requests" },
        () => fetchLeaveRequests()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    */
  }, []);

  const fetchLeaveRequests = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles for each request
      const requestsWithProfiles: LeaveRequest[] = await Promise.all(
        (data || []).map(async (request) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, department, position")
            .eq("user_id", request.user_id)
            .maybeSingle();

          return {
            ...request,
            profile,
          };
        })
      );

      setLeaveRequests(requestsWithProfiles);
    } catch (error) {
      console.error("Error fetching leave requests:", error);
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Tidak dapat memuat data cuti",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = (request: LeaveRequest) => {
    setSelectedRequest(request);
    setIsApproveDialogOpen(true);
  };

  const handleReject = (request: LeaveRequest) => {
    setSelectedRequest(request);
    setRejectionReason("");
    setIsRejectDialogOpen(true);
  };

  const confirmApprove = async () => {
    if (!selectedRequest || !user) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("leave_requests")
        .update({
          status: "approved",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", selectedRequest.id);

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: `Cuti ${selectedRequest.profile?.full_name || "karyawan"} telah disetujui`,
      });

      fetchLeaveRequests();
    } catch (err) {
      const error = err as Error;
      console.error("Error approving leave:", error);
      toast({
        variant: "destructive",
        title: "Gagal",
        description: error.message || "Tidak dapat menyetujui cuti",
      });
    } finally {
      setIsUpdating(false);
      setIsApproveDialogOpen(false);
      setSelectedRequest(null);
    }
  };

  const confirmReject = async () => {
    if (!selectedRequest || !user) return;

    if (!rejectionReason.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Alasan penolakan harus diisi",
      });
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("leave_requests")
        .update({
          status: "rejected",
          rejection_reason: rejectionReason,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", selectedRequest.id);

      if (error) throw error;

      toast({
        title: "Ditolak",
        description: `Cuti ${selectedRequest.profile?.full_name || "karyawan"} telah ditolak`,
      });

      fetchLeaveRequests();
    } catch (err) {
      const error = err as Error;
      console.error("Error rejecting leave:", error);
      toast({
        variant: "destructive",
        title: "Gagal",
        description: error.message || "Tidak dapat menolak cuti",
      });
    } finally {
      setIsUpdating(false);
      setIsRejectDialogOpen(false);
      setSelectedRequest(null);
      setRejectionReason("");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge className="bg-warning text-warning-foreground gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge className="bg-success text-success-foreground gap-1">
            <Check className="h-3 w-3" />
            Disetujui
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-destructive text-destructive-foreground gap-1">
            <X className="h-3 w-3" />
            Ditolak
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getLeaveTypeLabel = (type: string) => {
    switch (type) {
      case "cuti_tahunan": return "Cuti Tahunan";
      case "cuti_sakit": return "Cuti Sakit";
      case "cuti_melahirkan": return "Cuti Melahirkan";
      case "cuti_khusus": return "Cuti Khusus";
      default: return type;
    }
  };

  const filteredRequests = leaveRequests.filter((request) => {
    const matchesSearch =
      request.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.profile?.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.leave_type?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "all" || request.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: leaveRequests.length,
    pending: leaveRequests.filter((r) => r.status === "pending").length,
    approved: leaveRequests.filter((r) => r.status === "approved").length,
    rejected: leaveRequests.filter((r) => r.status === "rejected").length,
  };

  return (
    <EnterpriseLayout
      title="Kelola Cuti"
      subtitle="Approve/reject pengajuan cuti"
      roleLabel="Manager"
      menuSections={MANAGER_MENU_SECTIONS}
      showRefresh={true}
      onRefresh={fetchLeaveRequests}
      breadcrumbs={[
        { label: "Manager", href: "/manager" },
        { label: "Kelola Cuti" },
      ]}
    >
      <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-8 duration-700">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
          {[
            { icon: FileText, label: "Total", value: stats.total, gradient: "from-indigo-500 to-blue-600", shadow: "shadow-indigo-500/20", bg: "border-indigo-200/40 dark:border-indigo-800/30 bg-gradient-to-br from-white to-indigo-50/30 dark:from-slate-900 dark:to-indigo-950/20", color: "text-indigo-600 dark:text-indigo-400" },
            { icon: Clock, label: "Menunggu", value: stats.pending, gradient: "from-amber-500 to-orange-600", shadow: "shadow-amber-500/20", bg: "border-amber-200/40 dark:border-amber-800/30 bg-gradient-to-br from-white to-amber-50/30 dark:from-slate-900 dark:to-amber-950/20", color: "text-amber-600 dark:text-amber-400" },
            { icon: Check, label: "Disetujui", value: stats.approved, gradient: "from-emerald-500 to-green-600", shadow: "shadow-emerald-500/20", bg: "border-emerald-200/40 dark:border-emerald-800/30 bg-gradient-to-br from-white to-emerald-50/30 dark:from-slate-900 dark:to-emerald-950/20", color: "text-emerald-600 dark:text-emerald-400" },
            { icon: X, label: "Ditolak", value: stats.rejected, gradient: "from-rose-500 to-red-600", shadow: "shadow-rose-500/20", bg: "border-rose-200/40 dark:border-rose-800/30 bg-gradient-to-br from-white to-rose-50/30 dark:from-slate-900 dark:to-rose-950/20", color: "text-rose-600 dark:text-rose-400" },
          ].map((s, i) => (
            <div key={i} className={`group relative p-5 rounded-[24px] border overflow-hidden hover:shadow-lg transition-all duration-300 ${s.bg}`}>
              <div className="absolute top-0 right-0 w-24 h-24 bg-black/[.02] rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:scale-125 transition-transform duration-500" />
              <div className="relative flex items-center gap-3.5">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center shadow-lg ${s.shadow} shrink-0`}>
                  <s.icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className={`text-2xl font-black tracking-tighter ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">{s.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Cari nama, departemen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 h-12 bg-white/90 dark:bg-slate-900/70 backdrop-blur-md border-slate-200/50 dark:border-slate-700/50 rounded-2xl shadow-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-[200px] h-12 border-slate-200/50 dark:border-slate-700/50 rounded-2xl bg-white/90 dark:bg-slate-900/70 backdrop-blur-md font-bold">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Disetujui</SelectItem>
              <SelectItem value="rejected">Ditolak</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-[28px] border border-slate-200/50 dark:border-slate-800/50 shadow-sm bg-white/90 dark:bg-slate-900/70 backdrop-blur-md overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-indigo-600" />
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800/80 rounded-2xl flex items-center justify-center mx-auto mb-4 rotate-3">
                <Calendar className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-black text-slate-700 dark:text-slate-200 tracking-tight">Tidak Ada Data</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">Tidak ada pengajuan cuti dengan kriteria tersebut</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                      <TableHead className="font-black text-slate-400 text-[10px] uppercase tracking-widest py-4">Karyawan</TableHead>
                      <TableHead className="hidden sm:table-cell font-black text-slate-400 text-[10px] uppercase tracking-widest">Jenis Cuti</TableHead>
                      <TableHead className="hidden md:table-cell font-black text-slate-400 text-[10px] uppercase tracking-widest">Tanggal</TableHead>
                      <TableHead className="hidden lg:table-cell font-black text-slate-400 text-[10px] uppercase tracking-widest">Durasi</TableHead>
                      <TableHead className="font-black text-slate-400 text-[10px] uppercase tracking-widest">Status</TableHead>
                      <TableHead className="font-black text-slate-400 text-[10px] uppercase tracking-widest">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.map((request) => {
                      const duration = differenceInDays(new Date(request.end_date), new Date(request.start_date)) + 1;
                      return (
                        <TableRow key={request.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-50 dark:from-indigo-900/50 dark:to-indigo-800/30 flex items-center justify-center shadow-sm">
                                <User className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                              </div>
                              <div>
                                <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{request.profile?.full_name || "Tanpa Nama"}</p>
                                <p className="text-[11px] text-slate-400 flex items-center gap-1 font-semibold">
                                  <Building2 className="h-3 w-3" />
                                  {request.profile?.department || "-"}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200/50 dark:border-slate-700/50">{getLeaveTypeLabel(request.leave_type)}</span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="text-sm">
                              <p className="font-semibold text-slate-700 dark:text-slate-200">{format(new Date(request.start_date), "dd MMM yyyy", { locale: id })}</p>
                              <p className="text-xs text-slate-400 font-medium">s/d {format(new Date(request.end_date), "dd MMM yyyy", { locale: id })}</p>
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <span className="font-black text-slate-700 dark:text-slate-200 text-sm">{duration} hari</span>
                          </TableCell>
                          <TableCell>{getStatusBadge(request.status)}</TableCell>
                          <TableCell>
                            {request.status === "pending" ? (
                              <div className="flex gap-2">
                                <Button size="sm" className="gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-sm shadow-emerald-500/20 h-9 font-bold text-xs" onClick={() => handleApprove(request)}>
                                  <Check className="h-3.5 w-3.5" /> Setujui
                                </Button>
                                <Button size="sm" variant="outline" className="gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-500/10 border-rose-200 dark:border-rose-800/50 rounded-xl h-9 font-bold text-xs" onClick={() => handleReject(request)}>
                                  <X className="h-3.5 w-3.5" /> Tolak
                                </Button>
                              </div>
                            ) : (
                              <span className="text-sm text-slate-400 font-medium">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden flex flex-col p-4 gap-3 bg-slate-50/50 dark:bg-slate-800/20 rounded-b-[28px]">
                {filteredRequests.map((request) => {
                  const duration = differenceInDays(new Date(request.end_date), new Date(request.start_date)) + 1;
                  return (
                    <div key={request.id} className="bg-white dark:bg-slate-900 rounded-[20px] border border-slate-100 dark:border-slate-800 p-5 shadow-sm flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div className="flex gap-3">
                          <div className="h-10 w-10 mt-0.5 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-50 dark:from-indigo-900/50 dark:to-indigo-800/30 flex items-center justify-center shrink-0 shadow-sm">
                            <User className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <div>
                            <h4 className="font-black text-slate-900 dark:text-white text-sm tracking-tight">{request.profile?.full_name || "Tanpa Nama"}</h4>
                            <p className="text-[11px] text-slate-400 font-semibold">{request.profile?.department || "Karyawan"}</p>
                          </div>
                        </div>
                        {getStatusBadge(request.status)}
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 flex justify-between items-center border border-slate-100/50 dark:border-slate-700/30">
                        <div>
                          <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest block mb-0.5">Periode</span>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                            {format(new Date(request.start_date), "dd MMM")} — {format(new Date(request.end_date), "dd MMM yy")}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest block mb-0.5">Durasi</span>
                          <span className="text-xs font-black text-slate-800 dark:text-slate-100">{duration} hari</span>
                        </div>
                      </div>
                      {request.status === "pending" && (
                        <div className="flex gap-2 w-full pt-1">
                          <Button size="sm" className="flex-1 gap-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold" onClick={() => handleApprove(request)}>
                            <Check className="h-4 w-4" /> Setujui
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1 gap-1 text-rose-600 border-rose-200 rounded-xl font-bold" onClick={() => handleReject(request)}>
                            <X className="h-4 w-4" /> Tolak
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Approve Dialog */}
      <AlertDialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <AlertDialogContent className="rounded-[24px] border-slate-200/50 dark:border-slate-700/50 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-black tracking-tight">Setujui Pengajuan Cuti</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500 leading-relaxed">
              Anda akan menyetujui pengajuan cuti dari{" "}
              <span className="font-bold text-slate-700 dark:text-slate-200">{selectedRequest?.profile?.full_name}</span>
              {" "}untuk tanggal{" "}
              {selectedRequest && format(new Date(selectedRequest.start_date), "dd MMM yyyy", { locale: id })}
              {" "}s/d{" "}
              {selectedRequest && format(new Date(selectedRequest.end_date), "dd MMM yyyy", { locale: id })}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating} className="rounded-xl font-bold">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmApprove} disabled={isUpdating} className="bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold shadow-sm shadow-emerald-500/20">
              {isUpdating ? "Memproses..." : "Ya, Setujui"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="rounded-[24px] border-slate-200/50 dark:border-slate-700/50 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight">Tolak Pengajuan Cuti</DialogTitle>
            <DialogDescription className="text-sm text-slate-500 leading-relaxed">
              Berikan alasan penolakan untuk{" "}
              <span className="font-bold text-slate-700 dark:text-slate-200">{selectedRequest?.profile?.full_name}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Masukkan alasan penolakan..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              className="rounded-xl border-slate-200/50 dark:border-slate-700/50 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-300"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)} disabled={isUpdating} className="rounded-xl font-bold">Batal</Button>
            <Button variant="destructive" onClick={confirmReject} disabled={isUpdating || !rejectionReason.trim()} className="rounded-xl font-bold shadow-sm shadow-rose-500/20">
              {isUpdating ? "Memproses..." : "Tolak Cuti"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EnterpriseLayout>
  );
};

export default ManagerCuti;
