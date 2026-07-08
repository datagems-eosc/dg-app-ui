import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

import type React from "react";
import MathHomePage from "./page";

describe("MathHomePage – updated copy", () => {
  it("renders updated heading and subheading", () => {
    render(<MathHomePage />);
    expect(
      screen.getByRole("heading", { name: "Explore math data on MathE" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Solve complex math problems with AI support"),
    ).toBeInTheDocument();
  });

  it("renders updated CTA box title and description", () => {
    render(<MathHomePage />);
    expect(
      screen.getByRole("heading", { name: "Open MathE platform" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Get access to reliable math resources on MathE/),
    ).toBeInTheDocument();
  });

  it("renders Go to MathE button with unchanged href", () => {
    render(<MathHomePage />);
    const link = screen.getByRole("link", { name: /go to mathe/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/use-case/math/chat");
  });

  it("renders external platform note below button", () => {
    render(<MathHomePage />);
    expect(
      screen.getByText(
        "Clicking this button takes you to the external platform.",
      ),
    ).toBeInTheDocument();
  });

  it("renders updated How it works steps", () => {
    render(<MathHomePage />);
    expect(screen.getByText("1. Browse")).toBeInTheDocument();
    expect(screen.getByText("Browse MathE")).toBeInTheDocument();
    expect(screen.getByText("2. Learn")).toBeInTheDocument();
    expect(screen.getByText("Study the Material")).toBeInTheDocument();
    expect(screen.getByText("3. Solve")).toBeInTheDocument();
    expect(screen.getByText("Practice & Solve")).toBeInTheDocument();
  });
});
