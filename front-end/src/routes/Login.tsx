import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sparkles } from "lucide-react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import type { Lang } from "@/lib/translations";
import { FieldError } from "@/components/login/FieldError";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BrandName from "@/components/BrandName";
import ModeToggle from "@/components/ModeToggle";

const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

const registerSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters."),
    email: z.email("Enter a valid email address."),
    password: z.string().min(6, "Password must be at least 6 characters."),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

type LoginData = z.infer<typeof loginSchema>;
type RegisterData = z.infer<typeof registerSchema>;

const LANGS: { value: Lang; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "es", label: "ES" },
  { value: "pt", label: "PT" },
];

export default function Login() {
  const { login, register, isAuthenticated, authLoading } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const navigate = useNavigate();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const [registerTurnstileToken, setRegisterTurnstileToken] = useState<string | null>(null);
  const registerTurnstileRef = useRef<TurnstileInstance>(null);

  const loginForm = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (isAuthenticated) navigate("/chat");
  }, [isAuthenticated, navigate]);

  async function handleLogin(data: LoginData) {
    setLoginError(null);
    if (!turnstileToken) {
      setLoginError(t("err_captcha_failed"));
      return;
    }
    try {
      await login(data.email, data.password, turnstileToken);
      navigate("/chat");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      setLoginError(
        msg === "401"
          ? t("err_invalid_credentials")
          : msg === "400"
            ? t("err_captcha_failed")
            : t("err_generic"),
      );
    } finally {
      // Turnstile tokens are single-use — reset to get a fresh one for the next attempt
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    }
  }

  async function handleRegister(data: RegisterData) {
    setRegisterError(null);
    if (!registerTurnstileToken) {
      setRegisterError(t("err_captcha_failed"));
      return;
    }
    try {
      await register(data.name, data.email, data.password, registerTurnstileToken);
      navigate("/chat");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      setRegisterError(
        msg === "409"
          ? t("err_email_exists")
          : msg === "400"
            ? t("err_captcha_failed")
            : t("err_generic"),
      );
    } finally {
      registerTurnstileRef.current?.reset();
      setRegisterTurnstileToken(null);
    }
  }

  if (authLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-gradient-to-br from-background via-background to-primary/5 px-4">
      <div className="flex justify-end items-center gap-1 p-3">
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

      <div className="flex-1 flex flex-col items-center justify-center">
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

        <Tabs defaultValue="login" className="w-full max-w-sm">
          <TabsList className="grid grid-cols-2 w-full mb-4">
            <TabsTrigger value="login">{t("tab_login")}</TabsTrigger>
            <TabsTrigger value="register">{t("tab_register")}</TabsTrigger>
          </TabsList>

          {/* Login Tab */}
          <TabsContent value="login">
            <Card>
              <CardHeader>
                <CardTitle>{t("welcome_back")}</CardTitle>
                <CardDescription>{t("enter_credentials")}</CardDescription>
              </CardHeader>
              <form onSubmit={loginForm.handleSubmit(handleLogin)}>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email">{t("field_email")}</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@example.com"
                      {...loginForm.register("email")}
                    />
                    <FieldError
                      message={loginForm.formState.errors.email?.message}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-password">
                      {t("field_password")}
                    </Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      {...loginForm.register("password")}
                    />
                    <FieldError
                      message={loginForm.formState.errors.password?.message}
                    />
                  </div>
                  <Turnstile
                    ref={turnstileRef}
                    siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
                    onSuccess={setTurnstileToken}
                    onExpire={() => setTurnstileToken(null)}
                    onError={() => setTurnstileToken(null)}
                    options={{ theme: "auto", size: "flexible" }}
                  />
                </CardContent>
                <CardFooter className="flex-col gap-2 mt-2">
                  <Button
                    type="submit"
                    className="w-full mt-3"
                    disabled={loginForm.formState.isSubmitting || !turnstileToken}
                  >
                    {loginForm.formState.isSubmitting
                      ? t("btn_signing_in")
                      : t("btn_sign_in")}
                  </Button>
                  {loginError && (
                    <p className="text-destructive text-sm text-center">
                      {loginError}
                    </p>
                  )}
                </CardFooter>
              </form>
            </Card>
          </TabsContent>

          {/* Register Tab */}
          <TabsContent value="register">
            <Card>
              <CardHeader>
                <CardTitle>{t("create_account_title")}</CardTitle>
                <CardDescription>{t("fill_details")}</CardDescription>
              </CardHeader>
              <form onSubmit={registerForm.handleSubmit(handleRegister)}>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-name">{t("field_name")}</Label>
                    <Input
                      id="reg-name"
                      type="text"
                      placeholder="John Doe"
                      {...registerForm.register("name")}
                    />
                    <FieldError
                      message={registerForm.formState.errors.name?.message}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-email">{t("field_email")}</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="you@example.com"
                      {...registerForm.register("email")}
                    />
                    <FieldError
                      message={registerForm.formState.errors.email?.message}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-password">{t("field_password")}</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      placeholder="••••••••"
                      {...registerForm.register("password")}
                    />
                    <FieldError
                      message={registerForm.formState.errors.password?.message}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-confirm">
                      {t("field_confirm_password")}
                    </Label>
                    <Input
                      id="reg-confirm"
                      type="password"
                      placeholder="••••••••"
                      {...registerForm.register("confirmPassword")}
                    />
                    <FieldError
                      message={
                        registerForm.formState.errors.confirmPassword?.message
                      }
                    />
                  </div>
                  <Turnstile
                    ref={registerTurnstileRef}
                    siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY as string}
                    onSuccess={setRegisterTurnstileToken}
                    onExpire={() => setRegisterTurnstileToken(null)}
                    onError={() => setRegisterTurnstileToken(null)}
                    options={{ theme: "auto", size: "flexible" }}
                  />
                </CardContent>
                <CardFooter className="flex-col gap-2 mt-2">
                  <Button
                    type="submit"
                    className="w-full mt-3"
                    disabled={registerForm.formState.isSubmitting || !registerTurnstileToken}
                  >
                    {registerForm.formState.isSubmitting
                      ? t("btn_creating_account")
                      : t("btn_create_account")}
                  </Button>
                  {registerError && (
                    <p className="text-destructive text-sm text-center">
                      {registerError}
                    </p>
                  )}
                </CardFooter>
              </form>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
