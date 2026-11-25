import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { athensDayTable } from "@/lib/temperatureAnswer/fixtures/observed";
import {
  leapYearTable,
  missingValuesTable,
  table,
} from "@/lib/temperatureAnswer/fixtures/synthetic";
import {
  interpretTemperatureAnswer,
  type TemperatureAnswer,
} from "@/lib/temperatureAnswer/interpret";
import { TemperatureChart } from "./TemperatureChart";

const answerOf = (table: Parameters<typeof interpretTemperatureAnswer>[0]) =>
  interpretTemperatureAnswer(table) as TemperatureAnswer;

describe("TemperatureChart", () => {
  it("describes the chart for screen readers", () => {
    render(<TemperatureChart answer={answerOf(athensDayTable)} />);
    expect(
      screen.getByRole("img", {
        name: "Line chart of Avg tmean (°C), 31 values, 1 Jul 2020 to 31 Jul 2020",
      }),
    ).toHaveAttribute("tabindex", "0");
  });

  it("plots all 31 observations as one line in date order", () => {
    const { container } = render(
      <TemperatureChart answer={answerOf(athensDayTable)} />,
    );
    const points = container.querySelectorAll("[data-point]");
    expect(points).toHaveLength(31);
    const xs = [...points].map((point) => Number(point.getAttribute("cx")));
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    expect(container.querySelectorAll("polyline")).toHaveLength(1);
  });

  it("breaks the line at missing values instead of bridging them", () => {
    const { container } = render(
      <TemperatureChart answer={answerOf(missingValuesTable)} />,
    );
    // 1–7, 11–14 and 17–31 July; 16 July has an unreadable date.
    expect(container.querySelectorAll("polyline")).toHaveLength(3);
    expect(container.querySelectorAll("[data-point]")).toHaveLength(26);
  });

  it("explains what was not plotted", () => {
    render(<TemperatureChart answer={answerOf(missingValuesTable)} />);
    expect(
      screen.getByText(
        "Not plotted: 4 rows with no value (shown as gaps) and 1 row with a date that couldn't be read.",
      ),
    ).toBeInTheDocument();
  });

  it("lets a keyboard user step through the values", async () => {
    const user = userEvent.setup();
    render(<TemperatureChart answer={answerOf(athensDayTable)} />);
    const chart = screen.getByRole("img");
    await user.click(chart);
    expect(chart).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("status")).toHaveTextContent("1 Jul 2020: 29.9 °C");
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("status")).toHaveTextContent("2 Jul 2020: 29.1 °C");
    await user.keyboard("{End}");
    expect(screen.getByRole("status")).toHaveTextContent(
      "31 Jul 2020: 30.9 °C",
    );
    await user.keyboard("{Home}");
    expect(screen.getByRole("status")).toHaveTextContent("1 Jul 2020: 29.9 °C");
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("status")).toHaveTextContent("1 Jul 2020: 29.9 °C");
  });

  it("does not announce values while the pointer moves", () => {
    const { container } = render(
      <TemperatureChart answer={answerOf(athensDayTable)} />,
    );
    fireEvent.mouseMove(container.querySelector("svg") as SVGSVGElement, {
      clientX: 10_000,
      clientY: 10,
    });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("shows the value under the pointer", () => {
    const { container } = render(
      <TemperatureChart answer={answerOf(athensDayTable)} />,
    );
    const svg = container.querySelector("svg") as SVGSVGElement;
    fireEvent.mouseMove(svg, { clientX: 10_000, clientY: 10 });
    expect(screen.getByTestId("chart-tooltip")).toHaveTextContent(
      "31 Jul 2020" + "30.9 °C",
    );
    fireEvent.mouseLeave(svg);
    expect(screen.queryByTestId("chart-tooltip")).not.toBeInTheDocument();
  });

  it("labels an hourly series with times", () => {
    const hourly = interpretTemperatureAnswer(
      table(
        ["time", "avg_tmean_celsius"],
        Array.from({ length: 24 }, (_, h) => [
          `2020-07-01T${String(h).padStart(2, "0")}:00:00Z`,
          25 + h / 10,
        ]),
      ),
    ) as TemperatureAnswer;
    const { container } = render(<TemperatureChart answer={hourly} />);
    const labels = [...container.querySelectorAll("text")].map(
      (t) => t.textContent,
    );
    expect(labels).toContain("00:00");
    expect(labels).toContain("23:00");
  });

  it("names the year on January ticks of a multi-year series", () => {
    const twoYears = interpretTemperatureAnswer(
      table(
        ["day", "avg_tmean_celsius"],
        Array.from({ length: 731 }, (_, i) => [
          new Date(Date.UTC(2019, 0, 1 + i)).toISOString().slice(0, 10),
          10,
        ]),
      ),
    ) as TemperatureAnswer;
    const { container } = render(<TemperatureChart answer={twoYears} />);
    const labels = [...container.querySelectorAll("text")].map(
      (t) => t.textContent,
    );
    expect(labels).toContain("Jan 2019");
    expect(labels).toContain("Jan 2020");
    expect(labels).toContain("Jul");
  });

  it("drops point markers for long series", () => {
    const { container } = render(
      <TemperatureChart answer={answerOf(leapYearTable)} />,
    );
    expect(container.querySelectorAll("[data-point]")).toHaveLength(0);
    expect(container.querySelectorAll("polyline")).toHaveLength(1);
  });
});
