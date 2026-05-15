import { z } from "zod";

/**
 * Aceita tanto string (legado) quanto array de strings.
 * Strings vazias são filtradas; uma string não-vazia vira array de 1 elemento.
 */
const pathsField = z
  .union([z.string(), z.array(z.string())])
  .transform((val) => {
    if (typeof val === "string") return val ? [val] : [];
    return val.filter(Boolean);
  })
  .default([]);

export const configSchema = z.object({
  githubToken: z
    .string()
    .min(1, "Token obrigatório"),
  repository: z
    .string()
    .regex(/^[^/\s]+\/[^/\s]+$/, "Formato deve ser owner/repo"),
  branch: z.string().min(1, "Branch obrigatória").default("main"),
  /** Pastas a escanear (vazio = raiz do repo) */
  scriptsPaths: pathsField,
  bundleApiUrl: z.string().url("URL inválida"),
  bundleApiKey: z.string().min(1, "API key obrigatória"),
  stripComments: z.boolean().default(false),
});

export type AppConfig = z.infer<typeof configSchema>;

export const defaultConfig: Partial<AppConfig> = {
  branch: "main",
  scriptsPaths: [],
  stripComments: false,
};
