"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Boxes,
  FileCode2,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  TriangleAlert,
} from "lucide-react";
import { TopBar } from "@/components/layout/top-bar";
import { BundleModal } from "@/components/bundle/bundle-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useConfig } from "@/hooks/use-config";
import {
  useScriptList,
  useReadAllScripts,
} from "@/hooks/use-github-files";
import { useDeployBundle } from "@/hooks/use-bundle-deploy";
import { useScriptTitles } from "@/hooks/use-script-titles";
import { useScriptEnabled } from "@/hooks/use-script-enabled";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { ScriptListItem } from "@/lib/github/types";

export default function ScriptsPage() {
  const router = useRouter();
  const { config, hydrated } = useConfig();
  const { toast } = useToast();

  const list = useScriptList(config);
  const readAll = useReadAllScripts(config);
  const deploy = useDeployBundle(config);
  const scriptTitles = useScriptTitles(config?.repository, config?.branch);
  const scriptEnabled = useScriptEnabled(config?.repository, config?.branch);

  const [query, setQuery] = React.useState("");
  const [editingTitlePath, setEditingTitlePath] = React.useState<string | null>(
    null,
  );
  const [bundleOpen, setBundleOpen] = React.useState(false);
  /** Path do script sendo togglado (pra mostrar loading naquele card) */
  const [togglingPath, setTogglingPath] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (hydrated && !config) router.replace("/setup");
  }, [hydrated, config, router]);

  const items = list.data ?? [];

  const filtered = React.useMemo(() => {
    if (!query) return items;
    const q = query.toLowerCase();
    return items.filter((i) => {
      const title = scriptTitles.getTitle(i.path) ?? "";
      return (
        i.name.toLowerCase().includes(q) ||
        (i.folder ?? "").toLowerCase().includes(q) ||
        title.toLowerCase().includes(q)
      );
    });
  }, [items, query, scriptTitles]);

  if (!hydrated || !config) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-32 w-96" />
      </div>
    );
  }

  const isLoading = list.isLoading;
  const isRefreshing = list.isFetching && !list.isLoading;

  /**
   * Toggle: muda o estado local e automaticamente gera + deploya um novo bundle
   * com apenas os scripts ativos.
   */
  const handleToggle = async (toggledPath: string, nextActive: boolean) => {
    // 1. Atualiza o estado local imediatamente
    scriptEnabled.setEnabled(toggledPath, nextActive);
    setTogglingPath(toggledPath);

    const scriptName =
      scriptTitles.getTitle(toggledPath) || toggledPath.split("/").pop();

    try {
      // 2. Determina quais scripts ficam ativos APÓS a mudança
      const activePaths = items
        .filter((i) => {
          if (i.path === toggledPath) return nextActive;
          return scriptEnabled.isEnabled(i.path);
        })
        .map((i) => i.path);

      if (activePaths.length === 0) {
        // Deploy bundle vazio
        await new Promise<void>((resolve, reject) => {
          deploy.mutate([], {
            onSuccess: () => resolve(),
            onError: (err) => reject(err),
          });
        });
        toast({
          variant: "default",
          title: "Bundle atualizado",
          description: `${scriptName} desativado. Nenhum script ativo — bundle vazio enviado.`,
        });
        setTogglingPath(null);
        return;
      }

      // 3. Lê o conteúdo de todos os scripts ativos do GitHub
      const allFiles = await new Promise<
        { name: string; path: string; content: string }[]
      >((resolve, reject) => {
        readAll.mutate(activePaths, {
          onSuccess: (files) =>
            resolve(
              files.map((f) => ({
                name: f.name,
                path: f.path,
                content: f.content,
              })),
            ),
          onError: (err) => reject(err),
        });
      });

      // 4. Prepara os scripts para o deploy
      const namedScripts = allFiles
        .map((f) => ({
          name: f.path,
          content: (config?.stripComments
            ? f.content
                .replace(/\/\*[\s\S]*?\*\//g, "")
                .replace(/\/\/(?![*]).*$/gm, "")
            : f.content
          ).trim(),
        }))
        .filter((s) => s.content.length > 0);

      // 5. Deploya
      await new Promise<void>((resolve, reject) => {
        deploy.mutate(namedScripts, {
          onSuccess: () => resolve(),
          onError: (err) => reject(err),
        });
      });

      toast({
        variant: "success",
        title: nextActive ? "Script ativado" : "Script desativado",
        description: `${scriptName} — bundle atualizado com ${namedScripts.length} script(s).`,
      });
    } catch (err) {
      // Reverte o estado local em caso de erro
      scriptEnabled.setEnabled(toggledPath, !nextActive);
      toast({
        variant: "destructive",
        title: "Falha ao atualizar bundle",
        description: (err as Error).message,
      });
    } finally {
      setTogglingPath(null);
    }
  };

  const handleRefresh = () => {
    list.refetch();
  };

  const handleSaveTitle = (path: string, title: string) => {
    setEditingTitlePath(null);
    const trimmed = title.trim();
    if (!trimmed) {
      scriptTitles.removeTitle(path);
    } else {
      scriptTitles.setTitle(path, trimmed);
    }
  };

  const activeCount = items.filter((i) =>
    scriptEnabled.isEnabled(i.path),
  ).length;
  const isDeploying = readAll.isPending || deploy.isPending;

  return (
    <div className="flex h-screen flex-col">
      <TopBar onDeploy={() => setBundleOpen(true)} />

      <main className="flex-1 overflow-y-auto bg-slate-1">
        <div className="mx-auto w-full max-w-3xl px-6 py-8">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Scripts
              </h1>
              <p className="mt-1 text-sm text-slate-11">
                Ative ou desative scripts — o bundle é atualizado
                automaticamente.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Atualizar
              </Button>
              {items.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {activeCount}/{items.length} ativos
                </Badge>
              )}
            </div>
          </div>

          {/* Search */}
          {items.length > 0 && (
            <div className="relative mb-5">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-9" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar scripts..."
                className="h-10 pl-10 text-sm"
              />
            </div>
          )}

          {/* Content */}
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : list.isError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-center">
              <TriangleAlert className="mx-auto mb-3 h-8 w-8 text-destructive" />
              <p className="font-medium text-destructive">
                Erro ao carregar scripts
              </p>
              <p className="mt-1 text-xs text-destructive/80">
                {(list.error as Error)?.message ?? "Erro desconhecido"}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={handleRefresh}
              >
                Tentar novamente
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-3">
                <Boxes className="h-6 w-6 text-slate-10" />
              </div>
              <p className="text-base font-semibold text-foreground">
                Nenhum script ainda
              </p>
              <p className="mt-1 text-sm text-slate-11">
                Configure seus caminhos de scripts nas configurações para
                começar.
              </p>
              <Button asChild size="sm" className="mt-4">
                <Link href="/setup">Ir para configurações</Link>
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
              <Search className="mx-auto mb-3 h-8 w-8 text-slate-9" />
              <p className="font-medium text-foreground">Nenhum resultado</p>
              <p className="mt-1 text-sm text-slate-11">
                Nenhum script encontrado para &ldquo;{query}&rdquo;.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((item) => {
                const title = scriptTitles.getTitle(item.path);
                const enabled = scriptEnabled.isEnabled(item.path);
                const isToggling = togglingPath === item.path;
                return (
                  <ScriptCard
                    key={item.path}
                    item={item}
                    title={title}
                    isActive={enabled}
                    isEditingTitle={editingTitlePath === item.path}
                    onStartEditTitle={() => setEditingTitlePath(item.path)}
                    onSaveTitle={(t) => handleSaveTitle(item.path, t)}
                    onCancelEditTitle={() => setEditingTitlePath(null)}
                    onToggle={(next) => handleToggle(item.path, next)}
                    isToggling={isToggling}
                    isDeploying={isDeploying}
                  />
                );
              })}
            </div>
          )}
        </div>
      </main>

      <BundleModal
        open={bundleOpen}
        onOpenChange={setBundleOpen}
        liveOverrides={{}}
      />
    </div>
  );
}

function ScriptCard({
  item,
  title,
  isActive,
  isEditingTitle,
  onStartEditTitle,
  onSaveTitle,
  onCancelEditTitle,
  onToggle,
  isToggling,
  isDeploying,
}: {
  item: ScriptListItem;
  title: string | null;
  isActive: boolean;
  isEditingTitle: boolean;
  onStartEditTitle: () => void;
  onSaveTitle: (title: string) => void;
  onCancelEditTitle: () => void;
  onToggle: (next: boolean) => void;
  isToggling: boolean;
  isDeploying: boolean;
}) {
  const encodedPath = encodeURIComponent(item.path);

  return (
    <div
      className={cn(
        "group overflow-hidden rounded-lg border bg-card transition-all hover:shadow-md",
        isActive ? "border-border" : "border-border/50 opacity-60",
      )}
    >
      {/* Título editável + nome da pasta */}
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
        {isEditingTitle ? (
          <TitleInput
            initialValue={title ?? ""}
            placeholder="Adicionar título..."
            onSubmit={onSaveTitle}
            onCancel={onCancelEditTitle}
          />
        ) : (
          <>
            <div className="flex min-w-0 flex-1 flex-col">
              <span
                className={cn(
                  "truncate text-sm",
                  title
                    ? "font-semibold text-foreground"
                    : "italic text-slate-9",
                )}
              >
                {title || "Sem título — clique no lápis para adicionar"}
              </span>
              {item.folder && (
                <span className="truncate text-[11px] font-mono text-slate-9">
                  📁 {item.folder}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onStartEditTitle();
              }}
              className="shrink-0 rounded-sm p-1 text-slate-9 opacity-0 transition-opacity hover:bg-slate-4 hover:text-slate-12 group-hover:opacity-100"
              aria-label="Editar título"
              title="Editar título"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>

      {/* Ações do card */}
      <div className="flex items-center justify-between px-4 py-3">
        <Link
          href={`/scripts/edit/${encodedPath}`}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <FileCode2 className="h-3.5 w-3.5" />
          Editar script
        </Link>

        {/* Toggle ativar/desativar */}
        <div className="flex items-center gap-3">
          {isToggling ? (
            <span className="flex items-center gap-1.5 text-xs text-slate-9">
              <Loader2 className="h-3 w-3 animate-spin" />
              atualizando...
            </span>
          ) : (
            <span className="text-xs text-slate-9">
              {isActive ? "ativo" : "inativo"}
            </span>
          )}
          <Switch
            checked={isActive}
            onCheckedChange={onToggle}
            disabled={isToggling || isDeploying}
            aria-label={`${isActive ? "Desativar" : "Ativar"} ${item.name}`}
          />
        </div>
      </div>
    </div>
  );
}

function TitleInput({
  initialValue,
  placeholder,
  onSubmit,
  onCancel,
}: {
  initialValue: string;
  placeholder: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = React.useState(initialValue);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const submittedRef = React.useRef(false);

  React.useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, []);

  const tryCommit = () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    onSubmit(value);
  };

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          tryCommit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          submittedRef.current = true;
          onCancel();
        }
      }}
      onBlur={tryCommit}
      placeholder={placeholder}
      className="h-7 flex-1 rounded-md border border-accent bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-accent"
    />
  );
}
