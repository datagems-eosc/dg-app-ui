import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import FilePreviewMetadata from "./FilePreviewMetadata";

it.each(["", "   "])(
  "hides missing PDF/JSON file descriptions without losing keywords %j",
  (description) => {
    render(
      <FilePreviewMetadata description={description} keywords={["Nursing"]} />,
    );
    expect(screen.queryByText("About this file")).not.toBeInTheDocument();
    expect(screen.getByText("Nursing")).toBeInTheDocument();
  },
);
