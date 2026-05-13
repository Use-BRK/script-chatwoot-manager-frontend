"use client";

import * as React from "react";

/**
 * Hook que gerencia o estado ativo/inativo local de cada script.
 * Persiste no localStorage por repositório+branch.
 * Por padrão, todo script é considerado "ativo" (incluído no bundle).
 */

const STORAGE_KEY_PREFIX = "script-enabled";

function storageKey(repo?: string, branch?: string): string {
  return `${STORAGE_KEY_PREFIX}:${repo ?? "none"}:${branch ?? "main"}`;
}

export function useScriptEnabled(repo?: string, branch?: string) {
  const [state, setState] = React.useState<Record<string, boolean>>({});
  const key = storageKey(repo, branch);

  // Carrega do localStorage
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setState(JSON.parse(raw));
    } catch {
      /* noop */
    }
  }, [key]);

  const persist = React.useCallback(
    (next: Record<string, boolean>) => {
      setState(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* noop */
      }
    },
    [key],
  );

  /** Retorna se o script está ativo. Default = true (ativo). */
  const isEnabled = React.useCallback(
    (path: string): boolean => {
      return state[path] !== false;
    },
    [state],
  );

  const setEnabled = React.useCallback(
    (path: string, enabled: boolean) => {
      persist({ ...state, [path]: enabled });
    },
    [state, persist],
  );

  const toggle = React.useCallback(
    (path: string) => {
      const current = state[path] !== false;
      persist({ ...state, [path]: !current });
    },
    [state, persist],
  );

  return { isEnabled, setEnabled, toggle, state };
}
