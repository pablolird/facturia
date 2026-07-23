import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { setRefreshCallback, type SessionData } from "@/lib/api";

const API_URL = `${import.meta.env.VITE_API_BASE_URL as string}/auth`;

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  login: (email: string, password: string, turnstileToken: string) => Promise<void>;
  register: (name: string, email: string, password: string, turnstileToken: string) => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => string | null;
  updateUserName: (name: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function refreshAccessToken(): Promise<{ access_token: string; user: User }> {
  const res = await fetch(`${API_URL}/refresh`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Refresh failed");
  return res.json();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: sessionData, isLoading: authLoading } = useQuery({
    queryKey: ["session"],
    queryFn: refreshAccessToken,
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    throwOnError: false,
    refetchInterval: 13 * 60 * 1000,
  });

  useEffect(() => {
    setRefreshCallback((session: SessionData) => {
      queryClient.setQueryData(["session"], session);
    });
  }, [queryClient]);

  // Keep access token in sync with query data
  const resolvedToken = sessionData?.access_token ?? accessToken;
  const user = sessionData?.user ?? null;
  const isAuthenticated = !!resolvedToken;

  const loginMutation = useMutation({
    mutationFn: async ({
      email,
      password,
      turnstileToken,
    }: {
      email: string;
      password: string;
      turnstileToken: string;
    }) => {
      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, turnstileToken }),
      });
      if (!res.ok) throw new Error(String(res.status));
      return res.json() as Promise<{ access_token: string; user: User }>;
    },
    onSuccess: (data) => {
      setAccessToken(data.access_token);
      queryClient.setQueryData(["session"], data);
    },
  });

  const registerMutation = useMutation({
    mutationFn: async ({
      name,
      email,
      password,
      turnstileToken,
    }: {
      name: string;
      email: string;
      password: string;
      turnstileToken: string;
    }) => {
      const res = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, password, turnstileToken }),
      });
      if (!res.ok) throw new Error(String(res.status));
      return res.json() as Promise<{ access_token: string; user: User }>;
    },
    onSuccess: (data) => {
      setAccessToken(data.access_token);
      queryClient.setQueryData(["session"], data);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_URL}/logout`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Logout failed");
    },
    onSettled: () => {
      setAccessToken(null);
      queryClient.setQueryData(["session"], null);
      queryClient.clear();
    },
  });

  const login = useCallback(
    async (email: string, password: string, turnstileToken: string) => {
      await loginMutation.mutateAsync({ email, password, turnstileToken });
    },
    [loginMutation]
  );

  const register = useCallback(
    async (name: string, email: string, password: string, turnstileToken: string) => {
      await registerMutation.mutateAsync({ name, email, password, turnstileToken });
    },
    [registerMutation]
  );

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  const getAccessToken = useCallback(() => resolvedToken, [resolvedToken]);

  const updateUserName = useCallback(
    (name: string) => {
      queryClient.setQueryData<{ access_token: string; user: User } | null>(
        ['session'],
        (old) => {
          if (!old) return old;
          return { ...old, user: { ...old.user, name } };
        },
      );
    },
    [queryClient],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken: resolvedToken,
        isAuthenticated,
        authLoading,
        login,
        register,
        logout,
        getAccessToken,
        updateUserName,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
