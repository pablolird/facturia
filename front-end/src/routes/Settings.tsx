import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { fetchPresets } from "@/lib/api";
import type { Lang } from "@/lib/translations";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const DEEPSEEK_MODELS = [
  { id: "deepseek-chat", label: "DeepSeek V3" },
  { id: "deepseek-reasoner", label: "DeepSeek R1 (Reasoner)" },
];

const MODEL_KEY = "invoice-model";
const PRESET_KEY = "invoice-preset";

export default function Settings() {
  const { getAccessToken, user } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const token = getAccessToken();
  const presetKey = user ? `${PRESET_KEY}_${user.id}` : null;

  const [defaultModel, setDefaultModel] = useState(
    () => localStorage.getItem(MODEL_KEY) ?? DEEPSEEK_MODELS[0]!.id,
  );
  const [defaultPreset, setDefaultPreset] = useState(
    () => (presetKey ? localStorage.getItem(presetKey) : null) ?? "",
  );
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const { data: presets = [] } = useQuery({
    queryKey: ["presets"],
    queryFn: () => fetchPresets(token!),
    enabled: !!token,
  });

  function flash(key: string) {
    setSavedKey(key);
    setTimeout(() => setSavedKey(null), 2000);
  }

  function handleModelChange(value: string) {
    setDefaultModel(value);
    localStorage.setItem(MODEL_KEY, value);
    flash("model");
  }

  function handlePresetChange(value: string) {
    const actual = value === "__none__" ? "" : value;
    setDefaultPreset(actual);
    if (!presetKey) return;
    if (actual) {
      localStorage.setItem(presetKey, actual);
    } else {
      localStorage.removeItem(presetKey);
    }
    flash("preset");
  }

  const LANGUAGES: { value: Lang; label: string }[] = [
    { value: "en", label: t("lang_en") },
    { value: "es", label: t("lang_es") },
    { value: "pt", label: t("lang_pt") },
  ];

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-background overflow-hidden">
        <NavSidebar />

        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          <header className="flex items-center gap-3 border-b border-border px-4 h-14 shrink-0 bg-background/80 backdrop-blur-sm">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
            <h1 className="text-sm font-semibold">{t("settings_title")}</h1>
            <div className="flex-1" />
            <ModeToggle />
          </header>

          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="max-w-3xl mx-auto flex flex-col gap-5">

              {/* Preferences */}
              <Card>
                <CardHeader>
                  <CardTitle>{t("section_preferences")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-1.5">
                    <Label>{t("field_language")}</Label>
                    <p className="text-xs text-muted-foreground">{t("setting_language_desc")}</p>
                    <div className="flex gap-2 mt-1">
                      {LANGUAGES.map((l) => (
                        <Button
                          key={l.value}
                          size="sm"
                          variant={lang === l.value ? "default" : "outline"}
                          onClick={() => setLang(l.value)}
                          className="flex-1 sm:flex-none"
                        >
                          {l.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* AI Defaults — two cards side by side on md+ */}
              <div>
                <h2 className="text-sm font-semibold mb-3 px-1">{t("section_ai_defaults")}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                  {/* Default Model */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>{t("setting_default_model")}</CardTitle>
                        {savedKey === "model" && (
                          <Check className="size-4 text-green-500 shrink-0" />
                        )}
                      </div>
                      <CardDescription>{t("setting_default_model_desc")}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Select value={defaultModel} onValueChange={handleModelChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DEEPSEEK_MODELS.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </CardContent>
                  </Card>

                  {/* Default Preset */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>{t("setting_default_preset")}</CardTitle>
                        {savedKey === "preset" && (
                          <Check className="size-4 text-green-500 shrink-0" />
                        )}
                      </div>
                      <CardDescription>{t("setting_default_preset_desc")}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Select
                        value={defaultPreset || "__none__"}
                        onValueChange={handlePresetChange}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{t("no_default_preset")}</SelectItem>
                          {presets.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </CardContent>
                  </Card>

                </div>
              </div>

            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
