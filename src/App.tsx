import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { SystemSettingsProvider } from "@/contexts/SystemSettingsContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";
import ManagerRoute from "@/components/ManagerRoute";
import PWAUpdatePrompt from "@/components/PWAUpdatePrompt";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Loader2 } from "lucide-react";

// Lazy Imports for Performance Optimization
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const EditPasswordKaryawan = lazy(() => import("./pages/EditPasswordKaryawan"));

// Karyawan
const AbsensiKaryawan = lazy(() => import("./pages/karyawan/AbsensiKaryawan"));
const RiwayatAbsensi = lazy(() => import("./pages/karyawan/RiwayatAbsensi"));
const JurnalSaya = lazy(() => import("./pages/karyawan/JurnalSaya"));
const ProfilKaryawan = lazy(() => import("./pages/karyawan/ProfilKaryawan"));
const PengajuanCuti = lazy(() => import("./pages/karyawan/PengajuanCuti"));

// Admin
const KelolaKaryawan = lazy(() => import("./pages/admin/KelolaKaryawan"));
const RekapAbsensi = lazy(() => import("./pages/admin/RekapAbsensi"));
const LaporanKehadiran = lazy(() => import("./pages/admin/LaporanKehadiran"));
const ResetPassword = lazy(() => import("./pages/admin/ResetPassword"));
const Pengaturan = lazy(() => import("./pages/admin/Pengaturan"));
const Departemen = lazy(() => import("./pages/admin/Departemen"));
const KelolaRole = lazy(() => import("./pages/admin/KelolaRole"));
const Dokumentasi = lazy(() => import("./pages/admin/Dokumentasi"));
const JurnalKerja = lazy(() => import("./pages/admin/JurnalKerja"));
const ExportDatabase = lazy(() => import("./pages/admin/ExportDatabase"));

// Manager
const ManagerDashboard = lazy(() => import("./pages/manager/ManagerDashboardNew"));
const ManagerRekapAbsensi = lazy(() => import("./pages/manager/ManagerRekapAbsensi"));
const ManagerLaporan = lazy(() => import("./pages/manager/ManagerLaporan"));
const ManagerCuti = lazy(() => import("./pages/manager/ManagerCuti"));
const ManagerJurnal = lazy(() => import("./pages/manager/ManagerJurnal"));

const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // CRITICAL: Keep data fresh for 10 minutes - prevents refetch on navigation
      staleTime: 10 * 60 * 1000, // 10 minutes
      // Keep previous data while refetching (no skeleton flash)
      gcTime: 30 * 60 * 1000, // 30 minutes cache
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

// Component to handle root path - redirect based on auth status
const RootRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return user ? <Navigate to="/dashboard" replace /> : <Navigate to="/auth" replace />;
};

// Global Loading Fallback
const PageLoader = () => (
  <div className="flex min-h-[50vh] w-full items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
  </div>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <SystemSettingsProvider>
            <Toaster />
            <Sonner />
            <PWAUpdatePrompt />
            <BrowserRouter>
              <Suspense fallback={<PageLoader />}>
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
                    path="/karyawan/jurnal"
                    element={
                      <ProtectedRoute>
                        <JurnalSaya />
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
                    path="/manager/jurnal"
                    element={
                      <ManagerRoute>
                        <ManagerJurnal />
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
                    path="/admin/jurnal"
                    element={
                      <AdminRoute>
                        <JurnalKerja />
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
              </Suspense>
            </BrowserRouter>
          </SystemSettingsProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
