import { useState } from "react";
import { useNavigate } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { useClerk } from "@clerk/react";
import { Check, ShieldCheck } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { deleteUserAccount, updateUserProfile } from "@/lib/api";
import NavSidebar from "@/components/NavSidebar";
import ModeToggle from "@/components/ModeToggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export default function Profile() {
  const { user, logout, updateUserName } = useAuth();
  const { openUserProfile } = useClerk();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name ?? "");
  const [nameSuccess, setNameSuccess] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const updateNameMutation = useMutation({
    mutationFn: () => updateUserProfile({ name: name.trim() }),
    onSuccess: (data) => {
      updateUserName(data.name);
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 3000);
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: deleteUserAccount,
    onSuccess: async () => {
      try {
        await logout();
      } catch {
        // The Clerk user is already deleted, so ending its session can fail
      }
      navigate("/login");
    },
  });

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-background overflow-hidden">
        <NavSidebar />

        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          <header className="flex items-center gap-3 border-b border-border px-4 h-14 shrink-0 bg-background/80 backdrop-blur-sm">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
            <h1 className="text-sm font-semibold">{t("profile_title")}</h1>
            <div className="flex-1" />
            <ModeToggle />
          </header>

          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="max-w-3xl mx-auto flex flex-col gap-5">

              {/* Personal Info + Security side by side on large screens */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Personal Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t("section_personal_info")}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div className="grid gap-1.5">
                      <Label htmlFor="display-name">{t("field_display_name")}</Label>
                      <div className="flex gap-2">
                        <Input
                          id="display-name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          onClick={() => updateNameMutation.mutate()}
                          disabled={
                            !name.trim() ||
                            name.trim() === user?.name ||
                            updateNameMutation.isPending
                          }
                          className="shrink-0"
                        >
                          {nameSuccess ? (
                            <Check className="size-3.5" />
                          ) : updateNameMutation.isPending ? (
                            t("btn_saving")
                          ) : (
                            t("btn_save_changes")
                          )}
                        </Button>
                      </div>
                      {nameSuccess && (
                        <p className="text-xs text-green-600 dark:text-green-400">
                          {t("name_updated")}
                        </p>
                      )}
                    </div>

                    <div className="grid gap-1.5">
                      <Label htmlFor="email">{t("field_email")}</Label>
                      <Input
                        id="email"
                        value={user?.email ?? ""}
                        disabled
                        className="text-muted-foreground"
                      />
                      <p className="text-xs text-muted-foreground">{t("email_readonly_hint")}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Security: password, linked Google account and sessions live in Clerk */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t("section_security")}</CardTitle>
                    <CardDescription>{t("security_desc")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button size="sm" variant="outline" onClick={() => openUserProfile()}>
                      <ShieldCheck className="size-3.5" />
                      {t("btn_manage_security")}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Danger Zone */}
              <Card className="border-destructive/40">
                <CardHeader>
                  <CardTitle className="text-destructive">{t("section_danger")}</CardTitle>
                  <CardDescription>{t("delete_warning")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {showDeleteConfirm ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteAccountMutation.mutate()}
                        disabled={deleteAccountMutation.isPending}
                      >
                        {deleteAccountMutation.isPending
                          ? t("btn_saving")
                          : t("confirm_delete_btn")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowDeleteConfirm(false)}
                      >
                        {t("btn_cancel")}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-destructive/50 text-destructive hover:bg-destructive hover:text-white dark:hover:text-white"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      {t("delete_account_title")}
                    </Button>
                  )}
                </CardContent>
              </Card>

            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
