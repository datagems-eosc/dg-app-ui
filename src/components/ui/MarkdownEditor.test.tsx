import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarkdownEditor } from "./MarkdownEditor";

// The real editor loads through next/dynamic; under a full-suite run that can
// take longer than the default 1 s find timeout.
const EDITOR_LOAD_TIMEOUT_MS = 10_000;

describe("MarkdownEditor", () => {
  it("mounts the real editor with the placeholder and length limit", async () => {
    render(
      <MarkdownEditor
        value=""
        onChange={vi.fn()}
        placeholder="Describe the dataset"
        maxLength={3000}
      />,
    );

    const textarea = await screen.findByPlaceholderText(
      "Describe the dataset",
      undefined,
      { timeout: EDITOR_LOAD_TIMEOUT_MS },
    );
    expect(textarea).toHaveAttribute("maxLength", "3000");
  }, 15_000);
});
