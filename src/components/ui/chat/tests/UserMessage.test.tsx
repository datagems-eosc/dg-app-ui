import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UserMessage } from "../UserMessage";

vi.mock("../../Avatar", () => ({
  Avatar: () => <div data-testid="avatar">Avatar</div>,
}));

describe("UserMessage", () => {
  it("renders the message content", () => {
    render(<UserMessage content="Hello, world!" />);

    expect(screen.getByText("Hello, world!")).toBeInTheDocument();
  });

  it("renders long content in full", () => {
    const longMessage =
      "This is a very long message that should be displayed correctly in the component without breaking the layout or causing any issues with rendering.";

    render(<UserMessage content={longMessage} />);

    expect(screen.getByText(longMessage)).toBeInTheDocument();
  });

  it("shows the question without the user's avatar", () => {
    render(<UserMessage content="Test message" />);

    expect(screen.queryByTestId("avatar")).not.toBeInTheDocument();
  });
});
