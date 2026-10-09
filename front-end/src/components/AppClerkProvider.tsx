import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { ClerkProvider } from "@clerk/react";
import { esES, ptBR } from "@clerk/localizations";
import { ui } from "@clerk/ui";
import { shadcn } from "@clerk/ui/themes";
import { useLanguage } from "@/context/LanguageContext";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
if (!PUBLISHABLE_KEY) throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");

const LOCALIZATIONS = { en: undefined, es: esES, pt: ptBR };

// Wires Clerk into React Router (so its components navigate client-side), the app's language
// switcher and the shadcn theme. `ui` bundles Clerk's components instead of loading them from
// Clerk's CDN at runtime.
export default function AppClerkProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { lang } = useLanguage();

  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY!}
      ui={ui}
      appearance={{ theme: shadcn }}
      localization={LOCALIZATIONS[lang]}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      signInUrl="/login"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/chat"
      signUpFallbackRedirectUrl="/chat"
      afterSignOutUrl="/login"
    >
      {children}
    </ClerkProvider>
  );
}
