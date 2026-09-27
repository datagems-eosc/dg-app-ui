import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FileUploadCard } from "./FileUploadCard";

const failedFile = (error?: string) => ({
  name: "readings.csv",
  size: 2048,
  type: "text/csv",
  status: "error" as const,
  progress: 0,
  ...(error === undefined ? {} : { error }),
});

describe("FileUploadCard", () => {
  it("shows safe failure guidance instead of the transfer's own error text", () => {
    const { container } = render(
      <FileUploadCard
        file={failedFile("ECONNRESET upstream 10.0.3.7: No path returned")}
        onRemove={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("Upload failed")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Retry the upload, or remove this file if you don't need it.",
      ),
    ).toBeInTheDocument();
    // Neither visible nor hidden in a tooltip.
    expect(container.textContent).not.toMatch(/ECONNRESET|No path returned/);
    for (const element of container.querySelectorAll("[title]")) {
      expect(element.getAttribute("title")).not.toMatch(
        /ECONNRESET|No path returned/,
      );
    }
    // File identity and size stay visible.
    expect(screen.getByText("readings.csv")).toBeInTheDocument();
    expect(screen.getByText("2 KB")).toBeInTheDocument();
  });

  it("wraps the guidance below the file summary rather than truncating it", () => {
    render(
      <FileUploadCard
        file={failedFile()}
        onRemove={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    const guidance = screen.getByText(/^Retry the upload/);
    expect(guidance.tagName).toBe("P");
    expect(guidance.className).toContain("break-words");
    expect(guidance.className).not.toContain("truncate");
    // Typography survives alongside the colour class.
    expect(guidance.className).toContain("text-body-14-regular");
    expect(screen.getByText("Upload failed").className).toContain(
      "text-body-14-regular",
    );
  });

  it("points only at removal when no retry is available", () => {
    render(<FileUploadCard file={failedFile()} onRemove={vi.fn()} />);

    expect(
      screen.getByText("Remove this file, then add it again."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry upload" })).toBeNull();
    expect(screen.queryByText(/Retry the upload/)).toBeNull();
  });

  it("keeps the existing controls wired to their original callbacks", async () => {
    const onRemove = vi.fn();
    const onRetry = vi.fn();
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    const user = userEvent.setup();
    const { container } = render(
      <form>
        <FileUploadCard
          file={failedFile()}
          onRemove={onRemove}
          onRetry={onRetry}
        />
      </form>,
    );
    container.querySelector("form")?.addEventListener("submit", onSubmit);

    await user.click(screen.getByRole("button", { name: "Retry upload" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRemove).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Remove file" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);

    // The recovery controls the guidance points to never submit the form
    // they sit in.
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows no failure guidance while uploading or after success", () => {
    const { rerender } = render(
      <FileUploadCard
        file={{ ...failedFile(), status: "uploading", progress: 40 }}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText("Uploading…")).toBeInTheDocument();
    expect(screen.queryByText(/Retry the upload|Remove this file/)).toBeNull();

    rerender(
      <FileUploadCard
        file={{ ...failedFile(), status: "success", progress: 100 }}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText("File uploaded")).toBeInTheDocument();
    expect(screen.queryByText(/Retry the upload|Remove this file/)).toBeNull();
  });
});
