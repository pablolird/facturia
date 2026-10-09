import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useLanguage } from "@/context/LanguageContext";
import {
  createPreset,
  deletePreset,
  fetchPresets,
  updatePreset,
  type Preset,
  type PresetData,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const presetSchema = z.object({
  name: z.string().min(1, "Label is required"),
  business_name: z.string().min(1, "Business name is required"),
  ruc: z
    .string()
    .min(1, "RUC is required")
    .regex(/^\d+-\d$/, "Invalid format (e.g. 80000000-0)"),
  timbrado: z
    .string()
    .min(1, "Timbrado is required")
    .regex(/^\d{8}$/, "Must be exactly 8 digits"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.email("Invalid email"),
});

type PresetFormData = z.infer<typeof presetSchema>;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-destructive text-xs mt-1">{message}</p>;
}

interface PresetFormProps {
  preset?: Preset;
  logoData: string | null;
  onLogoChange: (v: string | null) => void;
  onSave: (data: PresetData) => void;
  onCancel: () => void;
  isSaving: boolean;
}

function PresetForm({ preset, logoData, onLogoChange, onSave, onCancel, isSaving }: PresetFormProps) {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PresetFormData>({
    resolver: zodResolver(presetSchema),
    defaultValues: {
      name: preset?.name ?? "",
      business_name: preset?.business_name ?? "",
      ruc: preset?.ruc ?? "",
      timbrado: preset?.timbrado ?? "",
      address: preset?.address ?? "",
      city: preset?.city ?? "",
      phone: preset?.phone ?? "",
      email: preset?.email ?? "",
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError(null);
    if (file.size > 1_000_000) {
      setLogoError(t("logo_too_large"));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onLogoChange(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleRemoveLogo() {
    onLogoChange(null);
    setLogoError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <form onSubmit={handleSubmit((formData) => onSave({ ...formData, logo_data: logoData ?? undefined }))} className="flex flex-col gap-4 px-4 py-2">
      <div className="grid gap-1.5">
        <Label htmlFor="name">{t("field_preset_label")} <span className="text-destructive">*</span></Label>
        <Input id="name" placeholder="e.g. My Company" {...register("name")} />
        <FieldError message={errors.name?.message} />
      </div>

      <Separator />
      <p className="text-xs text-muted-foreground -mt-2">{t("section_company_info")}</p>

      <div className="grid gap-1.5">
        <Label htmlFor="business_name">{t("field_razon_social")} <span className="text-destructive">*</span></Label>
        <Input id="business_name" placeholder="Company legal name" {...register("business_name")} />
        <FieldError message={errors.business_name?.message} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="ruc">RUC <span className="text-destructive">*</span></Label>
          <Input id="ruc" placeholder="80000000-0" {...register("ruc")} />
          <FieldError message={errors.ruc?.message} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="timbrado">Timbrado <span className="text-destructive">*</span></Label>
          <Input id="timbrado" placeholder="12345678" {...register("timbrado")} />
          <FieldError message={errors.timbrado?.message} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="address">{t("field_direccion")} <span className="text-destructive">*</span></Label>
        <Input id="address" placeholder="Street address" {...register("address")} />
        <FieldError message={errors.address?.message} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="city">{t("field_ciudad")} <span className="text-destructive">*</span></Label>
          <Input id="city" placeholder="Asunción" {...register("city")} />
          <FieldError message={errors.city?.message} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="phone">{t("field_telefono")} <span className="text-destructive">*</span></Label>
          <Input id="phone" placeholder="+595 21 000000" {...register("phone")} />
          <FieldError message={errors.phone?.message} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
        <Input id="email" type="email" placeholder="contact@company.com" {...register("email")} />
        <FieldError message={errors.email?.message} />
      </div>

      <Separator />
      <p className="text-xs text-muted-foreground -mt-2">{t("field_logo")}</p>

      <div className="grid gap-2">
        {logoData && (
          <div className="flex items-center gap-3">
            <img
              src={logoData}
              alt="Logo preview"
              className="h-10 max-w-[120px] object-contain rounded border border-border bg-muted/30 p-1"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleRemoveLogo}
              className="text-xs"
            >
              {t("btn_remove_logo")}
            </Button>
          </div>
        )}
        <Input
          ref={fileInputRef}
          id="logo"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="cursor-pointer"
        />
        <p className="text-xs text-muted-foreground">{t("logo_upload_hint")}</p>
        {logoError && <p className="text-destructive text-xs">{logoError}</p>}
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" size="sm" disabled={isSaving} className="flex-1">
          {isSaving
            ? t("btn_saving")
            : preset
              ? t("btn_update_preset")
              : t("btn_create_preset")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          {t("btn_cancel")}
        </Button>
      </div>
    </form>
  );
}

interface PresetSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PresetSheet({ open, onOpenChange }: PresetSheetProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Preset | "new" | null>(null);
  const [logoData, setLogoData] = useState<string | null>(null);

  const { data: presets = [] } = useQuery({
    queryKey: ["presets"],
    queryFn: () => fetchPresets(),
  });

  const createMutation = useMutation({
    mutationFn: (data: PresetData) => createPreset(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["presets"] });
      setEditing(null);
      toast.success(t("preset_created"));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PresetData> }) =>
      updatePreset(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["presets"] });
      setEditing(null);
      toast.success(t("preset_updated"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePreset(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["presets"] });
      toast.success(t("preset_deleted"));
    },
  });

  function handleSave(data: PresetData) {
    if (editing === "new") {
      createMutation.mutate(data);
    } else if (editing) {
      updateMutation.mutate({ id: editing.id, data });
    }
  }

  function openEditing(preset: Preset | "new") {
    setEditing(preset);
    setLogoData(preset === "new" ? null : (preset.logo_data ?? null));
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0 overflow-y-auto">
        <SheetHeader className="px-4 pt-5 pb-3">
          {editing ? (
            <button
              onClick={() => setEditing(null)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1 w-fit"
            >
              <ChevronLeft className="size-3.5" />
              {t("back_to_presets")}
            </button>
          ) : null}
          <SheetTitle>
            {editing
              ? editing === "new"
                ? t("new_preset")
                : t("edit_preset")
              : t("sidebar_presets")}
          </SheetTitle>
          <SheetDescription>
            {editing ? t("preset_desc_fill") : t("preset_desc_select")}
          </SheetDescription>
        </SheetHeader>

        <Separator />

        {editing ? (
          <PresetForm
            preset={editing === "new" ? undefined : editing}
            logoData={logoData}
            onLogoChange={setLogoData}
            onSave={handleSave}
            onCancel={() => setEditing(null)}
            isSaving={isSaving}
          />
        ) : (
          <div className="flex flex-col gap-1 px-4 py-3">
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-start gap-2 mb-1"
              onClick={() => openEditing("new")}
            >
              <Plus className="size-3.5" />
              {t("new_preset")}
            </Button>

            {presets.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t("no_presets_msg")}
              </p>
            )}

            {presets.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2"
              >
                {p.logo_data && (
                  <img
                    src={p.logo_data}
                    alt=""
                    className="size-6 object-contain rounded shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  {p.business_name && (
                    <p className="text-xs text-muted-foreground truncate">{p.business_name}</p>
                  )}
                </div>
                <button
                  onClick={() => openEditing(p)}
                  className="text-muted-foreground hover:text-foreground p-1 rounded"
                  aria-label="Edit preset"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  onClick={() => deleteMutation.mutate(p.id)}
                  className="text-muted-foreground hover:text-destructive p-1 rounded"
                  aria-label="Delete preset"
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
