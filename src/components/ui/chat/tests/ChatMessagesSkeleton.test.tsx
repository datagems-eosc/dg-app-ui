import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatMessagesSkeleton } from "../ChatMessagesSkeleton";

describe("ChatMessagesSkeleton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render skeleton structure with multiple elements", () => {
    const { container } = render(<ChatMessagesSkeleton />);

    const mainContainer = container.firstChild as HTMLElement;
    expect(mainContainer).toBeInTheDocument();
    expect(mainContainer.children.length).toBeGreaterThan(0);
  });
});
