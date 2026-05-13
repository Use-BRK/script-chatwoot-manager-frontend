"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useConfig } from "@/hooks/use-config";
import {
  useDeployedScripts,
  useToggleDeployedScript,
} from "@/hooks/use-bundle-deploy";
import { useToast } from "@/hooks/use-toast";
import { formatBytes } from "@/lib/utils";

export default function DeployedScriptsPage() {
  const router = useRouter();
  const { config, hydrated } = useConfig();
  const { toast } = useToast();

  const { data, isLoading, isFetching, refetch, isError, error } =
    useDeployedScripts(config);
  const toggle = useToggleDeployedScript(config);

  React.useEffect(() => {
    if (hydrated && !config) router.replace("/setup");
  }, [hydrated, config, router]);

  if (!hydrated || !config) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-32 w-96" />
      </div>
    );
  }

  const scripts = data ?? [];
  const activeCount = scripts.filter((s) => s.active).length;

  const handleToggle = (name: string, nextActive: boolean) => {
    toggle.mutate(
      { name, active: nextActive },
      {
        onSuccess: () => {
          toast({
            variant: nextActive ? "success" : "default",
            title: nextActive ? "Script ativado" : "Script desativado",
            description: name,
          });
        },
        onError: (err) => {
          toast({
            variant: "destructive",
            title: "Falha ao alterar",
            description: (err as Error).message,
          });
        },
      },
    );
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
        <Button variant="ghost" size="icon" asChild aria-label="Voltar">
          <Link href="/scripts">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex flex-1 flex-col leading-none">
          <span className="text-sm font-semibold">Scripts deployados</span>
          <span className="text-[11px] text-slate-11">
            Estado dos scripts servidos via{" "}
            <code className="font-mono">/script.js</code>
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Atualizar
        </Button>
      </header>

      <main className="flex-1 overflow-y-auto bg-slate-1">
        <div className="mx-auto w-full max-w-4xl space-y-4 p-6">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : isError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-text">
              <p className="font-medium">Falha ao carregar scripts</p>
              <p className="mt-1 text-xs opacity-80">
                {(error as Error)?.message ?? "Erro desconhecido"}
              </p>
            </div>
          ) : scripts.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-card p-8 text-center">
              <p className="text-sm font-medium text-foreground">
                Nenhum script deployado ainda
              </p>
              <p className="mt-1 text-xs text-slate-11">
                Volte ao editor, gere e envie um bundle. Os scripts aparecerão
                aqui com a opção de ativar/desativar individualmente.
              </p>
              <Button asChild size="sm" className="mt-4">
                <Link href="/scripts">Ir para os scripts</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-xs text-slate-11">
                <Badge variant="secondary">
                  {activeCount} de {scripts.length} ativos
                </Badge>
                <span>
                  Apenas os ativos são incluídos no{" "}
                  <code className="font-mono">/script.js</code>.
                </span>
              </div>

              <ul className="divide-y divide-border rounded-md border border-border bg-card">
                {scripts.map((s) => (
                  <li
                    key={s.name}
                    className="flex items-center justify-between gap-4 p-4"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      {s.active ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-success-text" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0 text-slate-9" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate font-mono text-sm"
                          title={s.name}
                        >
                          {s.name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-11">
                          {formatBytes(s.sizeBytes)} · atualizado{" "}
                          {new Date(s.updatedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={s.active}
                      onCheckedChange={(next) => handleToggle(s.name, next)}
                      disabled={toggle.isPending}
                      aria-label={`${s.active ? "Desativar" : "Ativar"} ${s.name}`}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
