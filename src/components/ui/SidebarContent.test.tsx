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

describe("SidebarContent – generalChat flag (Hide general chat)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("hides Ask a Question when flag is ON (true)", () => {
    window.__env = { DEPLOYMENT_ENV: "playground" };
    renderSidebar();
    expect(screen.queryByRole("link", { name: /ask a question/i })).toBeNull();
  });

  it("shows Ask a Question when flag is OFF (false)", () => {
    window.__env = { DEPLOYMENT_ENV: "staging" };
    renderSidebar();
    expect(
      screen.getByRole("link", { name: /ask a question/i }),
    ).toBeInTheDocument();
  });

  it("positions Ask a Question between Browse and Favourites", () => {
    window.__env = { DEPLOYMENT_ENV: "staging" };
    renderSidebar();

    const links = screen.getAllByRole("link");
    const labels = links.map((l) => l.textContent?.trim());
    const browseIndex = labels.findIndex((l) => l === "Browse");
    const askIndex = labels.findIndex((l) => /ask a question/i.test(l ?? ""));
    const favouritesIndex = labels.findIndex((l) => l === "Favourites");

    expect(browseIndex).toBeLessThan(askIndex);
    expect(askIndex).toBeLessThan(favouritesIndex);
  });
});
