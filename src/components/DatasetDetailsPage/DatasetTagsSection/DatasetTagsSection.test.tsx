import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DatasetTagsSection from "./DatasetTagsSection";

describe("DatasetTagsSection", () => {
  it("shows the heading and every tag", () => {
    render(
      <DatasetTagsSection title="Keywords" items={["climate", "weather"]} />,
    );

    expect(screen.getByText("Keywords")).toBeInTheDocument();
    expect(screen.getByText("climate")).toBeInTheDocument();
    expect(screen.getByText("weather")).toBeInTheDocument();
  });

  it("renders no heading or chip row without values", () => {
    const { container } = render(
      <DatasetTagsSection title="Keywords" items={[]} />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Keywords")).not.toBeInTheDocument();
  });
});
