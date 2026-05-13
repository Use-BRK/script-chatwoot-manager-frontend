"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deployBundle,
  fetchScriptStatus,
  listDeployedScripts,
  toggleDeployedScript,
} from "@/lib/bundle/api";
import type { AppConfig } from "@/lib/config/schema";

export function useBundleStatus(config: AppConfig | null) {
  return useQuery({
    queryKey: ["bundle", "status", config?.bundleApiUrl ?? "none"],
    enabled: !!config?.bundleApiUrl,
    queryFn: () =>
      config ? fetchScriptStatus(config.bundleApiUrl) : Promise.resolve(null),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useDeployBundle(config: AppConfig | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      scripts: Array<{ name: string; content: string }>,
    ) => {
      if (!config) throw new Error("Sem configuração");
      return deployBundle({
        apiUrl: config.bundleApiUrl,
        apiKey: config.bundleApiKey,
        scripts,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scripts", "deployed"] });
      qc.invalidateQueries({ queryKey: ["bundle", "status"] });
    },
  });
}

export function useDeployedScripts(config: AppConfig | null) {
  return useQuery({
    queryKey: ["scripts", "deployed", config?.bundleApiUrl ?? "none"],
    enabled: !!config?.bundleApiUrl && !!config?.bundleApiKey,
    queryFn: () =>
      config
        ? listDeployedScripts({
            apiUrl: config.bundleApiUrl,
            apiKey: config.bundleApiKey,
          })
        : Promise.resolve([]),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

export function useToggleDeployedScript(config: AppConfig | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { name: string; active: boolean }) => {
      if (!config) throw new Error("Sem configuração");
      return toggleDeployedScript({
        apiUrl: config.bundleApiUrl,
        apiKey: config.bundleApiKey,
        ...vars,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scripts", "deployed"] });
    },
  });
}
