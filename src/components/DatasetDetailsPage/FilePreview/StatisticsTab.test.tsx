import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { buildFilePreviews } from "@/lib/datasetProfile";
import StatisticsTab from "./StatisticsTab";

function renderAirbnbPrice(mean: number | undefined = 168.42936734443126) {
  const [entry] = buildFilePreviews({
    nodes: [
      {
        id: "file",
        labels: ["cr:FileObject"],
        properties: { name: "budapest_weekdays.csv" },
      },
      { id: "price", labels: ["cr:Field"], properties: { name: "realSum" } },
      {
        id: "stats",
        labels: ["dg:ColumnStatistics"],
        properties: {
          mean,
          rowCount: 2074,
          missingCount: 0,
          percentile05: 52.05827366543816,
          percentile95: 385.46382886736956,
        },
      },
    ],
    edges: [
      { from: "price", to: "file", labels: ["source/fileObject"] },
      { from: "price", to: "stats", labels: ["statistics"] },
    ],
  });
  if (entry?.data.type !== "tabular") throw new Error("Expected tabular data");
  return render(<StatisticsTab {...entry.data} />);
}

it("shows numeric price statistics when the live profile omits the field type", () => {
  renderAirbnbPrice();
  expect(screen.getByText("168.43")).toBeInTheDocument();
  const missingRows = screen.getByText("Missing rows").parentElement;
  if (!missingRows) throw new Error("Expected missing rows metric");
  expect(within(missingRows).getByText("0")).toBeInTheDocument();
});

it("keeps supplied percentiles when an untyped numeric field has no usable mean", () => {
  renderAirbnbPrice(Number.NaN);
  expect(screen.getByText("52.06")).toBeInTheDocument();
});

it("shows the inferred meaning of a column independently of its structural type and metrics", () => {
  const [entry] = buildFilePreviews({
    nodes: [
      { id: "file", labels: ["cr:FileObject"] },
      {
        id: "level",
        labels: ["cr:Field"],
        properties: {
          name: "Question Level",
          dataType: "sc:Text",
          semanticType: "difficulty level",
        },
      },
    ],
    edges: [{ from: "level", to: "file", labels: ["source/fileObject"] }],
  });
  if (entry?.data.type !== "tabular") throw new Error("Expected tabular data");
  render(<StatisticsTab {...entry.data} />);
  expect(screen.getByText("Question Level")).toBeInTheDocument();
  expect(
    screen.getByText("Inferred semantic type: difficulty level"),
  ).toBeInTheDocument();
  expect(screen.queryByText("Missing rows")).not.toBeInTheDocument();
});

it("labels available profiler percentiles as inferred", () => {
  renderAirbnbPrice();
  expect(screen.getByText("5th percentile (inferred)")).toBeInTheDocument();
  expect(screen.getByText("52.06")).toBeInTheDocument();
  expect(screen.getByText("95th percentile (inferred)")).toBeInTheDocument();
  expect(screen.getByText("385.46")).toBeInTheDocument();
  expect(screen.getByText("Median value")).toBeInTheDocument();
  expect(screen.queryByText(/inferred semantic type/i)).not.toBeInTheDocument();
});

it("scales the histogram to the observed count and aligns bars with that scale", () => {
  const { container } = render(
    <StatisticsTab
      columns={[
        { id: "price", name: "realSum", type: "numeric", visible: true },
      ]}
      statistics={[
        {
          columnId: "price",
          min: 37.129,
          max: 3630.681,
          distribution: [2032, 0],
        },
      ]}
    />,
  );
  expect(screen.getByText("2,500")).toBeInTheDocument();
  expect(screen.getByText("37.13", { selector: "text" })).toBeInTheDocument();
  const [tallest, empty] = container.querySelectorAll("rect");
  expect(Number(tallest.getAttribute("height"))).toBeCloseTo(
    (165 * 2032) / 2500,
  );
  expect(empty).toHaveAttribute("height", "0");
});

it("shows a valid histogram with legacy numeric-string bounds and its unique count", () => {
  render(
    <StatisticsTab
      columns={[{ id: "p", name: "Price", type: "numeric", visible: true }]}
      statistics={[
        {
          columnId: "p",
          min: "1",
          max: "9",
          uniqueValues: 682,
          distribution: [200, 0],
        },
      ]}
    />,
  );
  expect(
    screen.getByRole("img", { name: "Distribution of Price" }),
  ).toBeInTheDocument();
  expect(screen.getByText("682")).toBeInTheDocument();
});

it("uses profiled bin widths and positions for unequal histogram ranges", () => {
  const { container } = render(
    <StatisticsTab
      columns={[{ id: "p", name: "Price", type: "numeric", visible: true }]}
      statistics={[
        {
          columnId: "p",
          min: 0,
          max: 10,
          distribution: [6, 4],
          distributionRanges: [
            [0, 2],
            [4, 10],
          ],
        },
      ]}
    />,
  );
  const [first, second] = container.querySelectorAll("rect");
  expect(Number(second.getAttribute("x"))).toBeCloseTo(219 * 0.4);
  expect(Number(second.getAttribute("width"))).toBeGreaterThan(
    Number(first.getAttribute("width")) * 2,
  );
});

it("keeps distinct histogram endpoint labels for a small nonzero range", () => {
  render(
    <StatisticsTab
      columns={[{ id: "p", name: "Price", type: "numeric", visible: true }]}
      statistics={[
        { columnId: "p", min: 0.001, max: 0.003, distribution: [6, 4] },
      ]}
    />,
  );
  expect(screen.getByText("0.001", { selector: "text" })).toBeInTheDocument();
  expect(screen.getByText("0.003", { selector: "text" })).toBeInTheDocument();
});

it("rounds a near-zero lower histogram bound to zero without a minus sign", () => {
  render(
    <StatisticsTab
      columns={[
        { id: "a", name: "Type of Answer", type: "numeric", visible: true },
      ]}
      statistics={[
        { columnId: "a", min: -0.001, max: 1, distribution: [3, 4] },
      ]}
    />,
  );
  const chart = screen.getByRole("img", {
    name: "Distribution of Type of Answer",
  });
  expect(
    within(chart).getByText("0", { selector: "text" }),
  ).toBeInTheDocument();
  expect(within(chart).queryByText("-0")).not.toBeInTheDocument();
});

it("validates and rounds numeric bounds sent as strings", () => {
  render(
    <StatisticsTab
      columns={[{ id: "p", name: "Price", type: "numeric", visible: true }]}
      statistics={[{ columnId: "p", min: "1.23456", max: "Infinity" }]}
    />,
  );
  expect(screen.getByText("1.23")).toBeInTheDocument();
  expect(screen.queryByText("Infinity")).not.toBeInTheDocument();
});

it("explains when the visible file has no available statistics", () => {
  render(
    <StatisticsTab
      columns={[
        { id: "price", name: "realSum", type: "numeric", visible: true },
      ]}
      statistics={[{ columnId: "price" }]}
    />,
  );
  expect(
    screen.getByText("No statistics available for this file."),
  ).toBeInTheDocument();
});

it("does not claim all statistics are absent when a full row total is available", () => {
  render(
    <StatisticsTab
      columns={[{ id: "p", name: "Price", type: "numeric", visible: true }]}
      statistics={[]}
      totalRows={7}
    />,
  );
  expect(screen.getByText("7")).toBeInTheDocument();
  expect(
    screen.queryByText("No statistics available for this file."),
  ).not.toBeInTheDocument();
});

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
it.each([
  [undefined, "Not available"],
  [Number.NaN, "Not available"],
  [Number.POSITIVE_INFINITY, "Not available"],
  [0, "0%"],
  [12.5, "12.5%"],
] as const)(
  "distinguishes unknown numeric missing percentages from valid values %j",
  (value, expected) => {
    render(
      <StatisticsTab
        columns={[{ id: "x", name: "Score", type: "number", visible: true }]}
        statistics={[
          { columnId: "x", missingPercentage: value, uniqueValues: 7 },
        ]}
        totalRows={10}
        totalMissingPercentage={50}
      />,
    );
    const metric = screen.getByText("Missing percentage").parentElement;
    if (!metric) throw new Error("Expected the missing percentage metric");
    expect(within(metric).getByText(expected)).toBeInTheDocument();
  },
);
