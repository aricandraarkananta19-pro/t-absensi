import { useAuth } from "@/hooks/useAuth";
import AdminDashboard from "./admin/AdminDashboard";
import ManagerDashboard from "./manager/ManagerDashboard";
import KaryawanDashboard from "./karyawan/KaryawanDashboard";

const Index = () => {
  const { isAdmin, isManager, loading, role } = useAuth();

  if (loading || role === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Memuat...</p>
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
