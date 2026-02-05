import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface ManagerRouteProps {
  children: React.ReactNode;
}

const ManagerRoute = ({ children }: ManagerRouteProps) => {
  const { user, loading, isAdminOrManager, role } = useAuth();

  // Wait for both auth loading AND role to be fetched
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Memuat...</p>
        </div>
      </div>
    );
  }

  if (user && role === null) {
    return <Navigate to="/" replace />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAdminOrManager) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ManagerRoute;
