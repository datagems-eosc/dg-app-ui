"use client";

import { Button } from "@ui/Button";
import { FoldedChipList } from "@ui/FoldedChipList";
import { FoldedNameList } from "@ui/FoldedNameList";
import { FoldedText } from "@ui/FoldedText";
import { ShortenedLink } from "@ui/ShortenedLink";
import { Check, Copy } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import type { DatasetPlus } from "@/data/dataset";
import {
  displayNames,
  presentValues,
  sameAddress,
  webUrl,
} from "@/lib/datasetOverview";

/** Shared with the right column so every heading in the card looks the same. */
export const overviewHeadingClass =
  "text-base leading-6 font-semibold text-gray-750";
/** Horizontal padding of every part of the card. */
export const overviewGutterClass = "px-4 @xl/overview:px-5";

const sectionClass = `${overviewGutterClass} border-t border-slate-200 py-5`;

/** A muted label 6 px above its value. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <dt className="text-sm leading-5 text-gray-650">{label}</dt>
      <dd className="min-w-0 text-sm leading-6 text-gray-750">{children}</dd>
    </div>
  );
}

/** A titled group of fields; the caller leaves it out when it is empty. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <h3 className={overviewHeadingClass}>{title}</h3>
      <dl className="flex flex-col gap-4">{children}</dl>
    </div>
  );
}

/** A source or licence: a link for a web address, wrapping text otherwise. */
function Address({ value }: { value: string }) {
  const url = webUrl(value);
  return url ? (
    <ShortenedLink href={url} />
  ) : (
    <p className="[overflow-wrap:anywhere]">{value}</p>
  );
}

type CopyState = "idle" | "copied" | "failed";

function CopyCitation({ text }: { text: string }) {
  const [state, setState] = useState<CopyState>("idle");
  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [state]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
  };
  const Icon = state === "copied" ? Check : Copy;
  return (
    <Button
      variant="outline"
      size="sm"
      aria-label="Copy citation"
      className="shrink-0 gap-1.5 max-lg:h-11"
      onClick={() => void copy()}
    >
      <Icon aria-hidden="true" className="size-4" />
      <span aria-live="polite">
        {state === "copied"
          ? "Copied"
          : state === "failed"
            ? "Copy failed"
            : "Copy"}
      </span>
    </Button>
  );
}

function LoadingChips({ count, label }: { count: number; label: string }) {
  return (
    <div
      role="status"
      aria-label={`Loading ${label.toLowerCase()}`}
      className="flex flex-wrap gap-1.5"
    >
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="h-6 w-28 animate-pulse rounded-full bg-slate-200"
        />
      ))}
    </div>
  );
}

interface DatasetOverviewProps {
  dataset: DatasetPlus;
  /** The fields-of-science names are still loading. */
  fieldsOfSciencePending?: boolean;
  /** The right column: permissions and collections. */
  aside: ReactNode;
}

/**
 * The dataset's description and metadata in one card, grouped as
 * Classification, Characteristics beside Source & licensing, and Citation.
 * A value that is absent has no label, and a group with no values is left out.
 */
export default function DatasetOverview({
  dataset,
  fieldsOfSciencePending = false,
  aside,
}: DatasetOverviewProps) {
  const description = dataset.description?.trim();
  const fields = presentValues(dataset.fieldOfScience);
  const keywords = presentValues(dataset.keywords);
  const languages = displayNames(dataset.language, "language");
  const countries = displayNames(dataset.country, "region");
  const source = dataset.url?.trim() || undefined;
  const license = dataset.license?.trim() || undefined;
  const citation = dataset.citation?.trim() || undefined;
  // Some datasets give the same address as source and licence.
  const shared = sameAddress(source, license);

  const hasClassification = fields.length + keywords.length > 0;
  const hasCharacteristics = languages.length + countries.length > 0;
  const hasOrigin = !!source || !!license;

  return (
    <section
      aria-labelledby="dataset-overview-title"
      className="flex flex-col gap-3"
    >
      <h2
        id="dataset-overview-title"
        className="text-xl leading-snug font-semibold text-gray-750 lg:text-2xl"
      >
        Overview
      </h2>
      <div className="@container/overview rounded-2xl border border-slate-200 bg-white">
        <div className="grid grid-cols-[minmax(0,1fr)] @4xl/overview:grid-cols-[minmax(0,1fr)_19.5rem] @4xl/overview:grid-rows-[auto_1fr] [grid-template-areas:'about'_'details'_'aside'] @4xl/overview:[grid-template-areas:'about_aside'_'details_aside']">
          <div
            className={`${overviewGutterClass} min-w-0 py-5 [grid-area:about]`}
          >
            {description ? (
              <FoldedText
                text={description}
                markdown
                lines={10}
                about="description"
                className="max-w-[75ch] text-base leading-6 text-gray-750"
              />
            ) : (
              <p className="text-base text-gray-650">No description</p>
            )}
          </div>

          <div className="@container/details min-w-0 [grid-area:details]">
            {hasClassification && (
              <div className={sectionClass}>
                <Group title="Classification">
                  {fields.length > 0 && (
                    <Field label="Fields of science">
                      {fieldsOfSciencePending ? (
                        <LoadingChips
                          count={fields.length}
                          label="Fields of science"
                        />
                      ) : (
                        <FoldedChipList
                          items={fields}
                          label="Fields of science"
                        />
                      )}
                    </Field>
                  )}
                  {keywords.length > 0 && (
                    <Field label="Keywords">
                      <FoldedChipList items={keywords} label="Keywords" />
                    </Field>
                  )}
                </Group>
              </div>
            )}

            {(hasCharacteristics || hasOrigin) && (
              <div
                className={`${sectionClass} grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-6 @xl/details:grid-cols-2`}
              >
                {hasCharacteristics && (
                  <Group title="Characteristics">
                    {languages.length > 0 && (
                      <Field
                        label={languages.length > 1 ? "Languages" : "Language"}
                      >
                        <FoldedNameList items={languages} about="languages" />
                      </Field>
                    )}
                    {countries.length > 0 && (
                      <Field
                        label={countries.length > 1 ? "Countries" : "Country"}
                      >
                        <FoldedNameList items={countries} about="countries" />
                      </Field>
                    )}
                  </Group>
                )}
                {hasOrigin && (
                  <Group title="Source & licensing">
                    {shared && source ? (
                      <Field label="Source and license">
                        <Address value={source} />
                      </Field>
                    ) : (
                      <>
                        {source && (
                          <Field label="Source">
                            <Address value={source} />
                          </Field>
                        )}
                        {license && (
                          <Field label="License">
                            <Address value={license} />
                          </Field>
                        )}
                      </>
                    )}
                  </Group>
                )}
              </div>
            )}

            {citation && (
              <div className={`${sectionClass} flex flex-col gap-3`}>
                <div className="flex min-h-8 items-center justify-between gap-4">
                  <h3 className={overviewHeadingClass}>Citation</h3>
                  <CopyCitation text={citation} />
                </div>
                <FoldedText
                  text={citation}
                  lines={4}
                  about="citation"
                  className="max-w-[90ch] text-sm leading-6 text-gray-650"
                />
              </div>
            )}
          </div>

          <div className="min-w-0 border-slate-200 [grid-area:aside] @max-4xl/overview:border-t @4xl/overview:border-l">
            {aside}
          </div>
        </div>
      </div>
    </section>
  );
}
