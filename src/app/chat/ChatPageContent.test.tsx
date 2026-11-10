import { render } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let params: Record<string, string> = {};
let searchParams = new URLSearchParams();
const chatProps = vi.fn();
const api = {
  hasToken: false,
  queryDatasets: vi.fn().mockResolvedValue({ items: [] }),
};

vi.mock("next/navigation", () => ({
  useParams: () => params,
  useSearchParams: () => searchParams,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/hooks/useApi", () => ({ useApi: () => api }));
vi.mock("@/components/Chat", () => ({
  default: (props: Record<string, unknown>) => {
    chatProps(props);
    return null;
  },
}));
vi.mock("@/components/DashboardLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/ProtectedPage", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ProtectedPage: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

import { handoffStore } from "@/lib/intentRouting/handoffStore";
import { ChatPageContent } from "./ChatPageContent";

const handOff = (intent: "question" | "dataset_search" = "question") => {
  const id = handoffStore.create({
    originalQuery: "What is the mean temperature in Athens?",
    retrievalQuery: "Athens temperature",
    intent,
    chosenBy: "classifier",
  });
  searchParams = new URLSearchParams({ handoff: id });
  return id;
};

const lastChatProps = () => chatProps.mock.calls.at(-1)?.[0] ?? {};

describe("ChatPageContent – Home handoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    params = {};
    searchParams = new URLSearchParams();
  });

  it("passes a pending question handoff to a new chat with no selected datasets", () => {
    const id = handOff();
    render(<ChatPageContent />);
    expect(lastChatProps().initialHandoff).toEqual({
      id,
      originalQuery: "What is the mean temperature in Athens?",
    });
    expect(lastChatProps().selectedDatasets).toEqual([]);
  });

  it("has no handoff on direct entry", () => {
    render(<ChatPageContent />);
    expect(lastChatProps().initialHandoff).toBeUndefined();
  });

  it("ignores a dataset-search handoff", () => {
    handOff("dataset_search");
    render(<ChatPageContent />);
    expect(lastChatProps().initialHandoff).toBeUndefined();
  });

  it("ignores a handoff on an existing conversation", () => {
    handOff();
    params = { conversationId: "conv-1" };
    render(<ChatPageContent />);
    expect(lastChatProps().initialHandoff).toBeUndefined();
  });

  it("ignores an unknown handoff id", () => {
    searchParams = new URLSearchParams({ handoff: "unknown" });
    render(<ChatPageContent />);
    expect(lastChatProps().initialHandoff).toBeUndefined();
  });
});

describe("ChatPageContent – dataset details", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    params = {};
    searchParams = new URLSearchParams();
    api.hasToken = true;
  });

  it("does not load a catalogue page for a new chat", async () => {
    render(<ChatPageContent />);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(api.queryDatasets).not.toHaveBeenCalled();
  });
});
