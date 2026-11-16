import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { CollectionsProvider } from "@/contexts/CollectionsContext";
import CreateCollectionModal from "./CreateCollectionModal";

const fixture = vi.hoisted(() => ({
  query: vi.fn(),
  add: vi.fn(),
  principal: "alice",
  hasToken: true,
}));
vi.mock("@/hooks/useApi", () => ({
  useApi: () => ({
    hasToken: fixture.hasToken,
    queryCollections: async () => ({ items: [] }),
    queryUserCollections: fixture.query,
    addDatasetToUserCollection: fixture.add,
    datasetPermissions: {
      scope: {
        principalId: fixture.principal,
        gatewayOrigin: "https://gateway.test",
      },
    },
  }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/datasets/one",
}));
function Modal({
  visible = true,
  dataset = "one",
}: {
  visible?: boolean;
  dataset?: string;
}) {
  return (
    <CollectionsProvider>
      <CreateCollectionModal
        isVisible={visible}
        onClose={() => {}}
        selectedDatasets={[dataset]}
        datasets={[]}
      />
    </CollectionsProvider>
  );
}
beforeEach(() => {
  fixture.principal = "alice";
  fixture.hasToken = true;
  fixture.add.mockReset();
  fixture.query.mockReset().mockResolvedValue({
    items: [
      { id: "favorites", name: "Favorites", datasetCount: 0 },
      { id: "other", name: "Other" },
    ],
    count: 2,
  });
});
it("loads a lightweight picker without refreshing the sidebar on open or tab changes", async () => {
  const { rerender } = render(<Modal visible={false} />);
  await waitFor(() => expect(fixture.query).toHaveBeenCalledTimes(1));
  rerender(<Modal />);
  expect(await screen.findByText("Favorites")).toBeInTheDocument();
  expect(screen.queryByText(/items$/)).not.toBeInTheDocument();
  expect(fixture.query).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("button", { name: "Create New" }));
  fireEvent.click(screen.getByRole("button", { name: "Add to existing" }));
  await screen.findByText("Favorites");
  expect(fixture.query).toHaveBeenCalledTimes(3);
  expect(
    fixture.query.mock.calls
      .slice(1)
      .every(
        ([p]) =>
          JSON.stringify(p.project.fields) === JSON.stringify(["id", "name"]),
      ),
  ).toBe(true);
});
it.each(["dataset", "account"])(
  "invalidates a selected collection when %s scope changes",
  async (change) => {
    const { rerender } = render(<Modal />);
    await screen.findByText("Favorites");
    fireEvent.click(screen.getByText("Favorites"));
    expect(
      screen.getByRole("button", { name: "Add to Collection" }),
    ).toBeEnabled();
    if (change === "account") fixture.principal = "bob";
    rerender(<Modal dataset={change === "dataset" ? "two" : "one"} />);
    expect(
      screen.getByRole("button", { name: "Add to Collection" }),
    ).toBeDisabled();
    await screen.findByText("Favorites");
    expect(
      screen.getByRole("button", { name: "Add to Collection" }),
    ).toBeDisabled();
  },
);
it("shows a retryable failure without an empty state", async () => {
  fixture.query.mockRejectedValueOnce(new Error("offline"));
  render(<Modal />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "We couldn't load your collections.",
  );
  expect(
    screen.queryByText("No collections available."),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByText("Favorites");
});
it("preserves focus restoration and collection mutations", async () => {
  const onClose = vi.fn();
  const { rerender } = render(
    <>
      <button>Open collections</button>
      <CollectionsProvider>
        <CreateCollectionModal
          isVisible={false}
          onClose={onClose}
          selectedDatasets={["one"]}
          datasets={[]}
        />
      </CollectionsProvider>
    </>,
  );
  const trigger = screen.getByRole("button", { name: "Open collections" });
  trigger.focus();
  rerender(
    <>
      <button>Open collections</button>
      <CollectionsProvider>
        <CreateCollectionModal
          isVisible
          onClose={onClose}
          selectedDatasets={["one"]}
          datasets={[]}
        />
      </CollectionsProvider>
    </>,
  );
  await screen.findByText("Favorites");
  expect(
    screen.getByRole("button", { name: "Close collections" }),
  ).toHaveFocus();
  fireEvent.click(screen.getByText("Favorites"));
  fireEvent.click(screen.getByRole("button", { name: "Add to Collection" }));
  await waitFor(() =>
    expect(fixture.add).toHaveBeenCalledWith("favorites", "one"),
  );
  expect(onClose).toHaveBeenCalled();
  rerender(
    <>
      <button>Open collections</button>
      <CollectionsProvider>
        <CreateCollectionModal
          isVisible={false}
          onClose={onClose}
          selectedDatasets={["one"]}
          datasets={[]}
        />
      </CollectionsProvider>
    </>,
  );
  expect(trigger).toHaveFocus();
});

it("does not claim collections are empty before authenticated loading can start", () => {
  fixture.hasToken = false;
  render(<Modal />);
  expect(screen.getByText("Loading collections...")).toBeInTheDocument();
  expect(
    screen.queryByText("No collections available."),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Add to Collection" }),
  ).toBeDisabled();
});
