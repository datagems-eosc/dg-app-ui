import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/contexts/UserContext", () => ({
  useUser: () => ({ userData: { name: "Test" } }),
}));

vi.mock("@/contexts/CollectionsContext", () => ({
  useCollections: () => ({ apiCollections: [] }),
}));

vi.mock("@/components/DashboardLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/Tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import type React from "react";
import DashboardClient from "./DashboardClient";

describe("DashboardClient – UseCaseCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Browse Datasets button for Weather links to /use-case/weather/home", () => {
    render(<DashboardClient />);
    const links = screen.getAllByRole("link", { name: /browse datasets/i });
    const weatherLink = links.find((l) =>
      l.getAttribute("href")?.includes("weather/home"),
    );
    expect(weatherLink).toBeDefined();
  });

  it("Browse Datasets button for Math links to /use-case/math/home", () => {
    render(<DashboardClient />);
    const links = screen.getAllByRole("link", { name: /browse datasets/i });
    const mathLink = links.find((l) =>
      l.getAttribute("href")?.includes("math/home"),
    );
    expect(mathLink).toBeDefined();
  });

  it("Browse Datasets button for Lifelong Learning links to /use-case/lifelong-learning (no /home)", () => {
    render(<DashboardClient />);
    const links = screen.getAllByRole("link", { name: /browse datasets/i });
    const lifelongLink = links.find((l) => {
      const href = l.getAttribute("href") ?? "";
      return href.includes("lifelong-learning") && !href.includes("/home");
    });
    expect(lifelongLink).toBeDefined();
  });

  it("Browse Datasets button for Language links to /use-case/language/home", () => {
    render(<DashboardClient />);
    const links = screen.getAllByRole("link", { name: /browse datasets/i });
    const languageLink = links.find((l) =>
      l.getAttribute("href")?.includes("language/home"),
    );
    expect(languageLink).toBeDefined();
  });

  it("use-case tile card wrapper is not a link", () => {
    render(<DashboardClient />);
    const browseLinks = screen.getAllByRole("link", {
      name: /browse datasets/i,
    });
    expect(browseLinks).toHaveLength(4);
    for (const link of browseLinks) {
      expect(link.tagName.toLowerCase()).toBe("a");
      expect(link.closest("a[href]")).toBe(link);
    }
  });
});
