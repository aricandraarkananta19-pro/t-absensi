import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "manager" | "karyawan";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: AppRole | null;
  isAdmin: boolean;
  isManager: boolean;
  isAdminOrManager: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  role: null,
  isAdmin: false,
  isManager: false,
  isAdminOrManager: false,
  signOut: async () => { },
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (!error && data) {
        setRole(data.role as AppRole);
      } else {
        setRole(null);
      }
    } catch (err) {
      console.error("Error fetching role:", err);
      setRole(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // 1. Get initial session
        const { data: { session: initialSession } } = await supabase.auth.getSession();

        if (initialSession?.user) {
          setSession(initialSession);
          setUser(initialSession.user);
          // 2. Fetch role synchronously regarding loading state
          await fetchUserRole(initialSession.user.id);
        }
      } catch (error) {
        console.error("Auth init error:", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }

      // 3. Listen for changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, currentSession) => {
          if (!mounted) return;


          // If SIGNED_IN or TOKEN_REFRESHED, update state
          if (currentSession?.user) {
            setSession(currentSession);
            setUser(currentSession.user);

            // Only fetch role if we don't have it or user changed
            if (currentSession.user.id !== user?.id) {
              // We might want to set loading true here if it's a critical change
              // But usually for "TOKEN_REFRESHED" we don't want to block UI
              if (event === 'SIGNED_IN') {
                // If it's a sign in event, we should fetch role
                await fetchUserRole(currentSession.user.id);
              }
            }
          } else if (event === 'SIGNED_OUT') {
            setSession(null);
            setUser(null);
            setRole(null);
          }
        }
      );

      return subscription;
    };

    const subscriptionPromise = initializeAuth();

    return () => {
      mounted = false;
      subscriptionPromise.then(sub => sub?.unsubscribe());
    };
  }, []);

  const signOut = async () => {
    // 1. Optimistic clear - clear state IMMEDIATELY
    setUser(null);
    setSession(null);
    setRole(null);

    try {
      // 2. Call Supabase signout but don't wait indefinitely
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
      ]);
    } catch (error) {
      console.error("SignOut error or timeout:", error);
      // Ensure local storage is cleared even if network fails
      localStorage.clear();
      sessionStorage.clear();
    }
  };

  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isAdminOrManager = role === "admin" || role === "manager";

  return (
    <AuthContext.Provider value={{ user, session, loading, role, isAdmin, isManager, isAdminOrManager, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
