"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Boxes,
  Code2,
  FileCode2,
  FolderOpen,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  TriangleAlert,
} from "lucide-react";
import { TopBar } from "@/components/layout/top-bar";
import { BundleModal } from "@/components/bundle/bundle-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useConfig } from "@/hooks/use-config";
import {
  useScriptList,
  useCreateScript,
  useReadAllScripts,
} from "@/hooks/use-github-files";
import { useDeployBundle } from "@/hooks/use-bundle-deploy";
import { useScriptEnabled } from "@/hooks/use-script-enabled";
import { useToast } from "@/hooks/use-toast";
import { GitHubClient } from "@/lib/github/client";
import { cn } from "@/lib/utils";
import type { ScriptListItem } from "@/lib/github/types";

export default function ScriptsPage() {
  const router = useRouter();
  const { config, hydrated, save: saveConfig } = useConfig();
  const { toast } = useToast();

  const list = useScriptList(config);
  const readAll = useReadAllScripts(config);
  const deploy = useDeployBundle(config);
  const create = useCreateScript(config);
  const scriptEnabled = useScriptEnabled(config?.repository, config?.branch);

  const [query, setQuery] = React.useState("");
  const [bundleOpen, setBundleOpen] = React.useState(false);
  /** Path do script sendo togglado (pra mostrar loading naquele card) */
  const [togglingPath, setTogglingPath] = React.useState<string | null>(null);

  /** Dialog de criação de novo script */
  const [createOpen, setCreateOpen] = React.useState(false);
  const [newScriptName, setNewScriptName] = React.useState("");
  const [newScriptFolder, setNewScriptFolder] = React.useState("");

  /** Pastas carregadas automaticamente do GitHub */
  const [repoDirs, setRepoDirs] = React.useState<string[]>([]);
  const [dirsLoading, setDirsLoading] = React.useState(false);

  React.useEffect(() => {
    if (hydrated && !config) router.replace("/setup");
  }, [hydrated, config, router]);

  /**
   * Auto-fetch das pastas do repositório GitHub ao montar.
   * Atualiza a config (scriptsPaths) automaticamente se estiver vazia.
   */
  React.useEffect(() => {
    if (!config) return;
    let cancelled = false;

    const fetchDirs = async () => {
      setDirsLoading(true);
      try {
        const client = new GitHubClient(config);
        const dirs = await client.listRootDirectories();
        if (cancelled) return;
        setRepoDirs(dirs);

        // Auto-preenche scriptsPaths se estiver vazio
        if (dirs.length > 0 && (!config.scriptsPaths || config.scriptsPaths.length === 0)) {
          saveConfig({
            ...config,
            scriptsPaths: dirs,
          });
          // Refetch a lista com as novas pastas
          setTimeout(() => list.refetch(), 300);
        }
      } catch {
        // Silencia erro — as pastas podem não carregar, não é crítico
      } finally {
        if (!cancelled) setDirsLoading(false);
      }
    };

    fetchDirs();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.repository, config?.branch, config?.githubToken]);

  const items = list.data ?? [];

  const filtered = React.useMemo(() => {
    if (!query) return items;
    const q = query.toLowerCase();
    return items.filter((i) => {
      return (
        i.name.toLowerCase().includes(q) ||
        (i.folder ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, query]);

  /** Pastas disponíveis: as da config + as do repo */
  const allFolders = React.useMemo(() => {
    const set = new Set<string>([""]);
    config?.scriptsPaths?.forEach((p) => set.add(p));
    repoDirs.forEach((p) => set.add(p));
    return [...set];
  }, [config?.scriptsPaths, repoDirs]);

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

    const scriptName = toggledPath.split("/").slice(-2).join("/") || toggledPath;

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

  const handleCreateScript = () => {
    setNewScriptName("");
    setNewScriptFolder(allFolders.length > 1 ? allFolders[1] : "");
    setCreateOpen(true);
  };

  const submitCreateScript = () => {
    let filename = newScriptName.trim();
    if (!filename) return;
    if (!filename.endsWith(".js")) filename += ".js";
    const folder = newScriptFolder.trim().replace(/^\/|\/$/g, "");
    const fullPath = folder ? `${folder}/${filename}` : filename;

    create.mutate(fullPath, {
      onSuccess: () => {
        toast({
          variant: "success",
          title: "Script criado",
          description: `${fullPath} criado no GitHub.`,
        });
        setCreateOpen(false);
        list.refetch();
      },
      onError: (err) => {
        toast({
          variant: "destructive",
          title: "Falha ao criar",
          description: (err as Error).message,
        });
      },
    });
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

          {/* Ações principais */}
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={handleCreateScript}
              disabled={create.isPending}
              className="gap-1.5"
            >
              {create.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Novo Script
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="gap-1.5"
            >
              <Link href={items.length > 0 ? `/scripts/edit/${encodeURIComponent(items[0].path)}` : "/scripts/edit/_"}>
                <Code2 className="h-3.5 w-3.5" />
                Abrir Editor
              </Link>
            </Button>
            {dirsLoading && (
              <span className="flex items-center gap-1.5 text-xs text-slate-9">
                <Loader2 className="h-3 w-3 animate-spin" />
                Carregando pastas…
              </span>
            )}
            {!dirsLoading && repoDirs.length > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-slate-9">
                <FolderOpen className="h-3 w-3" />
                {repoDirs.length} pasta{repoDirs.length !== 1 ? "s" : ""} detectada{repoDirs.length !== 1 ? "s" : ""}
              </span>
            )}
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
                Crie seu primeiro script clicando em &ldquo;Novo Script&rdquo; acima.
              </p>
              <Button size="sm" className="mt-4 gap-1.5" onClick={handleCreateScript}>
                <Plus className="h-3.5 w-3.5" />
                Criar primeiro script
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
                const enabled = scriptEnabled.isEnabled(item.path);
                const isToggling = togglingPath === item.path;
                return (
                  <ScriptCard
                    key={item.path}
                    item={item}
                    isActive={enabled}
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

      {/* Dialog de criação de novo script */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Script</DialogTitle>
            <DialogDescription>
              O script será criado diretamente no repositório GitHub.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Seleção de pasta */}
            <div className="space-y-1.5">
              <Label>Pasta</Label>
              {allFolders.length > 1 ? (
                <div className="flex flex-wrap gap-1.5">
                  {allFolders.map((folder) => {
                    const selected = newScriptFolder === folder;
                    return (
                      <button
                        key={folder || "__root__"}
                        type="button"
                        onClick={() => setNewScriptFolder(folder)}
                        className={cn(
                          "flex items-center gap-1 rounded-full border px-3 py-1 font-mono text-xs transition-colors",
                          selected
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border bg-slate-3 text-slate-11 hover:border-primary/30 hover:bg-primary/5 hover:text-slate-12",
                        )}
                      >
                        <FolderOpen className="h-3 w-3" />
                        {folder || "/ (raiz)"}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-11">
                  Nenhuma pasta detectada — o script será criado na raiz.
                </p>
              )}
            </div>

            {/* Nome do arquivo */}
            <div className="space-y-1.5">
              <Label>Nome do arquivo</Label>
              <Input
                value={newScriptName}
                onChange={(e) => setNewScriptName(e.target.value)}
                placeholder="meu-script.js"
                className="font-mono text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitCreateScript();
                  }
                }}
              />
              <p className="text-xs text-slate-11">
                A extensão .js será adicionada automaticamente se não incluída.
              </p>
            </div>

            {/* Preview do path */}
            {newScriptName.trim() && (
              <div className="rounded-md border border-border bg-slate-2 px-3 py-2">
                <p className="text-[11px] text-slate-9">Caminho final:</p>
                <p className="font-mono text-xs text-foreground">
                  {newScriptFolder
                    ? `${newScriptFolder}/${newScriptName.trim().endsWith(".js") ? newScriptName.trim() : newScriptName.trim() + ".js"}`
                    : (newScriptName.trim().endsWith(".js") ? newScriptName.trim() : newScriptName.trim() + ".js")}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={submitCreateScript}
              disabled={!newScriptName.trim() || create.isPending}
            >
              {create.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Criar Script
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ScriptCard({
  item,
  isActive,
  onToggle,
  isToggling,
  isDeploying,
}: {
  item: ScriptListItem;
  isActive: boolean;
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
      {/* Nome da pasta (principal) + nome do script */}
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold text-foreground">
            {item.folder || item.name}
          </span>
          <span className="truncate text-[11px] font-mono text-slate-9">
            {item.name}
          </span>
        </div>
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
