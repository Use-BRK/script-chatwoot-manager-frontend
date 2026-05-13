"use client";

import { Save, Undo2, FileCode2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Props {
  /** Path completo do arquivo (ex: chatwoot-notifications/script.js) */
  filePath: string | null;
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

export function EditorHeader({
  filePath,
  isDirty,
  isSaving,
  onSave,
  onDiscard,
}: Props) {
  const parts = filePath ? filePath.split("/") : [];
  const filename = parts.length > 0 ? parts[parts.length - 1] : null;
  const folder = parts.length > 1 ? parts.slice(0, -1).join("/") : null;

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-slate-2 px-4">
      <div className="flex min-w-0 items-center gap-1.5">
        <FileCode2 className="h-4 w-4 shrink-0 text-slate-10" />
        {folder && (
          <>
            <span className="truncate font-mono text-xs text-slate-9">
              {folder}
            </span>
            <span className="text-slate-7">/</span>
          </>
        )}
        <span className="truncate text-sm font-medium">
          {filename ?? "Nenhum arquivo selecionado"}
        </span>
        {isDirty && (
          <Badge variant="warning" className="shrink-0">
            modificado
          </Badge>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDiscard}
          disabled={!isDirty || isSaving}
        >
          <Undo2 className="h-3.5 w-3.5" />
          Descartar
        </Button>
        <Button
          size="sm"
          onClick={onSave}
          disabled={!isDirty || isSaving || !filename}
        >
          <Save className="h-3.5 w-3.5" />
          {isSaving ? "Salvando…" : "Salvar no GitHub"}
        </Button>
      </div>
    </header>
  );
}
