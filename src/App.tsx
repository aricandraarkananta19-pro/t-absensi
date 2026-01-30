import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";
import ManagerRoute from "@/components/ManagerRoute";
import PWAUpdatePrompt from "@/components/PWAUpdatePrompt";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import EditPasswordKaryawan from "./pages/EditPasswordKaryawan";
import AbsensiKaryawan from "./pages/karyawan/AbsensiKaryawan";
import RiwayatAbsensi from "./pages/karyawan/RiwayatAbsensi";
import ProfilKaryawan from "./pages/karyawan/ProfilKaryawan";
import PengajuanCuti from "./pages/karyawan/PengajuanCuti";
import KelolaKaryawan from "./pages/admin/KelolaKaryawan";
import RekapAbsensi from "./pages/admin/RekapAbsensi";
import LaporanKehadiran from "./pages/admin/LaporanKehadiran";
import ResetPassword from "./pages/admin/ResetPassword";
import Pengaturan from "./pages/admin/Pengaturan";
import Departemen from "./pages/admin/Departemen";
import KelolaRole from "./pages/admin/KelolaRole";
import ManagerDashboard from "./pages/manager/ManagerDashboardNew";
import ManagerRekapAbsensi from "./pages/manager/ManagerRekapAbsensi";
import ManagerLaporan from "./pages/manager/ManagerLaporan";
import ManagerCuti from "./pages/manager/ManagerCuti";
import Dokumentasi from "./pages/admin/Dokumentasi";
import ExportDatabase from "./pages/admin/ExportDatabase";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Component to handle root path - redirect based on auth status
const RootRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return user ? <Navigate to="/dashboard" replace /> : <Navigate to="/auth" replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <PWAUpdatePrompt />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              }
            />
            <Route
              path="/edit-password"
              element={
                <ProtectedRoute>
                  <EditPasswordKaryawan />
                </ProtectedRoute>
              }
            />
            {/* Karyawan Routes */}
            <Route
              path="/karyawan/absensi"
              element={
                <ProtectedRoute>
                  <AbsensiKaryawan />
                </ProtectedRoute>
              }
            />
            <Route
              path="/karyawan/riwayat"
              element={
                <ProtectedRoute>
                  <RiwayatAbsensi />
                </ProtectedRoute>
              }
            />
            <Route
              path="/karyawan/profil"
              element={
                <ProtectedRoute>
                  <ProfilKaryawan />
                </ProtectedRoute>
              }
            />
            <Route
              path="/karyawan/cuti"
              element={
                <ProtectedRoute>
                  <PengajuanCuti />
                </ProtectedRoute>
              }
            />
            {/* Manager Routes - Read Only */}
            <Route
              path="/manager"
              element={
                <ManagerRoute>
                  <ManagerDashboard />
                </ManagerRoute>
              }
            />
            <Route
              path="/manager/absensi"
              element={
                <ManagerRoute>
                  <ManagerRekapAbsensi />
                </ManagerRoute>
              }
            />
            <Route
              path="/manager/laporan"
              element={
                <ManagerRoute>
                  <ManagerLaporan />
                </ManagerRoute>
              }
            />
            <Route
              path="/manager/cuti"
              element={
                <ManagerRoute>
                  <ManagerCuti />
                </ManagerRoute>
              }
            />
            {/* Admin Routes */}
            <Route
              path="/admin/karyawan"
              element={
                <AdminRoute>
                  <KelolaKaryawan />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/absensi"
              element={
                <AdminRoute>
                  <RekapAbsensi />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/laporan"
              element={
                <AdminRoute>
                  <LaporanKehadiran />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/reset-password"
              element={
                <AdminRoute>
                  <ResetPassword />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/pengaturan"
              element={
                <AdminRoute>
                  <Pengaturan />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/departemen"
              element={
                <AdminRoute>
                  <Departemen />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/role"
              element={
                <AdminRoute>
                  <KelolaRole />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/dokumentasi"
              element={
                <AdminRoute>
                  <Dokumentasi />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/export-database"
              element={
                <AdminRoute>
                  <ExportDatabase />
                </AdminRoute>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
