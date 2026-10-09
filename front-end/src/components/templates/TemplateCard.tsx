import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Download, Eye, Loader2, Pencil, Trash2, X } from "lucide-react";

import { useLanguage } from "@/context/LanguageContext";
import { updateTemplate, type Template } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TemplateThumbnail } from "./TemplateThumbnail";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export interface TemplateCardProps {
  template: Template;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

export function TemplateCard({
  template,
  onDelete,
  isDeleting,
}: TemplateCardProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(template.name);

  const renameMutation = useMutation({
    mutationFn: (name: string) => updateTemplate(template.id, { name }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["templates"] }),
  });

  function previewTemplate() {
    const blob = new Blob([template.html_content], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function downloadTemplate() {
    const blob = new Blob([template.html_content], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${template.name}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function commitRename() {
    const trimmed = title.trim();
    if (!trimmed) {
      setTitle(template.name);
      setEditing(false);
      return;
    }
    if (trimmed !== template.name) {
      renameMutation.mutate(trimmed);
    }
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") commitRename();
    if (e.key === "Escape") {
      setTitle(template.name);
      setEditing(false);
    }
  }

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card shadow-sm overflow-hidden hover:shadow-lg hover:border-primary/20 transition-all duration-200">
      <TemplateThumbnail html={template.html_content} />

      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center gap-1.5 min-w-0">
          {editing ? (
            <>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={commitRename}
                onKeyDown={handleKeyDown}
                className="h-7 text-sm px-2 flex-1"
                autoFocus
              />
              <button
                onClick={commitRename}
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <Check className="size-3.5" />
              </button>
              <button
                onClick={() => {
                  setTitle(template.name);
                  setEditing(false);
                }}
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <X className="size-3.5" />
              </button>
            </>
          ) : (
            <>
              <span className="text-sm font-medium truncate flex-1">
                {template.name}
              </span>
              <button
                onClick={() => setEditing(true)}
                className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 shrink-0"
                aria-label="Rename template"
              >
                <Pencil className="size-3.5" />
              </button>
            </>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {formatDate(template.created_at)}
        </p>

        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-7 text-xs gap-1.5"
            onClick={previewTemplate}
          >
            <Eye className="size-3" />
            {t("btn_preview_template")}
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
          <Button
            size="icon-sm"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(template.id)}
            disabled={isDeleting}
            aria-label="Delete template"
          >
            {isDeleting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
