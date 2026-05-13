"use client";

import { Cloud, CloudOff, Loader2 } from "lucide-react";
import { useBundleStatus } from "@/hooks/use-bundle-deploy";
import { useConfig } from "@/hooks/use-config";
import { formatBytes } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function StatusIndicator() {
  const { config } = useConfig();
  const { data, isLoading } = useBundleStatus(config);

  if (!config) return null;

  const dotColor = isLoading
    ? "bg-slate-9"
    : data?.ok
      ? data.hasDeploy
        ? "bg-success"
        : "bg-warning"
      : "bg-destructive";

  const label = isLoading
    ? "verificando…"
    : !data
      ? "sem status"
      : !data.ok
        ? "API offline"
        : !data.hasDeploy
          ? "sem deploy"
          : `${formatBytes(data.bytes)} em produção`;

  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-slate-11">
      <span className={cn("h-2 w-2 rounded-full", dotColor)} />
      {isLoading ? (
        <Loader2 className="h-3 w-3 animate-spin text-slate-10" />
      ) : data?.ok ? (
        <Cloud className="h-3 w-3 text-slate-10" />
      ) : (
        <CloudOff className="h-3 w-3 text-slate-10" />
      )}
      <span className="font-medium">{label}</span>
    </div>
  );
}
