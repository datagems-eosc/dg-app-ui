import assert from "node:assert/strict";
import test from "node:test";
import { render, screen } from "@testing-library/react";
import * as React from "react";
import { SmartSearchMatchItem } from "../src/components/ui/SmartSearchMatchItem";

test("renders number, description and match percentage", () => {
  render(
    <SmartSearchMatchItem
      number={0}
      description="Test description"
      matchPercentage="85"
    />,
  );

  // number is displayed as number + 1
  assert.ok(screen.getByText("1"));
  assert.ok(screen.getByText("Test description"));
  assert.ok(screen.getByText("85% match"));
});

test("renders correct number for arbitrary index", () => {
  render(
    <SmartSearchMatchItem number={4} description="Desc" matchPercentage="50" />,
  );
  assert.ok(screen.getByText("5"));
});

test("applies border-b when not last and not when isLast true", () => {
  const { container: c1 } = render(
    <SmartSearchMatchItem
      number={0}
      description="desc"
      matchPercentage="10"
      isLast={false}
    />,
  );
  const content1 = c1.querySelector(".flex-1");
  assert.ok(content1?.className.includes("border-b"));

  const { container: c2 } = render(
    <SmartSearchMatchItem
      number={0}
      description="desc"
      matchPercentage="10"
      isLast={true}
    />,
  );
  const content2 = c2.querySelector(".flex-1");
  assert.ok(content2 && !content2.className.includes("border-b"));
});

test("Chip text has flex-shrink-0 class present on wrapper", () => {
  const chip = screen.getByText("99% match");
  // chip is the text element; its parent should have the class
  const parent = chip.parentElement;
  assert.ok(parent?.className.includes("flex-shrink-0"));
});
