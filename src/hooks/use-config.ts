"use client";

import { useEffect, useState } from "react";
import {
  loadConfig,
  saveConfig as save,
  clearConfig,
  readEnvOverrides,
} from "@/lib/config/storage";
import { configSchema, type AppConfig } from "@/lib/config/schema";

export function useConfig() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [envOverrides, setEnvOverrides] = useState<Partial<AppConfig>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const env = readEnvOverrides();
    setEnvOverrides(env);

    let loaded = loadConfig();

    // Se não tem config salva mas as env vars têm todos os campos obrigatórios,
    // cria e salva automaticamente — pula o /setup.
    if (!loaded && env.githubToken && env.repository && env.bundleApiUrl && env.bundleApiKey) {
      const candidate = {
        branch: "main",
        scriptsPaths: [],
        stripComments: false,
        ...env,
      };
      const parsed = configSchema.safeParse(candidate);
      if (parsed.success) {
        save(parsed.data);
        loaded = parsed.data;
      }
    }

    setConfig(loaded);
    setHydrated(true);
  }, []);

  const persist = (cfg: AppConfig) => {
    save(cfg);
    setConfig(cfg);
  };

  const reset = () => {
    clearConfig();
    setConfig(null);
  };

  return { config, envOverrides, hydrated, save: persist, reset };
}
