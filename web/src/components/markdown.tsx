import "katex/dist/katex.min.css";

import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { cn } from "@/lib/utils";

const INLINE_IMAGE = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/;

/** Statements carry their figures inside the text, so the LAN-only hall never fetches anything. */
function urlTransform(url: string): string {
  return INLINE_IMAGE.test(url) ? url : defaultUrlTransform(url);
}

/** Problem statements and hints: tables, code blocks, lists, maths and embedded figures must render intact (US-F4-01). */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("prose-statement", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} urlTransform={urlTransform}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
