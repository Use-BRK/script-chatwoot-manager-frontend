import { configSchema, type AppConfig } from "./schema";

const STORAGE_KEY = "chatwoot-script-manager:config";

/**
 * Lê variáveis NEXT_PUBLIC_* e devolve apenas os campos definidos.
 * Vazio = não interfere; preenchido = sobrescreve localStorage no merge.
 */
export function readEnvOverrides(): Partial<AppConfig> {
  const out: Partial<AppConfig> = {};
  const token = process.env.NEXT_PUBLIC_GITHUB_TOKEN;
  const repo = process.env.NEXT_PUBLIC_GITHUB_REPO;
  const branch = process.env.NEXT_PUBLIC_GITHUB_BRANCH;
  const paths = process.env.NEXT_PUBLIC_SCRIPTS_PATHS;
  const bundleUrl = process.env.NEXT_PUBLIC_BUNDLE_API_URL;
  const bundleKey = process.env.NEXT_PUBLIC_BUNDLE_API_KEY;
  const strip = process.env.NEXT_PUBLIC_STRIP_COMMENTS;

  if (token) out.githubToken = token;
  if (repo) out.repository = repo;
  if (branch) out.branch = branch;
  if (paths !== undefined) {
    out.scriptsPaths = paths
      .split(",")
      .map((p) => p.trim().replace(/^\/|\/$/g, ""))
      .filter(Boolean);
  }
  if (bundleUrl) out.bundleApiUrl = bundleUrl;
  if (bundleKey) out.bundleApiKey = bundleKey;
  if (strip !== undefined) out.stripComments = strip === "true";

  return out;
}

export function loadConfig(): AppConfig | null {
  if (typeof window === "undefined") return null;
  const env = readEnvOverrides();
  let stored: Record<string, unknown> = {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && typeof data === "object") {
        // Normaliza configs salvas em versões antigas — null/string/undefined
        // viram array. O schema também faz isso, mas só pra os casos previstos
        // na união.
        if (!Array.isArray(data.scriptsPaths)) {
          if (typeof data.scriptsPaths === "string") {
            data.scriptsPaths = data.scriptsPaths ? [data.scriptsPaths] : [];
          } else {
            data.scriptsPaths = [];
          }
        }
        if (!Array.isArray(data.embeddings)) {
          data.embeddings = [];
        }
        stored = data;
      }
    }
  } catch {
    // localStorage corrompido — segue só com env
  }
  const merged = { ...stored, ...env };
  if (Object.keys(merged).length === 0) return null;
  const parsed = configSchema.safeParse(merged);
  if (!parsed.success) return null;
  return parsed.data;
}

export function saveConfig(config: AppConfig): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearConfig(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function hasConfig(): boolean {
  return loadConfig() !== null;
}
