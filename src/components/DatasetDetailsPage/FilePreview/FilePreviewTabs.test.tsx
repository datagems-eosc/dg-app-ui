import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { expect, it } from "vitest";
import type { FilePreviewTab } from "@/types/filePreview";
import FilePreviewTabs from "./FilePreviewTabs";

function Tabs() {
  const [tab, setTab] = useState<FilePreviewTab>("preview");
  return <FilePreviewTabs activeTab={tab} onTabChange={setTab} />;
}
it("links keyboard tabs to panels and wraps focus", () => {
  render(<Tabs />);
  const tabs = screen.getAllByRole("tab");
  expect(screen.getByRole("tablist")).toBeInTheDocument();
  expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  tabs[0].focus();
  fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
  expect(tabs[1]).toHaveFocus();
  expect(tabs[1]).toHaveAttribute("aria-selected", "true");
  fireEvent.keyDown(tabs[1], { key: "End" });
  expect(tabs[2]).toHaveFocus();
  fireEvent.keyDown(tabs[2], { key: "ArrowRight" });
  expect(tabs[0]).toHaveFocus();
  fireEvent.keyDown(tabs[0], { key: "ArrowLeft" });
  expect(tabs[2]).toHaveFocus();
  fireEvent.keyDown(tabs[2], { key: "Home" });
  expect(tabs[0]).toHaveFocus();
  expect(tabs[0]).toHaveAttribute("aria-controls");
});
