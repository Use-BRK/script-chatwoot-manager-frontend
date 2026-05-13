"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Boxes, Rocket } from "lucide-react";
import Link from "next/link";
import { TopBar } from "@/components/layout/top-bar";
import { FileList } from "@/components/editor/file-list";
import { EditorHeader } from "@/components/editor/editor-header";
import { CodeEditor } from "@/components/editor/code-editor";
import { BundleModal } from "@/components/bundle/bundle-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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
  useCreateScript,
  useDeleteScript,
  useDuplicateScript,
  useRenameScript,
  useSaveScript,
  useScriptFile,
  useScriptList,
} from "@/hooks/use-github-files";
import { useVirtualFolders } from "@/hooks/use-virtual-folders";
import { useToast } from "@/hooks/use-toast";
import type { CreatingState } from "@/components/editor/file-list";
import type { ScriptListItem } from "@/lib/github/types";

export default function EditorPage() {
  const router = useRouter();
  const params = useParams();
  const { config, hydrated, save: saveConfig } = useConfig();
  const { toast } = useToast();

  // Decodifica o path do parâmetro da URL
  const pathParam = params.path as string;
  const initialPath = pathParam ? decodeURIComponent(pathParam) : null;

  const list = useScriptList(config);
  const [selectedPath, setSelectedPath] = React.useState<string | null>(
    initialPath,
  );
  /** Pasta de referência pra criar novo arquivo. Pode estar setada mesmo
   *  quando o destaque visual está num arquivo (= a pasta-pai dele). */
  const [selectedFolder, setSelectedFolder] = React.useState<string | null>(
    null,
  );
  /** Qual elemento está visualmente selecionado na sidebar. Mutuamente exclusivo. */
  const [selectionType, setSelectionType] = React.useState<"file" | "folder">(
    "file",
  );
  const file = useScriptFile(config, selectedPath);
  const save = useSaveScript(config);
  const create = useCreateScript(config);
  const deleteScript = useDeleteScript(config);
  const rename = useRenameScript(config);
  const duplicate = useDuplicateScript(config);

  const virtualFolders = useVirtualFolders(config?.repository, config?.branch);

  // local edits per path
  const [localContents, setLocalContents] = React.useState<
    Record<string, string>
  >({});
  const [bundleOpen, setBundleOpen] = React.useState(false);
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<ScriptListItem | null>(
    null,
  );
  const [creating, setCreating] = React.useState<CreatingState>(null);
  /** Path do arquivo sendo renomeado inline (null = nenhum) */
  const [renamingPath, setRenamingPath] = React.useState<string | null>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

  // Redirect to /setup if not configured
  React.useEffect(() => {
    if (hydrated && !config) router.replace("/setup");
  }, [hydrated, config, router]);

  // Sincroniza selectedPath com o path da URL ao montar
  React.useEffect(() => {
    if (initialPath && !selectedPath) {
      setSelectedPath(initialPath);
    }
  }, [initialPath, selectedPath]);

  // Mantém selectedFolder em sincronia com a pasta do arquivo selecionado.
  // Se o user navega entre arquivos de pastas diferentes, a pasta "ativa" segue.
  React.useEffect(() => {
    if (!selectedPath || !list.data) return;
    const item = list.data.find((i) => i.path === selectedPath);
    if (item) setSelectedFolder(item.folder ?? "");
  }, [selectedPath, list.data]);

  const currentLocal = selectedPath
    ? localContents[selectedPath] ?? null
    : null;
  const currentRemote = file.data?.content ?? "";
  const editorValue = currentLocal !== null ? currentLocal : currentRemote;
  const isDirty =
    selectedPath !== null &&
    currentLocal !== null &&
    currentLocal !== currentRemote;

  const modifiedPaths = React.useMemo(
    () =>
      new Set(
        Object.keys(localContents).filter(
          (path) => localContents[path] !== undefined,
        ),
      ),
    [localContents],
  );

  // Update browser tab title
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const prefix = isDirty ? "* " : "";
    document.title = selectedPath
      ? `${prefix}${selectedPath} — Chatwoot Script Manager`
      : "Chatwoot Script Manager";
  }, [selectedPath, isDirty]);

  // Warn before unloading with unsaved changes
  React.useEffect(() => {
    if (modifiedPaths.size === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [modifiedPaths]);

  const handleSave = React.useCallback(() => {
    if (!selectedPath || !file.data || !isDirty) return;
    const content = localContents[selectedPath];
    if (content === undefined) return;
    save.mutate(
      { path: selectedPath, content, sha: file.data.sha },
      {
        onSuccess: () => {
          setLocalContents((prev) => {
            const next = { ...prev };
            delete next[selectedPath];
            return next;
          });
        },
        onError: (err) => {
          toast({
            variant: "destructive",
            title: "Falha ao salvar",
            description: (err as Error).message,
          });
        },
      },
    );
  }, [selectedPath, file.data, isDirty, localContents, save, toast]);

  const handleDiscard = () => {
    if (!isDirty) return;
    setDiscardOpen(true);
  };

  const confirmDiscard = () => {
    if (!selectedPath) return;
    setLocalContents((prev) => {
      const next = { ...prev };
      delete next[selectedPath];
      return next;
    });
    setDiscardOpen(false);
  };

  const handleCreate = () => {
    // Pasta selecionada na sidebar → destino default. Sem seleção → raiz.
    setCreating({ type: "file", folder: selectedFolder ?? "" });
  };

  const handleCreateFolder = () => {
    setCreating({ type: "folder" });
  };

  const cancelCreate = () => {
    setCreating(null);
  };

  /**
   * Pastas disponíveis pra mover/escolher como destino: raiz + scriptsPaths
   * + virtuais. Uniq, preserva ordem.
   */
  const availableFolders = React.useMemo(() => {
    const set = new Set<string>([""]);
    config?.scriptsPaths?.forEach((p) => set.add(p));
    virtualFolders.folders.forEach((p) => set.add(p));
    return [...set];
  }, [config?.scriptsPaths, virtualFolders.folders]);

  const handleStartRename = (item: ScriptListItem) => {
    setRenamingPath(item.path);
  };

  const handleDuplicate = (item: ScriptListItem) => {
    duplicate.mutate(
      { sourcePath: item.path },
      {
        onError: (err) => {
          toast({
            variant: "destructive",
            title: "Falha ao duplicar",
            description: (err as Error).message,
          });
        },
      },
    );
  };

  const handleMove = (item: ScriptListItem, targetFolder: string) => {
    const currentFolder = item.folder ?? "";
    if (currentFolder === targetFolder) return;
    const newPath = targetFolder ? `${targetFolder}/${item.name}` : item.name;
    rename.mutate(
      { oldPath: item.path, newPath },
      {
        onSuccess: () => {
          setLocalContents((prev) => {
            if (!(item.path in prev)) return prev;
            const next = { ...prev };
            next[newPath] = next[item.path];
            delete next[item.path];
            return next;
          });
          if (selectedPath === item.path) setSelectedPath(newPath);
        },
        onError: (err) => {
          toast({
            variant: "destructive",
            title: "Falha ao mover",
            description: (err as Error).message,
          });
        },
      },
    );
  };

  const handleCopyPath = (item: ScriptListItem) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      toast({
        variant: "destructive",
        title: "Clipboard indisponível",
        description: "O navegador não permite cópia automática.",
      });
      return;
    }
    navigator.clipboard.writeText(item.path).catch(() => {
      toast({
        variant: "destructive",
        title: "Falha ao copiar",
        description: item.path,
      });
    });
  };

  const cancelRename = () => {
    setRenamingPath(null);
  };

  const submitRename = (newName: string) => {
    if (!renamingPath || rename.isPending) {
      setRenamingPath(null);
      return;
    }
    const oldPath = renamingPath;
    setRenamingPath(null);
    let trimmed = newName.trim();
    if (!trimmed || trimmed === oldPath.split("/").pop()) return;
    if (!trimmed.endsWith(".js")) trimmed += ".js";
    const slashIdx = oldPath.lastIndexOf("/");
    const folder = slashIdx >= 0 ? oldPath.slice(0, slashIdx) : "";
    const newPath = folder ? `${folder}/${trimmed}` : trimmed;
    if (newPath === oldPath) return;
    rename.mutate(
      { oldPath, newPath },
      {
        onSuccess: () => {
          // Migra edits locais e seleção pra o novo path
          setLocalContents((prev) => {
            if (!(oldPath in prev)) return prev;
            const next = { ...prev };
            next[newPath] = next[oldPath];
            delete next[oldPath];
            return next;
          });
          if (selectedPath === oldPath) setSelectedPath(newPath);
        },
        onError: (err) => {
          toast({
            variant: "destructive",
            title: "Falha ao renomear",
            description: (err as Error).message,
          });
        },
      },
    );
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    // Fecha o dialog na hora — o optimistic update do useDeleteScript já
    // removeu o item do cache. Se falhar, rollback acontece lá e toast aqui.
    setDeleteTarget(null);
    setLocalContents((prev) => {
      const next = { ...prev };
      delete next[target.path];
      return next;
    });
    if (selectedPath === target.path) setSelectedPath(null);
    deleteScript.mutate(
      { path: target.path, sha: target.sha },
      {
        onError: (err) => {
          toast({
            variant: "destructive",
            title: "Falha ao apagar",
            description: (err as Error).message,
          });
        },
      },
    );
  };

  const submitCreateFolder = (rawName: string) => {
    const name = rawName.trim().replace(/^\/|\/$/g, "");
    setCreating(null);
    if (!name) return;
    const exists =
      config?.scriptsPaths?.includes(name) ||
      virtualFolders.folders.includes(name);
    if (exists) {
      toast({
        variant: "destructive",
        title: "Pasta já existe",
        description: name,
      });
      return;
    }
    virtualFolders.add(name);
  };

  const submitCreate = (rawName: string) => {
    if (create.isPending) return;
    setCreating(null);
    let filename = rawName.trim();
    if (!filename) return;
    if (!filename.endsWith(".js")) filename += ".js";
    // Pega a pasta do estado de criação (não de selectedFolder, que pode ter mudado)
    const folder =
      creating?.type === "file"
        ? creating.folder.trim().replace(/^\/|\/$/g, "")
        : "";
    const fullPath = folder ? `${folder}/${filename}` : filename;
    create.mutate(fullPath, {
      onSuccess: () => {
        // Se a pasta era virtual, promove: entra em scriptsPaths e sai do store virtual.
        if (folder && virtualFolders.folders.includes(folder) && config) {
          const alreadyConfigured = config.scriptsPaths.includes(folder);
          if (!alreadyConfigured) {
            saveConfig({
              ...config,
              scriptsPaths: [...config.scriptsPaths, folder],
            });
          }
          virtualFolders.remove(folder);
        }
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

  // Keyboard shortcuts
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "s" && !bundleOpen) {
        e.preventDefault();
        handleSave();
      } else if (meta && e.shiftKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setBundleOpen(true);
      } else if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "F2" && !meta) {
        // F2 renomeia o arquivo selecionado, igual no VS Code.
        // Ignora se o foco está num campo de texto (não rouba edição em andamento).
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        if (selectionType === "file" && selectedPath) {
          e.preventDefault();
          setRenamingPath(selectedPath);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave, bundleOpen, selectedPath, selectionType]);

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

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <FileList
          items={list.data ?? []}
          virtualFolders={virtualFolders.folders}
          selectedPath={selectionType === "file" ? selectedPath : null}
          selectedFolder={selectionType === "folder" ? selectedFolder : null}
          creating={creating}
          renamingPath={renamingPath}
          onSelect={(path) => {
            setSelectedPath(path);
            setSelectionType("file");
            // Atualiza a URL sem recarregar a página
            window.history.replaceState(
              null,
              "",
              `/scripts/edit/${encodeURIComponent(path)}`,
            );
          }}
          onSelectFolder={(folder) => {
            setSelectedFolder(folder);
            setSelectionType("folder");
          }}
          onCreate={handleCreate}
          onCreateFolder={handleCreateFolder}
          onSubmitCreate={submitCreate}
          onSubmitCreateFolder={submitCreateFolder}
          onCancelCreate={cancelCreate}
          onStartRename={handleStartRename}
          onSubmitRename={submitRename}
          onCancelRename={cancelRename}
          onDuplicate={handleDuplicate}
          onMove={handleMove}
          onCopyPath={handleCopyPath}
          availableFolders={availableFolders}
          onDelete={setDeleteTarget}
          onRemoveVirtualFolder={virtualFolders.remove}
          onReload={() => list.refetch()}
          isLoading={list.isLoading}
          isReloading={list.isFetching && !list.isLoading}
          error={list.isError ? (list.error as Error).message : null}
          modifiedPaths={modifiedPaths}
          searchRef={searchRef}
        />

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <EditorHeader
            filePath={selectedPath}
            isDirty={isDirty}
            isSaving={save.isPending}
            onSave={handleSave}
            onDiscard={handleDiscard}
          />

          <div className="min-h-0 flex-1 overflow-hidden bg-card">
            {!selectedPath ? (
              <EmptyEditor
                hasFiles={(list.data?.length ?? 0) > 0}
                onCreate={handleCreate}
              />
            ) : file.isLoading ? (
              <div className="flex flex-1 items-center justify-center">
                <Skeleton className="h-32 w-3/4" />
              </div>
            ) : (
              <CodeEditor
                value={editorValue}
                onSave={handleSave}
                onChange={(value) => {
                  if (!selectedPath) return;
                  setLocalContents((prev) => ({
                    ...prev,
                    [selectedPath]: value,
                  }));
                }}
              />
            )}
          </div>

          <footer className="flex h-7 shrink-0 items-center justify-between gap-2 border-t border-border bg-slate-2 px-4 text-[11px] text-slate-11">
            <span>
              {selectedPath
                ? `${editorValue.split("\n").length} linhas`
                : ""}
            </span>
            <span>
              {isDirty
                ? "modificado"
                : selectedPath
                  ? "salvo"
                  : ""}
            </span>
          </footer>
        </main>
      </div>

      <BundleModal
        open={bundleOpen}
        onOpenChange={setBundleOpen}
        liveOverrides={localContents}
      />


      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apagar arquivo?</DialogTitle>
            <DialogDescription>
              <span className="mx-1 font-mono">{deleteTarget?.path}</span> será
              removido do GitHub via commit. Essa ação não pode ser desfeita
              pela interface — só revertendo o commit no repositório.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteScript.isPending}
            >
              Apagar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descartar mudanças?</DialogTitle>
            <DialogDescription>
              Esta ação não pode ser desfeita. As alterações locais em
              <span className="mx-1 font-mono">
                {selectedPath?.split("/").pop()}
              </span>
              serão perdidas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDiscard}>
              Descartar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyEditor({
  hasFiles,
  onCreate,
}: {
  hasFiles: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-3">
        <Boxes className="h-5 w-5 text-slate-10" />
      </div>
      <div>
        <p className="text-sm font-semibold">
          {hasFiles ? "Selecione um arquivo" : "Nenhum script ainda"}
        </p>
        <p className="text-xs text-slate-11">
          {hasFiles
            ? "Escolha um arquivo na lista à esquerda para editar."
            : "Crie seu primeiro script para começar."}
        </p>
      </div>
      {!hasFiles && (
        <Button size="sm" onClick={onCreate}>
          Criar primeiro script
        </Button>
      )}
    </div>
  );
}
