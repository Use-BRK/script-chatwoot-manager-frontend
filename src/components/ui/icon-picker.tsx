"use client";

import * as React from "react";
import { Icon } from "@iconify/react";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface IconPickerProps {
  value?: string;
  onChange: (icon: string) => void;
  /** Quantidade de ícones por página. Default 60. */
  limit?: number;
}

const PREFIX = "fluent";
const DEFAULT_QUERY = "home";

/**
 * Picker de ícones Fluent System Icons (Microsoft) via API do Iconify.
 * Os SVGs são buscados on-demand pelo componente <Icon> do @iconify/react.
 */
export function IconPicker({ value, onChange, limit = 60 }: IconPickerProps) {
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState(DEFAULT_QUERY);
  const [icons, setIcons] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(query.trim() || DEFAULT_QUERY);
    }, 250);
    return () => clearTimeout(id);
  }, [query]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const url = `https://api.iconify.design/search?query=${encodeURIComponent(
      debounced,
    )}&prefix=${PREFIX}&limit=${limit}`;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        const list: string[] = Array.isArray(data.icons) ? data.icons : [];
        setIcons(list);
      })
      .catch((err) => {
        if (cancelled) return;
        setError((err as Error).message);
        setIcons([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
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
          className="h-9 pl-8 text-sm"
        />
      </div>

      {value && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-slate-2 px-3 py-2">
          <Icon icon={value} className="h-5 w-5 text-foreground" />
          <span className="font-mono text-xs text-slate-11">{value}</span>
        </div>
      )}

      <div className="relative max-h-64 overflow-y-auto rounded-md border border-border bg-slate-1 p-2">
        {loading && (
          <div className="flex items-center justify-center py-8 text-xs text-slate-11">
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            Buscando…
          </div>
        )}
        {!loading && error && (
          <p className="px-2 py-4 text-xs text-destructive-text">
            Erro: {error}
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
    </div>
  );
}
