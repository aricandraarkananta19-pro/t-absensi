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
    } catch (error: any) {
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
    } catch (error: any) {
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
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                  <Calendar className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-foreground">Kelola Cuti</h1>
                  <p className="text-sm text-muted-foreground">Approve/reject pengajuan cuti</p>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={fetchLeaveRequests} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <Card className="border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-warning">{stats.pending}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <Check className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-success">{stats.approved}</p>
                  <p className="text-xs text-muted-foreground">Disetujui</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <X className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-destructive">{stats.rejected}</p>
                  <p className="text-xs text-muted-foreground">Ditolak</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari nama, departemen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-[180px]">
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
        <Card className="border-border">
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="py-12 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground">Tidak Ada Data</h3>
                <p className="text-muted-foreground">Tidak ada pengajuan cuti dengan kriteria tersebut</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Karyawan</TableHead>
                    <TableHead className="hidden sm:table-cell">Jenis Cuti</TableHead>
                    <TableHead className="hidden md:table-cell">Tanggal</TableHead>
                    <TableHead className="hidden lg:table-cell">Durasi</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((request) => {
                    const duration = differenceInDays(new Date(request.end_date), new Date(request.start_date)) + 1;
                    return (
                      <TableRow key={request.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{request.profile?.full_name || "Tanpa Nama"}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
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
      </main>

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
    </div>
  );
};

export default ManagerCuti;
