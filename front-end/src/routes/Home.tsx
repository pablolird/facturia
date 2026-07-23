import { useState, useRef, useEffect } from "react";
import { useChatContext, WELCOME_ID } from "@/context/ChatContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  PenLine,
  Save,
  Send,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import {
  PaywallError,
  createTemplate,
  deleteConversation,
  fetchConversation,
  fetchConversations,
  fetchPresets,
  sendChat,
  updateTemplate,
} from "@/lib/api";
import { AppSidebar } from "@/components/home/AppSidebar";
import { ChatMessage, type Message } from "@/components/home/ChatMessage";
import { TemplateGenerating } from "@/components/home/TemplateGenerating";
import PresetSheet from "@/components/PresetSheet";
import BrandName from "@/components/BrandName";
import ModeToggle from "@/components/ModeToggle";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Textarea } from "@/components/ui/textarea";

const DEEPSEEK_MODELS = [
  { id: "deepseek-chat", label: "DeepSeek V3" },
  { id: "deepseek-reasoner", label: "DeepSeek R1 (Reasoner)" },
];

export default function Home() {
  const { getAccessToken, user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const token = getAccessToken();

  const {
    messages,
    setMessages,
    isLoading,
    setIsLoading,
    templateHtml,
    setTemplateHtml,
    templateName,
    setTemplateName,
    currentTemplateId,
    setCurrentTemplateId,
    currentConversationId,
    setCurrentConversationId,
    mobileTab,
    setMobileTab,
    loadOpRef,
    resetChat,
  } = useChatContext();

  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState(
    () => localStorage.getItem("invoice-model") ?? DEEPSEEK_MODELS[0]!.id,
  );
  const [selectedPreset, setSelectedPreset] = useState(
    () => (user ? localStorage.getItem(`invoice-preset_${user.id}`) : null) ?? "",
  );
  const [presetSheetOpen, setPresetSheetOpen] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [paywalled, setPaywalled] = useState(
    () => !!user && localStorage.getItem(`paywalled_${user.id}`) === "1",
  );
  const [showPaywallDialog, setShowPaywallDialog] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const nameBeforeEdit = useRef(templateName);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    localStorage.setItem("invoice-model", selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    if (!user) return;
    if (selectedPreset) {
      localStorage.setItem(`invoice-preset_${user.id}`, selectedPreset);
    } else {
      localStorage.removeItem(`invoice-preset_${user.id}`);
    }
  }, [selectedPreset, user]);

  // ── Server data ─────────────────────────────────────────────────────────────

  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => fetchConversations(token!),
    enabled: !!token,
  });

  const { data: presets = [], isFetched: presetsFetched } = useQuery({
    queryKey: ["presets"],
    queryFn: () => fetchPresets(token!),
    enabled: !!token,
  });

  useEffect(() => {
    if (!presetsFetched) return;
    const valid = presets.some((p) => p.id === selectedPreset);
    if (selectedPreset && !valid) {
      setSelectedPreset("");
      return;
    }
    if (!selectedPreset) {
      const demo = presets.find((p) => p.name === "Empresa Demo");
      if (demo) setSelectedPreset(demo.id);
    }
  }, [presets, presetsFetched, selectedPreset]);

  // ── New chat ─────────────────────────────────────────────────────────────────

  function handleNewChat() {
    resetChat();
    setInput("");
  }

  // ── Load conversation ─────────────────────────────────────────────────────────

  async function handleLoadConversation(id: string) {
    if (id === currentConversationId) return;
    loadOpRef.current += 1;
    setIsLoading(false);
    const opId = loadOpRef.current;
    setLoadingConversation(true);
    try {
      const conv = await fetchConversation(token!, id);
      if (loadOpRef.current !== opId) return;
      setCurrentConversationId(conv.id);
      setMessages(
        conv.messages.length > 0
          ? conv.messages.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
            }))
          : [{ id: WELCOME_ID, role: "assistant", content: "" }],
      );
      setTemplateHtml(conv.template_html ?? null);
      setSelectedPreset(conv.preset_id ?? "");
      setCurrentTemplateId(null);
      setTemplateName("Invoice Template");
    } finally {
      if (loadOpRef.current === opId) setLoadingConversation(false);
    }
  }

  // ── Delete conversation ───────────────────────────────────────────────────────

  const deleteConversationMutation = useMutation({
    mutationFn: (id: string) => deleteConversation(token!, id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (id === currentConversationId) handleNewChat();
    },
  });

  // ── Save / update template ───────────────────────────────────────────────────

  const saveTemplateMutation = useMutation({
    mutationFn: async () => {
      const name = templateName.trim() || "Invoice Template";
      if (currentTemplateId) {
        return updateTemplate(token!, currentTemplateId, {
          name,
          html_content: templateHtml!,
        });
      }
      return createTemplate(token!, {
        name,
        html_content: templateHtml!,
        preset_id: selectedPreset || undefined,
      });
    },
    onSuccess: (saved) => {
      if (saved && !currentTemplateId) setCurrentTemplateId(saved.id);
      void queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast.success(t("template_saved"));
    },
  });

  // ── Inline rename ────────────────────────────────────────────────────────────

  const renameMutation = useMutation({
    mutationFn: (name: string) =>
      updateTemplate(token!, currentTemplateId!, { name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast.success(t("template_renamed"));
    },
  });

  function downloadTemplate() {
    if (!templateHtml) return;
    const blob = new Blob([templateHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${templateName}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openInNewTab() {
    if (!templateHtml) return;
    const url = URL.createObjectURL(
      new Blob([templateHtml], { type: "text/html;charset=utf-8" }),
    );
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function startNameEdit() {
    nameBeforeEdit.current = templateName;
    setIsEditingName(true);
  }

  function commitNameEdit() {
    const trimmed = templateName.trim();
    if (!trimmed) {
      setTemplateName(nameBeforeEdit.current);
      setIsEditingName(false);
      return;
    }
    setTemplateName(trimmed);
    setIsEditingName(false);
    if (currentTemplateId && trimmed !== nameBeforeEdit.current) {
      renameMutation.mutate(trimmed);
    }
  }

  function handleNameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitNameEdit();
    }
    if (e.key === "Escape") {
      setTemplateName(nameBeforeEdit.current);
      setIsEditingName(false);
    }
  }

  // ── Send message ──────────────────────────────────────────────────────────────

  const noPreset = !selectedPreset;

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isLoading || noPreset) return;

    // Snapshot the current op counter so we can detect if the user switched
    // away (new chat / different conversation) before the response arrives.
    const sendOpId = loadOpRef.current;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: trimmed,
    };
    setMessages((prev) => [
      ...prev.filter((m) => m.id !== WELCOME_ID),
      userMsg,
    ]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await sendChat(
        token!,
        trimmed,
        selectedModel,
        currentConversationId ?? undefined,
        currentConversationId ? undefined : selectedPreset,
      );

      // If the user switched chats while we were waiting, discard this response.
      if (loadOpRef.current !== sendOpId) return;

      if (!currentConversationId) {
        setCurrentConversationId(response.conversationId);
        void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      }

      if (response.message) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: response.message!,
          },
        ]);
      }

      if (response.templateHtml) {
        setTemplateHtml(response.templateHtml);
        setCurrentTemplateId(null);
        setMobileTab("preview");
      }
    } catch (err) {
      if (loadOpRef.current !== sendOpId) return;
      if (err instanceof PaywallError) {
        if (user) localStorage.setItem(`paywalled_${user.id}`, "1");
        setPaywalled(true);
        setShowPaywallDialog(true);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: t("err_generic"),
          },
        ]);
      }
    } finally {
      // Only clear the spinner if this send is still the active one.
      // If the user already switched away, handleNewChat/handleLoadConversation
      // already reset isLoading to false.
      if (loadOpRef.current === sendOpId) setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-background overflow-hidden">
        <AppSidebar
          conversations={conversations}
          activeConversationId={currentConversationId}
          onNewChat={handleNewChat}
          onConversationClick={(id) => void handleLoadConversation(id)}
          onConversationDelete={(id) => deleteConversationMutation.mutate(id)}
          onPresetsClick={() => setPresetSheetOpen(true)}
        />

        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          {/* Top bar */}
          <header className="flex items-center gap-3 border-b border-border px-4 h-14 shrink-0 bg-background/80 backdrop-blur-sm">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
            <h1 className="text-sm font-semibold text-foreground truncate flex-1">
              <BrandName />
            </h1>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground"
              onClick={handleNewChat}
            >
              <PenLine className="size-3.5" />
              <span className="hidden sm:inline">{t("btn_new_chat")}</span>
            </Button>
            <ModeToggle />
          </header>

          {/* Mobile tab switcher */}
          <div className="md:hidden flex shrink-0 border-b border-border">
            <button
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                mobileTab === "chat"
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground"
              }`}
              onClick={() => setMobileTab("chat")}
            >
              {t("tab_chat")}
            </button>
            <button
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                mobileTab === "preview"
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground"
              }`}
              onClick={() => setMobileTab("preview")}
            >
              {t("tab_preview")}
              {templateHtml && (
                <span className="ml-1.5 inline-block size-1.5 rounded-full bg-primary align-middle" />
              )}
            </button>
          </div>

          {/* Main area: chat + preview */}
          <div className="flex flex-1 min-h-0">
            {/* Chat panel */}
            <div
              className={`flex-col flex-1 md:flex-none w-full md:w-[380px] md:shrink-0 min-h-0 md:border-r border-border ${mobileTab === "chat" ? "flex" : "hidden md:flex"}`}
            >
              {loadingConversation ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
                  {messages.map((msg) => (
                    <ChatMessage
                      key={msg.id}
                      message={
                        msg.id === WELCOME_ID
                          ? { ...msg, content: t("welcome_message") }
                          : msg
                      }
                    />
                  ))}
                  {isLoading && (
                    <div className="flex justify-start mb-3">
                      <div className="bg-muted rounded-xl px-4 py-2.5">
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
              )}

              {/* Input area */}
              <div className="shrink-0 p-3 border-t border-border">
                {paywalled ? (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-5 text-center">
                    <p className="text-sm font-semibold text-destructive">{t("paywall_banner_title")}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("paywall_banner_desc")}
                    </p>
                  </div>
                ) : (
                  <>
                    <div
                      className={`rounded-xl border bg-background shadow-sm transition-all focus-within:border-primary/30 focus-within:shadow-md focus-within:shadow-primary/5 ${noPreset ? "opacity-60" : ""}`}
                    >
                      <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={
                          noPreset
                            ? t("placeholder_no_preset")
                            : t("placeholder_describe")
                        }
                        rows={3}
                        className="resize-none border-0 shadow-none focus-visible:ring-0 text-sm rounded-b-none"
                        disabled={isLoading || noPreset || loadingConversation}
                      />
                      <div className="flex items-center gap-2 px-3 py-2 border-t border-border">
                        <Select
                          value={selectedModel}
                          onValueChange={setSelectedModel}
                        >
                          <SelectTrigger className="h-7 text-xs flex-1 md:flex-none md:w-30 border-0 shadow-none bg-transparent hover:bg-muted">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DEEPSEEK_MODELS.map((m) => (
                              <SelectItem
                                key={m.id}
                                value={m.id}
                                className="text-xs"
                              >
                                {m.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Separator orientation="vertical" className="h-4" />

                        <Select
                          value={selectedPreset}
                          onValueChange={setSelectedPreset}
                          disabled={!!currentConversationId}
                        >
                          <SelectTrigger
                            className={`h-7 text-xs flex-1 md:flex-none md:w-36 border-0 shadow-none bg-transparent hover:bg-muted ${
                              noPreset ? "text-destructive font-medium" : ""
                            }`}
                          >
                            <SelectValue
                              placeholder={t("select_preset_placeholder")}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {presets.length === 0 ? (
                              <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                                {t("no_presets_inline")}
                              </div>
                            ) : (
                              presets.map((p) => (
                                <SelectItem
                                  key={p.id}
                                  value={p.id}
                                  className="text-xs"
                                >
                                  {p.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>

                        <div className="hidden md:block md:flex-1" />

                        <Button
                          size="icon-sm"
                          onClick={() => void handleSend()}
                          disabled={
                            !input.trim() ||
                            isLoading ||
                            noPreset ||
                            loadingConversation
                          }
                        >
                          <Send className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    {noPreset ? (
                      <p className="text-center text-xs text-destructive mt-2">
                        {t("prompt_no_preset")}{" "}
                        <button
                          className="underline underline-offset-2 hover:opacity-70"
                          onClick={() => setPresetSheetOpen(true)}
                        >
                          {t("word_presets")}
                        </button>
                      </p>
                    ) : (
                      <p className="text-center text-xs text-muted-foreground mt-2">
                        {t("hint_enter_send")}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Preview panel */}
            <div
              className={`flex-col flex-1 min-h-0 min-w-0 ${mobileTab === "preview" ? "flex" : "hidden md:flex"}`}
            >
              <div className="shrink-0 flex items-center gap-2 border-b border-border px-4 h-11">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("preview_label")}
                </span>
                {templateHtml && (
                  <>
                    <Separator orientation="vertical" className="h-4" />

                    {isEditingName ? (
                      <input
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        onBlur={commitNameEdit}
                        onKeyDown={handleNameKeyDown}
                        className="text-xs w-48 bg-transparent outline-none border-b border-primary px-1 py-0.5"
                        autoFocus
                      />
                    ) : (
                      <button
                        onClick={startNameEdit}
                        className="text-xs px-1 py-0.5 rounded hover:bg-muted max-w-48 truncate text-left"
                        title={t("click_to_rename")}
                      >
                        {templateName}
                      </button>
                    )}

                    <div className="flex items-center gap-1.5 ml-auto">
                      {!currentTemplateId && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1.5"
                          onClick={() => saveTemplateMutation.mutate()}
                          disabled={saveTemplateMutation.isPending}
                        >
                          <Save className="size-3" />
                          {saveTemplateMutation.isPending
                            ? t("btn_saving")
                            : t("btn_save")}
                        </Button>
                      )}
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={openInNewTab}
                        aria-label={t("btn_open_tab")}
                      >
                        <ExternalLink className="size-3.5" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={downloadTemplate}
                        aria-label={t("btn_download")}
                      >
                        <Download className="size-3.5" />
                      </Button>
                    </div>
                  </>
                )}
              </div>

              {isLoading ? (
                <TemplateGenerating />
              ) : templateHtml ? (
                <iframe
                  key={templateHtml}
                  className="flex-1 w-full border-0 bg-white template-fade-in"
                  srcDoc={templateHtml}
                  title="Invoice Preview"
                  sandbox="allow-same-origin"
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
                  <div className="size-14 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10 flex items-center justify-center">
                    <FileText className="size-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {t("no_template_title")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("no_template_desc")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <PresetSheet open={presetSheetOpen} onOpenChange={setPresetSheetOpen} />

      <AlertDialog open={showPaywallDialog} onOpenChange={setShowPaywallDialog}>
        <AlertDialogContent className="gap-0 overflow-hidden p-0">
          <div className="flex flex-col items-center gap-3 bg-gradient-to-b from-primary/10 to-transparent px-6 pb-6 pt-8 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/20">
              <Sparkles className="size-7 text-primary" />
            </div>
            <AlertDialogTitle className="text-xl">
              {t("paywall_dialog_title")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              {t("paywall_dialog_body_1")}
            </AlertDialogDescription>
          </div>

          <div className="space-y-2.5 px-6 py-4">
            {([
              t("paywall_feature_unlimited"),
              t("paywall_feature_customize"),
              t("paywall_feature_download"),
            ] as string[]).map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Check className="size-3 text-primary" />
                </div>
                <span className="text-sm">{feature}</span>
              </div>
            ))}
          </div>

          <div className="space-y-2 px-6 pb-6">
            <p className="pb-1 text-center text-xs text-muted-foreground">
              {t("paywall_dialog_body_2")}
            </p>
            <Button
              className="w-full bg-gradient-to-br from-primary to-primary/75 text-primary-foreground shadow-sm shadow-primary/20 hover:opacity-90"
              onClick={() => setShowPaywallDialog(false)}
            >
              {t("paywall_contact_us")}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setShowPaywallDialog(false)}
            >
              {t("paywall_got_it")}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
