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

  it("shows a placeholder instead of the tags while they load", () => {
    render(
      <DatasetTagsSection
        title="Fields of Science"
        items={["4.1", "1.1"]}
        isLoading
      />,
    );

    expect(screen.getByText("Fields of Science")).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Loading Fields of Science" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("4.1")).not.toBeInTheDocument();
    expect(screen.queryByText("1.1")).not.toBeInTheDocument();
  });

  it("renders nothing while loading when there are no values", () => {
    const { container } = render(
      <DatasetTagsSection title="Fields of Science" items={[]} isLoading />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders no heading or chip row without values", () => {
    const { container } = render(
      <DatasetTagsSection title="Keywords" items={[]} />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Keywords")).not.toBeInTheDocument();
  });
});
