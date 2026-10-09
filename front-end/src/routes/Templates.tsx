import { useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2 } from "lucide-react";

import { useLanguage } from "@/context/LanguageContext";
import { deleteTemplate, fetchTemplates } from "@/lib/api";
import { toast } from "sonner";
import NavSidebar from "@/components/NavSidebar";
import ModeToggle from "@/components/ModeToggle";
import { TemplateCard } from "@/components/templates/TemplateCard";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default function Templates() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: () => fetchTemplates(),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      setDeletingIds((prev) => new Set(prev).add(id));
      await deleteTemplate(id);
      return id;
    },
    onSuccess: (id) => {
      setDeletingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      void queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast.success(t("template_deleted"));
    },
    onError: (_err, id) => {
      setDeletingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
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
            <h1 className="text-sm font-semibold">{t("templates_title")}</h1>
            <div className="flex-1" />
            <ModeToggle />
          </header>

          <main className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 h-64 text-center">
                <div className="size-14 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10 flex items-center justify-center">
                  <FileText className="size-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{t("no_templates_title")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("no_templates_desc")}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate("/chat")}>
                  {t("btn_go_to_chat")}
                </Button>
              </div>
            ) : (
              <div className="group-cards grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {templates.map((template) => (
                  <div key={template.id} className="group">
                    <TemplateCard
                      template={template}
                      onDelete={(id) => deleteMutation.mutate(id)}
                      isDeleting={deletingIds.has(template.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
