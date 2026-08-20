"use client";

import type React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export type MarkdownVariant = "full" | "compact";

interface MarkdownProps {
  content?: string | null;
  className?: string;
  variant?: MarkdownVariant;
}

type NodeProps = { children?: React.ReactNode };
type AnchorProps = NodeProps & { href?: string };
type CodeProps = NodeProps & {
  className?: string;
} & React.HTMLAttributes<HTMLElement>;

function Anchor({ children, href }: AnchorProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:underline break-words"
    >
      {children}
    </a>
  );
}

function CodeBlock({ children }: NodeProps) {
  return (
    <pre className="my-2 overflow-x-auto rounded-lg bg-slate-100 p-3 text-slate-900">
      <code className="font-mono text-[0.85em] whitespace-pre">{children}</code>
    </pre>
  );
}

function Code({ className, children, ...props }: CodeProps) {
  const isBlock =
    /language-/.test(className || "") || String(children).includes("\n");

  if (isBlock) {
    return <CodeBlock>{children}</CodeBlock>;
  }

  return (
    <code
      className={cn(
        "rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.9em] text-slate-900",
        className,
      )}
      {...props}
    >
      {children}
    </code>
  );
}

const fullComponents: Components = {
  a: Anchor,
  code: Code,
  pre: ({ children }: NodeProps) => <>{children}</>,
  p: ({ children }: NodeProps) => (
    <p className="mb-2 last:mb-0 whitespace-pre-wrap break-words">{children}</p>
  ),
  h1: ({ children }: NodeProps) => (
    <h1 className="mb-2 text-xl font-semibold">{children}</h1>
  ),
  h2: ({ children }: NodeProps) => (
    <h2 className="mb-2 text-lg font-semibold">{children}</h2>
  ),
  h3: ({ children }: NodeProps) => (
    <h3 className="mb-2 text-base font-semibold">{children}</h3>
  ),
  h4: ({ children }: NodeProps) => (
    <h4 className="mb-2 text-base font-semibold">{children}</h4>
  ),
  h5: ({ children }: NodeProps) => (
    <h5 className="mb-2 text-sm font-semibold">{children}</h5>
  ),
  h6: ({ children }: NodeProps) => (
    <h6 className="mb-2 text-sm font-semibold">{children}</h6>
  ),
  ul: ({ children }: NodeProps) => (
    <ul className="mb-2 list-disc pl-6">{children}</ul>
  ),
  ol: ({ children }: NodeProps) => (
    <ol className="mb-2 list-decimal pl-6">{children}</ol>
  ),
  li: ({ children }: NodeProps) => <li className="mb-1">{children}</li>,
};

const compactComponents: Components = {
  a: Anchor,
  code: Code,
  pre: ({ children }: NodeProps) => <>{children}</>,
  p: ({ children }: NodeProps) => (
    <span className="break-words">{children} </span>
  ),
  h1: ({ children }: NodeProps) => (
    <span className="font-medium">{children} </span>
  ),
  h2: ({ children }: NodeProps) => (
    <span className="font-medium">{children} </span>
  ),
  h3: ({ children }: NodeProps) => (
    <span className="font-medium">{children} </span>
  ),
  h4: ({ children }: NodeProps) => (
    <span className="font-medium">{children} </span>
  ),
  h5: ({ children }: NodeProps) => (
    <span className="font-medium">{children} </span>
  ),
  h6: ({ children }: NodeProps) => (
    <span className="font-medium">{children} </span>
  ),
  ul: ({ children }: NodeProps) => <span>{children}</span>,
  ol: ({ children }: NodeProps) => <span>{children}</span>,
  li: ({ children }: NodeProps) => (
    <span className="break-words">{children} </span>
  ),
};

export default function Markdown({
  content,
  className,
  variant = "full",
}: MarkdownProps) {
  const source = typeof content === "string" ? content : "";

  if (!source.trim()) {
    return null;
  }

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={variant === "compact" ? compactComponents : fullComponents}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
