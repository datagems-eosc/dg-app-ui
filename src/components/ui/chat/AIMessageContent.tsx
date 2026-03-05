"use client";

import { DataTable } from "@ui/chat/DataTable";
import { ChevronUp, Pencil, ThumbsDown, ThumbsUp } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import RcaiMarkdown from "@/components/RcaiChat/RcaiMarkdown";
import { Button } from "@/components/ui/Button";
import type { TableData } from "@/types/chat";

interface AIMessageContentProps {
  content: string;
  tableData?: TableData;
  sqlQuery?: string;
  sqlQueries?: string[];
  isGenerating?: boolean;
  onSaveAndRunSqlQuery?: (sqlQuery: string) => void;
}

export function AIMessageContent({
  content,
  tableData,
  sqlQuery,
  sqlQueries,
  isGenerating = false,
  onSaveAndRunSqlQuery,
}: AIMessageContentProps) {
  const [isExpertMode, setIsExpertMode] = useState(false);
  const [isSqlExpanded, setIsSqlExpanded] = useState(false);
  const [editingSqlIdx, setEditingSqlIdx] = useState<number | null>(null);
  const effectiveSqlQueries = useMemo(() => {
    if (Array.isArray(sqlQueries) && sqlQueries.length > 0) return sqlQueries;
    if (typeof sqlQuery === "string" && sqlQuery.trim().length > 0) {
      return [sqlQuery];
    }
    return [];
  }, [sqlQueries, sqlQuery]);

  const dirtySqlQueriesRef = React.useRef<Set<number>>(new Set());
  const [baselineSqlQueries, setBaselineSqlQueries] =
    useState<string[]>(effectiveSqlQueries);
  const [editableSqlQueries, setEditableSqlQueries] =
    useState<string[]>(effectiveSqlQueries);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("expertMode");
      setIsExpertMode(saved === "1");
    } catch {
      setIsExpertMode(false);
    }

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled?: unknown }>).detail;
      setIsExpertMode(Boolean(detail?.enabled));
    };

    window.addEventListener("expert-mode-change", handler);
    return () => {
      window.removeEventListener("expert-mode-change", handler);
    };
  }, []);

  useEffect(() => {
    dirtySqlQueriesRef.current.forEach((idx) => {
      if (idx >= effectiveSqlQueries.length)
        dirtySqlQueriesRef.current.delete(idx);
    });

    setBaselineSqlQueries((prev) =>
      effectiveSqlQueries.map((q: string, idx: number) => {
        if (editingSqlIdx === idx) return prev[idx] ?? q;
        if (dirtySqlQueriesRef.current.has(idx)) return prev[idx] ?? q;
        return q;
      }),
    );

    setEditableSqlQueries((prev) =>
      effectiveSqlQueries.map((q: string, idx: number) =>
        dirtySqlQueriesRef.current.has(idx) ? (prev[idx] ?? q) : q,
      ),
    );
  }, [effectiveSqlQueries, editingSqlIdx]);

  return (
    <div className="w-full max-w-full">
      <div className="text-body-16-regular text-gray-750 break-words overflow-hidden">
        <RcaiMarkdown content={content} />
      </div>

      {tableData && (
        <div className="mt-3 overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <DataTable tableData={tableData} />
        </div>
      )}

      {effectiveSqlQueries.length > 0 && isExpertMode ? (
        <div className="mt-4 border border-slate-350 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between gap-4 px-4 py-3 bg-white">
            <div className="text-body-14-semibold text-slate-850">
              {effectiveSqlQueries.length > 1 ? "SQL Queries" : "SQL Query"}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled
                className="text-slate-500 disabled:opacity-50"
                aria-label="Like"
              >
                <ThumbsUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled
                className="text-slate-500 disabled:opacity-50"
                aria-label="Dislike"
              >
                <ThumbsDown className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsSqlExpanded((v) => !v)}
                className="text-slate-700"
                aria-expanded={isSqlExpanded}
                aria-label={
                  isSqlExpanded ? "Collapse SQL Query" : "Expand SQL Query"
                }
              >
                <ChevronUp
                  className={isSqlExpanded ? "w-4 h-4" : "w-4 h-4 rotate-180"}
                />
              </button>
            </div>
          </div>

          {isSqlExpanded ? (
            <div className="border-t border-slate-350 bg-slate-25 px-4 py-4">
              <div className="space-y-4">
                {effectiveSqlQueries.map((_q: string, idx: number) => {
                  const baseline =
                    baselineSqlQueries[idx] ?? effectiveSqlQueries[idx] ?? "";
                  const current = editableSqlQueries[idx] ?? baseline;
                  const isEditing = editingSqlIdx === idx;
                  const isDirty =
                    dirtySqlQueriesRef.current.has(idx) && current !== baseline;
                  const canRun =
                    Boolean(onSaveAndRunSqlQuery) &&
                    !isGenerating &&
                    current.trim().length > 0 &&
                    isDirty;

                  return (
                    <div key={`sql-${idx}`} className="space-y-2">
                      {effectiveSqlQueries.length > 1 ? (
                        <div className="text-xs text-slate-500">
                          Query {idx + 1}
                        </div>
                      ) : null}

                      <div className="relative">
                        <textarea
                          value={isEditing ? current : baseline}
                          readOnly={!isEditing}
                          onChange={(e) => {
                            if (!isEditing) return;
                            dirtySqlQueriesRef.current.add(idx);
                            const value = e.target.value;
                            setEditableSqlQueries((prev) => {
                              const next = [...prev];
                              next[idx] = value;
                              return next;
                            });
                          }}
                          rows={8}
                          spellCheck={false}
                          className={
                            isEditing
                              ? "w-full text-sm text-slate-900 font-mono whitespace-pre-wrap break-words bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              : "w-full text-sm text-slate-500 font-mono whitespace-pre-wrap break-words bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none"
                          }
                        />

                        {!isEditing ? (
                          <button
                            type="button"
                            className="absolute top-2 right-2 text-slate-700 hover:text-slate-900"
                            aria-label="Edit SQL"
                            onClick={() => {
                              setEditableSqlQueries((prev) => {
                                const next = [...prev];
                                next[idx] = baseline;
                                return next;
                              });
                              setEditingSqlIdx(idx);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        ) : null}
                      </div>

                      {isEditing ? (
                        <div className="flex items-center justify-end gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="md"
                            disabled={isGenerating}
                            onClick={() => {
                              dirtySqlQueriesRef.current.delete(idx);
                              setEditableSqlQueries((prev) => {
                                const next = [...prev];
                                next[idx] = baseline;
                                return next;
                              });
                              setEditingSqlIdx(null);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            variant="primary"
                            size="md"
                            disabled={!canRun}
                            onClick={() => {
                              setBaselineSqlQueries((prev) => {
                                const next = [...prev];
                                next[idx] = current;
                                return next;
                              });
                              dirtySqlQueriesRef.current.delete(idx);
                              setEditingSqlIdx(null);
                              onSaveAndRunSqlQuery?.(current);
                            }}
                          >
                            Save and Run
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
