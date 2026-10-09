import { useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { SignIn, SignUp } from "@clerk/react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import type { Lang } from "@/lib/translations";
import BrandName from "@/components/BrandName";
import ModeToggle from "@/components/ModeToggle";

const LANGS: { value: Lang; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "es", label: "ES" },
  { value: "pt", label: "PT" },
];

// Clerk's prebuilt flows handle email + password, Google, email verification and bot
// protection; this page only provides the branded frame around them.
export default function Login({ mode = "sign-in" }: { mode?: "sign-in" | "sign-up" }) {
  const { isSignedIn, authLoading } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    if (isSignedIn) navigate("/chat", { replace: true });
  }, [isSignedIn, navigate]);

  if (authLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-gradient-to-br from-background via-background to-primary/5 px-4">
      <div className="flex justify-between items-center gap-1 p-3">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
        >
          <ArrowLeft className="size-4" />
          {t("btn_back_to_home")}
        </Link>
        <div className="flex items-center gap-1">
          <div className="flex gap-0.5">
            {LANGS.map((l) => (
              <button
                key={l.value}
                onClick={() => setLang(l.value)}
                className={`text-xs px-2 py-1 rounded transition-colors ${
                  lang === l.value
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
          <ModeToggle />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center pb-10">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center size-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground mb-4 shadow-lg shadow-primary/20">
            <Sparkles className="size-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            <BrandName />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("login_subtitle")}
          </p>
        </div>

        {mode === "sign-in" ? (
          <SignIn routing="path" path="/login" signUpUrl="/sign-up" />
        ) : (
          <SignUp routing="path" path="/sign-up" signInUrl="/login" />
        )}
      </div>
    </div>
  );
}
