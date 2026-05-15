"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import {
  Copy,
  Info,
  LayoutDashboard,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { TopBar } from "@/components/layout/top-bar";
import { BundleModal } from "@/components/bundle/bundle-modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmbeddingFormDialog } from "@/components/embeddings/embedding-form-dialog";
import { useConfig } from "@/hooks/use-config";
import { useToast } from "@/hooks/use-toast";
import {
  EMBEDDINGS_SCRIPT_NAME,
  generateEmbeddingsScript,
} from "@/lib/embeddings/generator";
import type { AppConfig, Embedding } from "@/lib/config/schema";
import { formatBytes } from "@/lib/utils";

export default function EmbeddingsPage() {
  const router = useRouter();
  const { config, hydrated, save } = useConfig();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Embedding | null>(null);
  const [bundleOpen, setBundleOpen] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);

  React.useEffect(() => {
    if (hydrated && !config) router.replace("/setup");
  }, [hydrated, config, router]);

  const embeddings = config?.embeddings ?? [];
  const generated = React.useMemo(
    () => (embeddings.length > 0 ? generateEmbeddingsScript(embeddings) : ""),
    [embeddings],
  );

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (e: Embedding) => {
    setEditing(e);
    setDialogOpen(true);
  };

  const handleSubmit = (data: Omit<Embedding, "id"> & { id?: string }) => {
    if (!config) return;
    const list = [...(config.embeddings ?? [])];

    if (data.id) {
      const idx = list.findIndex((e) => e.id === data.id);
      if (idx >= 0) {
        list[idx] = {
          id: data.id,
          title: data.title,
          url: data.url,
          icon: data.icon,
          iconBody: data.iconBody,
          iconWidth: data.iconWidth,
          iconHeight: data.iconHeight,
        };
      }
      toast({ variant: "success", title: "Embedding atualizado" });
    } else {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `emb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      list.push({
        id,
        title: data.title,
        url: data.url,
        icon: data.icon,
        iconBody: data.iconBody,
        iconWidth: data.iconWidth,
        iconHeight: data.iconHeight,
      });
      toast({ variant: "success", title: "Embedding adicionado" });
    }

    const next: AppConfig = { ...config, embeddings: list };
    save(next);
    setDialogOpen(false);
  };

  const handleRemove = (id: string) => {
    if (!config) return;
    const list = (config.embeddings ?? []).filter((e) => e.id !== id);
    const next: AppConfig = { ...config, embeddings: list };
    save(next);
    toast({ variant: "default", title: "Embedding removido" });
  };

  const copyScript = async () => {
    try {
      await navigator.clipboard.writeText(generated);
      toast({ variant: "success", title: "Script copiado" });
    } catch {
      toast({ variant: "destructive", title: "Falha ao copiar" });
    }
  };

  if (!hydrated || !config) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-32 w-96" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <TopBar onDeploy={() => setBundleOpen(true)} />

      <main className="flex-1 overflow-y-auto bg-slate-1">
        <div className="mx-auto w-full max-w-3xl px-6 py-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Embeddings
              </h1>
              <p className="mt-1 text-sm text-slate-11">
                Adicione atalhos no menu lateral de Configurações do Chatwoot.
                O userscript gerado vai junto com o bundle no deploy.
              </p>
            </div>
            <Button size="sm" className="gap-1.5" onClick={openNew}>
              <Plus className="h-3.5 w-3.5" />
              Adicionar embedding
            </Button>
          </div>

          <div className="mb-6 flex items-start gap-2 rounded-md border border-border bg-slate-2 px-3 py-2 text-xs text-slate-11">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-9" />
            <p>
              Cada embedding vira um item no menu lateral de Configurações do
              Chatwoot. Ao clicar, o link abre num iframe sobreposto ao painel.
              Só aparece para usuários com role <code className="font-mono">administrator</code>.
            </p>
          </div>

          {embeddings.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-3">
                <LayoutDashboard className="h-6 w-6 text-slate-10" />
              </div>
              <p className="text-base font-semibold text-foreground">
                Nenhum embedding ainda
              </p>
              <p className="mt-1 text-sm text-slate-11">
                Cadastre o primeiro link que vai virar atalho no Chatwoot.
              </p>
              <Button size="sm" className="mt-4 gap-1.5" onClick={openNew}>
                <Plus className="h-3.5 w-3.5" />
                Adicionar primeiro embedding
              </Button>
            </div>
          ) : (
            <ul className="space-y-3">
              {embeddings.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
                >
                  <Icon
                    icon={e.icon}
                    className="h-5 w-5 shrink-0 text-foreground"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {e.title}
                    </p>
                    <p className="truncate font-mono text-[11px] text-slate-9">
                      {e.url}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(e)}
                      aria-label={`Editar ${e.title}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive-text hover:bg-destructive-subtle"
                      onClick={() => handleRemove(e.id)}
                      aria-label={`Remover ${e.title}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {generated && (
            <div className="mt-8 rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <h2 className="text-sm font-semibold text-foreground">
                    Userscript gerado
                  </h2>
                  <Badge variant="secondary" className="text-[10px]">
                    {EMBEDDINGS_SCRIPT_NAME}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {formatBytes(new TextEncoder().encode(generated).length)}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 px-2 text-xs"
                    onClick={() => setPreviewOpen((v) => !v)}
                  >
                    {previewOpen ? "Ocultar" : "Ver código"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 px-2 text-xs"
                    onClick={copyScript}
                  >
                    <Copy className="h-3 w-3" />
                    Copiar
                  </Button>
                </div>
              </div>
              {previewOpen && (
                <pre className="max-h-96 overflow-auto bg-slate-1 p-4 font-mono text-[11px] leading-relaxed text-foreground">
                  {generated}
                </pre>
              )}
            </div>
          )}
        </div>
      </main>

      <EmbeddingFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSubmit={handleSubmit}
      />

      <BundleModal
        open={bundleOpen}
        onOpenChange={setBundleOpen}
        liveOverrides={{}}
      />
    </div>
  );
}
