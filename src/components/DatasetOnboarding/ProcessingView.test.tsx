import { render, screen, within } from "@testing-library/react";
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
  historicalSharingFailedView,
  historicalSharingUnconfirmedView,
  inconsistentView,
  LONG_DATASET_TITLE,
  loadingView,
  pendingRunningView,
  staleView,
  stepDetailsUnavailableView,
  succeededAccessDeniedView,
  succeededAccessUnknownView,
  succeededReadableView,
  unknownStatusView,
  unmatchedStepsView,
} from "./fixtures";
import { ProcessingView } from "./ProcessingView";
import type { ProcessingReadPhase } from "./presentation";

const stageTexts = () =>
  screen.getAllByRole("listitem").map((item) => item.textContent ?? "");

const liveRegion = () => screen.getByRole("status").textContent ?? "";

const stepsPanel = () =>
  screen.getByRole("region", { name: "Processing steps" });

const refreshButton = () =>
  screen.getByRole("button", { name: "Refresh status" });

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
    expect(screen.getByText("Checking progress…")).toBeInTheDocument();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    // The model permits no action before a first snapshot, and a healthy read
    // is not a reason to manufacture one.
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("shows the running aggregate with its stage states", () => {
    render(<ProcessingView view={pendingRunningView} />);

    expect(screen.getByText("Processing your dataset")).toBeInTheDocument();
    expect(
      screen.getByText("You can leave this page and return to check progress."),
    ).toBeInTheDocument();
    expect(stageTexts()[0]).toBe("Load datasetCompleted");
    expect(stageTexts()[1]).toBe("Profile dataIn progress");
  });

  it("preserves earlier success and later not-run stages after a failure", () => {
    render(<ProcessingView view={failedView} onCheckAgain={vi.fn()} />);

    expect(screen.getByText("Processing couldn't finish")).toBeInTheDocument();
    expect(stageTexts()).toEqual([
      "Load datasetCompleted",
      "Profile dataFailed",
      "Create linking reportNot run",
      "Package datasetNot run",
      "Register for recommendationsNo update available",
      "Prepare cross-dataset discoveryNo update available",
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

    const names = screen
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label") ?? button.textContent);
    expect(names).toEqual(["Refresh status"]);
    for (const forbidden of ["Retry", "Rerun", "Restart", "Cancel", "Resume"]) {
      expect(
        screen.queryByRole("button", { name: new RegExp(forbidden, "i") }),
      ).toBeNull();
    }
  });

  it("points at administrative help without inventing a contact", () => {
    const { container } = render(<ProcessingView view={failedView} />);

    expect(
      screen.getByText("Ask a DataGEMS administrator to check this dataset."),
    ).toBeInTheDocument();
    expect(container.querySelectorAll("a")).toHaveLength(0);
    expect(container.textContent).not.toMatch(/mailto:|@[\w.-]+\.\w+/);
  });

  it("reports completion of processing without claiming availability", () => {
    const { container } = render(
      <ProcessingView view={succeededReadableView} />,
    );

    expect(screen.getByText("Processing complete")).toBeInTheDocument();
    // The caveat that used to be repeated here is gone; the claims it guarded
    // against must still be absent.
    expect(container.textContent).not.toMatch(/configured processing only/i);
    for (const claim of [
      "public",
      "searchable",
      "downloadable",
      "published",
      "ready to download",
      "available to everyone",
    ]) {
      expect(container.textContent?.toLowerCase()).not.toContain(claim);
    }
  });

  it("does not claim a per-stage report for an aggregate-only completion", () => {
    // A Succeeded aggregate with no `steps` key at all — the censored or
    // unprojected shape. Composed here rather than in `fixtures.ts` because the
    // accepted payloads only ever pair an absent step list with a *running*
    // aggregate.
    const aggregateOnly = buildFixtureView({
      process: {
        id: PROCESS_INSTANCE_ID,
        processId: ONBOARDING_DEFINITION_ID,
        status: 2,
        dataset: { id: DATASET_ID },
      },
    });

    const { container } = render(<ProcessingView view={aggregateOnly} />);

    expect(screen.getByText("Processing complete")).toBeInTheDocument();
    expect(
      within(stepsPanel()).getByText(
        "Individual step details aren't available.",
      ),
    ).toBeInTheDocument();
    // Nothing reported per stage, so nothing may be claimed per stage.
    expect(stageTexts().join(" ")).not.toContain("Completed");
    expect(container.textContent).not.toMatch(
      /every (configured )?(stage|step) (reported success|completed)/i,
    );
  });

  it("renders a contradictory outcome once, without resolving it", () => {
    const { container } = render(<ProcessingView view={inconsistentView} />);

    expect(
      screen.getAllByText("We couldn't confirm that processing completed"),
    ).toHaveLength(1);
    expect(screen.queryByText("Processing complete")).toBeNull();
    expect(container.querySelector(".bg-emerald-50")).toBeNull();
    // The access message accompanying it must not resolve the contradiction.
    expect(
      screen.getByText(/We couldn't confirm whether you can open this dataset/),
    ).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/processing finished/i);
  });

  it("keeps an unrecognised aggregate status honest, and says it once", () => {
    const { container } = render(<ProcessingView view={unknownStatusView} />);
    expect(
      screen.getAllByText("Processing status is unavailable"),
    ).toHaveLength(1);
    expect(container.textContent).not.toMatch(/raw outcome|outside the range/i);
  });

  it("does not promote a DMM-ready dataset over an unfinished process", () => {
    render(<ProcessingView view={dmmReadyWhileRunningView} />);

    expect(screen.getByText("Processing your dataset")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Dataset details are available. Processing is still underway.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Processing complete")).toBeNull();
  });

  it("does not read missing step details as every stage succeeding", () => {
    render(<ProcessingView view={stepDetailsUnavailableView} />);

    expect(
      screen.getByText("Individual step details aren't available."),
    ).toBeInTheDocument();
    for (const text of stageTexts()) {
      expect(text).toContain("No update available");
    }
    expect(stageTexts().join(" ")).not.toContain("Completed");
  });

  it("lists steps outside the configuration without inventing an order", () => {
    const { container } = render(<ProcessingView view={unmatchedStepsView} />);

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Additional processing steps",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: "Additional processing steps" }).tagName,
    ).toBe("UL");
    // Said once, as the section helper, not again as a banner.
    expect(
      screen.getAllByText("The order of these steps isn't available."),
    ).toHaveLength(1);
    expect(container.textContent).not.toMatch(/separately below/i);
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

  // --- access and sharing -----------------------------------------------

  it("shows no sharing message for a current private upload", () => {
    const { container, unmount } = render(
      <ProcessingView view={succeededAccessUnknownView} />,
    );
    expect(container.textContent).not.toMatch(/shar/i);
    unmount();

    render(<ProcessingView view={succeededReadableView} />);
    expect(screen.getByText("Processing complete")).toBeInTheDocument();
    expect(screen.queryByText(/shar/i)).toBeNull();
  });

  it("places unconfirmed readability beside a local Check again", async () => {
    const onCheckAgain = vi.fn();
    const onViewDataset = vi.fn();
    const user = userEvent.setup();
    render(
      <ProcessingView
        view={succeededAccessUnknownView}
        onCheckAgain={onCheckAgain}
        onViewDataset={onViewDataset}
      />,
    );

    expect(screen.getByText("Processing complete")).toBeInTheDocument();
    expect(
      screen.getByText(
        "We couldn't confirm whether you can open this dataset yet.",
      ),
    ).toBeInTheDocument();
    // The id is present in the snapshot; that establishes nothing.
    expect(succeededAccessUnknownView.datasetId).toBeDefined();
    expect(screen.queryByRole("button", { name: "View dataset" })).toBeNull();

    // The local action is the same combined read as the header control.
    await user.click(screen.getByRole("button", { name: "Check again" }));
    expect(onCheckAgain).toHaveBeenCalledTimes(1);
    expect(onViewDataset).not.toHaveBeenCalled();
  });

  it("says the access check is running only while it actually runs", () => {
    const { rerender } = render(
      <ProcessingView
        view={succeededAccessUnknownView}
        read={{ phase: "stopped", checkingAccess: true }}
        onCheckAgain={vi.fn()}
      />,
    );
    expect(screen.getByText("Checking dataset access…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check again" })).toBeNull();

    rerender(
      <ProcessingView
        view={succeededAccessUnknownView}
        read={{ phase: "stopped", checkingAccess: false }}
        onCheckAgain={vi.fn()}
      />,
    );
    expect(screen.queryByText("Checking dataset access…")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Check again" }),
    ).toBeInTheDocument();
  });

  it("explains a refused dataset read without offering navigation", () => {
    render(
      <ProcessingView
        view={succeededAccessDeniedView}
        onViewDataset={vi.fn()}
        onCheckAgain={vi.fn()}
      />,
    );

    expect(screen.getByText("Processing complete")).toBeInTheDocument();
    expect(
      screen.getByText(/You can't open this dataset right now\./),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View dataset" })).toBeNull();
  });

  it("shows one sharing message for an earlier attempt, never a retry", () => {
    // The saved record and the model's notice describe the same fact.
    render(
      <ProcessingView
        view={historicalSharingUnconfirmedView}
        sharingNeedsReconciliation
        onCheckAgain={vi.fn()}
      />,
    );

    expect(
      screen.getAllByText("Earlier sharing changes couldn't be confirmed"),
    ).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /shar/i })).toBeNull();
  });

  it("keeps the saved-record reminder for an earlier attempt on its own", () => {
    render(
      <ProcessingView
        view={succeededReadableView}
        sharingNeedsReconciliation
      />,
    );
    expect(
      screen.getByText("Earlier sharing changes couldn't be confirmed"),
    ).toBeInTheDocument();
  });

  it("keeps a failed earlier sharing outcome separate from processing", () => {
    const { container } = render(
      <ProcessingView view={historicalSharingFailedView} />,
    );

    expect(screen.getByText("Processing complete")).toBeInTheDocument();
    expect(
      screen.getByText("Sharing changes weren't completed"),
    ).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/rolled back|retr(y|ies)/i);
  });

  // --- automatic updates ------------------------------------------------

  it("says updates are automatic between scheduled reads, without spinning", () => {
    render(
      <ProcessingView
        view={pendingRunningView}
        read={{ phase: "polling" }}
        onCheckAgain={vi.fn()}
      />,
    );

    expect(
      within(stepsPanel()).getByText("Updates automatically"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Updating…")).toBeNull();
    // Polling is a schedule, not a request: the refresh icon stays still.
    expect(refreshButton().querySelector(".animate-spin")).toBeNull();
  });

  it("shows Updating only while a current read is in flight", () => {
    const { rerender } = render(
      <ProcessingView
        view={pendingRunningView}
        read={{ phase: "polling", reading: true }}
        onCheckAgain={vi.fn()}
      />,
    );
    expect(within(stepsPanel()).getByText("Updating…")).toBeInTheDocument();
    expect(refreshButton().querySelector(".animate-spin")).not.toBeNull();
    expect(
      refreshButton().querySelector(".motion-reduce\\:animate-none"),
    ).not.toBeNull();

    // An access read alone keeps it, so overlapping reads read as one update.
    rerender(
      <ProcessingView
        view={pendingRunningView}
        read={{ phase: "polling", reading: false, checkingAccess: true }}
        onCheckAgain={vi.fn()}
      />,
    );
    expect(screen.getByText("Updating…")).toBeInTheDocument();

    rerender(
      <ProcessingView
        view={pendingRunningView}
        read={{ phase: "polling", reading: false, checkingAccess: false }}
        onCheckAgain={vi.fn()}
      />,
    );
    expect(screen.queryByText("Updating…")).toBeNull();
    expect(screen.getByText("Updates automatically")).toBeInTheDocument();
  });

  it("promises no automatic update while paused or after a normal finish", () => {
    const { rerender } = render(
      <ProcessingView
        view={pendingRunningView}
        read={{ phase: "paused" }}
        onCheckAgain={vi.fn()}
      />,
    );
    expect(screen.getByText("Updates paused")).toBeInTheDocument();
    expect(screen.queryByText(/automatically|Trying again/)).toBeNull();

    // A terminal stop is the normal end, not an alarm.
    rerender(
      <ProcessingView
        view={failedView}
        read={{ phase: "stopped" }}
        onCheckAgain={vi.fn()}
      />,
    );
    expect(
      screen.queryByText(/Updates automatically|Updates paused|stopped/i),
    ).toBeNull();
    expect(refreshButton()).toBeEnabled();
  });

  it("distinguishes a retrying stale read from a stopped one", () => {
    const { rerender } = render(
      <ProcessingView view={staleView} read={{ phase: "polling" }} />,
    );
    expect(
      screen.getByText("Progress updates are unavailable"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Couldn't update. Trying again…"),
    ).toBeInTheDocument();

    rerender(<ProcessingView view={staleView} read={{ phase: "stopped" }} />);
    // Promising automatic updates after monitoring stopped would be untrue.
    expect(screen.queryByText(/Trying again/)).toBeNull();
    expect(screen.getByText("Automatic updates stopped")).toBeInTheDocument();
    expect(
      screen.getByText(/Select Refresh status to try again/),
    ).toBeInTheDocument();
    // The snapshot itself survives either way, and no spinner claims progress.
    expect(stageTexts()[0]).toBe("Load datasetCompleted");
  });

  it("keeps the header refresh focusable and usable during a read", async () => {
    const onCheckAgain = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <ProcessingView
        view={pendingRunningView}
        read={{ phase: "polling" }}
        onCheckAgain={onCheckAgain}
      />,
    );

    await user.tab();
    expect(refreshButton()).toHaveFocus();
    expect(refreshButton()).toHaveAttribute("type", "button");
    // The adjacent status is its description, so it is heard on focus rather
    // than announced on every request.
    const describedBy = refreshButton().getAttribute("aria-describedby");
    expect(describedBy).not.toBeNull();
    expect(document.getElementById(describedBy ?? "")?.textContent).toBe(
      "Updates automatically",
    );

    rerender(
      <ProcessingView
        view={pendingRunningView}
        read={{ phase: "polling", reading: true }}
        onCheckAgain={onCheckAgain}
      />,
    );
    // Focus does not move, and the control is still a real button: the hooks
    // coalesce a click with the read in flight.
    expect(refreshButton()).toHaveFocus();
    expect(refreshButton()).toBeEnabled();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onCheckAgain).toHaveBeenCalledTimes(2);
    expect(liveRegion()).toBe("");
  });

  // --- read health -------------------------------------------------------

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
      screen.getByText("We couldn't open this progress page"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Checking progress…")).toBeNull();
    expect(container.querySelector(".animate-spin")).toBeNull();
    // 404 is not deletion, and we must not say it is.
    expect(container.textContent).not.toMatch(/delet/i);
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

    await user.click(refreshButton());
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
      screen.getByText("This progress link is invalid"),
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
      screen.getByText("Please sign in again to view progress"),
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
      screen.getAllByText("You can't view this processing status right now"),
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
        read={{ phase: "polling" }}
        onCheckAgain={onCheckAgain}
        onRetryConfiguration={onRetryConfiguration}
      />,
    );

    expect(
      within(stepsPanel()).getByText("We couldn't load the processing steps."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reload steps" }));
    expect(onRetryConfiguration).toHaveBeenCalledTimes(1);
    expect(onCheckAgain).not.toHaveBeenCalled();

    await user.click(refreshButton());
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
      screen.getByText("We couldn't load the processing steps."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reload steps" })).toBeNull();
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

    const refresh = refreshButton();
    const reload = screen.getByRole("button", { name: "Reload steps" });

    await user.tab();
    expect(refresh).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onCheckAgain).toHaveBeenCalledTimes(1);

    await user.tab();
    expect(reload).toHaveFocus();
    await user.keyboard(" ");
    expect(onRetryConfiguration).toHaveBeenCalledTimes(1);
  });

  // --- announcements and focus ------------------------------------------

  it("stays silent on mount and on an equivalent poll", () => {
    const { rerender } = render(<ProcessingView view={pendingRunningView} />);
    expect(liveRegion()).toBe("");

    // A new object with the same meaning is what every poll produces, and a
    // background request is not a transition either.
    rerender(
      <ProcessingView
        view={{ ...pendingRunningView }}
        read={{ phase: "polling", reading: true }}
      />,
    );
    expect(liveRegion()).toBe("");
  });

  it("announces a meaningful transition once, without listing stages", () => {
    const { rerender } = render(<ProcessingView view={pendingRunningView} />);

    rerender(<ProcessingView view={succeededReadableView} />);
    expect(liveRegion()).toBe("Processing complete.");
    expect(liveRegion()).not.toContain("Load dataset");

    rerender(<ProcessingView view={{ ...succeededReadableView }} />);
    expect(liveRegion()).toBe("Processing complete.");
  });

  it("does not announce a first read as both checking and failed", () => {
    const { rerender } = render(<ProcessingView view={loadingView} />);
    rerender(
      <ProcessingView
        view={buildFixtureView({ process: null, connection: "unavailable" })}
      />,
    );
    expect(liveRegion()).toBe("We couldn't check progress.");
  });

  it("announces a change in read health", () => {
    const { rerender } = render(
      <ProcessingView view={pendingRunningView} read={{ phase: "polling" }} />,
    );
    rerender(<ProcessingView view={staleView} read={{ phase: "polling" }} />);

    expect(liveRegion()).toMatch(/^Processing your dataset\./);
    expect(liveRegion()).toMatch(/Showing the last available update/);
  });

  it("keeps refresh focused until processing completes, then hides it", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ProcessingView view={pendingRunningView} onCheckAgain={vi.fn()} />,
    );

    await user.click(refreshButton());
    expect(refreshButton()).toHaveFocus();

    rerender(<ProcessingView view={staleView} onCheckAgain={vi.fn()} />);
    expect(refreshButton()).toHaveFocus();

    rerender(
      <ProcessingView view={succeededReadableView} onCheckAgain={vi.fn()} />,
    );
    expect(screen.queryByRole("button", { name: "Refresh status" })).toBeNull();
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

    const title = screen.getByText("Processing complete");
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
