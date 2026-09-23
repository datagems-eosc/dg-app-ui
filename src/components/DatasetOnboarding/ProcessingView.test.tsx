import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { MonitoringPhase } from "@/hooks/useDatasetOnboardingProcess";
import {
  DATASET_ID,
  ONBOARDING_DEFINITION_ID,
  PROCESS_INSTANCE_ID,
} from "@/lib/datasetOnboarding/fixtures";
import { asDatasetId } from "@/lib/datasetOnboarding/types";
import {
  buildFixtureView,
  configurationUnavailableView,
  dmmReadyWhileRunningView,
  failedView,
  forbiddenView,
  inconsistentView,
  LONG_DATASET_TITLE,
  loadingView,
  pendingRunningView,
  staleView,
  stepDetailsUnavailableView,
  succeededAccessUnknownView,
  succeededReadableView,
  succeededSharingFailedView,
  unknownStatusView,
  unmatchedStepsView,
} from "./fixtures";
import { ProcessingView } from "./ProcessingView";
import type { ProcessingReadPhase } from "./presentation";

const stageTexts = () =>
  screen.getAllByRole("listitem").map((item) => item.textContent ?? "");

const liveRegion = () => screen.getByRole("status").textContent ?? "";

describe("ProcessingView", () => {
  it("restates the accepted hook's read phase without drifting from it", () => {
    // The view depends on no hook, so the vocabulary is duplicated on purpose.
    // If the hook ever gains a phase, this stops compiling.
    const phases: ProcessingReadPhase[] = [
      "idle",
      "polling",
      "paused",
      "stopped",
    ] satisfies MonitoringPhase[];
    expect(phases).toHaveLength(4);
  });

  // --- aggregate states --------------------------------------------------

  it("reports a first read without inventing stage completion", () => {
    render(<ProcessingView view={loadingView} onCheckAgain={vi.fn()} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Dataset processing" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Checking processing status")).toBeInTheDocument();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    // The model permits no action before a first snapshot, and a healthy read
    // is not a reason to manufacture one.
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("shows the running aggregate with its stage states", () => {
    render(<ProcessingView view={pendingRunningView} />);

    expect(
      screen.getByText("Dataset processing is in progress"),
    ).toBeInTheDocument();
    expect(stageTexts()[0]).toBe("Load datasetCompleted");
    expect(stageTexts()[1]).toBe("Profile dataIn progress");
  });

  it("preserves earlier success and later not-run stages after a failure", () => {
    render(<ProcessingView view={failedView} onCheckAgain={vi.fn()} />);

    expect(
      screen.getByText("Dataset processing stopped before it finished"),
    ).toBeInTheDocument();
    expect(stageTexts()).toEqual([
      "Load datasetCompleted",
      "Profile dataFailed",
      "Create linking reportNot run",
      "Package datasetNot run",
      "Register for recommendationsNot reported",
      "Prepare cross-dataset discoveryNot reported",
    ]);
  });

  it("offers no rerun, cancel or stage execution after a failure", () => {
    render(
      <ProcessingView
        view={failedView}
        onCheckAgain={vi.fn()}
        onRetryConfiguration={vi.fn()}
        onViewDataset={vi.fn()}
      />,
    );

    const labels = screen
      .getAllByRole("button")
      .map((button) => button.textContent ?? "");
    expect(labels).toEqual(["Check again"]);
    for (const forbidden of ["Retry", "Rerun", "Restart", "Cancel", "Resume"]) {
      expect(
        screen.queryByRole("button", { name: new RegExp(forbidden, "i") }),
      ).toBeNull();
    }
  });

  it("points at administrative help without inventing a contact", () => {
    const { container } = render(<ProcessingView view={failedView} />);

    expect(
      screen.getByText(/ask a DataGEMS administrator to look into it/i),
    ).toBeInTheDocument();
    expect(container.querySelectorAll("a")).toHaveLength(0);
    expect(container.textContent).not.toMatch(/mailto:|@[\w.-]+\.\w+/);
  });

  it("reports completion of processing without claiming availability", () => {
    const { container } = render(
      <ProcessingView view={succeededReadableView} />,
    );

    expect(screen.getByText("Dataset processing complete")).toBeInTheDocument();
    expect(container.textContent).toMatch(/configured processing only/i);
    for (const claim of [
      "public",
      "searchable",
      "downloadable",
      "published",
      "available to everyone",
    ]) {
      expect(container.textContent?.toLowerCase()).not.toContain(claim);
    }
  });

  it("does not claim a per-stage report when step details are absent", () => {
    // A Succeeded aggregate with no `steps` key at all — the censored or
    // unprojected shape. Composed here rather than in `fixtures.ts` because the
    // accepted payloads only ever pair an absent step list with a *running*
    // aggregate, and this correction may not add a fixture scenario.
    const aggregateOnly = buildFixtureView({
      process: {
        id: PROCESS_INSTANCE_ID,
        processId: ONBOARDING_DEFINITION_ID,
        status: 2,
        dataset: { id: DATASET_ID },
      },
    });

    const { container } = render(<ProcessingView view={aggregateOnly} />);

    expect(screen.getByText("Dataset processing complete")).toBeInTheDocument();
    expect(
      screen.getByText(/The process reports that processing is complete/i),
    ).toBeInTheDocument();
    // Nothing reported per stage, so nothing may be claimed per stage.
    expect(container.textContent).not.toMatch(
      /every configured stage reported success/i,
    );
    expect(
      screen.getByText("Stage details are not available"),
    ).toBeInTheDocument();
  });

  it("words the availability notice independently of the process outcome", () => {
    const expected = /Access to this dataset has not yet been confirmed/i;

    const { container, unmount } = render(
      <ProcessingView view={inconsistentView} />,
    );
    expect(
      screen.getByText("Processing details are inconsistent"),
    ).toBeInTheDocument();
    expect(screen.getByText(expected)).toBeInTheDocument();
    // An access notice must not quietly resolve a contradictory outcome.
    expect(container.textContent).not.toMatch(/processing finished/i);
    unmount();

    // The same sentence, unchanged, alongside a clean completion.
    render(<ProcessingView view={succeededAccessUnknownView} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("makes no claim about where the unmatched-step list sits", () => {
    const { container } = render(<ProcessingView view={unmatchedStepsView} />);

    expect(
      screen.getByText(/their position in the run is not confirmed/i),
    ).toBeInTheDocument();
    // The list renders above the notices, so "below" would be wrong.
    expect(container.textContent).not.toMatch(/separately below/i);
  });

  it("keeps completion and unconfirmed access as separate persistent messages", () => {
    render(<ProcessingView view={succeededAccessUnknownView} />);

    expect(screen.getByText("Dataset processing complete")).toBeInTheDocument();
    expect(
      screen.getByText("We have not confirmed access to the dataset"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Sharing has not been confirmed"),
    ).toBeInTheDocument();
  });

  it("keeps a failed sharing outcome separate from the processing outcome", () => {
    render(<ProcessingView view={succeededSharingFailedView} />);

    expect(screen.getByText("Dataset processing complete")).toBeInTheDocument();
    expect(screen.getByText("Sharing did not complete")).toBeInTheDocument();
    expect(
      screen.getByText(/Nothing here retries sharing/i),
    ).toBeInTheDocument();
  });

  it("shows an inconsistency as a caution rather than a clean success", () => {
    const { container } = render(<ProcessingView view={inconsistentView} />);

    expect(
      screen.getByText("Processing details are inconsistent"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Dataset processing complete")).toBeNull();
    expect(container.querySelector(".bg-emerald-50")).toBeNull();
  });

  it("does not promote a DMM-ready dataset over an unfinished process", () => {
    render(<ProcessingView view={dmmReadyWhileRunningView} />);

    expect(
      screen.getByText("Dataset processing is in progress"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Dataset metadata is ready, processing is not finished"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Dataset processing complete")).toBeNull();
  });

  it("does not read missing step details as every stage succeeding", () => {
    render(<ProcessingView view={stepDetailsUnavailableView} />);

    expect(
      screen.getByText("Stage details are not available"),
    ).toBeInTheDocument();
    for (const text of stageTexts()) {
      expect(text).toContain("Not reported");
    }
    expect(stageTexts().join(" ")).not.toContain("Completed");
  });

  it("lists steps outside the configuration without inventing an order", () => {
    render(<ProcessingView view={unmatchedStepsView} />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Other reported steps" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/without a position in the sequence/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: "Other reported steps" }),
    ).toBeInTheDocument();
  });

  it("keeps an unrecognised aggregate status honest", () => {
    render(<ProcessingView view={unknownStatusView} />);
    expect(
      screen.getByText("The processing status is not recognised"),
    ).toBeInTheDocument();
  });

  it("never states a percentage or a time estimate", () => {
    for (const view of [
      pendingRunningView,
      failedView,
      succeededReadableView,
      staleView,
    ]) {
      const { container, unmount } = render(<ProcessingView view={view} />);
      expect(container.textContent).not.toMatch(/\d+\s*%/);
      expect(container.textContent).not.toMatch(
        /minutes? (left|remaining)|estimated time|will (finish|complete) (in|by)/i,
      );
      unmount();
    }
  });

  // --- read health -------------------------------------------------------

  it("distinguishes a retrying stale read from a stopped one", () => {
    const { rerender } = render(
      <ProcessingView view={staleView} read={{ phase: "polling" }} />,
    );
    expect(
      screen.getByText("Updates are temporarily unavailable"),
    ).toBeInTheDocument();
    expect(screen.getByText(/still trying to reconnect/i)).toBeInTheDocument();

    rerender(<ProcessingView view={staleView} read={{ phase: "stopped" }} />);
    // Promising automatic updates after monitoring stopped would be a lie.
    expect(screen.queryByText(/still trying to reconnect/i)).toBeNull();
    expect(
      screen.getByText(/Automatic updates have stopped/i),
    ).toBeInTheDocument();
    // The snapshot itself survives either way.
    expect(stageTexts()[0]).toBe("Load datasetCompleted");
  });

  it("replaces an indefinite spinner with the reason the read stopped", () => {
    const { container } = render(
      <ProcessingView
        view={loadingView}
        read={{
          phase: "stopped",
          reference: "valid",
          failure: { kind: "unavailable-reference", httpStatus: 404 },
        }}
        onCheckAgain={vi.fn()}
      />,
    );

    expect(
      screen.getByText("We could not retrieve this process"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Checking processing status")).toBeNull();
    expect(container.querySelector(".animate-spin")).toBeNull();
    // 404 is not deletion, and we must not say it is.
    expect(container.textContent).toMatch(
      /does not mean the process was deleted/i,
    );
  });

  it("keeps the read action for a valid but unresolvable reference", async () => {
    const onCheckAgain = vi.fn();
    const user = userEvent.setup();
    render(
      <ProcessingView
        view={loadingView}
        read={{
          reference: "valid",
          failure: { kind: "unavailable-reference", httpStatus: 404 },
        }}
        onCheckAgain={onCheckAgain}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Check again" }));
    expect(onCheckAgain).toHaveBeenCalledTimes(1);
  });

  it("hides the read action for an invalid reference", () => {
    render(
      <ProcessingView
        view={loadingView}
        read={{ reference: "invalid" }}
        onCheckAgain={vi.fn()}
        onViewDataset={vi.fn()}
      />,
    );

    expect(
      screen.getByText("We could not retrieve this process"),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("uses sanitized session copy and reads nothing without a session", () => {
    const { container } = render(
      <ProcessingView
        view={loadingView}
        read={{ session: "unavailable" }}
        onCheckAgain={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Processing status cannot be read for this session"),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(container.textContent).not.toMatch(/failed|deleted/i);
  });

  it("does not repeat a refused read as both headline and notice", () => {
    render(
      <ProcessingView
        view={forbiddenView}
        read={{ failure: { kind: "forbidden", httpStatus: 403 } }}
      />,
    );

    expect(
      screen.getAllByText("This session cannot read the processing status"),
    ).toHaveLength(1);
  });

  // --- actions -----------------------------------------------------------

  it("navigates with the model's validated dataset id and nothing else", async () => {
    const onViewDataset = vi.fn();
    const user = userEvent.setup();
    render(
      <ProcessingView
        view={succeededReadableView}
        onViewDataset={onViewDataset}
      />,
    );

    await user.click(screen.getByRole("button", { name: "View dataset" }));
    expect(onViewDataset).toHaveBeenCalledTimes(1);
    expect(onViewDataset).toHaveBeenCalledWith(asDatasetId(DATASET_ID));
  });

  it("offers no dataset action while readability is unconfirmed", () => {
    render(
      <ProcessingView
        view={succeededAccessUnknownView}
        onViewDataset={vi.fn()}
        onCheckAgain={vi.fn()}
      />,
    );

    // The id is present in the snapshot; that establishes nothing.
    expect(succeededAccessUnknownView.datasetId).toBeDefined();
    expect(screen.queryByRole("button", { name: "View dataset" })).toBeNull();
  });

  it("renders no control when its callback is absent", () => {
    render(<ProcessingView view={succeededReadableView} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("keeps the configuration re-read separate from the status re-read", async () => {
    const onCheckAgain = vi.fn();
    const onRetryConfiguration = vi.fn();
    const user = userEvent.setup();
    render(
      <ProcessingView
        view={configurationUnavailableView}
        onCheckAgain={onCheckAgain}
        onRetryConfiguration={onRetryConfiguration}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Retry loading stages" }),
    );
    expect(onRetryConfiguration).toHaveBeenCalledTimes(1);
    expect(onCheckAgain).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Check again" }));
    expect(onCheckAgain).toHaveBeenCalledTimes(1);
    expect(onRetryConfiguration).toHaveBeenCalledTimes(1);
  });

  it("hides the configuration re-read when no callback is supplied", () => {
    render(
      <ProcessingView
        view={configurationUnavailableView}
        onCheckAgain={vi.fn()}
      />,
    );
    expect(
      screen.getByText("The stage configuration could not be loaded"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Retry loading stages" }),
    ).toBeNull();
  });

  it("renders every control as an enabled, typed button", () => {
    render(
      <ProcessingView
        view={configurationUnavailableView}
        onCheckAgain={vi.fn()}
        onRetryConfiguration={vi.fn()}
      />,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      // An unavailable action is absent, never a disabled control the user has
      // to reason about; and no button may submit a surrounding form.
      expect(button).toBeEnabled();
      expect(button).toHaveAttribute("type", "button");
    }
  });

  it("reaches both read actions by keyboard with Enter and Space", async () => {
    const onCheckAgain = vi.fn();
    const onRetryConfiguration = vi.fn();
    const user = userEvent.setup();
    render(
      <ProcessingView
        view={configurationUnavailableView}
        onCheckAgain={onCheckAgain}
        onRetryConfiguration={onRetryConfiguration}
      />,
    );

    const retry = screen.getByRole("button", { name: "Retry loading stages" });
    const check = screen.getByRole("button", { name: "Check again" });

    await user.tab();
    expect(retry).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onRetryConfiguration).toHaveBeenCalledTimes(1);

    await user.tab();
    expect(check).toHaveFocus();
    await user.keyboard(" ");
    expect(onCheckAgain).toHaveBeenCalledTimes(1);
  });

  // --- recovery marker ---------------------------------------------------

  it("shows the recovery marker as a reminder, not a grant or a retry", () => {
    render(
      <ProcessingView
        view={succeededReadableView}
        sharingNeedsReconciliation
        onCheckAgain={vi.fn()}
      />,
    );

    expect(
      screen.getByText("An earlier sharing result still needs checking"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/nothing is re-applied from here/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /shar/i })).toBeNull();
  });

  // --- announcements and focus ------------------------------------------

  it("stays silent on mount and on an equivalent poll", () => {
    const { rerender } = render(<ProcessingView view={pendingRunningView} />);
    expect(liveRegion()).toBe("");

    // A new object with the same meaning is what every poll produces.
    rerender(<ProcessingView view={{ ...pendingRunningView }} />);
    expect(liveRegion()).toBe("");
  });

  it("announces a meaningful transition once, without listing stages", () => {
    const { rerender } = render(<ProcessingView view={pendingRunningView} />);

    rerender(<ProcessingView view={succeededReadableView} />);
    expect(liveRegion()).toBe("Dataset processing complete.");
    expect(liveRegion()).not.toContain("Load dataset");

    rerender(<ProcessingView view={{ ...succeededReadableView }} />);
    expect(liveRegion()).toBe("Dataset processing complete.");
  });

  it("announces a change in read health", () => {
    const { rerender } = render(
      <ProcessingView view={pendingRunningView} read={{ phase: "polling" }} />,
    );
    rerender(<ProcessingView view={staleView} read={{ phase: "polling" }} />);

    expect(liveRegion()).toMatch(/Dataset processing is in progress\./);
    expect(liveRegion()).toMatch(/last known status is shown/i);
  });

  it("does not move focus when a poll updates the view", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ProcessingView view={pendingRunningView} onCheckAgain={vi.fn()} />,
    );

    const check = screen.getByRole("button", { name: "Check again" });
    await user.click(check);
    expect(check).toHaveFocus();

    rerender(
      <ProcessingView view={succeededReadableView} onCheckAgain={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Check again" })).toHaveFocus();
  });

  it("exposes the heading as a focus target without entering the tab order", () => {
    // A passive seam for task 5.3: the page moves focus here after route
    // navigation. The view itself still never focuses anything.
    render(<ProcessingView view={pendingRunningView} onCheckAgain={vi.fn()} />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveAttribute("tabindex", "-1");
    expect(document.body).toHaveFocus();

    heading.focus();
    expect(heading).toHaveFocus();
  });

  it("does not take focus on mount", () => {
    render(<ProcessingView view={pendingRunningView} onCheckAgain={vi.fn()} />);
    expect(document.body).toHaveFocus();
  });

  // --- title -------------------------------------------------------------

  it("keeps custom typography classes alongside colour classes", () => {
    // The shared `cn` helper runs tailwind-merge, which drops this project's
    // custom `text-body-*` / `text-H2-*` classes when a text colour is merged
    // in the same call. These components join instead of merging; this guards
    // that the typography actually reaches the markup.
    const { container } = render(
      <ProcessingView view={succeededReadableView} />,
    );

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.className).toContain("text-H2-32-semibold");
    expect(heading.className).toContain("text-gray-750");
    // Tailwind generates no variant for a hand-written class, so a `sm:`
    // prefix on one compiles to nothing. The unprefixed class already carries
    // its own breakpoint.
    expect(heading.className).not.toMatch(/\bsm:text-/);

    const title = screen.getByText("Dataset processing complete");
    expect(title.className).toContain("text-body-16-semibold");
    expect(title.className).toContain("text-emerald-800");

    const stageLabel = screen.getAllByRole("listitem")[0]?.firstElementChild;
    expect(stageLabel?.firstElementChild?.className).toContain(
      "text-body-16-medium",
    );
    expect(container.querySelector(".text-body-14-regular")).not.toBeNull();
  });

  it("renders a supplied title as wrapping text below the heading", () => {
    const { container } = render(
      <ProcessingView
        view={pendingRunningView}
        datasetTitle={LONG_DATASET_TITLE}
      />,
    );

    const title = screen.getByText(LONG_DATASET_TITLE);
    expect(title.className).toContain("break-words");
    expect(title.className).not.toContain("truncate");
    expect(container.textContent).toContain(LONG_DATASET_TITLE);
  });

  it("renders without a title at all", () => {
    render(<ProcessingView view={pendingRunningView} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Dataset processing" }),
    ).toBeInTheDocument();
  });
});
