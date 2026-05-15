"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@iconify/react";
import {
  ExternalLink,
  LayoutDashboard,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { TopBar } from "@/components/layout/top-bar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmbeddingFormDialog } from "@/components/embeddings/embedding-form-dialog";
import { useConfig } from "@/hooks/use-config";
import { useToast } from "@/hooks/use-toast";
import type { AppConfig, Embedding } from "@/lib/config/schema";
import { cn } from "@/lib/utils";

export default function EmbeddingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { config, hydrated, save } = useConfig();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Embedding | null>(null);
  const [iframeLoading, setIframeLoading] = React.useState(false);

  React.useEffect(() => {
    if (hydrated && !config) router.replace("/setup");
  }, [hydrated, config, router]);

  const embeddings = config?.embeddings ?? [];
  const selectedId = searchParams.get("id");
  const selected = embeddings.find((e) => e.id === selectedId) ?? null;

  const selectEmbedding = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("id", id);
    router.replace(`/embeddings?${params.toString()}`);
  };

  const clearSelection = () => {
    router.replace("/embeddings");
  };

  // Loading do iframe
  React.useEffect(() => {
    if (selected) setIframeLoading(true);
  }, [selected?.id, selected?.url]); // eslint-disable-line react-hooks/exhaustive-deps

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
        list[idx] = { id: data.id, title: data.title, url: data.url, icon: data.icon };
      }
      toast({ variant: "success", title: "Embedding atualizado" });
    } else {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `emb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      list.push({ id, title: data.title, url: data.url, icon: data.icon });
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
    if (selectedId === id) clearSelection();
    toast({ variant: "default", title: "Embedding removido" });
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
      <TopBar onDeploy={() => router.push("/scripts")} deployDisabled />

      <main className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">
              Embeddings
            </h2>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={openNew}
            >
              <Plus className="h-3 w-3" />
              Adicionar
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {embeddings.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-6 text-center">
                <LayoutDashboard className="mx-auto mb-2 h-6 w-6 text-slate-9" />
                <p className="text-sm font-medium text-foreground">
                  Nenhum embedding ainda
                </p>
                <p className="mt-1 text-xs text-slate-11">
                  Adicione um link para abri-lo dentro do app.
                </p>
                <Button
                  size="sm"
                  className="mt-3 gap-1.5"
                  onClick={openNew}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar embedding
                </Button>
              </div>
            ) : (
              <ul className="space-y-1">
                {embeddings.map((e) => {
                  const active = e.id === selectedId;
                  return (
                    <li key={e.id}>
                      <div
                        className={cn(
                          "group flex items-center gap-2 rounded-md border px-2 py-2 transition-colors",
                          active
                            ? "border-primary/40 bg-primary/10"
                            : "border-transparent hover:border-border hover:bg-slate-2",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => selectEmbedding(e.id)}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        >
                          <Icon
                            icon={e.icon}
                            className={cn(
                              "h-4 w-4 shrink-0",
                              active ? "text-primary" : "text-foreground",
                            )}
                          />
                          <span
                            className={cn(
                              "truncate text-sm",
                              active ? "font-medium text-primary" : "text-foreground",
                            )}
                          >
                            {e.title}
                          </span>
                        </button>
                        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => openEdit(e)}
                            aria-label={`Editar ${e.title}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive-text hover:bg-destructive-subtle"
                            onClick={() => handleRemove(e.id)}
                            aria-label={`Remover ${e.title}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Visualizador */}
        <section className="flex flex-1 flex-col bg-slate-1">
          {selected ? (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Icon
                    icon={selected.icon}
                    className="h-4 w-4 shrink-0 text-foreground"
                  />
                  <span className="truncate text-sm font-medium text-foreground">
                    {selected.title}
                  </span>
                  <span className="hidden truncate font-mono text-[11px] text-slate-9 sm:inline">
                    — {selected.url}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-xs"
                  onClick={() =>
                    window.open(selected.url, "_blank", "noopener,noreferrer")
                  }
                >
                  <ExternalLink className="h-3 w-3" />
                  Abrir em nova aba
                </Button>
              </div>

              <div className="relative flex-1 bg-background">
                {iframeLoading && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/80">
                    <Skeleton className="h-32 w-96" />
                  </div>
                )}
                <iframe
                  key={selected.id}
                  src={selected.url}
                  title={selected.title}
                  className="h-full w-full border-0"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
                  referrerPolicy="no-referrer-when-downgrade"
                  onLoad={() => setIframeLoading(false)}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8">
              <div className="max-w-sm text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-3">
                  <LayoutDashboard className="h-6 w-6 text-slate-10" />
                </div>
                <p className="text-base font-semibold text-foreground">
                  Selecione um embedding
                </p>
                <p className="mt-1 text-sm text-slate-11">
                  Escolha um item na lista à esquerda para carregar dentro do
                  app. Adicione novos no botão acima.
                </p>
                {embeddings.length === 0 && (
                  <Button size="sm" className="mt-4 gap-1.5" onClick={openNew}>
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar primeiro embedding
                  </Button>
                )}
              </div>
            </div>
          )}
        </section>
      </main>

      <EmbeddingFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
