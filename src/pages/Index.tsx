import { useAuth } from "@/hooks/useAuth";
// Use the new redesigned dashboard components
import AdminDashboard from "./admin/AdminDashboardNew";
import ManagerDashboard from "./manager/ManagerDashboardNew";
import KaryawanDashboard from "./karyawan/KaryawanDashboardNew";

const Index = () => {
  const { isAdmin, isManager, loading, role } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-slate-500 text-sm">Memuat dashboard...</p>
        </div>
      </div>
    );
  }

  // Handle case where user is logged in but has no role (RLS issue or database error)
  if (role === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white p-6 rounded-xl shadow-lg text-center border border-red-100">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Akses Bermasalah</h3>
          <p className="text-slate-500 mb-6 text-sm">
            Kami tidak dapat memuat informasi role Anda. Ini mungkin karena kebijakan akses (RLS) pada database.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Coba Lagi
          </button>
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
