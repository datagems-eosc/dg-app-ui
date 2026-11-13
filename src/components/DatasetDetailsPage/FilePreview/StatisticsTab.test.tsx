import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import StatisticsTab from "./StatisticsTab";

it.each([undefined, Number.NaN, Number.POSITIVE_INFINITY])(
  "shows unavailable for unknown statistics %j",
  (value) => {
    render(
      <StatisticsTab
        statistics={[]}
        columns={[]}
        totalRows={value}
        totalMissingPercentage={value}
      />,
    );
    expect(screen.getAllByText("Not available")).toHaveLength(2);
  },
);
it("keeps valid zero", () => {
  render(
    <StatisticsTab
      statistics={[]}
      columns={[]}
      totalRows={0}
      totalMissingPercentage={0}
    />,
  );
  expect(screen.getByText("0")).toBeInTheDocument();
  expect(screen.getByText("0%")).toBeInTheDocument();
});
it("does not invent a Celsius unit for numeric columns", () => {
  const { container } = render(
    <StatisticsTab
      columns={[{ id: "x", name: "Score", type: "number", visible: true }]}
      statistics={[{ columnId: "x", min: 1, max: 2, distribution: [1, 2] }]}
    />,
  );
  expect(container.textContent).not.toContain("°C");
});
