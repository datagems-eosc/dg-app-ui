import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import FilePreview from "./FilePreview";

vi.mock("next/dynamic", () => ({ default: () => () => null }));
it.each(["tabular", "json"] as const)(
  "does not offer a fabricated %s download",
  (type) => {
    render(
      <FilePreview
        fileData={
          type === "json"
            ? {
                type,
                filename: "data.json",
                fileSize: "",
                description: "",
                keywords: [],
                content: "{}",
              }
            : {
                type,
                filename: "data.csv",
                fileSize: "",
                description: "",
                columns: [],
                rows: [],
                totalRows: 0,
                statistics: [],
                dataQuality: [],
              }
        }
      />,
    );
    expect(
      screen.queryByRole("button", { name: /download/i }),
    ).not.toBeInTheDocument();
  },
);
