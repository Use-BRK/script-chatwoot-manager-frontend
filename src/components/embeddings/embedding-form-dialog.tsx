"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconPicker } from "@/components/ui/icon-picker";
import { useToast } from "@/hooks/use-toast";
import type { Embedding } from "@/lib/config/schema";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se preenchido, modo edição. */
  editing?: Embedding | null;
  onSubmit: (data: Omit<Embedding, "id"> & { id?: string }) => void;
}

export function EmbeddingFormDialog({
  open,
  onOpenChange,
  editing,
  onSubmit,
}: Props) {
  const { toast } = useToast();
  const [title, setTitle] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [icon, setIcon] = React.useState("");

  // Sincroniza ao abrir (e ao trocar embedding editado)
  React.useEffect(() => {
    if (open) {
      setTitle(editing?.title ?? "");
      setUrl(editing?.url ?? "");
      setIcon(editing?.icon ?? "");
    }
  }, [open, editing]);

  const handleSubmit = () => {
    const t = title.trim();
    const u = url.trim();
    const i = icon.trim();

    if (!t) {
      toast({ variant: "destructive", title: "Informe o título" });
      return;
    }
    try {
      new URL(u);
    } catch {
      toast({ variant: "destructive", title: "URL inválida" });
      return;
    }
    if (!i) {
      toast({ variant: "destructive", title: "Escolha um ícone" });
      return;
    }

    onSubmit({ id: editing?.id, title: t, url: u, icon: i });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Editar embedding" : "Adicionar embedding"}
          </DialogTitle>
          <DialogDescription>
            O título aparece como tooltip, o ícone é exibido na barra superior e
            a URL é carregada num iframe interno.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Dashboard de métricas"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>URL do embedding</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Ícone</Label>
            <IconPicker value={icon} onChange={setIcon} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>
            <Check className="h-3.5 w-3.5" />
            {editing ? "Salvar alterações" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
