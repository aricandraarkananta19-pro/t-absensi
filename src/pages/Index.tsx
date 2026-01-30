import { useAuth } from "@/hooks/useAuth";
// Use the new redesigned dashboard components
import AdminDashboard from "./admin/AdminDashboardNew";
import ManagerDashboard from "./manager/ManagerDashboardNew";
import KaryawanDashboard from "./karyawan/KaryawanDashboardNew";

const Index = () => {
  const { isAdmin, isManager, loading, role } = useAuth();

  if (loading || role === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-slate-500 text-sm">Memuat dashboard...</p>
        </div>
      </div>
    );
  }

  if (isAdmin) {
    return <AdminDashboard />;
  }

  if (isManager) {
    return <ManagerDashboard />;
  }

  return <KaryawanDashboard />;
};

export default Index;
