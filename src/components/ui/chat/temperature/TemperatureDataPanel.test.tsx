import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  athensDayTable,
  zurichSingleTable,
} from "@/lib/temperatureAnswer/fixtures/observed";
import {
  allNullTable,
  table,
} from "@/lib/temperatureAnswer/fixtures/synthetic";
import {
  interpretTemperatureAnswer,
  type TemperatureAnswer,
} from "@/lib/temperatureAnswer/interpret";
import { TemperatureDataPanel } from "./TemperatureDataPanel";
import { TemperatureValueCard } from "./TemperatureValueCard";

const answerOf = (data: Parameters<typeof interpretTemperatureAnswer>[0]) =>
  interpretTemperatureAnswer(data) as TemperatureAnswer;

describe("TemperatureDataPanel", () => {
  it("opens on the chart with the title and Download CSV", () => {
    render(
      <TemperatureDataPanel
        answer={answerOf(athensDayTable)}
        onDownload={vi.fn()}
      />,
    );
    expect(screen.getByRole("tab", { name: "Chart" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Table" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.getByTestId("temperature-panel-title")).toHaveTextContent(
      "Avg tmean (°C) · 31 rows · 1 Jul 2020 – 31 Jul 2020",
    );
    expect(screen.getByRole("img", { name: /Line chart/ })).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("switches to the table and keeps the download in place", async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn();
    render(
      <TemperatureDataPanel
        answer={answerOf(athensDayTable)}
        onDownload={onDownload}
      />,
    );
    await user.click(screen.getByRole("tab", { name: "Table" }));
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Line chart/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Download CSV" }));
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it("switches views with the arrow keys", async () => {
    const user = userEvent.setup();
    render(
      <TemperatureDataPanel
        answer={answerOf(athensDayTable)}
        onDownload={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("tab", { name: "Chart" }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Table" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Table" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Chart" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("shows only the table when nothing can be charted", () => {
    render(
      <TemperatureDataPanel
        answer={answerOf(
          table(
            ["day", "avg_tmean_celsius"],
            [
              ["2020-07-01", 29.9],
              ["2020-07-02", null],
            ],
          ),
        )}
        onDownload={vi.fn()}
      />,
    );
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("says when no temperatures came back", () => {
    render(
      <TemperatureDataPanel
        answer={answerOf(allNullTable)}
        onDownload={vi.fn()}
      />,
    );
    expect(
      screen.getByText("No temperature values were returned for these dates."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Download CSV" }),
    ).toBeInTheDocument();
  });
});

describe("TemperatureValueCard", () => {
  it("shows the Zurich value with its label and Download CSV", async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn();
    render(
      <TemperatureValueCard
        answer={answerOf(zurichSingleTable)}
        onDownload={onDownload}
      />,
    );
    expect(screen.getByText("Avg tmean (°C)")).toBeInTheDocument();
    expect(screen.getByText("22.2 °C")).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Download CSV" }));
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it("adds the date of a single dated row", () => {
    render(
      <TemperatureValueCard
        answer={answerOf(
          table(["day", "avg_tmean_celsius"], [["2020-07-01", 29.94]]),
        )}
        onDownload={vi.fn()}
      />,
    );
    expect(screen.getByText("· 1 Jul 2020")).toBeInTheDocument();
    expect(screen.getByText("29.9 °C")).toBeInTheDocument();
  });
});
