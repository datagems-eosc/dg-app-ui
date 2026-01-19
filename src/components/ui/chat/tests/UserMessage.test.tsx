import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserMessage } from "../UserMessage";

const mockUseSession = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}));

vi.mock("../Avatar", () => ({
  Avatar: ({
    name,
    email,
  }: {
    name?: string;
    email?: string;
    src?: string;
    size?: string;
    className?: string;
  }) => (
    <div data-testid="avatar" data-name={name} data-email={email}>
      Avatar
    </div>
  ),
}));

describe("UserMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render message content", () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          name: "Test User",
          email: "test@example.com",
        },
      },
    });

    render(<UserMessage content="Hello, world!" />);

    expect(screen.getByText("Hello, world!")).toBeInTheDocument();
  });

  it("should render Avatar component", () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          name: "Test User",
          email: "test@example.com",
        },
      },
    });

    render(<UserMessage content="Test message" />);

    const avatar = screen.getByTestId("avatar");
    expect(avatar).toBeInTheDocument();
  });

  it("should pass user name to Avatar when session has name", () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          name: "John Doe",
          email: "john@example.com",
        },
      },
    });

    render(<UserMessage content="Test message" />);

    const avatar = screen.getByTestId("avatar");
    expect(avatar).toHaveAttribute("data-name", "John Doe");
  });

  it("should pass user email to Avatar when session has email", () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          name: "John Doe",
          email: "john@example.com",
        },
      },
    });

    render(<UserMessage content="Test message" />);

    const avatar = screen.getByTestId("avatar");
    expect(avatar).toHaveAttribute("data-email", "john@example.com");
  });

  it("should handle session with partial user data", () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          name: "John",
        },
      },
    });

    render(<UserMessage content="Test message" />);

    const avatar = screen.getByTestId("avatar");
    expect(avatar).toHaveAttribute("data-name", "John");
    expect(avatar).toHaveAttribute("data-email", "");
  });

  it("should render long message content", () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          name: "Test User",
          email: "test@example.com",
        },
      },
    });

    const longMessage =
      "This is a very long message that should be displayed correctly in the component without breaking the layout or causing any issues with rendering.";

    render(<UserMessage content={longMessage} />);

    expect(screen.getByText(longMessage)).toBeInTheDocument();
  });
});
