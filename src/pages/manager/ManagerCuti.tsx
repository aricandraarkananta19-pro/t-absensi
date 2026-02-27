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
    >
      <div className="space-y-6 pb-20">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 vibe-stat-grid">
          <Card className="border-white/60 shadow-sm shadow-slate-200/40 bg-white/70 backdrop-blur-md rounded-[18px]">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-slate-800 tracking-tight">{stats.total}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-white/60 shadow-sm shadow-slate-200/40 bg-white/70 backdrop-blur-md rounded-[18px]">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-amber-600 tracking-tight">{stats.pending}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-white/60 shadow-sm shadow-slate-200/40 bg-white/70 backdrop-blur-md rounded-[18px]">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Check className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-emerald-600 tracking-tight">{stats.approved}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Disetujui</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-white/60 shadow-sm shadow-slate-200/40 bg-white/70 backdrop-blur-md rounded-[18px]">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center">
                  <X className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-red-600 tracking-tight">{stats.rejected}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ditolak</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Cari nama, departemen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 bg-white/70 backdrop-blur-md border-slate-200/60 rounded-xl shadow-sm font-medium text-slate-800"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-[180px] h-11 border-slate-200/60 rounded-xl bg-white/70 backdrop-blur-md font-medium">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Disetujui</SelectItem>
              <SelectItem value="rejected">Ditolak</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card className="border-white/60 shadow-sm shadow-slate-200/40 bg-white/70 backdrop-blur-md rounded-[20px] vibe-glass-card">
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-300 border-t-slate-700" />
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Calendar className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-700">Tidak Ada Data</h3>
                <p className="text-slate-500 text-sm font-medium mt-1">Tidak ada pengajuan cuti dengan kriteria tersebut</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 border-b border-slate-100">
                    <TableHead className="font-bold text-slate-400 text-xs uppercase tracking-wider">Karyawan</TableHead>
                    <TableHead className="hidden sm:table-cell font-bold text-slate-400 text-xs uppercase tracking-wider">Jenis Cuti</TableHead>
                    <TableHead className="hidden md:table-cell font-bold text-slate-400 text-xs uppercase tracking-wider">Tanggal</TableHead>
                    <TableHead className="hidden lg:table-cell font-bold text-slate-400 text-xs uppercase tracking-wider">Durasi</TableHead>
                    <TableHead className="font-bold text-slate-400 text-xs uppercase tracking-wider">Status</TableHead>
                    <TableHead className="font-bold text-slate-400 text-xs uppercase tracking-wider">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((request) => {
                    const duration = differenceInDays(new Date(request.end_date), new Date(request.start_date)) + 1;
                    return (
                      <TableRow key={request.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center">
                              <User className="h-4 w-4 text-slate-500" />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800 text-sm">{request.profile?.full_name || "Tanpa Nama"}</p>
                              <p className="text-xs text-slate-400 flex items-center gap-1 font-medium">
                                <Building2 className="h-3 w-3" />
                                {request.profile?.department || "-"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline">{getLeaveTypeLabel(request.leave_type)}</Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="text-sm">
                            <p>{format(new Date(request.start_date), "dd MMM yyyy", { locale: id })}</p>
                            <p className="text-muted-foreground">s/d {format(new Date(request.end_date), "dd MMM yyyy", { locale: id })}</p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <span className="font-medium">{duration} hari</span>
                        </TableCell>
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
                        <TableCell>
                          {request.status === "pending" ? (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-success hover:text-success hover:bg-success/10"
                                onClick={() => handleApprove(request)}
                              >
                                <Check className="h-4 w-4" />
                                <span className="hidden sm:inline">Setujui</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleReject(request)}
                              >
                                <X className="h-4 w-4" />
                                <span className="hidden sm:inline">Tolak</span>
                              </Button>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </Card>
      </div>

      {/* Approve Dialog */}
      <AlertDialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Setujui Pengajuan Cuti</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan menyetujui pengajuan cuti dari{" "}
              <span className="font-semibold">{selectedRequest?.profile?.full_name}</span>
              {" "}untuk tanggal{" "}
              {selectedRequest && format(new Date(selectedRequest.start_date), "dd MMM yyyy", { locale: id })}
              {" "}s/d{" "}
              {selectedRequest && format(new Date(selectedRequest.end_date), "dd MMM yyyy", { locale: id })}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmApprove}
              disabled={isUpdating}
              className="bg-success hover:bg-success/90"
            >
              {isUpdating ? "Memproses..." : "Ya, Setujui"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak Pengajuan Cuti</DialogTitle>
            <DialogDescription>
              Berikan alasan penolakan untuk{" "}
              <span className="font-semibold">{selectedRequest?.profile?.full_name}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Masukkan alasan penolakan..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)} disabled={isUpdating}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={isUpdating || !rejectionReason.trim()}
            >
              {isUpdating ? "Memproses..." : "Tolak Cuti"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EnterpriseLayout>
  );
};

export default ManagerCuti;
