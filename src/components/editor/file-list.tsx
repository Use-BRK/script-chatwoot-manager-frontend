"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  FileJson,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  Copy,
  FolderInput,
  FolderPlus,
  Link2,
  type LucideIcon,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ScriptListItem } from "@/lib/github/types";

function getFileIcon(name: string): { Icon: LucideIcon; className: string } {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "js":
    case "mjs":
    case "cjs":
      return { Icon: FileCode2, className: "text-amber-500" };
    case "ts":
    case "tsx":
    case "jsx":
      return { Icon: FileCode2, className: "text-sky-500" };
    case "json":
      return { Icon: FileJson, className: "text-emerald-500" };
    case "md":
    case "mdx":
      return { Icon: FileText, className: "text-slate-10" };
    case "css":
    case "scss":
      return { Icon: FileCode2, className: "text-pink-500" };
    case "html":
    case "htm":
      return { Icon: FileCode2, className: "text-orange-500" };
    default:
      return { Icon: FileText, className: "text-slate-10" };
  }
}

/** Estado de criação inline ativo na sidebar. */
export type CreatingState =
  | { type: "file"; folder: string }
  | { type: "folder" }
  | null;

interface Props {
  items: ScriptListItem[];
  /** Pastas que existem só no localStorage e ainda não têm arquivos no GitHub */
  virtualFolders: string[];
  selectedPath: string | null;
  /** Pasta atualmente selecionada (define destino default ao criar script) */
  selectedFolder: string | null;
  /** Estado de input inline (file/folder ativo, ou null) */
  creating: CreatingState;
  /** Path do arquivo em modo de rename inline (null = nenhum) */
  renamingPath: string | null;
  /** Pastas que podem receber arquivos (raiz "" + scriptsPaths + virtuais) */
  availableFolders: string[];
  onSelect: (path: string) => void;
  onSelectFolder: (folder: string) => void;
  onCreate: () => void;
  onCreateFolder: () => void;
  onSubmitCreate: (name: string) => void;
  onSubmitCreateFolder: (name: string) => void;
  onCancelCreate: () => void;
  onStartRename: (item: ScriptListItem) => void;
  onSubmitRename: (newName: string) => void;
  onCancelRename: () => void;
  onDuplicate: (item: ScriptListItem) => void;
  onMove: (item: ScriptListItem, targetFolder: string) => void;
  onCopyPath: (item: ScriptListItem) => void;
  onDelete: (item: ScriptListItem) => void;
  onRemoveVirtualFolder: (folder: string) => void;
  onReload: () => void;
  isLoading: boolean;
  isReloading: boolean;
  error?: string | null;
  modifiedPaths: Set<string>;
  searchRef?: React.RefObject<HTMLInputElement>;
}

/** Agrupa ScriptListItem por pasta (campo `folder`). */
function groupByFolder(
  items: ScriptListItem[],
): Map<string, ScriptListItem[]> {
  const map = new Map<string, ScriptListItem[]>();
  for (const item of items) {
    const key = item.folder ?? "";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return map;
}

export function FileList({
  items,
  virtualFolders,
  selectedPath,
  selectedFolder,
  creating,
  renamingPath,
  availableFolders,
  onSelect,
  onSelectFolder,
  onCreate,
  onCreateFolder,
  onSubmitCreate,
  onSubmitCreateFolder,
  onCancelCreate,
  onStartRename,
  onSubmitRename,
  onCancelRename,
  onDuplicate,
  onMove,
  onCopyPath,
  onDelete,
  onRemoveVirtualFolder,
  onReload,
  isLoading,
  isReloading,
  error,
  modifiedPaths,
  searchRef,
}: Props) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    if (!query) return items;
    const q = query.toLowerCase();
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, query]);

  /**
   * Pastas reais (vindas do GitHub) + pastas virtuais (só localStorage).
   * Virtuais com o mesmo nome de uma real somem — ela já foi promovida.
   * Quando o usuário busca algo, virtuais vazias somem (não há o que filtrar).
   */
  const grouped = React.useMemo(() => {
    const map = groupByFolder(filtered);
    if (!query) {
      for (const folder of virtualFolders) {
        if (!map.has(folder)) map.set(folder, []);
      }
    }
    // Se está criando arquivo na raiz e ela está vazia, força entrada no map
    // pra o input inline ter onde aparecer.
    if (
      creating?.type === "file" &&
      creating.folder === "" &&
      !map.has("")
    ) {
      map.set("", []);
    }
    return map;
  }, [filtered, virtualFolders, query, creating]);

  /** Conjunto pra marcar nós como virtuais (vazios E na lista virtual) */
  const virtualSet = React.useMemo(
    () => new Set(virtualFolders),
    [virtualFolders],
  );

  /** Só mostra cabeçalhos de pasta se houver mais de uma pasta distinta */
  const showGroups =
    grouped.size > 1 ||
    (grouped.size === 1 && [...grouped.keys()][0] !== "");

  return (
    <aside className="flex h-full w-[280px] flex-col border-r border-border bg-slate-2">
      <div className="flex items-center justify-between gap-2 border-b border-border p-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-11">
          Scripts
        </span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onReload}
            disabled={isReloading}
            aria-label="Recarregar do GitHub"
            title="Recarregar do GitHub"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", isReloading && "animate-spin")}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onCreateFolder}
            aria-label="Nova pasta"
            title="Nova pasta"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onCreate}
            aria-label="Novo script"
            title="Novo script"
          >
            <FilePlus2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="border-b border-border p-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-9" />
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar arquivo... (Cmd+K)"
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <ul className="p-1">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="px-2 py-1.5">
                <Skeleton className="h-5 w-full" />
              </li>
            ))
          ) : error ? (
            <li className="p-4 text-center text-xs">
              <TriangleAlert className="mx-auto mb-2 h-5 w-5 text-destructive" />
              <p className="font-medium text-destructive">
                Erro ao carregar scripts
              </p>
              <p className="mt-1 text-slate-11">{error}</p>
            </li>
          ) : filtered.length === 0 && grouped.size === 0 ? (
            <li className="p-6 text-center text-xs text-slate-11">
              {items.length === 0 ? (
                <>
                  Nenhum script ainda.
                  <br />
                  Clique em <span className="font-medium">+</span> para criar.
                </>
              ) : (
                "Nenhum resultado"
              )}
            </li>
          ) : (
            <>
              {/* Input inline pra criar pasta — sempre no topo */}
              {creating?.type === "folder" && (
                <InlineCreateRow
                  type="folder"
                  onSubmit={onSubmitCreateFolder}
                  onCancel={onCancelCreate}
                />
              )}
              {showGroups ? (
                /* ── Modo agrupado por pasta (árvore expansível) ── */
                [...grouped.entries()].map(([folder, files]) => (
                  <FolderNode
                    key={folder}
                    name={folder || "/"}
                    files={files}
                    isVirtual={virtualSet.has(folder) && files.length === 0}
                    isSelected={selectedFolder === folder}
                    selectedPath={selectedPath}
                    renamingPath={renamingPath}
                    modifiedPaths={modifiedPaths}
                    creatingFile={
                      creating?.type === "file" && creating.folder === folder
                    }
                    onSelect={onSelect}
                    onSelectFolder={() => onSelectFolder(folder)}
                    onSubmitCreate={onSubmitCreate}
                    onCancelCreate={onCancelCreate}
                    onStartRename={onStartRename}
                    onSubmitRename={onSubmitRename}
                    onCancelRename={onCancelRename}
                    onDuplicate={onDuplicate}
                    onMove={onMove}
                    onCopyPath={onCopyPath}
                    availableFolders={availableFolders}
                    onDelete={onDelete}
                    onRemoveVirtual={() => onRemoveVirtualFolder(folder)}
                    forceExpanded={query.length > 0}
                  />
                ))
              ) : (
                <>
                  {/* Modo plano: input na raiz vai aqui (sem indentação) */}
                  {creating?.type === "file" && creating.folder === "" && (
                    <InlineCreateRow
                      type="file"
                      onSubmit={onSubmitCreate}
                      onCancel={onCancelCreate}
                    />
                  )}
                  {filtered.map((file) => (
                    <ScriptRow
                      key={file.path}
                      file={file}
                      isSelected={file.path === selectedPath}
                      isModified={modifiedPaths.has(file.path)}
                      isRenaming={file.path === renamingPath}
                      onSelect={onSelect}
                      onStartRename={onStartRename}
                      onSubmitRename={onSubmitRename}
                      onCancelRename={onCancelRename}
                      onDuplicate={onDuplicate}
                      onMove={onMove}
                      onCopyPath={onCopyPath}
                      availableFolders={availableFolders}
                      onDelete={onDelete}
                      indented={false}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </ul>
      </ScrollArea>
    </aside>
  );
}

function FolderNode({
  name,
  files,
  isVirtual,
  isSelected,
  selectedPath,
  renamingPath,
  modifiedPaths,
  creatingFile,
  onSelect,
  onSelectFolder,
  onSubmitCreate,
  onCancelCreate,
  onStartRename,
  onSubmitRename,
  onCancelRename,
  onDuplicate,
  onMove,
  onCopyPath,
  availableFolders,
  onDelete,
  onRemoveVirtual,
  forceExpanded,
}: {
  name: string;
  files: ScriptListItem[];
  /** Pasta vazia que vive só no localStorage (ainda não tem arquivos no GitHub) */
  isVirtual: boolean;
  isSelected: boolean;
  selectedPath: string | null;
  renamingPath: string | null;
  modifiedPaths: Set<string>;
  /** Há um input inline ativo de criação dentro dessa pasta */
  creatingFile: boolean;
  onSelect: (path: string) => void;
  onSelectFolder: () => void;
  onSubmitCreate: (name: string) => void;
  onCancelCreate: () => void;
  onStartRename: (item: ScriptListItem) => void;
  onSubmitRename: (newName: string) => void;
  onCancelRename: () => void;
  onDuplicate: (item: ScriptListItem) => void;
  onMove: (item: ScriptListItem, targetFolder: string) => void;
  onCopyPath: (item: ScriptListItem) => void;
  availableFolders: string[];
  onDelete: (item: ScriptListItem) => void;
  onRemoveVirtual: () => void;
  forceExpanded: boolean;
}) {
  const [open, setOpen] = React.useState(true);
  // Quando há criação inline aqui dentro, força expandido pra o input ser visto
  const expanded = forceExpanded || creatingFile || open;

  return (
    <li>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-sm px-1.5 py-1 text-xs text-slate-12 transition-colors hover:bg-slate-3",
          // Destaque sutil pra pasta "ativa" — não compete com o azul forte do arquivo aberto
          isSelected && "bg-slate-3 font-semibold",
          isVirtual && !isSelected && "italic text-slate-11",
        )}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          className="shrink-0 rounded-sm text-slate-9 hover:text-slate-12"
          aria-label={expanded ? "Recolher" : "Expandir"}
          aria-expanded={expanded}
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
        <button
          type="button"
          onClick={onSelectFolder}
          className="flex flex-1 items-center gap-1 truncate text-left"
        >
          {expanded ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-slate-10" />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0 text-slate-10" />
          )}
          <span className="flex-1 truncate font-medium">{name}</span>
        </button>
        {isVirtual ? (
          <button
            type="button"
            onClick={onRemoveVirtual}
            className="shrink-0 rounded-sm p-0.5 text-slate-9 opacity-0 transition-opacity hover:bg-slate-4 hover:text-destructive-text group-hover:opacity-100"
            aria-label={`Remover pasta ${name}`}
            title="Remover pasta (apenas local — não há arquivos no GitHub)"
          >
            <X className="h-3 w-3" />
          </button>
        ) : (
          <span className="shrink-0 text-[10px] tabular-nums text-slate-9">
            {files.length}
          </span>
        )}
      </div>
      {expanded && (
        <ul className="relative ml-[11px] border-l border-border/60 pl-1">
          {creatingFile && (
            <InlineCreateRow
              type="file"
              indented
              onSubmit={onSubmitCreate}
              onCancel={onCancelCreate}
            />
          )}
          {files.length === 0 && isVirtual && !creatingFile ? (
            <li className="px-2 py-1 text-[11px] italic text-slate-9">
              vazia
            </li>
          ) : (
            files.map((file) => (
              <ScriptRow
                key={file.path}
                file={file}
                isSelected={file.path === selectedPath}
                isModified={modifiedPaths.has(file.path)}
                isRenaming={file.path === renamingPath}
                onSelect={onSelect}
                onStartRename={onStartRename}
                onSubmitRename={onSubmitRename}
                onCancelRename={onCancelRename}
                onDuplicate={onDuplicate}
                onMove={onMove}
                onCopyPath={onCopyPath}
                availableFolders={availableFolders}
                onDelete={onDelete}
                indented
              />
            ))
          )}
        </ul>
      )}
    </li>
  );
}

function InlineCreateRow({
  type,
  indented,
  onSubmit,
  onCancel,
}: {
  type: "file" | "folder";
  indented?: boolean;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  // Evita double-fire entre Enter e blur (Enter dispara blur que dispara submit)
  const submittedRef = React.useRef(false);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const tryCommit = () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const trimmed = value.trim();
    if (!trimmed) {
      onCancel();
      return;
    }
    onSubmit(trimmed);
  };

  const Icon = type === "folder" ? Folder : FileCode2;
  const iconClass = type === "folder" ? "text-slate-10" : "text-amber-500";

  return (
    <li>
      <div
        className={cn(
          "flex items-center gap-2 rounded-sm py-0.5",
          indented ? "pl-3 pr-1" : "px-1",
        )}
      >
        <Icon className={cn("h-3.5 w-3.5 shrink-0", iconClass)} />
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
          placeholder={type === "folder" ? "nome-da-pasta" : "arquivo.js"}
          className="h-6 flex-1 rounded-sm border border-accent bg-background px-1.5 font-mono text-xs outline-none focus:ring-1 focus:ring-accent"
        />
      </div>
    </li>
  );
}

function ScriptRow({
  file,
  isSelected,
  isModified,
  isRenaming,
  onSelect,
  onStartRename,
  onSubmitRename,
  onCancelRename,
  onDuplicate,
  onMove,
  onCopyPath,
  availableFolders,
  onDelete,
  indented,
}: {
  file: ScriptListItem;
  isSelected: boolean;
  isModified: boolean;
  isRenaming: boolean;
  onSelect: (path: string) => void;
  onStartRename: (item: ScriptListItem) => void;
  onSubmitRename: (newName: string) => void;
  onCancelRename: () => void;
  onDuplicate: (item: ScriptListItem) => void;
  onMove: (item: ScriptListItem, targetFolder: string) => void;
  onCopyPath: (item: ScriptListItem) => void;
  availableFolders: string[];
  onDelete: (item: ScriptListItem) => void;
  indented: boolean;
}) {
  const { Icon, className: iconColor } = getFileIcon(file.name);
  const currentFolder = file.folder ?? "";

  if (isRenaming) {
    return (
      <li>
        <div
          className={cn(
            "flex items-center gap-2 rounded-sm text-xs",
            indented ? "pl-3 pr-1" : "px-1",
          )}
        >
          <RenameInput
            initialValue={file.name}
            Icon={Icon}
            iconColor={iconColor}
            onSubmit={onSubmitRename}
            onCancel={onCancelRename}
          />
        </div>
      </li>
    );
  }

  return (
    <li>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              "group flex items-center gap-2 rounded-sm text-xs text-slate-12 transition-colors hover:bg-slate-3",
              indented ? "pl-3 pr-1" : "px-1",
              isSelected && "bg-slate-3 font-semibold",
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(file.path)}
              className="flex flex-1 items-center gap-2 truncate py-1.5 text-left"
            >
              <Icon className={cn("h-3.5 w-3.5 shrink-0", iconColor)} />
              <span className="flex-1 truncate">{file.name}</span>
            </button>
            {isModified && (
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-warning"
                title="Modificado localmente"
              />
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStartRename(file);
              }}
              className="shrink-0 rounded-sm p-1 text-slate-9 opacity-0 transition-opacity hover:bg-slate-4 hover:text-slate-12 group-hover:opacity-100"
              aria-label={`Renomear ${file.name}`}
              title="Renomear (F2)"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(file);
              }}
              className="shrink-0 rounded-sm p-1 text-slate-9 opacity-0 transition-opacity hover:bg-slate-4 hover:text-destructive-text group-hover:opacity-100"
              aria-label={`Apagar ${file.name}`}
              title="Apagar arquivo do GitHub"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => onStartRename(file)}>
            <Pencil className="h-3.5 w-3.5 text-slate-10" />
            Renomear
            <ContextMenuShortcut>F2</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => onDuplicate(file)}>
            <Copy className="h-3.5 w-3.5 text-slate-10" />
            Duplicar
          </ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <FolderInput className="h-3.5 w-3.5 text-slate-10" />
              Mover para…
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {availableFolders.length === 0 ? (
                <ContextMenuItem disabled>Sem pastas disponíveis</ContextMenuItem>
              ) : (
                availableFolders
                  .filter((f) => f !== currentFolder)
                  .map((f) => (
                    <ContextMenuItem
                      key={f || "__root__"}
                      onSelect={() => onMove(file, f)}
                    >
                      {f === "" ? "/ (raiz)" : f}
                    </ContextMenuItem>
                  ))
              )}
              {availableFolders.filter((f) => f !== currentFolder).length === 0 && (
                <ContextMenuItem disabled>
                  (nenhuma outra pasta)
                </ContextMenuItem>
              )}
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuItem onSelect={() => onCopyPath(file)}>
            <Link2 className="h-3.5 w-3.5 text-slate-10" />
            Copiar caminho
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem destructive onSelect={() => onDelete(file)}>
            <Trash2 className="h-3.5 w-3.5" />
            Apagar
            <ContextMenuShortcut>Del</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </li>
  );
}

function RenameInput({
  initialValue,
  Icon,
  iconColor,
  onSubmit,
  onCancel,
}: {
  initialValue: string;
  Icon: LucideIcon;
  iconColor: string;
  onSubmit: (newName: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = React.useState(initialValue);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const submittedRef = React.useRef(false);

  React.useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    // Seleciona o nome sem a extensão (igual ao VS Code)
    const dotIdx = initialValue.lastIndexOf(".");
    if (dotIdx > 0) input.setSelectionRange(0, dotIdx);
    else input.select();
  }, [initialValue]);

  const tryCommit = () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const trimmed = value.trim();
    if (!trimmed || trimmed === initialValue) {
      onCancel();
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <div className="flex flex-1 items-center gap-2 py-0.5">
      <Icon className={cn("h-3.5 w-3.5 shrink-0", iconColor)} />
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
        className="h-6 flex-1 rounded-sm border border-accent bg-background px-1.5 font-mono text-xs outline-none focus:ring-1 focus:ring-accent"
      />
    </div>
  );
}
