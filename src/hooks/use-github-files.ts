"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GitHubClient, makeClient } from "@/lib/github/client";
import type { AppConfig } from "@/lib/config/schema";
import type { ScriptFile, ScriptListItem } from "@/lib/github/types";

const KEYS = {
  list: (cfg: AppConfig) =>
    ["gh", "list", cfg.repository, cfg.branch, ...cfg.scriptsPaths] as const,
  file: (cfg: AppConfig, path: string) =>
    ["gh", "file", cfg.repository, cfg.branch, path] as const,
};

/**
 * Cache controlado pelas mutations.
 *
 * staleTime: Infinity + refetchOnWindowFocus: false → react-query nunca
 * refetcha sozinho. Cada mutation atualiza o cache com setQueryData usando
 * a resposta determinística do GitHub. Isso elimina race conditions com a
 * eventual consistency da API (DELETE responde 200 mas a próxima listagem
 * ainda traz o item por 1-3s).
 *
 * Pra ver mudanças feitas fora do app (outro dev mexendo direto no GitHub),
 * o user clica "Recarregar" na sidebar (chama list.refetch()).
 */
export function useScriptList(config: AppConfig | null) {
  return useQuery({
    queryKey: config ? KEYS.list(config) : ["gh", "list", "none"],
    enabled: !!config,
    queryFn: async () => {
      if (!config) return [];
      const client = makeClient(config);
      return client.listAllScripts();
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useScriptFile(config: AppConfig | null, path: string | null) {
  return useQuery({
    queryKey:
      config && path ? KEYS.file(config, path) : ["gh", "file", "none"],
    enabled: !!config && !!path,
    queryFn: async () => {
      if (!config || !path) return null;
      const client = makeClient(config);
      return client.readScript(path);
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useSaveScript(config: AppConfig | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      path: string;
      content: string;
      sha?: string;
    }) => {
      if (!config) throw new Error("Sem configuração");
      const client = makeClient(config);
      return client.saveScript(vars);
    },
    onSuccess: (result, vars) => {
      if (!config) return;
      // Atualiza sha/size no item da lista
      qc.setQueryData<ScriptListItem[]>(KEYS.list(config), (old) =>
        old
          ? old.map((i) =>
              i.path === vars.path
                ? { ...i, sha: result.sha, size: vars.content.length }
                : i,
            )
          : old,
      );
      // Atualiza o arquivo aberto no editor (sha + content novos)
      qc.setQueryData<ScriptFile | null>(
        KEYS.file(config, vars.path),
        (old) =>
          old
            ? {
                ...old,
                sha: result.sha,
                content: vars.content,
                size: vars.content.length,
              }
            : old,
      );
    },
  });
}

export function useCreateScript(config: AppConfig | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (filename: string) => {
      if (!config) throw new Error("Sem configuração");
      const client = makeClient(config);
      return client.createScript(filename);
    },
    onSuccess: (result, filename) => {
      if (!config) return;
      // Reconstrói o ScriptListItem a partir do input + resposta do GitHub
      const trimmed = filename.trim().replace(/^\/+/, "");
      const path = trimmed.includes("/")
        ? trimmed
        : config.scriptsPaths[0]
          ? `${config.scriptsPaths[0]}/${trimmed}`
          : trimmed;
      const slashIdx = path.lastIndexOf("/");
      const name = slashIdx >= 0 ? path.slice(slashIdx + 1) : path;
      const folder = slashIdx >= 0 ? path.slice(0, slashIdx) : "";
      const newItem: ScriptListItem = {
        name,
        path,
        sha: result.sha,
        size: 0,
        folder: folder || undefined,
      };
      qc.setQueryData<ScriptListItem[]>(KEYS.list(config), (old) => {
        if (!old) return [newItem];
        if (old.some((i) => i.path === newItem.path)) return old;
        return [...old, newItem].sort((a, b) => {
          const fa = a.folder ?? "";
          const fb = b.folder ?? "";
          if (fa !== fb) return fa.localeCompare(fb);
          return a.name.localeCompare(b.name);
        });
      });
    },
  });
}

export function useDuplicateScript(config: AppConfig | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { sourcePath: string; targetPath?: string }) => {
      if (!config) throw new Error("Sem configuração");
      return makeClient(config).duplicateScript(vars.sourcePath, vars.targetPath);
    },
    onSuccess: (result) => {
      if (!config) return;
      // Adiciona o item duplicado ao cache da lista (igual ao create)
      const slashIdx = result.path.lastIndexOf("/");
      const name =
        slashIdx >= 0 ? result.path.slice(slashIdx + 1) : result.path;
      const folder = slashIdx >= 0 ? result.path.slice(0, slashIdx) : "";
      const newItem: ScriptListItem = {
        name,
        path: result.path,
        sha: result.sha,
        size: 0,
        folder: folder || undefined,
      };
      qc.setQueryData<ScriptListItem[]>(KEYS.list(config), (old) => {
        if (!old) return [newItem];
        if (old.some((i) => i.path === newItem.path)) return old;
        return [...old, newItem].sort((a, b) => {
          const fa = a.folder ?? "";
          const fb = b.folder ?? "";
          if (fa !== fb) return fa.localeCompare(fb);
          return a.name.localeCompare(b.name);
        });
      });
    },
  });
}

export function useRenameScript(config: AppConfig | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { oldPath: string; newPath: string }) => {
      if (!config) throw new Error("Sem configuração");
      return makeClient(config).renameScript(vars);
    },
    onSuccess: (result, vars) => {
      if (!config) return;
      const slashIdx = vars.newPath.lastIndexOf("/");
      const newName =
        slashIdx >= 0 ? vars.newPath.slice(slashIdx + 1) : vars.newPath;
      const newFolder = slashIdx >= 0 ? vars.newPath.slice(0, slashIdx) : "";

      // Atualiza o item na lista (path/name/folder/sha) e re-ordena
      qc.setQueryData<ScriptListItem[]>(KEYS.list(config), (old) => {
        if (!old) return old;
        return old
          .map((i) =>
            i.path === vars.oldPath
              ? {
                  ...i,
                  path: vars.newPath,
                  name: newName,
                  folder: newFolder || undefined,
                  sha: result.sha,
                }
              : i,
          )
          .sort((a, b) => {
            const fa = a.folder ?? "";
            const fb = b.folder ?? "";
            if (fa !== fb) return fa.localeCompare(fb);
            return a.name.localeCompare(b.name);
          });
      });

      // Migra cache do file (se aberto): copia pro novo path, descarta o velho
      const oldFileData = qc.getQueryData<ScriptFile | null>(
        KEYS.file(config, vars.oldPath),
      );
      if (oldFileData) {
        qc.setQueryData<ScriptFile | null>(KEYS.file(config, vars.newPath), {
          ...oldFileData,
          path: vars.newPath,
          name: newName,
          sha: result.sha,
        });
      }
      qc.removeQueries({ queryKey: KEYS.file(config, vars.oldPath) });
    },
  });
}

export function useDeleteScript(config: AppConfig | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { path: string; sha: string }) => {
      if (!config) throw new Error("Sem configuração");
      const client = makeClient(config);
      return client.deleteScript(vars);
    },
    /**
     * Optimistic update: tira do cache na hora pra UI responder rápido.
     * Se falhar, restauramos no onError. Sem invalidate depois — o cache
     * já reflete o estado correto a partir do onSuccess.
     */
    onMutate: async (vars) => {
      if (!config) return;
      await qc.cancelQueries({ queryKey: KEYS.list(config) });
      const previous = qc.getQueryData<ScriptListItem[]>(KEYS.list(config));
      qc.setQueryData<ScriptListItem[]>(KEYS.list(config), (old) =>
        old ? old.filter((item) => item.path !== vars.path) : old,
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (!config) return;
      if (context?.previous) {
        qc.setQueryData(KEYS.list(config), context.previous);
      }
    },
    onSuccess: (_, vars) => {
      if (!config) return;
      // Confirma a remoção no cache (idempotente com o onMutate) e descarta
      // o conteúdo cached do arquivo deletado.
      qc.setQueryData<ScriptListItem[]>(KEYS.list(config), (old) =>
        old ? old.filter((item) => item.path !== vars.path) : old,
      );
      qc.removeQueries({ queryKey: KEYS.file(config, vars.path) });
    },
  });
}

export function useReadAllScripts(config: AppConfig | null) {
  return useMutation({
    mutationFn: async (paths: string[]): Promise<ScriptFile[]> => {
      if (!config) throw new Error("Sem configuração");
      const client = new GitHubClient(config);
      const results: ScriptFile[] = [];
      for (const path of paths) {
        results.push(await client.readScript(path));
      }
      return results;
    },
  });
}
