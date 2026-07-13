import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureFlagsProvider } from "@/contexts/FeatureFlagsContext";
import { FEATURE_FLAGS_STORAGE_KEY } from "@/lib/featureFlags/storage";
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

  it("hides Ask a Question by default on production", () => {
    window.__env = { DEPLOYMENT_ENV: "production" };
    renderSidebar();
    expect(screen.queryByRole("link", { name: /ask a question/i })).toBeNull();
  });

  it("shows Ask a Question by default on playground and staging (kept for testing)", () => {
    window.__env = { DEPLOYMENT_ENV: "playground" };
    const { unmount } = renderSidebar();
    expect(
      screen.getByRole("link", { name: /ask a question/i }),
    ).toBeInTheDocument();
    unmount();

    window.__env = { DEPLOYMENT_ENV: "staging" };
    renderSidebar();
    expect(
      screen.getByRole("link", { name: /ask a question/i }),
    ).toBeInTheDocument();
  });

  it("shows Ask a Question when the flag is overridden OFF (false)", () => {
    window.__env = { DEPLOYMENT_ENV: "production" };
    window.localStorage.setItem(
      FEATURE_FLAGS_STORAGE_KEY,
      JSON.stringify({ generalChat: false }),
    );
    renderSidebar();
    expect(
      screen.getByRole("link", { name: /ask a question/i }),
    ).toBeInTheDocument();
  });

  it("positions Ask a Question between Browse and Favourites when shown", () => {
    window.__env = { DEPLOYMENT_ENV: "production" };
    window.localStorage.setItem(
      FEATURE_FLAGS_STORAGE_KEY,
      JSON.stringify({ generalChat: false }),
    );
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
