import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DatasetCollectionSection from "./DatasetCollectionSection";

describe("DatasetCollectionSection", () => {
  it.each(["Meteo", ""])(
    "keeps a working Add action with collection label %j",
    (displayCollection) => {
      const onAddClick = vi.fn();
      render(
        <DatasetCollectionSection
          collectionLabels={displayCollection ? [displayCollection] : []}
          onAddClick={onAddClick}
        />,
      );
      expect(screen.getByText("Collection")).toBeInTheDocument();
      if (displayCollection)
        expect(screen.getByText(displayCollection)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Add" }));
      expect(onAddClick).toHaveBeenCalledTimes(1);
    },
  );
});
it("shows all dataset memberships without inventing a badge when empty", () => {
  const { rerender, container } = render(
    <DatasetCollectionSection
      collectionLabels={["First", "Second"]}
      onAddClick={vi.fn()}
    />,
  );
  expect(screen.getByText("First")).toBeInTheDocument();
  expect(screen.getByText("Second")).toBeInTheDocument();
  rerender(
    <DatasetCollectionSection collectionLabels={[]} onAddClick={vi.fn()} />,
  );
  expect(container.textContent).toBe("CollectionAdd");
});
