"use client";

/**
 * Monaco, bundled locally. The default @monaco-editor/react setup fetches
 * the editor from a CDN at runtime -- a blank editor in a hall with no
 * internet (US-F10-01). `loader.config({ monaco })` points it at the copy in
 * node_modules instead, so everything ships in the build.
 */
import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";

loader.config({ monaco });

// No web workers are configured: Monaco then tokenises on the main thread,
// which is fine for contest-sized files (NFR-F-02 asks for 1,000 lines) and
// avoids a worker bundle path that differs between bundlers.

const MONACO_LANGUAGE: Record<string, string> = { c: "c", cpp: "cpp", python: "python", pypy: "python", java: "java", javascript: "javascript" };

export function CodeEditor({ value, language, onChange, height = "60vh", readOnly = false }: { value: string; language: string; onChange?: (v: string) => void; height?: string; readOnly?: boolean }) {
  return (
    <div className="overflow-hidden rounded-box border border-line">
      <Editor
        height={height}
        language={MONACO_LANGUAGE[language] ?? "plaintext"}
        value={value}
        theme="vs-dark"
        onChange={(v) => onChange?.(v ?? "")}
        options={{ fontSize: 13, minimap: { enabled: false }, scrollBeyondLastLine: false, tabSize: 4, readOnly, automaticLayout: true, wordWrap: "off" }}
      />
    </div>
  );
}
