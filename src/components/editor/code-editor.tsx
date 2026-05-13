"use client";

import * as React from "react";
import CodeMirror, { EditorView, Extension } from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  className?: string;
  onSave?: () => void;
}

// Faz o editor ocupar toda a altura do container e habilita scroll vertical
// no scroller interno. Sem maxHeight o .cm-editor cresce além do pai.
const fillParent = EditorView.theme({
  "&": {
    height: "100%",
    maxHeight: "100%",
  },
  ".cm-scroller": {
    overflow: "auto",
  },
  ".cm-content": {
    minHeight: "100%",
  },
});

const lightColors = EditorView.theme(
  {
    "&": {
      backgroundColor: "rgb(var(--solid-1))",
      color: "rgb(var(--slate-12))",
    },
    ".cm-gutters": {
      backgroundColor: "rgb(var(--slate-2))",
      color: "rgb(var(--slate-9))",
      border: "none",
    },
    ".cm-activeLine": { backgroundColor: "rgba(var(--alpha-2))" },
    ".cm-activeLineGutter": { backgroundColor: "rgba(var(--alpha-2))" },
    ".cm-selectionBackground, ::selection": {
      backgroundColor: "rgb(var(--blue-4)) !important",
    },
    ".cm-cursor": { borderLeftColor: "rgb(var(--blue-9))" },
  },
  { dark: false },
);

export function CodeEditor({
  value,
  onChange,
  readOnly,
  className,
  onSave,
}: Props) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const extensions = React.useMemo<Extension[]>(() => {
    const exts: Extension[] = [
      javascript({ jsx: false, typescript: false }),
      fillParent,
    ];
    if (!isDark) exts.push(lightColors);
    if (onSave) {
      exts.push(
        EditorView.domEventHandlers({
          keydown: (event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "s") {
              event.preventDefault();
              onSave();
              return true;
            }
            return false;
          },
        }),
      );
    }
    return exts;
  }, [onSave, isDark]);

  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      <CodeMirror
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        theme={isDark ? oneDark : "light"}
        extensions={extensions}
        height="100%"
        style={{ height: "100%" }}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          tabSize: 2,
          indentOnInput: true,
          autocompletion: true,
          bracketMatching: true,
          closeBrackets: true,
        }}
      />
    </div>
  );
}
