import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  athensDaySql,
  athensTimeSql,
  athensTimeTable,
  zurichSingleSql,
  zurichSingleTable,
} from "@/lib/temperatureAnswer/fixtures/observed";
import {
  type TemperatureAnswer as Interpreted,
  interpretTemperatureAnswer,
} from "@/lib/temperatureAnswer/interpret";
import { TemperatureAnswer } from "./TemperatureAnswer";

const { saveOriginalFile } = vi.hoisted(() => ({ saveOriginalFile: vi.fn() }));
vi.mock("@/lib/fileDownload", () => ({ saveOriginalFile }));

vi.mock("./QueryLocationMap", () => ({
  QueryLocationMap: ({
    location,
  }: {
    location: { latitude: number; longitude: number };
  }) => (
    <div data-testid="query-location-map">
      {location.latitude}, {location.longitude}
    </div>
  ),
}));

const savedCsv = async () => {
  const [blob, filename] = saveOriginalFile.mock.calls[0] as [Blob, string];
  // jsdom's Blob has no text(); FileReader reads it the way a browser would.
  const text = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsText(blob);
  });
  return { text, filename, type: blob.type };
};

describe("TemperatureAnswer", () => {
  beforeEach(() => saveOriginalFile.mockClear());

  it("downloads every returned row unchanged from the chart view", async () => {
    const user = userEvent.setup();
    const answer = interpretTemperatureAnswer(athensTimeTable) as Interpreted;
    render(
      <TemperatureAnswer
        answer={answer}
        message={{ tableData: athensTimeTable, sqlQuery: athensTimeSql }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Download CSV" }));

    const csv = await savedCsv();
    expect(csv.filename).toBe("temperature-2020-07-01-to-2020-07-31.csv");
    expect(csv.type).toBe("text/csv;charset=utf-8");
    const lines = csv.text.replace(/^﻿/, "").split("\r\n");
    expect(lines).toHaveLength(32);
    expect(lines[0]).toBe("time,avg_tmean_celsius");
    expect(lines[31]).toBe("2020-07-31T11:00:00Z,30.908162292505665");
  });

  it("downloads the same file from the table view", async () => {
    const user = userEvent.setup();
    const answer = interpretTemperatureAnswer(athensTimeTable) as Interpreted;
    render(
      <TemperatureAnswer
        answer={answer}
        message={{ tableData: athensTimeTable, sqlQuery: athensTimeSql }}
      />,
    );
    await user.click(screen.getByRole("tab", { name: "Table" }));
    await user.click(screen.getByRole("button", { name: "Download CSV" }));
    const csv = await savedCsv();
    expect(csv.text.split("\r\n")).toHaveLength(32);
  });

  it("puts the map after the panel when the SQL names a location", () => {
    const answer = interpretTemperatureAnswer(athensTimeTable) as Interpreted;
    const { container } = render(
      <TemperatureAnswer
        answer={answer}
        message={{ tableData: athensTimeTable, sqlQuery: athensDaySql }}
      />,
    );
    const map = screen.getByTestId("query-location-map");
    expect(map).toHaveTextContent("38, 23.7");
    expect(container.firstElementChild?.lastElementChild).toBe(map);
  });

  it("starts a fresh map when the location changes", () => {
    const answer = interpretTemperatureAnswer(athensTimeTable) as Interpreted;
    const { rerender } = render(
      <TemperatureAnswer
        answer={answer}
        message={{ tableData: athensTimeTable, sqlQuery: athensDaySql }}
      />,
    );
    const first = screen.getByTestId("query-location-map");
    rerender(
      <TemperatureAnswer
        answer={answer}
        message={{ tableData: athensTimeTable, sqlQuery: zurichSingleSql }}
      />,
    );
    expect(screen.getByTestId("query-location-map")).not.toBe(first);
  });

  it("shows no map without a supported location", () => {
    const answer = interpretTemperatureAnswer(athensTimeTable) as Interpreted;
    render(
      <TemperatureAnswer
        answer={answer}
        message={{
          tableData: athensTimeTable,
          sqlQuery: "SELECT 1",
          latitude: 38,
          longitude: 23.7,
        }}
      />,
    );
    expect(screen.queryByTestId("query-location-map")).toBeNull();
  });

  it("shows the Zurich value card with its map and download", async () => {
    const user = userEvent.setup();
    const answer = interpretTemperatureAnswer(zurichSingleTable) as Interpreted;
    render(
      <TemperatureAnswer
        answer={answer}
        message={{ tableData: zurichSingleTable, sqlQuery: zurichSingleSql }}
      />,
    );
    expect(screen.getByText("22.2 °C")).toBeInTheDocument();
    expect(screen.getByTestId("query-location-map")).toHaveTextContent(
      "47.4, 8.5",
    );
    await user.click(screen.getByRole("button", { name: "Download CSV" }));
    const csv = await savedCsv();
    expect(csv.filename).toBe("temperature.csv");
    expect(csv.text.replace(/^﻿/, "")).toBe(
      "avg_tmean_celsius\r\n22.24835866292318",
    );
  });
});
