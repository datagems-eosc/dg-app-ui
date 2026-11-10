import { render, screen } from "@testing-library/react";
import type { TextareaHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";
import { BasicInformation } from "./BasicInformation";

// The real editor is a large package loaded through next/dynamic. Under a
// full-suite run it can take longer than the default find timeout, so stand
// in a plain textarea that receives the same props from MarkdownEditor.
vi.mock("@uiw/react-md-editor", () => ({
  default: ({
    value,
    onChange,
    textareaProps,
  }: {
    value?: string;
    onChange?: (value?: string) => void;
    textareaProps?: TextareaHTMLAttributes<HTMLTextAreaElement>;
  }) => (
    <textarea
      {...textareaProps}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

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
