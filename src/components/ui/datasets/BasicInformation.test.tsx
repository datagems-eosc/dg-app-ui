import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BasicInformation } from "./BasicInformation";

// The real editor loads through next/dynamic and can exceed the default find
// timeout under a full-suite run.
vi.mock("@uiw/react-md-editor", () => import("@ui/markdownEditorTestStub"));

type BasicInformationData = {
  title: string;
  headline: string;
  description: string;
  keywords: string[];
};

const initialData: BasicInformationData = {
  title: "",
  headline: "",
  description: "",
  keywords: [],
};

describe("BasicInformation", () => {
  it("renders all basic info fields", async () => {
    render(
      <BasicInformation data={initialData} onChange={() => {}} errors={{}} />,
    );

    expect(
      screen.getAllByPlaceholderText("Enter dataset title").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByPlaceholderText("Enter short headline").length,
    ).toBeGreaterThanOrEqual(1);
    const descriptions = await screen.findAllByPlaceholderText(
      "Provide a detailed description of the dataset contents",
    );
    expect(descriptions.length).toBeGreaterThanOrEqual(1);
    expect(descriptions[0]).toHaveAttribute("maxLength", "3000");
  });

  it("does not render an Authors field", () => {
    render(
      <BasicInformation data={initialData} onChange={() => {}} errors={{}} />,
    );

    expect(screen.queryByPlaceholderText("Enter authors")).toBeNull();
    expect(screen.queryByText(/^Authors$/)).toBeNull();
  });
});
