import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { CollectionsProvider, useCollections } from "./CollectionsContext";

const query = vi.hoisted(() =>
  vi.fn(async (payload: { page: { Offset: number } }) => ({
    items:
      payload.page.Offset === 0
        ? Array.from({ length: 100 }, (_, i) => ({
            id: String(i),
            name: `Collection ${i}`,
          }))
        : [{ id: "last", name: "Last collection" }],
    count: 101,
  })),
);
vi.mock("@/hooks/useApi", () => ({
  useApi: () => ({
    hasToken: true,
    queryCollections: async () => ({ items: [] }),
    queryUserCollections: query,
  }),
}));
function List() {
  const { extraCollections, extraCollectionsError } = useCollections();
  return (
    <>
      {extraCollectionsError && <p>{extraCollectionsError}</p>}
      {extraCollections.map((c) => (
        <span key={c.id}>{c.name}</span>
      ))}
    </>
  );
}
it("loads the user's later collection pages instead of truncating at 100", async () => {
  render(
    <CollectionsProvider>
      <List />
    </CollectionsProvider>,
  );
  expect(await screen.findByText("Last collection")).toBeInTheDocument();
  expect(query).toHaveBeenCalledTimes(2);
});

beforeEach(() => vi.clearAllMocks());
it("does not report a failed later page as a complete collection list", async () => {
  query
    .mockResolvedValueOnce({
      items: [{ id: "first", name: "First" }],
      count: 2,
    })
    .mockRejectedValueOnce(new Error("offline"));
  render(
    <CollectionsProvider>
      <List />
    </CollectionsProvider>,
  );
  expect(
    await screen.findByText("We couldn't load your collections."),
  ).toBeInTheDocument();
  expect(screen.queryByText("First")).not.toBeInTheDocument();
});
it("does not loop forever when a collection page fails to advance", async () => {
  query
    .mockResolvedValueOnce({
      items: [{ id: "repeat", name: "Repeated" }],
      count: 2,
    })
    .mockResolvedValueOnce({
      items: [{ id: "repeat", name: "Repeated" }],
      count: 2,
    });
  render(
    <CollectionsProvider>
      <List />
    </CollectionsProvider>,
  );
  expect(
    await screen.findByText("We couldn't load your collections."),
  ).toBeInTheDocument();
  expect(query).toHaveBeenCalledTimes(2);
});
