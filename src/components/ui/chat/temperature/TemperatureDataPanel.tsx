"use client";

import { ChartLine, Table } from "lucide-react";
import { type KeyboardEvent, useId, useRef, useState } from "react";
import { formatDateRange } from "@/lib/temperatureAnswer/format";
import type { TemperatureAnswer } from "@/lib/temperatureAnswer/interpret";
import { columnLabel } from "@/lib/temperatureAnswer/temperatureColumn";
import { DownloadCsvButton } from "./DownloadCsvButton";
import { TemperatureChart } from "./TemperatureChart";
import { TemperatureTable } from "./TemperatureTable";

type View = "chart" | "table";

interface TemperatureDataPanelProps {
  answer: TemperatureAnswer;
  onDownload: () => void;
}

const VIEWS: Array<{ id: View; label: string; Icon: typeof ChartLine }> = [
  { id: "chart", label: "Chart", Icon: ChartLine },
  { id: "table", label: "Table", Icon: Table },
];

/**
 * One panel for a temperature series: a Chart | Table toggle (when a chart can
 * be drawn), the title and Download CSV, then the selected view.
 */
export function TemperatureDataPanel({
  answer,
  onDownload,
}: TemperatureDataPanelProps) {
  const [view, setView] = useState<View>(answer.canChart ? "chart" : "table");
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const panelId = useId();
  const active: View = answer.canChart ? view : "table";
  const rowCount = answer.rows.length;
  const range = answer.dateRange ? formatDateRange(answer.dateRange) : null;

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = view === "chart" ? 1 : 0;
    setView(VIEWS[next].id);
    tabs.current[next]?.focus();
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-200 py-2.5 pr-2.5 pl-3">
        {answer.canChart && (
          <div
            role="tablist"
            aria-label="Show as"
            className="flex shrink-0 overflow-hidden rounded-lg border border-slate-350"
          >
            {VIEWS.map(({ id, label, Icon }, index) => (
              <button
                key={id}
                id={`${panelId}-${id}`}
                ref={(element) => {
                  tabs.current[index] = element;
                }}
                type="button"
                role="tab"
                aria-selected={view === id}
                aria-controls={panelId}
                tabIndex={view === id ? 0 : -1}
                onClick={() => setView(id)}
                onKeyDown={onTabKeyDown}
                className={`flex h-8 items-center gap-1.5 px-3 text-body-14-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 [&+button]:border-l [&+button]:border-slate-350 ${
                  view === id
                    ? "bg-sky-950 text-white"
                    : "bg-white text-gray-750 hover:bg-slate-75"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        )}
        <p
          data-testid="temperature-panel-title"
          className="order-3 min-w-0 basis-full text-descriptions-12-regular text-gray-650 sm:order-none sm:flex-1 sm:basis-auto"
        >
          <b className="text-body-14-medium text-gray-750">
            {columnLabel(answer.temperatureColumn)}
          </b>
          {` · ${rowCount} ${rowCount === 1 ? "row" : "rows"}`}
          {range ? ` · ${range}` : ""}
        </p>
        <div className="ml-auto">
          <DownloadCsvButton onDownload={onDownload} />
        </div>
      </div>
      <div
        id={panelId}
        role={answer.canChart ? "tabpanel" : undefined}
        aria-labelledby={answer.canChart ? `${panelId}-${active}` : undefined}
        className={active === "chart" ? "px-3 pt-3 pb-2" : undefined}
      >
        {answer.kind === "empty" && (
          <p className="border-b border-slate-200 bg-slate-75 px-3.5 py-3 text-body-14-regular text-gray-750">
            No temperature values were returned for these dates.
          </p>
        )}
        {active === "chart" ? (
          <TemperatureChart answer={answer} />
        ) : (
          <TemperatureTable answer={answer} />
        )}
      </div>
    </div>
  );
}
