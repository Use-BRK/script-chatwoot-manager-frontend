"use client";

import * as React from "react";
import { Loader2, Rocket } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BundlePreview } from "./bundle-preview";
import { useConfig } from "@/hooks/use-config";
import { useReadAllScripts, useScriptList } from "@/hooks/use-github-files";
import { useDeployBundle } from "@/hooks/use-bundle-deploy";
import { generateBundle, computeStats } from "@/lib/bundle/generator";
import {
  EMBEDDINGS_SCRIPT_NAME,
  generateEmbeddingsScript,
} from "@/lib/embeddings/generator";
import { useToast } from "@/hooks/use-toast";
import { formatBytes } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Conteúdo local (com modificações) por path */
  liveOverrides?: Record<string, string>;
}

export function BundleModal({ open, onOpenChange, liveOverrides }: Props) {
  const { config } = useConfig();
  const { data: list, isLoading: listLoading } = useScriptList(config);
  const readAll = useReadAllScripts(config);
  const deploy = useDeployBundle(config);
  const { toast } = useToast();

  const [excluded, setExcluded] = React.useState<Set<string>>(new Set());
  const [files, setFiles] = React.useState<
    { name: string; path: string; content: string }[]
  >([]);

  React.useEffect(() => {
    if (!open || !list || !config) return;
    setExcluded(new Set());
    const paths = list.map((f) => f.path);
    readAll.mutate(paths, {
      onSuccess: (allFiles) => {
        const merged = allFiles.map((f) => ({
          name: f.name,
          path: f.path,
          content: liveOverrides?.[f.path] ?? f.content,
        }));
        setFiles(merged);
      },
      onError: (err) => {
        toast({
          variant: "destructive",
          title: "Falha ao carregar scripts",
          description: (err as Error).message,
        });
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, list?.length]);

  const includedFiles = React.useMemo(
    () => files.filter((f) => !excluded.has(f.path)),
    [files, excluded],
  );

  /** Script gerado a partir dos embeddings configurados (vazio se não há). */
  const embeddingsScript = React.useMemo(() => {
    const list = config?.embeddings ?? [];
    if (list.length === 0) return null;
    return {
      name: EMBEDDINGS_SCRIPT_NAME,
      path: EMBEDDINGS_SCRIPT_NAME,
      content: generateEmbeddingsScript(list),
    };
  }, [config?.embeddings]);

  /** Lista combinada: scripts do GitHub + userscript de embeddings (se houver). */
  const allIncluded = React.useMemo(() => {
    if (!embeddingsScript) return includedFiles;
    if (excluded.has(EMBEDDINGS_SCRIPT_NAME)) return includedFiles;
    return [...includedFiles, embeddingsScript];
  }, [includedFiles, embeddingsScript, excluded]);

  const bundle = React.useMemo(
    () => generateBundle(allIncluded, { stripComments: config?.stripComments }),
    [allIncluded, config?.stripComments],
  );

  const stats = React.useMemo(
    () => computeStats(bundle, allIncluded),
    [bundle, allIncluded],
  );

  const toggle = (path: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleDeploy = () => {
    if (!bundle || stats.scriptCount === 0) {
      toast({
        variant: "destructive",
        title: "Bundle vazio",
        description: "Selecione ao menos um script com conteúdo.",
      });
      return;
    }
    const namedScripts = allIncluded
      .map((f) => ({
        name: f.path,
        content: (config?.stripComments
          ? f.content.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/(?![*]).*$/gm, "")
          : f.content
        ).trim(),
      }))
      .filter((s) => s.content.length > 0);
    deploy.mutate(namedScripts, {
      onSuccess: (res) => {
        const when = new Date(res.deployedAt).toLocaleString();
        if (res.warning) {
          toast({
            variant: "warning",
            title: "Bundle deployado com aviso",
            description: `${res.warning} (em ${when})`,
          });
        } else {
          toast({
            variant: "success",
            title: "Bundle deployado",
            description: `Em ${when}`,
          });
        }
        onOpenChange(false);
      },
      onError: (err) => {
        toast({
          variant: "destructive",
          title: "Falha no deploy",
          description: (err as Error).message,
        });
      },
    });
  };

  const isLoading = listLoading || readAll.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-4 overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>Gerar e enviar bundle</DialogTitle>
          <DialogDescription>
            Concatena todos os scripts selecionados em
            <code className="mx-1 rounded bg-slate-3 px-1 py-0.5 text-[11px]">
              &lt;script&gt;…&lt;/script&gt;…
            </code>
            e envia para a API do bundle.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                {stats.scriptCount} scripts incluídos
              </Badge>
              <Badge variant="secondary">
                bundle: {formatBytes(stats.sizeBytes)}
              </Badge>
              <Badge variant="secondary">
                JS bruto: {formatBytes(stats.bareJsBytes)}
              </Badge>
              {config?.stripComments && (
                <Badge variant="warning">comentários removidos</Badge>
              )}
            </div>

            <BundlePreview content={bundle || "/* bundle vazio */"} />

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-11">
                Arquivos incluídos
              </p>
              <ScrollArea className="h-40 rounded-md border border-border bg-slate-2">
                <ul className="divide-y divide-border">
                  {files.length === 0 && !embeddingsScript ? (
                    <li className="p-4 text-center text-xs text-slate-11">
                      Nenhum script encontrado
                    </li>
                  ) : (
                    <>
                      {files.map((file) => {
                        const isIncluded = !excluded.has(file.path);
                        const id = `bundle-file-${file.path}`;
                        const displayPath = file.path;
                        return (
                          <li
                            key={file.path}
                            className="flex items-center justify-between gap-3 px-3 py-2"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <Checkbox
                                id={id}
                                checked={isIncluded}
                                onCheckedChange={() => toggle(file.path)}
                              />
                              <Label
                                htmlFor={id}
                                className="cursor-pointer truncate font-mono text-xs"
                                title={displayPath}
                              >
                                {displayPath}
                              </Label>
                            </div>
                            <span className="shrink-0 font-mono text-[11px] text-slate-11">
                              {formatBytes(
                                new TextEncoder().encode(file.content).length,
                              )}
                            </span>
                          </li>
                        );
                      })}
                      {embeddingsScript && (
                        <li
                          key={embeddingsScript.path}
                          className="flex items-center justify-between gap-3 px-3 py-2"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <Checkbox
                              id={`bundle-file-${embeddingsScript.path}`}
                              checked={!excluded.has(embeddingsScript.path)}
                              onCheckedChange={() => toggle(embeddingsScript.path)}
                            />
                            <Label
                              htmlFor={`bundle-file-${embeddingsScript.path}`}
                              className="cursor-pointer truncate font-mono text-xs"
                              title={embeddingsScript.path}
                            >
                              {embeddingsScript.path}
                            </Label>
                            <Badge variant="secondary" className="shrink-0 text-[10px]">
                              gerado
                            </Badge>
                          </div>
                          <span className="shrink-0 font-mono text-[11px] text-slate-11">
                            {formatBytes(
                              new TextEncoder().encode(embeddingsScript.content).length,
                            )}
                          </span>
                        </li>
                      )}
                    </>
                  )}
                </ul>
              </ScrollArea>
            </div>
          </div>
        )}

        <DialogFooter className="shrink-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deploy.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleDeploy}
            disabled={isLoading || deploy.isPending || stats.scriptCount === 0}
          >
            {deploy.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Rocket className="h-3.5 w-3.5" />
            )}
            Confirmar e enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
