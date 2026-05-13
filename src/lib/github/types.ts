export interface ScriptFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  content: string;
}

export interface ScriptListItem {
  name: string;
  path: string;
  sha: string;
  size: number;
  /** Pasta de origem — preenchido quando múltiplos paths são usados */
  folder?: string;
}

export interface SaveFileResult {
  sha: string;
  commitUrl: string;
}
