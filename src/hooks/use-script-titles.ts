"use client";

import * as React from "react";

/**
 * Hook que gerencia títulos customizados para scripts.
 * Os títulos ficam no localStorage, mapeando path → título.
 * Se o script não tiver título customizado, retorna null.
 */

const STORAGE_KEY_PREFIX = "script-titles";

function storageKey(repo?: string, branch?: string): string {
  return `${STORAGE_KEY_PREFIX}:${repo ?? "none"}:${branch ?? "main"}`;
}

export function useScriptTitles(repo?: string, branch?: string) {
  const [titles, setTitles] = React.useState<Record<string, string>>({});
  const key = storageKey(repo, branch);

  // Carrega do localStorage
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setTitles(JSON.parse(raw));
    } catch {
      /* noop */
    }
  }, [key]);

  const save = React.useCallback(
    (next: Record<string, string>) => {
      setTitles(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* noop */
      }
    },
    [key],
  );

  const setTitle = React.useCallback(
    (path: string, title: string) => {
      save({ ...titles, [path]: title });
    },
    [titles, save],
  );

  const removeTitle = React.useCallback(
    (path: string) => {
      const next = { ...titles };
      delete next[path];
      save(next);
    },
    [titles, save],
  );

  const getTitle = React.useCallback(
    (path: string): string | null => {
      return titles[path] ?? null;
    },
    [titles],
  );

  return { titles, getTitle, setTitle, removeTitle };
}
