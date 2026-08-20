import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BasicInformation } from "./BasicInformation";

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
    expect(
      (
        await screen.findAllByPlaceholderText(
          "Provide a detailed description of the dataset contents",
        )
      ).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("does not render an Authors field", () => {
    render(
      <BasicInformation data={initialData} onChange={() => {}} errors={{}} />,
    );

    expect(screen.queryByPlaceholderText("Enter authors")).toBeNull();
    expect(screen.queryByText(/^Authors$/)).toBeNull();
  });
});
