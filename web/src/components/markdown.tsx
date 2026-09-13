import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

/** Problem statements and hints: tables, code blocks and lists must render intact (US-F4-01). */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("prose-statement", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
