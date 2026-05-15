"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Boxes,
  Check,
  FolderSearch,
  Loader2,
  Plus,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { configSchema, type AppConfig } from "@/lib/config/schema";
import { useConfig } from "@/hooks/use-config";
import { GitHubClient } from "@/lib/github/client";
import { fetchScriptStatus } from "@/lib/bundle/api";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { cn } from "@/lib/utils";

type TestState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; detail: string }
  | { status: "error"; detail: string };

export default function SetupPage() {
  const router = useRouter();
  const { config, envOverrides, save, hydrated } = useConfig();
  const { toast } = useToast();
  const [githubTest, setGithubTest] = React.useState<TestState>({
    status: "idle",
  });
  const [bundleTest, setBundleTest] = React.useState<TestState>({
    status: "idle",
  });

  const form = useForm<AppConfig>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      branch: "main",
      scriptsPaths: [],
      stripComments: false,
      githubToken: "",
      repository: "",
      bundleApiUrl: "",
      bundleApiKey: "",
    },
  });

  // Estado local para o input de novo path
  const [pathInput, setPathInput] = React.useState("");

  React.useEffect(() => {
    const source = config ?? envOverrides;
    if (!source || Object.keys(source).length === 0) return;
    // garante compatibilidade com config salva no formato antigo
    const scriptsPaths = Array.isArray(source.scriptsPaths)
      ? source.scriptsPaths
      : [];
    form.reset({
      branch: "main",
      stripComments: false,
      githubToken: "",
      repository: "",
      bundleApiUrl: "",
      bundleApiKey: "",
      ...source,
      scriptsPaths,
    });
  }, [config, envOverrides, form]);

  const currentPaths = form.watch("scriptsPaths") ?? [];

  const addPath = () => {
    const val = pathInput.trim().replace(/^\/|\/$/g, "");
    if (!val) return;
    const existing = form.getValues("scriptsPaths") ?? [];
    if (!existing.includes(val)) {
      form.setValue("scriptsPaths", [...existing, val], { shouldDirty: true });
    }
    setPathInput("");
  };

  const removePath = (p: string) => {
    const existing = form.getValues("scriptsPaths") ?? [];
    form.setValue(
      "scriptsPaths",
      existing.filter((x) => x !== p),
      { shouldDirty: true },
    );
  };

  const onSubmit = (values: AppConfig) => {
    save(values);
    toast({
      variant: "success",
      title: "Configuração salva",
      description: "Pronto para gerenciar scripts.",
    });
    router.push("/");
  };

  const handleTest = async () => {
    const valid = await form.trigger();
    if (!valid) {
      toast({
        variant: "destructive",
        title: "Preencha todos os campos antes de testar",
      });
      return;
    }
    const values = form.getValues();
    setGithubTest({ status: "loading" });
    setBundleTest({ status: "loading" });

    try {
      const client = new GitHubClient(values);
      const result = await client.testConnection();
      setGithubTest({ status: "ok", detail: result.repo });
    } catch (err) {
      setGithubTest({
        status: "error",
        detail: (err as Error).message,
      });
    }

    try {
      const status = await fetchScriptStatus(values.bundleApiUrl);
      if (status.ok)
        setBundleTest({
          status: "ok",
          detail: status.hasDeploy
            ? `bundle ativo (${status.bytes} B)`
            : "API responde, sem deploy",
        });
      else
        setBundleTest({
          status: "error",
          detail: "API offline ou URL inválida",
        });
    } catch (err) {
      setBundleTest({
        status: "error",
        detail: (err as Error).message,
      });
    }
  };

  if (!hydrated) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Boxes className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold">
            Chatwoot Script Manager
          </span>
        </div>
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-medium">Configuração inicial</h1>
          <p className="mt-1 text-sm text-slate-11">
            Os dados ficam apenas no seu navegador (localStorage) ou em{" "}
            <code className="font-mono text-xs">.env.local</code>. Nada é
            enviado para servidores externos.
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>GitHub</CardTitle>
              <CardDescription>
                Repositório onde os scripts ficam versionados. O PAT precisa do
                escopo <code className="font-mono text-xs">repo</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field
                label="Personal Access Token"
                error={form.formState.errors.githubToken?.message}
              >
                <Input
                  type="password"
                  placeholder="ghp_..."
                  autoComplete="off"
                  {...form.register("githubToken")}
                />
              </Field>
              <Field
                label="Repositório (owner/repo)"
                error={form.formState.errors.repository?.message}
              >
                <Input
                  placeholder="minhaempresa/chatwoot-scripts"
                  {...form.register("repository")}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Branch"
                  error={form.formState.errors.branch?.message}
                >
                  <Input placeholder="main" {...form.register("branch")} />
                </Field>
              </div>

              {/* ── Multi-path com auto-fetch ── */}
              <Field
                label="Pastas dos scripts"
                hint={`Clique em "Carregar pastas" para buscar do repositório, ou adicione manualmente`}
              >
                <div className="space-y-2">
                  {/* Botão para carregar pastas do repo */}
                  <FolderFetcher
                    form={form}
                    currentPaths={currentPaths}
                    addPath={(p: string) => {
                      const existing = form.getValues("scriptsPaths") ?? [];
                      if (!existing.includes(p)) {
                        form.setValue("scriptsPaths", [...existing, p], { shouldDirty: true });
                      }
                    }}
                    removePath={removePath}
                  />
                  {/* Chips das pastas selecionadas */}
                  {currentPaths.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {currentPaths.map((p) => (
                        <span
                          key={p}
                          className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-mono text-xs text-primary"
                        >
                          <Check className="h-3 w-3" />
                          {p}
                          <button
                            type="button"
                            onClick={() => removePath(p)}
                            className="ml-0.5 rounded-full text-primary/60 hover:text-destructive-text"
                            aria-label={`Remover ${p}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Input manual (fallback) */}
                  <div className="flex gap-1.5">
                    <Input
                      value={pathInput}
                      onChange={(e) => setPathInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          addPath();
                        }
                      }}
                      placeholder="ou digite manualmente…"
                      className="h-8 text-xs font-mono"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 shrink-0"
                      onClick={addPath}
                      aria-label="Adicionar pasta"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Field>
              <TestStatus state={githubTest} label="GitHub" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API de bundle</CardTitle>
              <CardDescription>
                Onde o bundle final é entregue. A chave vai no header
                <code className="mx-1 font-mono text-xs">x-api-key</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field
                label="URL"
                error={form.formState.errors.bundleApiUrl?.message}
              >
                <Input
                  placeholder="https://api.exemplo.com"
                  {...form.register("bundleApiUrl")}
                />
              </Field>
              <Field
                label="API Key"
                error={form.formState.errors.bundleApiKey?.message}
              >
                <Input
                  type="password"
                  autoComplete="off"
                  {...form.register("bundleApiKey")}
                />
              </Field>
              <TestStatus state={bundleTest} label="API de bundle" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preferências</CardTitle>
            </CardHeader>
            <CardContent>
              <label className="flex items-start gap-3">
                <Checkbox
                  checked={form.watch("stripComments")}
                  onCheckedChange={(v) =>
                    form.setValue("stripComments", v === true)
                  }
                  id="strip-comments"
                />
                <span className="text-sm">
                  <span className="font-medium">Remover comentários</span>
                  <span className="ml-1 text-slate-11">
                    ao gerar o bundle (// e /* */)
                  </span>
                </span>
              </label>
            </CardContent>
          </Card>

          <CardFooter className="flex gap-2 px-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={
                githubTest.status === "loading" ||
                bundleTest.status === "loading"
              }
            >
              {(githubTest.status === "loading" ||
                bundleTest.status === "loading") && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              Testar conexão
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              <ShieldCheck className="h-3.5 w-3.5" />
              Salvar e continuar
            </Button>
          </CardFooter>
        </form>
      </main>
    </div>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive-text">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-11">{hint}</p>
      ) : null}
    </div>
  );
}

function TestStatus({ state, label }: { state: TestState; label: string }) {
  if (state.status === "idle") return null;
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-sm border px-3 py-2 text-xs",
        state.status === "ok"
          ? "border-success/30 bg-success-subtle text-success-text"
          : state.status === "error"
            ? "border-destructive/30 bg-destructive-subtle text-destructive-text"
            : "border-border bg-slate-2 text-slate-11",
      )}
    >
      {state.status === "loading" ? (
        <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />
      ) : state.status === "ok" ? (
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      ) : (
        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      )}
      <div>
        <span className="font-medium">{label}: </span>
        {state.status === "loading"
          ? "testando…"
          : state.status === "ok"
            ? state.detail
            : state.detail}
      </div>
    </div>
  );
}

type FolderFetcherProps = {
  form: ReturnType<typeof useForm<AppConfig>>;
  currentPaths: string[];
  addPath: (p: string) => void;
  removePath: (p: string) => void;
};

function FolderFetcher({ form, currentPaths, addPath, removePath }: FolderFetcherProps) {
  const [dirs, setDirs] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fetched, setFetched] = React.useState(false);

  // Observa o token em tempo real para detectar campo vazio
  const tokenValue = form.watch("githubToken");
  const repoValue = form.watch("repository");
  const tokenMissing = !tokenValue || tokenValue.trim() === "";

  const handleFetch = async () => {
    // Relê os valores no momento do clique (garante valor atual do DOM)
    const token = form.getValues("githubToken");
    const repo = form.getValues("repository");
    const branch = form.getValues("branch") || "main";

    if (!token || token.trim() === "") {
      setError("O campo \"Personal Access Token\" está vazio. Browsers não restauram campos de senha automaticamente — reinsira o PAT antes de carregar as pastas.");
      return;
    }

    if (!repo || repo.trim() === "") {
      setError("Preencha o campo \"Repositório\" antes de carregar pastas.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const client = new GitHubClient({
        githubToken: token.trim(),
        repository: repo.trim(),
        branch: branch.trim(),
        scriptsPaths: [],
        bundleApiUrl: form.getValues("bundleApiUrl") || "https://placeholder.test",
        bundleApiKey: form.getValues("bundleApiKey") || "placeholder",
        stripComments: false,
      });
      const result = await client.listRootDirectories();
      setDirs(result);
      setFetched(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const toggleFolder = (folder: string) => {
    if (currentPaths.includes(folder)) {
      removePath(folder);
    } else {
      addPath(folder);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={handleFetch}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FolderSearch className="h-3.5 w-3.5" />
        )}
        {loading ? "Buscando…" : "Carregar pastas do repositório"}
      </Button>

      {/* Aviso proativo quando o token não foi (re)inserido */}
      {tokenMissing && !error && repoValue && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          ⚠️ O campo PAT está vazio. Browsers não restauram senhas automaticamente — reinsira o token antes de carregar as pastas.
        </p>
      )}

      {error && (
        <p className="text-xs text-destructive-text">{error}</p>
      )}

      {fetched && dirs.length === 0 && !error && (
        <p className="text-xs text-slate-11">Nenhuma pasta encontrada na raiz do repositório.</p>
      )}

      {dirs.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {dirs.map((dir) => {
            const selected = currentPaths.includes(dir);
            return (
              <button
                key={dir}
                type="button"
                onClick={() => toggleFolder(dir)}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-xs transition-colors",
                  selected
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-slate-3 text-slate-11 hover:border-primary/30 hover:bg-primary/5 hover:text-slate-12",
                )}
              >
                {selected && <Check className="h-3 w-3" />}
                {dir}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
