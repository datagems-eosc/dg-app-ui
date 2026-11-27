"use client";

import { formatTemperature, formatTime } from "@/lib/temperatureAnswer/format";
import type { TemperatureAnswer } from "@/lib/temperatureAnswer/interpret";
import { columnLabel } from "@/lib/temperatureAnswer/temperatureColumn";
import { DownloadCsvButton } from "./DownloadCsvButton";

interface TemperatureValueCardProps {
  answer: TemperatureAnswer;
  onDownload: () => void;
}

/** A single returned temperature: no chart, no toggle. */
export function TemperatureValueCard({
  answer,
  onDownload,
}: TemperatureValueCardProps) {
  const [row] = answer.rows;
  const time = row?.time?.status === "ok" ? row.time.value : null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 py-3.5 pr-3.5 pl-4">
      <div>
        <p className="text-descriptions-12-regular text-gray-650">
          <b className="text-body-14-medium text-gray-750">
            {columnLabel(answer.temperatureColumn)}
          </b>
          {time && <span> {`· ${formatTime(time)}`}</span>}
        </p>
        {row?.temperature !== null && row?.temperature !== undefined && (
          <p className="text-H2-24-semibold text-slate-850 tabular-nums">
            {formatTemperature(row.temperature)} °C
          </p>
        )}
      </div>
      <DownloadCsvButton onDownload={onDownload} />
    </div>
  );
}
