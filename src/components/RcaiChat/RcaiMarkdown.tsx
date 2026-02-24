"use client";

import type React from "react";
import { useMemo } from "react";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { MemoizedReactMarkdown } from "@/components/RcaiChat/markdown";
import RcaiCodeBlock from "@/components/RcaiChat/RcaiCodeBlock";

type ChildrenProps = {
  children?: React.ReactNode;
};

type LinkProps = ChildrenProps & {
  href?: string;
};

type CodeProps = ChildrenProps & {
  inline?: boolean;
  className?: string;
} & React.HTMLAttributes<HTMLElement>;

type RcaiMarkdownPart =
  | { kind: "text"; content: string }
  | { kind: "thinking"; content: string };

function splitThinkingBlocks(input: string): RcaiMarkdownPart[] {
  const parts: RcaiMarkdownPart[] = [];

  let i = 0;
  let inThinking = false;

  while (i < input.length) {
    if (!inThinking) {
      const openIdx = input.indexOf("<thinking", i);
      if (openIdx === -1) {
        const chunk = input.slice(i);
        if (chunk) parts.push({ kind: "text", content: chunk });
        break;
      }

      const before = input.slice(i, openIdx);
      if (before) parts.push({ kind: "text", content: before });

      const openEnd = input.indexOf(">", openIdx);
      if (openEnd === -1) {
        break;
      }

      i = openEnd + 1;
      inThinking = true;
      continue;
    }

    const closeFull = input.indexOf("</thinking>", i);
    if (closeFull === -1) {
      const closeStart = input.indexOf("</thinking", i);
      const chunk =
        closeStart === -1 ? input.slice(i) : input.slice(i, closeStart);
      if (chunk) parts.push({ kind: "thinking", content: chunk });
      break;
    }

    const thinkingChunk = input.slice(i, closeFull);
    if (thinkingChunk) parts.push({ kind: "thinking", content: thinkingChunk });

    i = closeFull + "</thinking>".length;
    inThinking = false;
  }

  return parts;
}

function MarkdownRenderer({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <MemoizedReactMarkdown
      className={className}
      remarkPlugins={[remarkGfm, remarkMath]}
      components={{
        p({ children }: ChildrenProps) {
          return (
            <p className="mb-2 last:mb-0 whitespace-pre-wrap">{children}</p>
          );
        },
        a({ children, href }: LinkProps) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 underline break-words"
            >
              {children}
            </a>
          );
        },
        ul({ children }: ChildrenProps) {
          return <ul className="list-disc pl-6 mb-2">{children}</ul>;
        },
        ol({ children }: ChildrenProps) {
          return <ol className="list-decimal pl-6 mb-2">{children}</ol>;
        },
        li({ children }: ChildrenProps) {
          return <li className="mb-1">{children}</li>;
        },
        blockquote({ children }: ChildrenProps) {
          return (
            <blockquote className="border-l-4 border-slate-300 pl-4 italic text-slate-700 my-2">
              {children}
            </blockquote>
          );
        },
        h1({ children }: ChildrenProps) {
          return <h1 className="text-xl font-semibold mb-2">{children}</h1>;
        },
        h2({ children }: ChildrenProps) {
          return <h2 className="text-lg font-semibold mb-2">{children}</h2>;
        },
        h3({ children }: ChildrenProps) {
          return <h3 className="text-base font-semibold mb-2">{children}</h3>;
        },
        code({ inline, className, children, ...props }: CodeProps) {
          const match = /language-(\w+)/.exec(className || "");

          if (inline) {
            return (
              <code
                className={`px-1 py-0.5 rounded bg-slate-100 text-slate-900 font-mono text-[0.9em] ${className || ""}`}
                {...props}
              >
                {children}
              </code>
            );
          }

          if (match) {
            return (
              <RcaiCodeBlock
                language={match[1] || ""}
                value={String(children).replace(/\n$/, "")}
              />
            );
          }

          return (
            <code
              className={`font-mono text-[0.9em] ${className || ""}`}
              {...props}
            >
              {children}
            </code>
          );
        },
        table({ children }: ChildrenProps) {
          return (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full border border-slate-200 rounded-lg overflow-hidden">
                {children}
              </table>
            </div>
          );
        },
        thead({ children }: ChildrenProps) {
          return <thead className="bg-slate-75">{children}</thead>;
        },
        th({ children }: ChildrenProps) {
          return (
            <th className="px-3 py-2 text-left text-sm font-semibold text-slate-850 border-b border-slate-200">
              {children}
            </th>
          );
        },
        td({ children }: ChildrenProps) {
          return (
            <td className="px-3 py-2 text-sm text-slate-850 border-b border-slate-200 align-top">
              {children}
            </td>
          );
        },
      }}
    >
      {content}
    </MemoizedReactMarkdown>
  );
}

export default function RcaiMarkdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const parts = useMemo(() => splitThinkingBlocks(content), [content]);

  if (parts.length <= 1 && parts[0]?.kind !== "thinking") {
    return <MarkdownRenderer content={content} className={className} />;
  }

  return (
    <div className="space-y-3">
      {parts
        .filter((p) => p.content.trim().length > 0)
        .map((part, idx) =>
          part.kind === "thinking" ? (
            <div
              key={`thinking-${idx}`}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700"
            >
              <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">
                Thinking
              </div>
              <div className="text-xs">
                <MarkdownRenderer
                  content={part.content}
                  className={className}
                />
              </div>
            </div>
          ) : (
            <MarkdownRenderer
              key={`text-${idx}`}
              content={part.content}
              className={className}
            />
          ),
        )}
    </div>
  );
}
