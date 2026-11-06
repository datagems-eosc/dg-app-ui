import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureFlagsProvider } from "@/contexts/FeatureFlagsContext";
import { SidebarContent } from "./SidebarContent";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("./chat/ChatHistoryList", () => ({
  ChatHistoryList: () => null,
}));

const defaultProps = {
  isSidebarOpen: true,
  isMobile: false,
  session: null,
  conversations: [],
  onMobileSidebarClose: vi.fn(),
  onDeleteConversation: vi.fn(),
  onConversationUpdate: vi.fn(),
  setConversations: vi.fn(),
};

const renderSidebar = () =>
  render(
    <FeatureFlagsProvider>
      <SidebarContent {...defaultProps} />
    </FeatureFlagsProvider>,
  );

describe("SidebarContent – Home entry", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.__env = { DEPLOYMENT_ENV: "staging" };
  });

  it("labels the dashboard link Home and keeps its route", () => {
    renderSidebar();
    const home = screen.getByRole("link", { name: "Home" });
    expect(home).toHaveAttribute("href", "/dashboard");
    expect(screen.queryByRole("link", { name: "Dashboard" })).toBeNull();
  });

  it("labels the browse link Datasets and keeps its route", () => {
    renderSidebar();
    const datasets = screen.getByRole("link", { name: "Datasets" });
    expect(datasets).toHaveAttribute("href", "/browse");
    expect(screen.queryByRole("link", { name: "Browse" })).toBeNull();
  });

  it("labels the general chat link Chat and keeps its route", () => {
    renderSidebar();
    const chat = screen.getByRole("link", { name: "Chat" });
    expect(chat).toHaveAttribute("href", "/chat");
    expect(screen.queryByRole("link", { name: /ask a question/i })).toBeNull();
  });
});

describe("SidebarContent – generalChat flag (Hide general chat)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("hides Chat when flag is ON (true)", () => {
    window.__env = { DEPLOYMENT_ENV: "playground" };
    renderSidebar();
    expect(screen.queryByRole("link", { name: "Chat" })).toBeNull();
  });

  it("shows Chat when flag is OFF (false)", () => {
    window.__env = { DEPLOYMENT_ENV: "staging" };
    renderSidebar();
    expect(screen.getByRole("link", { name: "Chat" })).toBeInTheDocument();
  });

  it("positions Chat between Datasets and Favourites", () => {
    window.__env = { DEPLOYMENT_ENV: "staging" };
    renderSidebar();

    const links = screen.getAllByRole("link");
    const labels = links.map((l) => l.textContent?.trim());
    const browseIndex = labels.findIndex((l) => l === "Datasets");
    const askIndex = labels.findIndex((l) => l === "Chat");
    const favouritesIndex = labels.findIndex((l) => l === "Favourites");

    expect(browseIndex).toBeLessThan(askIndex);
    expect(askIndex).toBeLessThan(favouritesIndex);
  });
});
