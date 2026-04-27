import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BasicInformation } from "./BasicInformation";

type BasicInformationData = {
  title: string;
  headline: string;
  description: string;
  keywords: string[];
  authors: string;
};

const initialData: BasicInformationData = {
  title: "",
  headline: "",
  description: "",
  keywords: [],
  authors: "",
};

describe("BasicInformation", () => {
  it("renders authors field with counter and max length", () => {
    render(
      <BasicInformation data={initialData} onChange={() => {}} errors={{}} />,
    );

    expect(screen.getByPlaceholderText("Enter authors")).toBeInTheDocument();
    expect(screen.getAllByText("0/250").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByPlaceholderText("Enter authors")).toHaveAttribute(
      "maxLength",
      "250",
    );
  });

  it("renders all basic info fields", () => {
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
      screen.getAllByPlaceholderText(
        "Provide a detailed description of the dataset contents",
      ).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByPlaceholderText("Enter authors").length,
    ).toBeGreaterThanOrEqual(1);
  });
});
