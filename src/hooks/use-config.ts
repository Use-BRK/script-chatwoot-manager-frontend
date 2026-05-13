"use client";

import { useEffect, useState } from "react";
import {
  loadConfig,
  saveConfig as save,
  clearConfig,
  readEnvOverrides,
} from "@/lib/config/storage";
import type { AppConfig } from "@/lib/config/schema";

export function useConfig() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [envOverrides, setEnvOverrides] = useState<Partial<AppConfig>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setConfig(loadConfig());
    setEnvOverrides(readEnvOverrides());
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
