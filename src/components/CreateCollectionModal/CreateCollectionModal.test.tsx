import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import CreateCollectionModal from "./CreateCollectionModal";

const refresh = vi.fn();
let collectionError: string | undefined;
let loading = false;
let emptyCollections = false;
vi.mock("@/contexts/CollectionsContext", () => ({
  useCollections: () => ({
    extraCollectionsError: collectionError,
    isLoadingExtraCollections: loading,
    extraCollections: emptyCollections
      ? []
      : [
          { id: "a", name: "Favorites" },
          { id: "b", name: "Other" },
        ],
    refreshExtraCollections: refresh,
    notifyCollectionModified: vi.fn(),
  }),
}));
vi.mock("@/hooks/useApi", () => ({ useApi: () => ({ hasToken: true }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Add dataset</button>
      <CreateCollectionModal
        isVisible={open}
        onClose={() => setOpen(false)}
        selectedDatasets={[]}
        datasets={[]}
      />
    </>
  );
}
it("lists all user collections and restores focus after Escape", () => {
  render(<Harness />);
  const trigger = screen.getByRole("button", { name: "Add dataset" });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog", { name: "Collections" });
  expect(dialog).toContainElement(document.activeElement as HTMLElement);
  expect(
    screen.getByRole("button", { name: "Close collections" }),
  ).toHaveFocus();
  expect(screen.getByText("Favorites")).toBeInTheDocument();
  expect(screen.getByText("Other")).toBeInTheDocument();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it("distinguishes loading and failed collection reads", () => {
  loading = true;
  const { rerender } = render(
    <CreateCollectionModal
      isVisible
      onClose={() => {}}
      selectedDatasets={[]}
      datasets={[]}
    />,
  );
  expect(screen.getByText("Loading collections...")).toBeInTheDocument();
  loading = false;
  collectionError = "We couldn't load your collections.";
  rerender(
    <CreateCollectionModal
      isVisible
      onClose={() => {}}
      selectedDatasets={[]}
      datasets={[]}
    />,
  );
  expect(screen.getByText(collectionError)).toBeInTheDocument();
  expect(
    screen.queryByText("No collections available."),
  ).not.toBeInTheDocument();
  collectionError = undefined;
});

it("shows an empty collection picker without invented entries", () => {
  emptyCollections = true;
  render(
    <CreateCollectionModal
      isVisible
      onClose={() => {}}
      selectedDatasets={[]}
      datasets={[]}
    />,
  );
  expect(screen.getByText("No collections available.")).toBeInTheDocument();
  expect(screen.queryByText("Favorites")).not.toBeInTheDocument();
  emptyCollections = false;
});
