import { render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { expect, it, vi } from "vitest";
import PdfFilePreview from "./PdfFilePreview";

vi.mock("react-pdf", () => ({
  pdfjs: { GlobalWorkerOptions: {}, version: "test" },
  Page: () => null,
  Document: ({
    children,
    onLoadSuccess,
  }: {
    children: React.ReactNode;
    onLoadSuccess: (value: { numPages: number }) => void;
  }) => {
    useEffect(() => onLoadSuccess({ numPages: 5 }), [onLoadSuccess]);
    return <>{children}</>;
  },
}));
it("shows remaining pages without an unavailable download action", () => {
  render(
    <PdfFilePreview
      data={{
        type: "pdf",
        filename: "five.pdf",
        fileSize: "",
        description: "",
        keywords: [],
        fileUrl: "blob:test",
        totalPages: 0,
      }}
    />,
  );
  expect(screen.getByText("+ 2 more pages")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /download/i }),
  ).not.toBeInTheDocument();
});
