import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { zurichSingleTable } from "@/lib/temperatureAnswer/fixtures/observed";
import { table } from "@/lib/temperatureAnswer/fixtures/synthetic";
import {
  interpretTemperatureAnswer,
  type TemperatureAnswer,
} from "@/lib/temperatureAnswer/interpret";
import { TemperatureValueCard } from "./TemperatureValueCard";

const answerOf = (data: Parameters<typeof interpretTemperatureAnswer>[0]) =>
  interpretTemperatureAnswer(data) as TemperatureAnswer;

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
