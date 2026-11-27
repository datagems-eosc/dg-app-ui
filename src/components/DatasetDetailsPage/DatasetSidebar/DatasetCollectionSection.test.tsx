import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubLayout } from "@/components/ui/__testing__/layout";
import DatasetCollectionSection from "./DatasetCollectionSection";

afterEach(() => vi.restoreAllMocks());

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
      expect(
        screen.getByRole("heading", { name: "Collections" }),
      ).toBeInTheDocument();
      if (displayCollection)
        expect(screen.getByText(displayCollection)).toBeInTheDocument();
      fireEvent.click(
        screen.getByRole("button", { name: "Add to collection" }),
      );
      expect(onAddClick).toHaveBeenCalledTimes(1);
    },
  );

  it("titles the section without an icon", () => {
    render(
      <DatasetCollectionSection collectionLabels={[]} onAddClick={vi.fn()} />,
    );
    expect(
      screen.getByRole("heading", { name: "Collections" }).querySelector("svg"),
    ).toBeNull();
  });
});

it("lists all dataset memberships and says so when there are none", () => {
  const { rerender } = render(
    <DatasetCollectionSection
      collectionLabels={["First", "Second"]}
      onAddClick={vi.fn()}
    />,
  );
  expect(
    within(screen.getByRole("list", { name: "Collections" }))
      .getAllByRole("listitem")
      .map((item) => item.textContent),
  ).toEqual(["First", "Second"]);
  rerender(
    <DatasetCollectionSection collectionLabels={[]} onAddClick={vi.fn()} />,
  );
  expect(screen.queryByRole("list")).not.toBeInTheDocument();
  expect(screen.getByText("Not in a collection")).toBeInTheDocument();
});

it("folds many collections to two lines with +N more", () => {
  stubLayout({ width: 280 });
  const names = Array.from({ length: 30 }, (_, i) => `Collection ${i + 1}`);
  render(
    <DatasetCollectionSection collectionLabels={names} onAddClick={vi.fn()} />,
  );
  const more = screen.getByRole("button", { name: /^\+\d+ more collections$/ });
  fireEvent.click(more);
  expect(
    within(screen.getByRole("list", { name: "Collections" })).getByText(
      "Collection 30",
    ),
  ).toBeInTheDocument();
});
