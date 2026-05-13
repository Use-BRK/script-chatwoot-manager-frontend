/**
 * Pastas "virtuais" só vivem no localStorage. Aparecem na UI como nós vazios
 * até que um arquivo seja criado dentro — aí o componente que cria o arquivo
 * deve "promover" essa pasta (mover pra `scriptsPaths` da config) e remover
 * daqui via `removeVirtualFolder`.
 *
 * Escopo é por repositório + branch pra não vazar entre projetos.
 */

const PREFIX = "chatwoot-script-manager:virtual-folders";

function key(repository: string, branch: string): string {
  return `${PREFIX}:${repository}@${branch}`;
}

function normalize(path: string): string {
  return path.trim().replace(/^\/|\/$/g, "");
}

export function loadVirtualFolders(
  repository: string,
  branch: string,
): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key(repository, branch));
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter((x): x is string => typeof x === "string" && x.length > 0);
  } catch {
    return [];
  }
}

export function saveVirtualFolders(
  repository: string,
  branch: string,
  folders: string[],
): void {
  if (typeof window === "undefined") return;
  const unique = Array.from(new Set(folders.map(normalize).filter(Boolean)));
  window.localStorage.setItem(key(repository, branch), JSON.stringify(unique));
}

export function addVirtualFolder(
  repository: string,
  branch: string,
  folder: string,
): string[] {
  const next = [...loadVirtualFolders(repository, branch), folder];
  saveVirtualFolders(repository, branch, next);
  return loadVirtualFolders(repository, branch);
}

export function removeVirtualFolder(
  repository: string,
  branch: string,
  folder: string,
): string[] {
  const target = normalize(folder);
  const next = loadVirtualFolders(repository, branch).filter(
    (f) => normalize(f) !== target,
  );
  saveVirtualFolders(repository, branch, next);
  return next;
}
