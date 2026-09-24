import "katex/dist/katex.min.css";

import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema, type Options as Schema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { parseAlt } from "@/lib/statement-images";
import { cn } from "@/lib/utils";

const INLINE_IMAGE = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/;

/**
 * Statements copied from other sites carry inline HTML (`<code>`, `<u>`, `<sub>`), so it is
 * parsed, and then everything outside a short allowlist is dropped: no scripts, no handlers.
 * Data URIs are allowed for `src` because that is how a figure travels inside a statement.
 */
const SCHEMA: Schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "u", "mark", "small"],
  protocols: { ...defaultSchema.protocols, src: [...(defaultSchema.protocols?.src ?? []), "data"] },
  attributes: {
    ...defaultSchema.attributes,
    // The classes remark-math puts on a formula, which KaTeX then finds.
    code: [...(defaultSchema.attributes?.code ?? []), ["className", /^language-./, "math-inline", "math-display"]],
  },
};

/** Statements carry their figures inside the text, so the LAN-only hall never fetches anything. */
function urlTransform(url: string): string {
  return INLINE_IMAGE.test(url) ? url : defaultUrlTransform(url);
}

/** Problem statements and hints: tables, code blocks, lists, maths and embedded figures must render intact (US-F4-01). */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("prose-statement", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, SCHEMA], rehypeKatex]}
        urlTransform={urlTransform}
        components={{
          img: ({ src, alt }) => {
            const { text, width } = parseAlt(alt ?? "");
            // eslint-disable-next-line @next/next/no-img-element
            return <img src={typeof src === "string" ? src : undefined} alt={text} style={width ? { width, maxWidth: "100%" } : undefined} />;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
