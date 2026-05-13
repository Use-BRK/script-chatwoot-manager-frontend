"use client";

import { CodeEditor } from "@/components/editor/code-editor";

interface Props {
  content: string;
}

export function BundlePreview({ content }: Props) {
  return (
    <div className="h-72 overflow-hidden rounded-md border border-border bg-card">
      <CodeEditor value={content} readOnly />
    </div>
  );
}
