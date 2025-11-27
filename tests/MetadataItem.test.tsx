import assert from "node:assert/strict";
import test from "node:test";
import { render, screen } from "@testing-library/react";
import * as React from "react";
import MetadataItem from "../src/components/ui/datasets/MetadataItem";

function TestIcon() {
  return <svg data-testid="test-icon" />;
}

test("renders icon, label and value", () => {
  const { container } = render(
    <MetadataItem icon={<TestIcon />} label="My Label" value="My Value" />,
  );

  assert.ok(screen.getByText("My Label"));
  assert.ok(screen.getByText("My Value"));
  assert.ok(screen.getByTestId("test-icon"));

  // icon wrapper classes
  const iconWrapper = container.querySelector(".w-5.h-5");
  assert.ok(iconWrapper, "icon wrapper with classes w-5 h-5 should exist");
});

test("applies correct text classes", () => {
  render(<MetadataItem icon={<TestIcon />} label="Label" value="Value" />);

  const labelEl = screen.getByText("Label");
  const valueEl = screen.getByText("Value");

  assert.ok(labelEl.className.includes("text-descriptions-12-medium"));
  assert.ok(valueEl.className.includes("text-descriptions-12-regular"));
});

test("renders long label and value without truncation in DOM", () => {
  const longLabel = "L".repeat(200);
  const longValue = "V".repeat(300);
  render(
    <MetadataItem icon={<TestIcon />} label={longLabel} value={longValue} />,
  );

  assert.ok(screen.getByText(longLabel));
  assert.ok(screen.getByText(longValue));
});

test("renders empty value as empty text node", () => {
  const { container } = render(
    <MetadataItem icon={<TestIcon />} label="Only Label" value="" />,
  );

  // find label
  assert.ok(screen.getByText("Only Label"));

  // find value container by class and ensure its textContent is empty or whitespace
  const valueDiv = container.querySelector(
    ".text-descriptions-12-regular",
  ) as HTMLElement | null;
  assert.ok(valueDiv);
  const text = valueDiv.textContent?.trim() || "";
  assert.equal(text, "");
});
