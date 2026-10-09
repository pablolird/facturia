import { Navigate, Outlet } from "react-router";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";

export default function ProtectedRoute() {
  const { authLoading, isAuthenticated, isSignedIn, accountError, logout } = useAuth();
  const { t } = useLanguage();

  if (authLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/login" replace />;
  }

  // Signed in with Clerk, but the API refused to open an account for this session
  if (!isAuthenticated) {
    const message =
      accountError === "email_not_verified"
        ? t("err_email_not_verified")
        : accountError === "account_conflict"
          ? t("err_account_conflict")
          : t("err_generic");
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-sm text-center flex flex-col items-center gap-3">
          <h1 className="text-lg font-semibold">{t("account_error_title")}</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
          <Button variant="outline" size="sm" onClick={() => void logout()}>
            {t("sidebar_sign_out")}
          </Button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
