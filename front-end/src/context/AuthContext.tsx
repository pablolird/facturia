import { createContext, useCallback, useContext, type ReactNode } from "react";
import { useAuth as useClerkAuth, useClerk } from "@clerk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, fetchMe, type AppUser } from "@/lib/api";

// Why a signed-in Clerk session has no usable app account (see GET /me on the backend)
export type AccountError = "email_not_verified" | "account_conflict" | "unknown";

interface AuthContextValue {
  user: AppUser | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  isSignedIn: boolean;
  accountError: AccountError | null;
  logout: () => Promise<void>;
  updateUserName: (name: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toAccountError(error: unknown): AccountError {
  if (error instanceof ApiError && error.status === 403) return "email_not_verified";
  if (error instanceof ApiError && error.status === 409) return "account_conflict";
  return "unknown";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useClerkAuth();
  const { signOut } = useClerk();
  const queryClient = useQueryClient();

  // Keyed by the Clerk user so switching accounts never serves the previous user's profile
  const meKey = ["me", userId] as const;
  const me = useQuery({
    queryKey: meKey,
    queryFn: fetchMe,
    enabled: isLoaded && !!isSignedIn,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const user = isSignedIn ? (me.data?.user ?? null) : null;

  const logout = useCallback(async () => {
    await signOut();
    queryClient.clear();
  }, [signOut, queryClient]);

  const updateUserName = useCallback(
    (name: string) => {
      queryClient.setQueryData<{ user: AppUser }>(["me", userId], (old) =>
        old ? { user: { ...old.user, name } } : old,
      );
    },
    [queryClient, userId],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        authLoading: !isLoaded || (!!isSignedIn && me.isPending),
        isSignedIn: !!isSignedIn,
        accountError: isSignedIn && me.isError ? toAccountError(me.error) : null,
        logout,
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
