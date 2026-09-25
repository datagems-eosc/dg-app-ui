import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  asStepDefinitionId,
  asStepInstanceId,
  type StageState,
  type StageView,
} from "@/lib/datasetOnboarding/types";
import {
  duplicateConfigurationView,
  failedView,
  pendingRunningView,
  testAndUnknownKindView,
} from "./fixtures";
import { StageList } from "./StageList";

const rowTexts = () =>
  screen.getAllByRole("listitem").map((item) => item.textContent ?? "");

const stage = (state: StageState, index = 0): StageView => ({
  stepDefinitionId: asStepDefinitionId(`definition-${index}`),
  stepInstanceId: asStepInstanceId(`instance-${index}`),
  state,
});

describe("StageList", () => {
  it("renders configured stages in the model's order with readable labels", () => {
    render(<StageList stages={pendingRunningView.stages} />);

    expect(rowTexts()).toEqual([
      "Load datasetCompleted",
      "Profile dataIn progress",
      "Create linking reportWaiting to start",
      "Package datasetWaiting to start",
      "Register for recommendationsWaiting to start",
      "Prepare cross-dataset discoveryWaiting to start",
    ]);
  });

  it("uses an ordered list for configured stages", () => {
    const { container } = render(
      <StageList stages={pendingRunningView.stages} />,
    );
    expect(container.querySelector("ol")).not.toBeNull();
    expect(container.querySelector("ul")).toBeNull();
  });

  it("keeps earlier success, the failure and later not-run stages distinct", () => {
    render(<StageList stages={failedView.stages} />);

    expect(rowTexts()).toEqual([
      "Load datasetCompleted",
      "Profile dataFailed",
      "Create linking reportNot run",
      "Package datasetNot run",
      "Register for recommendationsNo update available",
      "Prepare cross-dataset discoveryNo update available",
    ]);
  });

  it("distinguishes a test definition kind and refuses to name an unknown one", () => {
    render(<StageList stages={testAndUnknownKindView.stages} />);

    expect(rowTexts()).toEqual([
      "Package dataset (test)Completed",
      "Additional processing stepIn progress",
    ]);
  });

  it("renders every configured row when the configuration repeats an entry", () => {
    // Both entries share a definition id *and* an order, so neither is a usable
    // key on its own. Nothing may be dropped or collapsed.
    expect(duplicateConfigurationView.stages).toHaveLength(2);
    render(<StageList stages={duplicateConfigurationView.stages} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("renders unmatched steps as an unordered list without a sequence", () => {
    const { container } = render(
      <StageList
        stages={[stage("running", 1), stage("succeeded", 2)]}
        variant="unmatched"
      />,
    );
    expect(container.querySelector("ul")).not.toBeNull();
    expect(container.querySelector("ol")).toBeNull();
    // No configuration means no kind, so no stage may be given a name.
    expect(rowTexts()).toEqual([
      "Additional processing stepIn progress",
      "Additional processing stepCompleted",
    ]);
  });

  it("states every stage state as text, not only as colour or an icon", () => {
    const states: StageState[] = [
      "pending",
      "running",
      "succeeded",
      "failed",
      "not-run",
      "not-reported",
      "unknown",
    ];
    render(
      <StageList stages={states.map((state, index) => stage(state, index))} />,
    );

    expect(rowTexts()).toEqual([
      "Additional processing stepWaiting to start",
      "Additional processing stepIn progress",
      "Additional processing stepCompleted",
      "Additional processing stepFailed",
      "Additional processing stepNot run",
      "Additional processing stepNo update available",
      "Additional processing stepStatus unavailable",
    ]);
  });

  it("pins the darker text tokens the contrast pass was measured against", () => {
    // A token lock, not a contrast proof. It records which classes the measured
    // pass in `evidence/correction-01/contrast-results.json` was taken against,
    // so a later colour change cannot quietly drop below the threshold without
    // this failing. A class string can never establish a ratio on its own.
    const expected: ReadonlyArray<[StageState, string]> = [
      ["succeeded", "text-emerald-700"],
      ["failed", "text-red-600"],
      ["running", "text-gray-750"],
      ["pending", "text-gray-750"],
      ["not-run", "text-gray-650"],
      ["not-reported", "text-gray-650"],
      ["unknown", "text-gray-650"],
    ];

    for (const [index, [state, token]] of expected.entries()) {
      const { container, unmount } = render(
        <StageList stages={[stage(state, index)]} />,
      );
      const [label, status] = Array.from(container.querySelectorAll("li p"));
      expect(status?.className, state).toContain(token);
      // A stage that has not run recedes, but never below secondary text.
      expect(label?.className, state).toContain(
        state === "not-run" || state === "not-reported" || state === "unknown"
          ? "text-gray-650"
          : "text-gray-750",
      );
      expect(label?.className, state).not.toContain("text-slate-450");
      unmount();
    }
  });

  it("hides stage icons from assistive technology", () => {
    const { container } = render(
      <StageList stages={pendingRunningView.stages} />,
    );
    const icons = container.querySelectorAll("svg");
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("lets an activity indicator stand down under reduced motion", () => {
    const { container } = render(<StageList stages={[stage("running")]} />);
    const spinner = container.querySelector("svg.animate-spin");
    expect(spinner?.getAttribute("class")).toContain(
      "motion-reduce:animate-none",
    );
  });

  it("offers no control of any kind", () => {
    render(<StageList stages={failedView.stages} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("labels the list with a supplied heading id", () => {
    render(
      <>
        <h2 id="stages-heading">Processing stages</h2>
        <StageList
          stages={pendingRunningView.stages}
          labelledBy="stages-heading"
        />
      </>,
    );
    const list = screen.getByRole("list", { name: "Processing stages" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(6);
  });
});
