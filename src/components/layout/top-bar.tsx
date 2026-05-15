"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { Cog, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useConfig } from "@/hooks/use-config";
import { StatusIndicator } from "./status-indicator";
import { ThemeToggle } from "./theme-toggle";

interface Props {
  onDeploy: () => void;
  deployDisabled?: boolean;
}

export function TopBar({ onDeploy, deployDisabled }: Props) {
  const router = useRouter();
  const { config } = useConfig();
  const embeddings = config?.embeddings ?? [];

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-4">
      <div />

      <div className="flex items-center gap-3">
        {embeddings.length > 0 && (
          <>
            <div className="flex items-center gap-1">
              {embeddings.map((e) => (
                <Button
                  key={e.id}
                  variant="ghost"
                  size="icon"
                  onClick={() => router.push(`/embeddings?id=${e.id}`)}
                  aria-label={e.title}
                  title={e.title}
                >
                  <Icon icon={e.icon} className="h-4 w-4" />
                </Button>
              ))}
            </div>
            <Separator orientation="vertical" className="h-6" />
          </>
        )}
        <StatusIndicator />
        <Separator orientation="vertical" className="h-6" />
        <Button
          onClick={onDeploy}
          disabled={deployDisabled}
          className="shadow-blue-glow"
          aria-label="Gerar e enviar bundle"
          title="Gerar e enviar bundle (Cmd+Shift+B)"
        >
          <Rocket className="h-3.5 w-3.5" />
          Gerar e enviar bundle
        </Button>
        <ThemeToggle />
        <Button variant="ghost" size="icon" asChild aria-label="Configurações">
          <Link href="/setup">
            <Cog className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </header>
  );
}
