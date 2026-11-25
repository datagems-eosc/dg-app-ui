import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  athensDayTable,
  athensTimeTable,
} from "@/lib/temperatureAnswer/fixtures/observed";
import {
  extraColumnTable,
  missingValuesTable,
  reorderedCellsTable,
} from "@/lib/temperatureAnswer/fixtures/synthetic";
import {
  interpretTemperatureAnswer,
  type TemperatureAnswer,
} from "@/lib/temperatureAnswer/interpret";
import { TemperatureTable } from "./TemperatureTable";

const answerOf = (table: Parameters<typeof interpretTemperatureAnswer>[0]) =>
  interpretTemperatureAnswer(table) as TemperatureAnswer;

const bodyRows = () =>
  within(screen.getByRole("table")).getAllByRole("row").slice(1);

describe("TemperatureTable", () => {
  it("lists every returned row with readable dates and one decimal", () => {
    render(<TemperatureTable answer={answerOf(athensDayTable)} />);
    expect(bodyRows()).toHaveLength(31);
    const first = within(bodyRows()[0]).getAllByRole("cell");
    expect(first.map((cell) => cell.textContent)).toEqual([
      "1 Jul 2020",
      "29.9",
    ]);
  });

  it("shows a readable heading and the original column name", () => {
    render(<TemperatureTable answer={answerOf(athensDayTable)} />);
    const headers = screen.getAllByRole("columnheader");
    expect(headers[0]).toHaveTextContent("Day");
    expect(headers[0]).toHaveTextContent("day");
    expect(headers[1]).toHaveTextContent("Avg tmean (°C)");
    expect(headers[1]).toHaveTextContent("avg_tmean_celsius");
  });

  it("marks UTC timestamps in the heading", () => {
    render(<TemperatureTable answer={answerOf(athensTimeTable)} />);
    expect(screen.getAllByRole("columnheader")[0]).toHaveTextContent(
      "Time (UTC)",
    );
    expect(within(bodyRows()[0]).getAllByRole("cell")[0]).toHaveTextContent(
      "1 Jul 2020, 11:00",
    );
  });

  it("puts each value under its own column when cells are reordered", () => {
    render(<TemperatureTable answer={answerOf(reorderedCellsTable)} />);
    expect(
      within(bodyRows()[0])
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["2 Jul 2020", "29.1"]);
  });

  it("announces missing values and flags unreadable dates", () => {
    render(<TemperatureTable answer={answerOf(missingValuesTable)} />);
    const rows = bodyRows();
    expect(within(rows[7]).getByLabelText("No value")).toHaveTextContent("—");
    expect(within(rows[14]).getByLabelText("No value")).toBeInTheDocument();
    expect(within(rows[15]).getAllByRole("cell")[0]).toHaveTextContent(
      "07/16/2020 · date not recognised",
    );
  });

  it("shows extra columns as returned", () => {
    render(<TemperatureTable answer={answerOf(extraColumnTable)} />);
    expect(screen.getAllByRole("columnheader")[2]).toHaveTextContent(
      "Grid cells",
    );
    expect(within(bodyRows()[0]).getAllByRole("cell")[2]).toHaveTextContent(
      "4",
    );
  });

  it("scrolls inside a focusable, labelled area", () => {
    render(<TemperatureTable answer={answerOf(athensDayTable)} />);
    const region = screen.getByRole("region", {
      name: "Avg tmean (°C) values",
    });
    expect(region).toHaveAttribute("tabindex", "0");
  });
});
