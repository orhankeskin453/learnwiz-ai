import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { UserProfile } from "@learwizai/types";
import * as authApi from "@/services/auth";

interface AuthContextValue {
  user: UserProfile | null;
  /** True while the initial /me lookup is in flight. */
  loading: boolean;
  setUser: (user: UserProfile | null) => void;
  logout: () => Promise<void>;
}

const DEFAULT_CONTEXT: AuthContextValue = {
  user: null,
  loading: false,
  setUser: () => undefined,
  logout: async () => undefined,
};

const AuthContext = createContext<AuthContextValue>(DEFAULT_CONTEXT);

/** Identity state for the shell (CLAUDE.md §9 plan/usage slot, §29 funnel). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void authApi.me().then((profile) => {
      if (!cancelled) {
        setUser(profile);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      setUser,
      logout: async () => {
        try {
          await authApi.logout();
        } finally {
          setUser(null);
        }
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
