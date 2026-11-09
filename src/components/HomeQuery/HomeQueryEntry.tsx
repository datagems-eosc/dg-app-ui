"use client";

import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  FolderSearch,
  Info,
  RotateCw,
  X,
} from "lucide-react";
import Link from "next/link";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { APP_ROUTES } from "@/config/appUrls";
import {
  isClassifiableQuery,
  MAX_QUERY_LENGTH,
} from "@/lib/intentRouting/gateway";
import type { DestinationIntent } from "@/lib/intentRouting/types";
import { cn, createUrl } from "@/lib/utils";
import { Button } from "../ui/Button";
import SmartSearchExamples from "../ui/SmartSearchExamples";
import { WorkingStatus } from "../ui/WorkingStatus";
import type { HomeQueryState } from "./useHomeQuery";

const PLACEHOLDER = "Type a topic or a question…";

const STATUS_MESSAGES = [
  "Working out what you need",
  "Choosing where to take you",
  "Checking how best to help",
] as const;

export interface HomeExamples {
  idle: readonly string[];
  outOfScope: readonly string[];
}

interface HomeQueryEntryProps {
  state: HomeQueryState;
  /** Picked once per visit by the container; empty until picked. */
  examples: HomeExamples;
  onTextChange: (text: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onChoose: (intent: DestinationIntent) => void;
  onRetry: () => void;
}

interface ChoiceRowProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  onClick: () => void;
  buttonRef?: React.Ref<HTMLButtonElement>;
}

function ChoiceRow({
  title,
  description,
  icon,
  iconBg,
  onClick,
  buttonRef,
}: ChoiceRowProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 hover:shadow-s2 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-850 focus-visible:ring-offset-1"
    >
      <div
        className={`${iconBg} rounded-lg p-2 w-11 h-11 flex items-center justify-center shrink-0`}
      >
        {icon}
      </div>
      <div className="flex flex-col">
        <p className="text-body-16-semibold text-gray-800">{title}</p>
        <p className="text-body-14-regular text-gray-500">{description}</p>
      </div>
    </button>
  );
}

function FindDatasetsRow(
  props: Omit<ChoiceRowProps, "title" | "description" | "icon" | "iconBg">,
) {
  return (
    <ChoiceRow
      title="Find datasets"
      description="See datasets that match your words, then filter and open them."
      icon={
        <FolderSearch strokeWidth={1.25} className="w-5 h-5 text-blue-500" />
      }
      iconBg="bg-blue-50"
      {...props}
    />
  );
}

function GetAnswerRow(
  props: Omit<ChoiceRowProps, "title" | "description" | "icon" | "iconBg">,
) {
  return (
    <ChoiceRow
      title="Get an answer"
      description="Get a written reply based on data in the platform, in a new chat."
      icon={<Bot strokeWidth={1.25} className="w-5 h-5 text-emerald-600" />}
      iconBg="bg-emerald-50"
      {...props}
    />
  );
}

function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby="home-query-panel-title"
      className="bg-slate-75 border border-slate-200 rounded-2xl p-5 flex flex-col gap-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col">
          <h2
            id="home-query-panel-title"
            className="text-body-16-semibold text-gray-800"
          >
            {title}
          </h2>
          {description && (
            <p className="text-body-14-regular text-gray-500">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function PlaceholderPanel() {
  const bar = "bg-slate-200 rounded animate-pulse motion-reduce:animate-none";
  return (
    <div
      data-testid="home-query-placeholder"
      aria-hidden="true"
      className="bg-slate-75 border border-slate-200 rounded-2xl p-5 flex flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <div className={`${bar} h-5 w-64`} />
        <div className={`${bar} h-3 w-96 max-w-full`} />
      </div>
      <div className="flex flex-col gap-3">
        {[0, 1].map((row) => (
          <div
            key={row}
            className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4"
          >
            <div className={`${bar} w-11 h-11 rounded-lg shrink-0`} />
            <div className="flex flex-col gap-2 w-full">
              <div className={`${bar} h-4 w-32`} />
              <div
                className={`${bar} h-3 ${row === 0 ? "w-96" : "w-80"} max-w-full`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HomeQueryEntry({
  examples,
  state,
  onTextChange,
  onSubmit,
  onCancel,
  onChoose,
  onRetry,
}: HomeQueryEntryProps) {
  const firstChoiceRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { status, text } = state;
  const busy = status === "classifying" || status === "navigating";
  const tooLong = text.trim().length > MAX_QUERY_LENGTH;
  const canSubmit = !busy && isClassifiableQuery(text);
  const failed = status === "failed";

  useEffect(() => {
    if (status === "clarify" || status === "failed") {
      firstChoiceRef.current?.focus();
    }
  }, [status]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSubmit) onSubmit();
    }
  };

  const choices = (
    <div className="flex flex-col gap-3">
      <FindDatasetsRow
        buttonRef={firstChoiceRef}
        onClick={() => onChoose("dataset_search")}
      />
      <GetAnswerRow onClick={() => onChoose("question")} />
    </div>
  );

  // Escape from a panel's choices returns to the input to edit the question.
  const handleRootKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      event.key === "Escape" &&
      (status === "clarify" || status === "outOfScope" || failed)
    ) {
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex flex-col gap-3" onKeyDown={handleRootKeyDown}>
      <div
        className={cn(
          "w-full bg-white border rounded-2xl transition-all duration-300",
          "border-slate-200 hover:border-slate-350 focus-within:border-slate-350",
          failed && "border-red-550 focus-within:border-red-550",
        )}
        style={{
          outline: "4px solid rgba(202, 213, 226, 0.25)",
          outlineOffset: 0,
        }}
      >
        <div className="p-3 sm:p-4 relative">
          <label htmlFor="home-query" className="sr-only">
            {PLACEHOLDER}
          </label>
          <textarea
            ref={inputRef}
            id="home-query"
            name="home-query"
            rows={2}
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={PLACEHOLDER}
            aria-busy={busy}
            className="w-full border-none resize-none bg-transparent text-descriptions-14-regular sm:text-body-16-regular text-gray-750 placeholder-slate-450 focus:outline-none focus:ring-0"
            style={{ minHeight: "52px", maxHeight: "140px" }}
          />
          <div className="flex items-center justify-between gap-2 mt-3 sm:mt-4 min-h-8">
            {busy ? (
              <>
                <WorkingStatus messages={STATUS_MESSAGES} />
                {/* Once navigation has started there is nothing to cancel. */}
                {status === "classifying" && (
                  <Button
                    key="cancel"
                    variant="tertiary"
                    size="sm"
                    onClick={onCancel}
                  >
                    <X className="w-4 h-4 mr-1" aria-hidden="true" />
                    Cancel
                  </Button>
                )}
              </>
            ) : (
              <>
                {/* Messages share the footer row so the box never changes height. */}
                {failed ? (
                  <p className="text-red-500 text-sm min-w-0" role="alert">
                    {
                      "We couldn't check your request. Something went wrong on our side."
                    }
                  </p>
                ) : tooLong ? (
                  <p className="text-red-500 text-sm min-w-0">
                    Keep your request under 2,000 characters.
                  </p>
                ) : (
                  <span />
                )}
                <Button
                  key="send"
                  variant="primary"
                  size="icon"
                  className="p-1"
                  aria-label="Send"
                  onClick={onSubmit}
                  disabled={!canSubmit}
                >
                  <ArrowUpRight
                    className="w-4 h-4 text-icon"
                    aria-hidden="true"
                  />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {status === "idle" && (
        <>
          <SmartSearchExamples
            showHeader={false}
            align="start"
            examples={examples.idle}
            onPickExample={onTextChange}
          />
          <Link
            href={createUrl(APP_ROUTES.BROWSE)}
            className="self-start inline-flex items-center gap-1.5 text-body-14-medium text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-850 focus-visible:ring-offset-1 rounded-sm"
          >
            or browse all datasets
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </>
      )}

      {busy && <PlaceholderPanel />}

      {status === "clarify" && (
        <Panel
          title="What would you like to do?"
          description={
            state.degraded
              ? undefined
              : `“${text.trim()}” could mean either. Choose one to continue.`
          }
        >
          {state.degraded && (
            <div
              role="status"
              className="p-3.5 bg-blue-75 rounded-full flex items-center gap-2"
            >
              <Info
                className="w-4 h-4 text-blue-850 shrink-0"
                aria-hidden="true"
              />
              <p className="text-body-14-regular text-blue-650 flex-1">
                {
                  "We can't pick the right place for your request right now. Please choose one."
                }
              </p>
            </div>
          )}
          {choices}
        </Panel>
      )}

      {status === "outOfScope" && (
        <Panel
          title="DataGEMS can't help with this"
          description="DataGEMS finds datasets and answers questions about data. Try a request like one of these:"
        >
          <SmartSearchExamples
            showHeader={false}
            align="start"
            examples={examples.outOfScope}
            onPickExample={onTextChange}
          />
          <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-4">
            <p className="text-body-14-regular text-gray-500">
              Still want to look for datasets with your words?
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onChoose("dataset_search")}
            >
              <FolderSearch className="w-4 h-4 mr-2" aria-hidden="true" />
              Find datasets
            </Button>
          </div>
        </Panel>
      )}

      {failed && (
        <Panel
          title="What would you like to do?"
          description="Try again, or choose how to continue."
          action={
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RotateCw className="w-4 h-4 mr-2" aria-hidden="true" />
              Try again
            </Button>
          }
        >
          {choices}
        </Panel>
      )}
    </div>
  );
}
