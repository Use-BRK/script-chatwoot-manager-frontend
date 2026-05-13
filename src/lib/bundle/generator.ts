import type { ScriptFile } from "../github/types";

export interface BundleOptions {
  stripComments?: boolean;
}

const LINE_COMMENT = /\/\/(?![*]).*$/gm;
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;

function stripCommentsFrom(code: string): string {
  return code.replace(BLOCK_COMMENT, "").replace(LINE_COMMENT, "");
}

/**
 * Concatena scripts no formato exato esperado pela API:
 * `<script>codigo1</script><script>codigo2</script>` — sem espaço,
 * quebra de linha ou separador entre `</script>` e o próximo `<script>`.
 */
export function generateBundle(
  files: Pick<ScriptFile, "name" | "content">[],
  options: BundleOptions = {},
): string {
  const parts: string[] = [];
  for (const file of files) {
    const raw = options.stripComments
      ? stripCommentsFrom(file.content)
      : file.content;
    const trimmed = raw.replace(/^﻿/, "").trim();
    if (!trimmed) continue;
    parts.push(`<script>${trimmed}</script>`);
  }
  return parts.join("");
}

export interface BundleStats {
  scriptCount: number;
  sizeBytes: number;
  bareJsBytes: number;
}

export function computeStats(
  bundle: string,
  files: Pick<ScriptFile, "name" | "content">[],
): BundleStats {
  const totalJs = files.reduce(
    (acc, f) => acc + new TextEncoder().encode(f.content).length,
    0,
  );
  return {
    scriptCount: (bundle.match(/<script>/g) || []).length,
    sizeBytes: new TextEncoder().encode(bundle).length,
    bareJsBytes: totalJs,
  };
}
