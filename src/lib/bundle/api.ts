export class BundleApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "BundleApiError";
    this.status = status;
  }
}

export interface DeployResult {
  success: boolean;
  message: string;
  deployedAt: string;
  blockCount?: number;
  removed?: string[];
  minified?: boolean;
  warning?: string;
}

export interface ScriptStateItem {
  name: string;
  active: boolean;
  position: number;
  sizeBytes: number;
  updatedAt: string;
}

export interface ApiHealth {
  ok: boolean;
  bytes: number;
  hasDeploy: boolean;
}

function trimUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export async function deployBundle(opts: {
  apiUrl: string;
  apiKey: string;
  scripts: Array<{ name: string; content: string }>;
}): Promise<DeployResult> {
  const res = await fetch(`${trimUrl(opts.apiUrl)}/bundle`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": opts.apiKey,
    },
    body: JSON.stringify({ scripts: opts.scripts }),
  });

  if (!res.ok) {
    let detail = res.statusText;
    let extra = "";
    try {
      const data = await res.json();
      const msg = Array.isArray(data?.message)
        ? data.message.join("; ")
        : data?.message;
      detail = msg ?? detail;
      if (data?.detail && data.detail !== msg) {
        extra = ` — ${String(data.detail)}`;
      }
    } catch {
      /* noop */
    }
    if (res.status === 401)
      throw new BundleApiError("API key inválida", 401);
    if (res.status === 400)
      throw new BundleApiError(`Bundle inválido: ${detail}${extra}`, 400);
    throw new BundleApiError(`Erro ${res.status}: ${detail}${extra}`, res.status);
  }

  return (await res.json()) as DeployResult;
}

export async function listDeployedScripts(opts: {
  apiUrl: string;
  apiKey: string;
}): Promise<ScriptStateItem[]> {
  const res = await fetch(`${trimUrl(opts.apiUrl)}/scripts`, {
    headers: { "x-api-key": opts.apiKey },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new BundleApiError(
      `Erro ${res.status} ao listar scripts: ${res.statusText}`,
      res.status,
    );
  }
  const data = (await res.json()) as { scripts: ScriptStateItem[] };
  return data.scripts ?? [];
}

export async function toggleDeployedScript(opts: {
  apiUrl: string;
  apiKey: string;
  name: string;
  active: boolean;
}): Promise<ScriptStateItem> {
  const res = await fetch(
    `${trimUrl(opts.apiUrl)}/scripts/${encodeURIComponent(opts.name)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": opts.apiKey,
      },
      body: JSON.stringify({ active: opts.active }),
    },
  );
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = data?.message ?? detail;
    } catch {
      /* noop */
    }
    throw new BundleApiError(
      `Erro ${res.status} ao alterar estado: ${detail}`,
      res.status,
    );
  }
  return (await res.json()) as ScriptStateItem;
}

export async function fetchScriptStatus(apiUrl: string): Promise<ApiHealth> {
  try {
    const res = await fetch(`${trimUrl(apiUrl)}/script.js`, {
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, bytes: 0, hasDeploy: false };
    const text = await res.text();
    const placeholder = "/* nenhum bundle deployado ainda */";
    return {
      ok: true,
      bytes: new TextEncoder().encode(text).length,
      hasDeploy: !text.includes(placeholder),
    };
  } catch {
    return { ok: false, bytes: 0, hasDeploy: false };
  }
}
