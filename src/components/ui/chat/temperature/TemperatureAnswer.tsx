"use client";

import { saveOriginalFile } from "@/lib/fileDownload";
import { csvFileName, tableToCsv } from "@/lib/temperatureAnswer/csv";
import type { TemperatureAnswer as Interpreted } from "@/lib/temperatureAnswer/interpret";
import { resolveQueryLocation } from "@/lib/temperatureAnswer/queryLocation";
import type { Message } from "@/types/chat";
import { QueryLocationMap } from "./QueryLocationMap";
import { TemperatureDataPanel } from "./TemperatureDataPanel";
import { TemperatureValueCard } from "./TemperatureValueCard";

interface TemperatureAnswerProps {
  answer: Interpreted;
  message: Pick<Message, "tableData" | "sqlQuery" | "latitude" | "longitude">;
}

/**
 * A recognised temperature answer: the data panel (or a value card for one
 * value), then the query-location map. The CSV is built from the returned
 * table, so it is the same in every view.
 */
export function TemperatureAnswer({ answer, message }: TemperatureAnswerProps) {
  const location = resolveQueryLocation(message);

  const download = () => {
    if (!message.tableData) return;
    saveOriginalFile(
      new Blob([tableToCsv(message.tableData)], {
        type: "text/csv;charset=utf-8",
      }),
      csvFileName(answer),
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {answer.kind === "single" ? (
        <TemperatureValueCard answer={answer} onDownload={download} />
      ) : (
        <TemperatureDataPanel answer={answer} onDownload={download} />
      )}
      {location && (
        // A new location starts a fresh map, including after a failed one.
        <QueryLocationMap
          key={`${location.latitude},${location.longitude}`}
          location={location}
        />
      )}
    </div>
  );
}
