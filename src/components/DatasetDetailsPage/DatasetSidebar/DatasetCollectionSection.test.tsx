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
          displayCollection={displayCollection}
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
