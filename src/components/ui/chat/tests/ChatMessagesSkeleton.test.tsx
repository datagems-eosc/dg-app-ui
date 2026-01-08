import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatMessagesSkeleton } from "../ChatMessagesSkeleton";

describe("ChatMessagesSkeleton", () => {
  it("should render skeleton structure with multiple elements", () => {
    const { container } = render(<ChatMessagesSkeleton />);

    const mainContainer = container.firstChild as HTMLElement;
    expect(mainContainer).toBeInTheDocument();
    expect(mainContainer.children.length).toBeGreaterThan(0);
  });
});
