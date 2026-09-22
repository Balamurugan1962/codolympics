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

/*
 * Monaco is deliberately run without language workers: tokenising on the main
 * thread is fine for contest-sized files (NFR-F-02 asks for 1,000 lines) and
 * avoids a worker bundle path that differs between bundlers.
 *
 * It still *asks* for a worker, though, and with none configured that throws an
 * ErrorEvent which Next surfaces as a full-screen runtime error — alarming for
 * a competitor mid-round, over a feature they are not using. Handing it an
 * empty worker answers the question without shipping anything.
 */
if (typeof window !== "undefined") {
  (window as unknown as { MonacoEnvironment?: unknown }).MonacoEnvironment = {
    getWorker: () => new Worker(URL.createObjectURL(new Blob([""], { type: "text/javascript" }))),
  };
}

const MONACO_LANGUAGE: Record<string, string> = { c: "c", cpp: "cpp", python: "python", pypy: "python", java: "java", javascript: "javascript" };

export function CodeEditor({ value, language, onChange, height = "60vh", readOnly = false, fontSize = 13 }: { value: string; language: string; onChange?: (v: string) => void; height?: string; readOnly?: boolean; fontSize?: number }) {
  return (
    <Editor
      height={height}
      language={MONACO_LANGUAGE[language] ?? "plaintext"}
      value={value}
      theme="vs-dark"
      onChange={(v) => onChange?.(v ?? "")}
      options={{
        fontSize,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        tabSize: 4,
        readOnly,
        automaticLayout: true,
        wordWrap: "off",
        lineNumbersMinChars: 3,
        padding: { top: 8 },
        // Once the editor is scrolled to its end the wheel goes on to the page;
        // by default Monaco swallows it and the page under the pointer is stuck.
        scrollbar: { alwaysConsumeMouseWheel: false },
      }}
    />
  );
}
