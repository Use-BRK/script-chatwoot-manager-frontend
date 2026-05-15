"use client";

import * as React from "react";
import { Icon } from "@iconify/react";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface IconPickerProps {
  value?: string;
  onChange: (icon: string) => void;
  /** Quantidade de ícones por busca. Default 96. */
  limit?: number;
}

const PREFIX = "fluent";

/**
 * Sugestões iniciais variadas (quando a busca está vazia).
 * Termos que costumam render bem na coleção Fluent.
 */
const SEED_QUERIES = [
  "home",
  "settings",
  "chat",
  "person",
  "mail",
  "calendar",
  "search",
  "chart",
  "code",
  "folder",
  "document",
  "globe",
  "bell",
  "rocket",
];

/**
 * Picker de ícones Fluent System Icons (Microsoft) via API do Iconify.
 * Os SVGs são buscados on-demand pelo componente <Icon> do @iconify/react.
 */
export function IconPicker({ value, onChange, limit = 96 }: IconPickerProps) {
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [icons, setIcons] = React.useState<string[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        if (debounced.length > 0) {
          const url = `https://api.iconify.design/search?query=${encodeURIComponent(
            debounced,
          )}&prefix=${PREFIX}&limit=${limit}`;
          const r = await fetch(url);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const data = await r.json();
          if (cancelled) return;
          setIcons(Array.isArray(data.icons) ? data.icons : []);
          setTotal(typeof data.total === "number" ? data.total : 0);
        } else {
          // Sem busca: pega 1 ícone variado de cada termo do seed
          const results = await Promise.all(
            SEED_QUERIES.map(async (term) => {
              const u = `https://api.iconify.design/search?query=${encodeURIComponent(
                term,
              )}&prefix=${PREFIX}&limit=6`;
              try {
                const r = await fetch(u);
                if (!r.ok) return [];
                const d = await r.json();
                return Array.isArray(d.icons) ? (d.icons as string[]) : [];
              } catch {
                return [];
              }
            }),
          );
          if (cancelled) return;
          const flat: string[] = [];
          for (const list of results) flat.push(...list);
          // dedupe + limita
          const seen = new Set<string>();
          const dedup: string[] = [];
          for (const name of flat) {
            if (!seen.has(name)) {
              seen.add(name);
              dedup.push(name);
            }
            if (dedup.length >= limit) break;
          }
          setIcons(dedup);
          setTotal(dedup.length);
        }
      } catch (err) {
        if (cancelled) return;
        setError((err as Error).message);
        setIcons([]);
        setTotal(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [debounced, limit]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-9" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar ícone (ex.: home, settings, chat)…"
          className="h-9 pl-8 pr-8 text-sm"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-9 hover:bg-slate-3 hover:text-foreground"
            aria-label="Limpar busca"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {value && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-slate-2 px-3 py-2">
          <Icon icon={value} className="h-5 w-5 text-foreground" />
          <span className="font-mono text-xs text-slate-11">{value}</span>
        </div>
      )}

      <div className="relative max-h-64 min-h-32 overflow-y-auto rounded-md border border-border bg-slate-1 p-2">
        {loading && (
          <div className="flex items-center justify-center py-8 text-xs text-slate-11">
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            Buscando…
          </div>
        )}
        {!loading && error && (
          <p className="px-2 py-4 text-xs text-destructive-text">
            Erro ao buscar ícones: {error}
          </p>
        )}
        {!loading && !error && icons.length === 0 && (
          <p className="px-2 py-4 text-xs text-slate-11">
            Nenhum ícone encontrado para “{debounced}”.
          </p>
        )}
        {!loading && !error && icons.length > 0 && (
          <div className="grid grid-cols-8 gap-1">
            {icons.map((name) => {
              const selected = name === value;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => onChange(name)}
                  title={name}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-md border transition-colors",
                    selected
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-transparent text-slate-11 hover:border-border hover:bg-slate-3 hover:text-foreground",
                  )}
                >
                  <Icon icon={name} className="h-5 w-5" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!loading && !error && icons.length > 0 && (
        <p className="text-[11px] text-slate-9">
          {debounced
            ? `${icons.length} de ${total} resultado${total !== 1 ? "s" : ""} para “${debounced}”`
            : "Mostrando sugestões — busque para filtrar"}
        </p>
      )}
    </div>
  );
}
