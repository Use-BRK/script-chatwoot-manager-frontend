import { Octokit } from "@octokit/rest";
import type { AppConfig } from "../config/schema";
import type { ScriptFile, ScriptListItem, SaveFileResult } from "./types";

export class GitHubError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
  }
}

function parseRepo(repo: string): { owner: string; repo: string } {
  const [owner, name] = repo.split("/");
  return { owner, repo: name };
}

function joinPath(...parts: string[]): string {
  return parts
    .filter(Boolean)
    .join("/")
    .replace(/\/+/g, "/")
    .replace(/^\//, "");
}

function isJsFile(name: string): boolean {
  return /\.js$/i.test(name);
}

function decodeBase64(content: string): string {
  if (typeof window !== "undefined" && typeof window.atob === "function") {
    const binary = window.atob(content.replace(/\n/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  }
  return Buffer.from(content, "base64").toString("utf-8");
}

function encodeBase64(content: string): string {
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    const bytes = new TextEncoder().encode(content);
    let binary = "";
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return window.btoa(binary);
  }
  return Buffer.from(content, "utf-8").toString("base64");
}

function wrapError(err: unknown, ctx?: string): GitHubError {
  if (err instanceof GitHubError) return err;
  const e = err as { status?: number; message?: string };
  const status = e?.status;
  const msg = e?.message ?? "Erro desconhecido do GitHub";
  const where = ctx ? ` (${ctx})` : "";
  if (status === 401) return new GitHubError("PAT inválido ou expirado", 401);
  if (status === 403)
    return new GitHubError(
      "Sem permissão ou rate limit atingido — confira o escopo `repo` do PAT",
      403,
    );
  if (status === 404)
    return new GitHubError(
      `Não encontrado${where}. Verifique repositório, branch e o campo "Path dos scripts" em /setup.`,
      404,
    );
  // 422 com "sha wasn't supplied" = arquivo já existe (PUT sem sha = create-only)
  if (status === 422 && /sha.*supplied/i.test(msg)) {
    return new GitHubError(
      `Já existe um arquivo com esse nome${where}. Escolha outro nome.`,
      422,
    );
  }
  return new GitHubError(msg + where, status);
}

export class GitHubClient {
  private octokit: Octokit;
  private owner: string;
  private repo: string;
  private branch: string;
  /** Lista de pastas configuradas (vazia = raiz) */
  private basePaths: string[];

  constructor(config: AppConfig) {
    this.octokit = new Octokit({
      auth: config.githubToken,
      // Silencia logs do Octokit; tratamos os erros via wrapError.
      log: {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      },
    });
    const parsed = parseRepo(config.repository);
    this.owner = parsed.owner;
    this.repo = parsed.repo;
    this.branch = config.branch || "main";

    // Compatibilidade: scriptsPath (legado string) ou scriptsPaths (array)
    const raw = (config as AppConfig & { scriptsPath?: string }).scriptsPath;
    const paths: string[] = Array.isArray(config.scriptsPaths)
      ? config.scriptsPaths
      : raw
        ? [raw]
        : [];
    this.basePaths = paths
      .map((p) => p.replace(/^\/|\/$/g, ""))
      .filter(Boolean);
  }

  private locator(path: string): string {
    return `${this.owner}/${this.repo}@${this.branch}:${path || "/"}`;
  }

  async testConnection(): Promise<{ ok: true; repo: string }> {
    try {
      const { data } = await this.octokit.repos.get({
        owner: this.owner,
        repo: this.repo,
      });
      return { ok: true, repo: data.full_name };
    } catch (err) {
      throw wrapError(err, `${this.owner}/${this.repo}`);
    }
  }

  /**
   * Lista todas as pastas (diretórios) na raiz do repositório.
   * Usado na tela de setup para o usuário selecionar pastas
   * sem precisar digitar manualmente.
   */
  async listRootDirectories(): Promise<string[]> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: "",
        ref: this.branch,
      });
      if (!Array.isArray(data)) return [];
      return data
        .filter((item) => item.type === "dir")
        .map((item) => item.name)
        .sort((a, b) => a.localeCompare(b));
    } catch (err) {
      throw wrapError(err, `${this.owner}/${this.repo}@${this.branch}:/`);
    }
  }

  async listScripts(basePath?: string): Promise<ScriptListItem[]> {
    const resolvedPath = basePath ?? (this.basePaths[0] ?? "");
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: resolvedPath || "",
        ref: this.branch,
      });
      if (!Array.isArray(data)) {
        throw new GitHubError(
          `O path "${resolvedPath || "/"}" não é um diretório — aponte para uma pasta com .js (ou deixe vazio para a raiz)`,
          400,
        );
      }
      return data
        .filter((item) => item.type === "file" && isJsFile(item.name))
        .map((item) => ({
          name: item.name,
          path: item.path,
          sha: item.sha,
          size: item.size,
          folder: resolvedPath || undefined,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
      throw wrapError(err, this.locator(resolvedPath));
    }
  }

  /**
   * Lista scripts de TODAS as pastas configuradas em paralelo.
   * Os scripts ficam agrupados por pasta (campo `folder`).
   *
   * Sempre inclui a raiz no resultado: se o user criar arquivos diretamente
   * na raiz do repo (via dropdown "/ (raiz)"), eles aparecem na sidebar
   * mesmo quando há `scriptsPaths` configurado pra outras pastas.
   */
  async listAllScripts(): Promise<ScriptListItem[]> {
    const paths =
      this.basePaths.length > 0 ? ["", ...this.basePaths] : [""];
    const settled = await Promise.allSettled(
      paths.map((p) => this.listScripts(p)),
    );
    const results: ScriptListItem[] = [];
    const errors: string[] = [];
    for (let i = 0; i < settled.length; i++) {
      const s = settled[i];
      if (s.status === "fulfilled") {
        results.push(...s.value);
      } else {
        errors.push(`[${paths[i] || "/"}] ${(s.reason as Error).message}`);
      }
    }
    if (results.length === 0 && errors.length > 0) {
      throw new GitHubError(errors.join(" | "));
    }
    return results;
  }

  async readScript(path: string): Promise<ScriptFile> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ref: this.branch,
      });
      if (Array.isArray(data) || data.type !== "file") {
        throw new GitHubError("Path não aponta para um arquivo", 400);
      }
      const file = data as { content?: string; sha: string; size: number; name: string; path: string };
      const content = file.content ? decodeBase64(file.content) : "";
      return {
        name: file.name,
        path: file.path,
        sha: file.sha,
        size: file.size,
        content,
      };
    } catch (err) {
      throw wrapError(err, this.locator(path));
    }
  }

  async saveScript(opts: {
    path: string;
    content: string;
    sha?: string;
    message?: string;
  }): Promise<SaveFileResult> {
    const { path, content, sha, message } = opts;
    try {
      const { data } = await this.octokit.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path,
        branch: this.branch,
        message:
          message ||
          `chore: update ${path.split("/").pop()} via script-manager`,
        content: encodeBase64(content),
        sha,
      });
      return {
        sha: data.content?.sha ?? "",
        commitUrl: data.commit.html_url ?? "",
      };
    } catch (err) {
      throw wrapError(err, this.locator(path));
    }
  }

  /**
   * Cria um arquivo no path exato informado.
   * Se o input contém `/`, usa como path completo (`pasta/foo.js`).
   * Se não contém `/`, cria na raiz do repo (`foo.js`).
   *
   * O chamador é responsável por montar o path completo com a pasta desejada.
   *
   * Faz pré-check de existência: se o arquivo já existe na branch, falha com
   * mensagem clara antes de tentar o PUT (que devolveria 422 críptico).
   */
  async createScript(input: string, content = ""): Promise<SaveFileResult> {
    const trimmed = input.trim().replace(/^\/+/, "");
    const filename = trimmed.split("/").pop() ?? "";
    if (!isJsFile(filename)) {
      throw new GitHubError("Arquivo precisa terminar em .js", 400);
    }
    // Usa o path exatamente como informado — sem auto-prepend de basePaths
    const path = trimmed;

    // Pré-check: getContent. 200 = existe → erro claro. 404 = livre → segue.
    try {
      await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ref: this.branch,
      });
      throw new GitHubError(
        `Já existe um arquivo em ${this.locator(path)}. Escolha outro nome.`,
        422,
      );
    } catch (err) {
      if (err instanceof GitHubError) throw err;
      const status = (err as { status?: number })?.status;
      if (status !== 404) throw wrapError(err, this.locator(path));
      // 404 confirmado → o arquivo realmente não existe, pode criar
    }

    return this.saveScript({
      path,
      content,
      message: `chore: create ${filename} via script-manager`,
    });
  }

  /**
   * Duplica um arquivo: lê o conteúdo atual e cria uma cópia no destino
   * informado (por padrão, mesma pasta com sufixo " (copy)" antes da extensão).
   * Quando `targetPath` não é fornecido, lista a pasta para encontrar o
   * próximo sufixo livre: `(copy)`, `(copy 2)`, `(copy 3)`, …
   */
  async duplicateScript(
    sourcePath: string,
    targetPath?: string,
  ): Promise<SaveFileResult & { path: string }> {
    const src = sourcePath.replace(/^\/+/, "");
    const file = await this.readScript(src);
    const dest = targetPath ?? (await this.findFreeCopyPath(src));
    const result = await this.createScript(dest, file.content);
    return { ...result, path: dest };
  }

  /**
   * Lista a pasta-alvo e encontra o primeiro sufixo "(copy N)" livre.
   * Sequência: `foo (copy).js` → `foo (copy 2).js` → `foo (copy 3).js` → …
   */
  private async findFreeCopyPath(path: string): Promise<string> {
    const slash = path.lastIndexOf("/");
    const folder = slash >= 0 ? path.slice(0, slash) : "";
    const filename = slash >= 0 ? path.slice(slash + 1) : path;
    const dot = filename.lastIndexOf(".");
    const base = dot > 0 ? filename.slice(0, dot) : filename;
    const ext = dot > 0 ? filename.slice(dot) : "";

    // Nomes existentes na pasta (lowercase pra comparação case-insensitive)
    let existing: Set<string>;
    try {
      const items = await this.listScripts(folder);
      existing = new Set(items.map((i) => i.name.toLowerCase()));
    } catch {
      existing = new Set<string>();
    }

    // Tenta "(copy)", "(copy 2)", "(copy 3)", …
    const first = `${base} (copy)${ext}`;
    if (!existing.has(first.toLowerCase())) {
      return folder ? `${folder}/${first}` : first;
    }
    for (let n = 2; n < 100; n++) {
      const candidate = `${base} (copy ${n})${ext}`;
      if (!existing.has(candidate.toLowerCase())) {
        return folder ? `${folder}/${candidate}` : candidate;
      }
    }
    throw new GitHubError("Muitas cópias — renomeie manualmente", 400);
  }

  /**
   * Renomeia um arquivo via Git Trees API — 1 commit atômico equivalente a
   * `git mv old new`. Reusa o blob existente, então não duplica conteúdo.
   *
   * Sequência: getRef → getCommit → getContent (blob sha) → createTree
   * (add new + null sha pra remover old) → createCommit → updateRef.
   */
  async renameScript(opts: {
    oldPath: string;
    newPath: string;
    message?: string;
  }): Promise<{ commitUrl: string; sha: string }> {
    const oldPath = opts.oldPath.replace(/^\/+/, "");
    const newPath = opts.newPath.replace(/^\/+/, "");
    if (oldPath === newPath) {
      throw new GitHubError("Novo nome igual ao atual", 400);
    }
    if (!isJsFile(newPath.split("/").pop() ?? "")) {
      throw new GitHubError("Arquivo precisa terminar em .js", 400);
    }
    try {
      // 1. Ref atual da branch → SHA do commit
      const { data: ref } = await this.octokit.git.getRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${this.branch}`,
      });
      const parentSha = ref.object.sha;

      // 2. Commit → SHA da tree atual
      const { data: commit } = await this.octokit.git.getCommit({
        owner: this.owner,
        repo: this.repo,
        commit_sha: parentSha,
      });
      const baseTreeSha = commit.tree.sha;

      // 3. Blob SHA do arquivo a renomear (reusado na nova tree)
      const { data: oldFile } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: oldPath,
        ref: this.branch,
      });
      if (Array.isArray(oldFile) || oldFile.type !== "file") {
        throw new GitHubError(`Origem ${oldPath} não é um arquivo`, 400);
      }
      const blobSha = oldFile.sha;

      // 3.5. Pré-check do destino — se já existe, falha com erro claro
      try {
        await this.octokit.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path: newPath,
          ref: this.branch,
        });
        throw new GitHubError(
          `Já existe um arquivo em ${this.locator(newPath)}. Escolha outro nome.`,
          422,
        );
      } catch (err) {
        if (err instanceof GitHubError) throw err;
        const status = (err as { status?: number })?.status;
        if (status !== 404) throw wrapError(err, this.locator(newPath));
      }

      // 4. Nova tree: adiciona blob no newPath, marca oldPath pra remover
      const { data: newTree } = await this.octokit.git.createTree({
        owner: this.owner,
        repo: this.repo,
        base_tree: baseTreeSha,
        tree: [
          {
            path: newPath,
            mode: "100644",
            type: "blob",
            sha: blobSha,
          },
          {
            path: oldPath,
            mode: "100644",
            type: "blob",
            // sha: null marca o arquivo pra remoção dessa tree
            sha: null as unknown as string,
          },
        ],
      });

      // 5. Commit referenciando a nova tree
      const oldName = oldPath.split("/").pop() ?? oldPath;
      const newName = newPath.split("/").pop() ?? newPath;
      const { data: newCommit } = await this.octokit.git.createCommit({
        owner: this.owner,
        repo: this.repo,
        message:
          opts.message ||
          `chore: rename ${oldName} → ${newName} via script-manager`,
        tree: newTree.sha,
        parents: [parentSha],
      });

      // 6. Atualiza a branch (= push)
      await this.octokit.git.updateRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${this.branch}`,
        sha: newCommit.sha,
      });

      return { commitUrl: newCommit.html_url ?? "", sha: blobSha };
    } catch (err) {
      if (err instanceof GitHubError) throw err;
      throw wrapError(err, this.locator(oldPath));
    }
  }

  async deleteScript(opts: {
    path: string;
    sha: string;
    message?: string;
  }): Promise<{ commitUrl: string }> {
    const { path, sha, message } = opts;
    try {
      const { data } = await this.octokit.repos.deleteFile({
        owner: this.owner,
        repo: this.repo,
        path,
        branch: this.branch,
        message:
          message ||
          `chore: delete ${path.split("/").pop()} via script-manager`,
        sha,
      });
      return { commitUrl: data.commit.html_url ?? "" };
    } catch (err) {
      throw wrapError(err, this.locator(path));
    }
  }
}

export function makeClient(config: AppConfig): GitHubClient {
  return new GitHubClient(config);
}
