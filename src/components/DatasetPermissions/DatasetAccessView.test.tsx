import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DATASET_ROLE_MAP } from "@/config/contextGrantRoles";
import {
  EVERYONE_GROUP_ID,
  RESEARCH_GROUP_ID,
  SECOND_GROUP_ID,
} from "@/lib/datasetPermissions/fixtures";
import { DatasetAccessView } from "./DatasetAccessView";
import {
  AMBIGUOUS_GROUPS,
  baseProps,
  DATASET_NAME,
  DISCOVERED_GROUPS,
  DUPLICATE_EVERYONE_GROUP,
  EVERYONE_AMBIGUOUS,
  KNOWN_GRANTS,
  LONG_GROUP_NAME,
  operation,
  READ_ONLY_CAPABILITIES,
  RECIPIENTS_UNSUPPORTED,
  UNKNOWN_CAPABILITIES,
} from "./fixtures";
import type { DatasetAccessViewProps } from "./types";

const renderView = (overrides: Partial<DatasetAccessViewProps> = {}) => {
  const props = baseProps(overrides);
  const result = render(<DatasetAccessView {...props} />);
  return {
    ...result,
    props,
    rerenderWith: (next: Partial<DatasetAccessViewProps>) =>
      result.rerender(
        <DatasetAccessView {...baseProps({ ...overrides, ...next })} />,
      ),
  };
};

/** Switches are named "<group> — <role>", so this is the whole addressing scheme. */
const switchFor = (group: string, role: string) =>
  screen.getByRole("switch", { name: `${group} — ${role}` });

const RESEARCH = "Baltic Modelling Team";

describe("DatasetAccessView — displayed states", () => {
  it("shows a loading state and no controls while reads are outstanding", () => {
    renderView({ reads: { status: "loading" } });
    expect(screen.getByText(/loading group permissions/i)).toBeInTheDocument();
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
  });

  it("renders a switch per role for each discovered group once reads settle", () => {
    renderView();
    expect(screen.getAllByRole("switch")).toHaveLength(
      DISCOVERED_GROUPS.length * 6,
    );
    expect(switchFor(RESEARCH, "Browse")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(switchFor(RESEARCH, "Edit")).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("explains a denied recipient read and offers no switches for it", () => {
    renderView({
      reads: {
        status: "settled",
        groups: { kind: "read", groups: DISCOVERED_GROUPS },
        recipients: { kind: "unknown", reason: "not-supported" },
      },
      capabilities: RECIPIENTS_UNSUPPORTED,
    });
    expect(
      screen.getByText(/can't view existing permissions/i),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
  });

  it("explains a failed recipient read without claiming nobody has access", () => {
    renderView({
      reads: {
        status: "settled",
        groups: { kind: "read", groups: DISCOVERED_GROUPS },
        recipients: { kind: "failed" },
      },
    });
    expect(
      screen.getByText(/couldn't load existing permissions/i),
    ).toBeVisible();
    // Missing information is not an empty result.
    expect(screen.queryByText(/nobody|no one|no permissions/i)).toBeNull();
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
  });

  it("explains a failed group read", () => {
    renderView({
      reads: {
        status: "settled",
        groups: { kind: "failed" },
        recipients: { kind: "known", grants: [] },
      },
    });
    expect(screen.getByText(/couldn't load the groups/i)).toBeInTheDocument();
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
  });

  it("distinguishes an empty discovery from an absence of access", () => {
    renderView({
      reads: {
        status: "settled",
        groups: { kind: "read", groups: [] },
        recipients: { kind: "known", grants: [] },
      },
    });
    expect(
      screen.getByText("No groups are available to your account."),
    ).toBeInTheDocument();
    // The empty discovery is still framed as the caller's view, not the world.
    expect(
      screen.getByText(/other users or groups may also have access/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/nobody|no one/i)).toBeNull();
  });

  it("does not claim the group list enumerates everyone with access", () => {
    renderView();
    expect(
      screen.getByText(/other users or groups may also have access/i),
    ).toBeInTheDocument();
  });

  it("words an unavailable capability differently from an unknown one", () => {
    const { unmount } = renderView({ capabilities: READ_ONLY_CAPABILITIES });
    expect(
      screen.getByText(/don't have permission to grant access/i),
    ).toBeInTheDocument();
    unmount();

    renderView({ capabilities: UNKNOWN_CAPABILITIES });
    expect(
      screen.getByText(/couldn't check whether you can grant access/i),
    ).toBeInTheDocument();
  });

  it("shows the journal-unavailable state and disables every control", () => {
    renderView({ storageAvailable: false });
    expect(
      screen.getByText(/unavailable in this browser tab/i),
    ).toBeInTheDocument();
    for (const control of screen.getAllByRole("switch")) {
      expect(control).toBeDisabled();
    }
  });

  it("shows pending, acknowledged, refused and uncertain side by side", () => {
    renderView({
      operations: [
        operation({
          operationId: "a",
          role: DATASET_ROLE_MAP.edit,
          status: "pending",
        }),
        operation({
          operationId: "b",
          role: DATASET_ROLE_MAP.search,
          status: "acknowledged",
        }),
        operation({
          operationId: "c",
          role: DATASET_ROLE_MAP.manage,
          status: "refused",
        }),
        operation({
          operationId: "d",
          role: DATASET_ROLE_MAP.delete,
          status: "uncertain",
          uncertainReason: "no-response",
        }),
      ],
    });

    // Each is named by permission and recorded direction, below the row.
    expect(screen.getByText("Granting Edit…")).toBeInTheDocument();
    expect(screen.getByText("Search permission granted.")).toBeInTheDocument();
    expect(
      screen.getByText("Manage permission wasn't granted."),
    ).toBeInTheDocument();
    // Unknown is neither granted nor refused.
    expect(
      screen.getByText(/^Delete: we couldn't confirm whether it was granted/),
    ).toBeInTheDocument();
    // And each is tied to its own switch for assistive technology.
    expect(switchFor(RESEARCH, "Delete")).toHaveAccessibleDescription(
      /Delete: we couldn't confirm/,
    );
    expect(switchFor(RESEARCH, "Manage")).toHaveAccessibleDescription(
      "Manage permission wasn't granted.",
    );
    expect(switchFor(RESEARCH, "Browse")).not.toHaveAccessibleDescription();
    // The acknowledged one stays visible while another is uncertain.
    expect(switchFor(RESEARCH, "Search")).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("words a restored uncertain operation as an earlier change", () => {
    renderView({
      operations: [
        operation({
          role: DATASET_ROLE_MAP.edit,
          status: "uncertain",
          restored: true,
        }),
      ],
    });
    expect(
      screen.getByText(
        /^Edit: we couldn't confirm whether an earlier grant was applied/,
      ),
    ).toBeInTheDocument();
  });

  it("keeps an uncertain outcome blocked in both directions", () => {
    const onRoleChange = vi.fn();
    renderView({
      onRoleChange,
      operations: [
        operation({ role: DATASET_ROLE_MAP.edit, status: "uncertain" }),
      ],
    });
    const control = switchFor(RESEARCH, "Edit");
    expect(control).toBeDisabled();
    fireEvent.click(control);
    expect(onRoleChange).not.toHaveBeenCalled();
    expect(
      screen.getByText(/we couldn't confirm one access change/i),
    ).toBeInTheDocument();
  });
});

describe("DatasetAccessView — sending one change", () => {
  it("sends exactly one action with the group, Gateway role and direction", () => {
    const onRoleChange = vi.fn();
    renderView({ onRoleChange });

    fireEvent.click(switchFor(RESEARCH, "Edit"));

    expect(onRoleChange).toHaveBeenCalledTimes(1);
    expect(onRoleChange).toHaveBeenCalledWith(
      RESEARCH_GROUP_ID,
      DATASET_ROLE_MAP.edit,
      "assign",
    );
  });

  it("prevents another dataset action while one write is in flight", () => {
    const onRoleChange = vi.fn();
    renderView({
      onRoleChange,
      operations: [
        operation({ role: DATASET_ROLE_MAP.edit, status: "pending" }),
      ],
    });

    // A different group and a different role: the design's rule is per dataset,
    // not per assignment.
    const other = switchFor(LONG_GROUP_NAME, "Search");
    expect(other).toBeDisabled();
    fireEvent.click(other);
    expect(onRoleChange).not.toHaveBeenCalled();
    expect(screen.getByText(/wait for it to finish/i)).toBeInTheDocument();
  });

  it("sends nothing when the evidence does not positively authorize it", () => {
    const onRoleChange = vi.fn();
    const { unmount } = renderView({
      onRoleChange,
      capabilities: UNKNOWN_CAPABILITIES,
    });
    fireEvent.click(switchFor(RESEARCH, "Edit"));
    expect(onRoleChange).not.toHaveBeenCalled();
    unmount();

    renderView({ onRoleChange, capabilities: READ_ONLY_CAPABILITIES });
    fireEvent.click(switchFor(RESEARCH, "Edit"));
    expect(onRoleChange).not.toHaveBeenCalled();
  });

  it("respects a block the hook reports even when the view sees none", () => {
    const onRoleChange = vi.fn();
    renderView({
      onRoleChange,
      canAttempt: () => ({ kind: "blocked", reason: "uncertain-outcome" }),
    });
    const control = switchFor(RESEARCH, "Edit");
    expect(control).toBeDisabled();
    fireEvent.click(control);
    expect(onRoleChange).not.toHaveBeenCalled();
  });
});

describe("DatasetAccessView — confirmations", () => {
  const confirmDialog = () => screen.getByRole("dialog");

  it("confirms an elevated grant with dataset, group and permission", () => {
    const onRoleChange = vi.fn();
    renderView({ onRoleChange });

    fireEvent.click(switchFor(RESEARCH, "Manage"));
    expect(onRoleChange).not.toHaveBeenCalled();

    const dialog = confirmDialog();
    expect(dialog).toHaveTextContent(RESEARCH);
    expect(dialog).toHaveTextContent(DATASET_NAME);
    expect(dialog).toHaveTextContent(/Manage/);
    expect(dialog).toHaveTextContent(/change who has access to the dataset/i);

    fireEvent.click(
      within(dialog).getByRole("button", { name: /grant manage/i }),
    );
    expect(onRoleChange).toHaveBeenCalledTimes(1);
    expect(onRoleChange).toHaveBeenCalledWith(
      RESEARCH_GROUP_ID,
      DATASET_ROLE_MAP.manage,
      "assign",
    );
  });

  it("confirms a public-audience grant and explains what Browse is not", () => {
    const onRoleChange = vi.fn();
    renderView({ onRoleChange });

    fireEvent.click(switchFor("Everyone", "Browse"));
    const dialog = confirmDialog();
    expect(dialog).toHaveTextContent(/all DataGEMS users/i);
    expect(dialog).toHaveTextContent(/everyone who can sign in to DataGEMS/i);
    expect(dialog).toHaveTextContent(/doesn't include downloading files/i);
    // Signed-in users, not anonymous publication.
    expect(dialog).not.toHaveTextContent(/public|internet|anonymous/i);

    fireEvent.click(
      within(dialog).getByRole("button", { name: /grant browse/i }),
    );
    expect(onRoleChange).toHaveBeenCalledWith(
      EVERYONE_GROUP_ID,
      DATASET_ROLE_MAP.browse,
      "assign",
    );
  });

  it("confirms a revocation with the exact role and no removal guarantee", () => {
    const onRoleChange = vi.fn();
    renderView({ onRoleChange });

    fireEvent.click(switchFor(RESEARCH, "Download"));
    const dialog = confirmDialog();
    expect(dialog).toHaveTextContent(/Remove Download permission/);
    expect(dialog).toHaveTextContent(
      /may still have access through other permissions/i,
    );

    fireEvent.click(
      within(dialog).getByRole("button", { name: /remove download/i }),
    );
    expect(onRoleChange).toHaveBeenCalledWith(
      RESEARCH_GROUP_ID,
      DATASET_ROLE_MAP.download,
      "remove",
    );
  });

  it("sends nothing when a confirmation is cancelled", () => {
    const onRoleChange = vi.fn();
    renderView({ onRoleChange });

    fireEvent.click(switchFor(RESEARCH, "Manage"));
    fireEvent.click(
      within(confirmDialog()).getByRole("button", { name: /^cancel$/i }),
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onRoleChange).not.toHaveBeenCalled();
  });

  it("returns focus to the control the confirmation was raised from", () => {
    renderView();
    const control = switchFor(RESEARCH, "Manage");
    control.focus();
    fireEvent.click(control);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: /^cancel$/i,
      }),
    );
    expect(document.activeElement).toBe(control);
  });

  it("discards an unconfirmed change when the owner changes", () => {
    const onRoleChange = vi.fn();
    const { rerenderWith } = renderView({ onRoleChange });

    fireEvent.click(switchFor(RESEARCH, "Manage"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    rerenderWith({ scopeKey: "principal-b|https://gateway.example|dataset-1" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onRoleChange).not.toHaveBeenCalled();
  });

  it("discards an unconfirmed change when the caller's authority changes", () => {
    const onRoleChange = vi.fn();
    const { rerenderWith } = renderView({ onRoleChange });

    fireEvent.click(switchFor(RESEARCH, "Manage"));
    rerenderWith({ capabilities: READ_ONLY_CAPABILITIES });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onRoleChange).not.toHaveBeenCalled();
  });

  it("re-checks the decision at confirm time, not when the dialog opened", () => {
    const onRoleChange = vi.fn();
    // The dialog is raised while the action is allowed; the answer changes
    // underneath it, as a completed read or a revoked authority would change it.
    let blocked = false;
    const canAttempt = () =>
      blocked
        ? ({ kind: "blocked", reason: "uncertain-outcome" } as const)
        : ({ kind: "allowed" } as const);

    render(<DatasetAccessView {...baseProps({ onRoleChange, canAttempt })} />);

    fireEvent.click(switchFor(RESEARCH, "Manage"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    blocked = true;
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: /grant manage/i,
      }),
    );

    expect(onRoleChange).not.toHaveBeenCalled();
  });
});

describe("DatasetAccessView — the public audience", () => {
  it("marks the identified public audience and no other group", () => {
    renderView();
    expect(screen.getAllByText("All DataGEMS users")).toHaveLength(1);
  });

  // Two groups actually carrying the Everyone semantic, not a standalone flag.
  const ambiguousReads = {
    status: "settled",
    groups: { kind: "read", groups: AMBIGUOUS_GROUPS },
    recipients: {
      kind: "known",
      grants: [
        ...KNOWN_GRANTS,
        { groupId: EVERYONE_GROUP_ID, role: DATASET_ROLE_MAP.browse },
      ],
    },
  } as const;

  it("refuses new assignments to ambiguous candidates and explains why", () => {
    const onRoleChange = vi.fn();
    renderView({
      onRoleChange,
      reads: ambiguousReads,
      everyone: EVERYONE_AMBIGUOUS,
    });

    expect(screen.queryByText("All DataGEMS users")).not.toBeInTheDocument();
    expect(screen.getAllByText("Group needs checking")).toHaveLength(2);
    expect(
      screen.getByText(/access to all DataGEMS users is unavailable/i),
    ).toHaveTextContent(/couldn't identify the correct group/i);

    // Neither candidate is an ordinary target: no switch that would assign.
    for (const name of ["Everyone", DUPLICATE_EVERYONE_GROUP.name ?? ""]) {
      for (const role of ["Browse", "Search", "Manage"]) {
        const control = switchFor(name, role);
        if (control.getAttribute("aria-checked") === "true") continue;
        expect(control).toBeDisabled();
        fireEvent.click(control);
      }
    }
    expect(onRoleChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps ordinary groups usable while Everyone is ambiguous", () => {
    const onRoleChange = vi.fn();
    renderView({
      onRoleChange,
      reads: ambiguousReads,
      everyone: EVERYONE_AMBIGUOUS,
    });

    fireEvent.click(switchFor(RESEARCH, "Search"));
    expect(onRoleChange).toHaveBeenCalledTimes(1);
    expect(onRoleChange).toHaveBeenCalledWith(
      RESEARCH_GROUP_ID,
      DATASET_ROLE_MAP.search,
      "assign",
    );
  });

  it("still lets a known role on a candidate be removed, with exact confirmation", () => {
    const onRoleChange = vi.fn();
    renderView({
      onRoleChange,
      reads: ambiguousReads,
      everyone: EVERYONE_AMBIGUOUS,
    });

    const held = switchFor("Everyone", "Browse");
    expect(held).toHaveAttribute("aria-checked", "true");
    expect(held).toBeEnabled();
    fireEvent.click(held);
    expect(onRoleChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /remove browse/i }));
    expect(onRoleChange).toHaveBeenCalledWith(
      EVERYONE_GROUP_ID,
      DATASET_ROLE_MAP.browse,
      "remove",
    );
  });

  it("still confirms a uniquely identified public audience", () => {
    const onRoleChange = vi.fn();
    renderView({ onRoleChange });

    fireEvent.click(switchFor("Everyone", "Browse"));
    expect(onRoleChange).not.toHaveBeenCalled();
    expect(
      screen.getByText(/will be able to find and open this dataset/i),
    ).toBeInTheDocument();
  });
});

describe("DatasetAccessView — closing and search", () => {
  it("closes without compensating for anything already applied", () => {
    const onDone = vi.fn();
    const onRoleChange = vi.fn();
    renderView({
      onDone,
      onRoleChange,
      operations: [
        operation({ role: DATASET_ROLE_MAP.edit, status: "acknowledged" }),
        operation({
          operationId: "u",
          role: DATASET_ROLE_MAP.search,
          status: "uncertain",
        }),
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onRoleChange).not.toHaveBeenCalled();
  });

  it("clears an open confirmation when the view is closed", () => {
    const onRoleChange = vi.fn();
    renderView({ onRoleChange });

    fireEvent.click(switchFor(RESEARCH, "Manage"));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onRoleChange).not.toHaveBeenCalled();
  });

  it("filters the list by group name and says so when nothing matches", () => {
    renderView();
    const search = screen.getByRole("textbox", { name: /search groups/i });

    fireEvent.change(search, { target: { value: "modelling" } });
    expect(screen.getAllByRole("switch")).toHaveLength(6);

    fireEvent.change(search, { target: { value: "no such group" } });
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
    expect(screen.getByText(/no groups match/i)).toBeInTheDocument();
  });

  it("keeps every group and role addressable when names are long", () => {
    renderView();
    expect(switchFor(LONG_GROUP_NAME, "Browse")).toHaveAttribute(
      "aria-checked",
      String(
        KNOWN_GRANTS.some(
          (grant) =>
            grant.groupId === SECOND_GROUP_ID &&
            grant.role === DATASET_ROLE_MAP.browse,
        ),
      ),
    );
  });
});

/**
 * The presentations the evidence selects.
 *
 * The view renders `mode` and never re-derives it, so these cases are about
 * what each presentation *offers* — and, more to the point, what it refuses to
 * offer. The selection rule itself is tested in
 * `lib/datasetPermissions/mode.test.ts`; the fixtures derive the mode from the
 * same evidence, so an impossible combination cannot be staged here by
 * accident.
 */
describe("DatasetAccessView — the grant-only presentation", () => {
  const grantOnly = (overrides: Partial<DatasetAccessViewProps> = {}) =>
    renderView({
      reads: {
        status: "settled",
        groups: { kind: "read", groups: DISCOVERED_GROUPS },
        recipients: { kind: "unknown", reason: "not-supported" },
      },
      capabilities: RECIPIENTS_UNSUPPORTED,
      ...overrides,
    });

  it("offers an explicit group and role choice with one Grant action", () => {
    grantOnly();
    expect(screen.getByLabelText("Group")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Browse" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /grant access/i }),
    ).toBeInTheDocument();
  });

  it("draws no switches, because existing access is unknown", () => {
    grantOnly();
    // A grid of off switches would say nobody has access.
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
  });

  it("says existing access cannot be shown, without claiming there is none", () => {
    grantOnly();
    expect(screen.getByText(/can't view existing permissions/i)).toBeVisible();
    expect(screen.queryByText(/nobody|no one|no permissions/i)).toBeNull();
  });

  it("leads with the task and states the limitation once, without unrelated warnings", () => {
    grantOnly();
    expect(
      screen.getByRole("heading", { name: "Grant access" }),
    ).toBeInTheDocument();
    expect(screen.getByText(new RegExp(DATASET_NAME))).toBeVisible();
    expect(screen.getAllByText(/existing permissions/i)).toHaveLength(1);
    // No removal action exists here, so no warning about one.
    expect(
      screen.queryByText(/permission to remove access/i),
    ).not.toBeInTheDocument();
    // No explanation of absent controls, and no banners at all.
    expect(screen.queryByText(/save|undo/i)).not.toBeInTheDocument();
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
  });

  it("makes closing secondary to the Grant action", () => {
    grantOnly();
    expect(screen.getByRole("button", { name: "Done" })).not.toHaveClass(
      "bg-sky-950",
    );
    expect(screen.getByRole("button", { name: "Grant access" })).toHaveClass(
      "bg-sky-950",
    );
  });

  it("offers no revocation", () => {
    grantOnly();
    expect(screen.queryByRole("button", { name: /remove/i })).toBeNull();
    expect(
      screen.getByText(
        /to review or remove them, ask a DataGEMS administrator/i,
      ),
    ).toBeVisible();
  });

  it("offers every role separately, so Browse is never bundled", () => {
    grantOnly();
    const roles = screen.getAllByRole("radio");
    expect(roles).toHaveLength(6);
    // Radios, not checkboxes: one deliberate action is one request.
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("requires both a group and a role before anything can be sent", () => {
    const onRoleChange = vi.fn();
    grantOnly({ onRoleChange });

    fireEvent.click(screen.getByRole("button", { name: /grant access/i }));
    expect(onRoleChange).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /grant access/i }),
    ).toBeDisabled();
  });

  it("sends exactly the chosen group and role", () => {
    const onRoleChange = vi.fn();
    grantOnly({ onRoleChange });

    fireEvent.change(screen.getByLabelText("Group"), {
      target: { value: RESEARCH_GROUP_ID },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Download" }));
    fireEvent.click(screen.getByRole("button", { name: /grant access/i }));

    expect(onRoleChange).toHaveBeenCalledTimes(1);
    expect(onRoleChange).toHaveBeenCalledWith(
      RESEARCH_GROUP_ID,
      DATASET_ROLE_MAP.download,
      "assign",
    );
  });

  it("marks the public audience from semantics and confirms a grant to it", () => {
    const onRoleChange = vi.fn();
    grantOnly({ onRoleChange });

    fireEvent.change(screen.getByLabelText("Group"), {
      target: { value: EVERYONE_GROUP_ID },
    });
    expect(
      screen.getByText(/includes everyone who can sign in to DataGEMS/i),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("radio", { name: "Browse" }));
    fireEvent.click(screen.getByRole("button", { name: /grant access/i }));

    expect(onRoleChange).not.toHaveBeenCalled();
    expect(
      screen.getByText(/will be able to find and open this dataset/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /grant browse/i }));
    expect(onRoleChange).toHaveBeenCalledWith(
      EVERYONE_GROUP_ID,
      DATASET_ROLE_MAP.browse,
      "assign",
    );
  });

  it("confirms an elevated role before sending it", () => {
    const onRoleChange = vi.fn();
    grantOnly({ onRoleChange });

    fireEvent.change(screen.getByLabelText("Group"), {
      target: { value: RESEARCH_GROUP_ID },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Manage" }));
    fireEvent.click(screen.getByRole("button", { name: /grant access/i }));

    expect(onRoleChange).not.toHaveBeenCalled();
    expect(
      screen.getByText(/change who has access to the dataset/i),
    ).toBeInTheDocument();
  });

  it("offers no ambiguous candidate as a target, and still offers the rest", () => {
    const onRoleChange = vi.fn();
    grantOnly({
      onRoleChange,
      reads: {
        status: "settled",
        groups: { kind: "read", groups: AMBIGUOUS_GROUPS },
        recipients: { kind: "unknown", reason: "not-supported" },
      },
      everyone: EVERYONE_AMBIGUOUS,
    });

    // Explained once, beside the chooser, and about the options — never
    // about an unselected "this group", and not repeated as a banner.
    const hint = screen.getByText(/marked “needs checking” can't be chosen/i);
    expect(screen.getByLabelText("Group")).toHaveAccessibleDescription(
      hint.textContent ?? "",
    );
    expect(screen.queryByText(/this group/i)).toBeNull();
    expect(
      screen.queryByText(/access to all DataGEMS users is unavailable/i),
    ).toBeNull();
    for (const id of [EVERYONE_GROUP_ID, DUPLICATE_EVERYONE_GROUP.id]) {
      const option = screen
        .getByLabelText("Group")
        .querySelector(`option[value="${id}"]`);
      expect(option).toBeDisabled();
      expect(option).toHaveTextContent(/needs checking/i);
    }

    // Even if the value reaches the control, nothing is sent and nothing asks.
    fireEvent.change(screen.getByLabelText("Group"), {
      target: { value: DUPLICATE_EVERYONE_GROUP.id },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Browse" }));
    expect(
      screen.getByRole("button", { name: /grant access/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /grant access/i }),
    ).toHaveAccessibleDescription(/All Users needs checking/);
    fireEvent.click(screen.getByRole("button", { name: /grant access/i }));
    expect(onRoleChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();

    // The shortcut is what is unavailable, not the form.
    fireEvent.change(screen.getByLabelText("Group"), {
      target: { value: RESEARCH_GROUP_ID },
    });
    expect(screen.queryByText(/this group|needs checking before/i)).toBeNull();
    expect(screen.getByRole("button", { name: /grant access/i })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /grant access/i }));
    expect(onRoleChange).toHaveBeenCalledTimes(1);
    expect(onRoleChange).toHaveBeenCalledWith(
      RESEARCH_GROUP_ID,
      DATASET_ROLE_MAP.browse,
      "assign",
    );
  });

  it("blocks the form while a write is in flight, and says why", () => {
    grantOnly({ operations: [operation({ status: "pending" })] });
    expect(
      screen.getByRole("button", { name: /grant access/i }),
    ).toBeDisabled();
    expect(screen.getByLabelText("Group")).toBeDisabled();
  });

  it("blocks the form when the recovery record cannot be stored", () => {
    grantOnly({ storageAvailable: false });
    expect(
      screen.getByRole("button", { name: /grant access/i }),
    ).toBeDisabled();
  });
});

describe("DatasetAccessView — when neither presentation is offered", () => {
  it("explains a failed recipient read and offers no controls at all", () => {
    renderView({
      reads: {
        status: "settled",
        groups: { kind: "read", groups: DISCOVERED_GROUPS },
        recipients: { kind: "failed" },
      },
    });

    expect(screen.getByText(/access settings unavailable/i)).toBeVisible();
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
    expect(screen.queryByLabelText("Group")).toBeNull();
  });

  it("does not present an unexpected refusal as policy", () => {
    renderView({
      reads: {
        status: "settled",
        groups: { kind: "read", groups: DISCOVERED_GROUPS },
        recipients: { kind: "unknown", reason: "not-supported" },
      },
      // Lookup was established as allowed, so this refusal is unexplained.
      capabilities: {
        grant: "allowed",
        revoke: "allowed",
        lookupRecipients: "allowed",
      },
    });

    expect(
      screen.getByText(/couldn't load existing permissions/i),
    ).toBeVisible();
    // An unexpected refusal is not worded as the account's policy.
    expect(screen.queryByText(/don't have permission/i)).toBeNull();
    expect(screen.queryByLabelText("Group")).toBeNull();
  });

  it("keeps the Done footer, so the surface can always be closed", () => {
    const onDone = vi.fn();
    renderView({
      reads: {
        status: "settled",
        groups: { kind: "failed" },
        recipients: { kind: "failed" },
      },
    });
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe("DatasetAccessView — reconciliation", () => {
  it("says a re-check failed without moving anything", () => {
    renderView({
      reconciliationFailed: true,
      operations: [operation({ status: "acknowledged" })],
    });

    expect(
      screen.getByText(/couldn't refresh the permissions list/i),
    ).toHaveTextContent(/your change was applied/i);
    expect(switchFor(RESEARCH, "Edit")).toHaveAttribute("aria-checked", "true");
  });
});

describe("DatasetAccessView — grant results and eligibility", () => {
  const grantOnlyReads = {
    status: "settled",
    groups: { kind: "read", groups: DISCOVERED_GROUPS },
    recipients: { kind: "unknown", reason: "not-supported" },
  } as const;

  const grantOnly = (overrides: Partial<DatasetAccessViewProps> = {}) =>
    renderView({
      reads: grantOnlyReads,
      capabilities: RECIPIENTS_UNSUPPORTED,
      ...overrides,
    });

  const choose = (groupId: string, role: string) => {
    fireEvent.change(screen.getByLabelText("Group"), {
      target: { value: groupId },
    });
    fireEvent.click(screen.getByRole("radio", { name: role }));
  };

  const grantButton = () =>
    screen.getByRole("button", { name: "Grant access" });

  it("names the group and permission for each outcome", () => {
    grantOnly({
      operations: [
        operation({
          operationId: "ack",
          role: DATASET_ROLE_MAP.browse,
          status: "acknowledged",
        }),
        operation({
          operationId: "ref",
          groupId: SECOND_GROUP_ID,
          role: DATASET_ROLE_MAP.search,
          status: "refused",
        }),
        operation({
          operationId: "unk",
          role: DATASET_ROLE_MAP.download,
          status: "uncertain",
          uncertainReason: "no-response",
        }),
        operation({
          operationId: "pen",
          role: DATASET_ROLE_MAP.edit,
          status: "pending",
        }),
      ],
    });

    // One summary at the top points to the named results below the form.
    expect(
      screen.getByText(
        /^We couldn't confirm one access change\. Details are under Your changes\.$/,
      ),
    ).toBeInTheDocument();
    const region = screen.getByText("Your changes").parentElement;
    if (region === null) throw new Error("results region missing");
    expect(region).toHaveAttribute("aria-live", "polite");
    const results = within(region);
    expect(
      results.getByText(`Browse permission granted to ${RESEARCH}.`),
    ).toBeInTheDocument();
    expect(
      results.getByText(
        `Search permission wasn't granted to ${LONG_GROUP_NAME}.`,
      ),
    ).toBeInTheDocument();
    // Unknown is neither granted nor refused.
    expect(
      results.getByText(
        new RegExp(
          `^We couldn't confirm whether Download permission was granted to ${RESEARCH}\\.`,
        ),
      ),
    ).toBeInTheDocument();
    expect(
      results.getByText(`Granting Edit to ${RESEARCH}…`),
    ).toBeInTheDocument();
    // Newest first.
    expect(results.getAllByRole("listitem")[0]).toHaveTextContent(
      "Granting Edit",
    );
    // An acknowledgement is not an inventory of who has access.
    expect(screen.queryByText(/nobody|only group|all groups/i)).toBeNull();
  });

  it("explains and disables a selected assignment whose earlier grant is unknown", () => {
    const onRoleChange = vi.fn();
    grantOnly({
      onRoleChange,
      operations: [
        operation({ role: DATASET_ROLE_MAP.browse, status: "uncertain" }),
      ],
    });

    choose(RESEARCH_GROUP_ID, "Browse");

    // Explained before the click, and the button matches the explanation.
    expect(grantButton()).toBeDisabled();
    expect(grantButton()).toHaveAccessibleDescription(
      new RegExp(
        `can't change Browse for ${RESEARCH} until access has been checked`,
      ),
    );
    fireEvent.click(grantButton());
    expect(onRoleChange).not.toHaveBeenCalled();
  });

  it("explains a block the lifecycle reports for the selected assignment", () => {
    const onRoleChange = vi.fn();
    // The view has no record of it; `canAttempt` is still the authority.
    grantOnly({
      onRoleChange,
      canAttempt: (groupId, role) =>
        groupId === RESEARCH_GROUP_ID && role === DATASET_ROLE_MAP.edit
          ? { kind: "blocked", reason: "uncertain-outcome" }
          : { kind: "allowed" },
    });

    choose(RESEARCH_GROUP_ID, "Edit");
    expect(grantButton()).toBeDisabled();
    expect(grantButton()).toHaveAccessibleDescription(/can't change Edit for/);
    fireEvent.click(grantButton());
    expect(onRoleChange).not.toHaveBeenCalled();
  });

  it("keeps other assignments usable beside an unknown one", () => {
    const onRoleChange = vi.fn();
    grantOnly({
      onRoleChange,
      operations: [
        operation({ role: DATASET_ROLE_MAP.browse, status: "uncertain" }),
      ],
    });

    // Same group, another permission.
    choose(RESEARCH_GROUP_ID, "Download");
    expect(grantButton()).toBeEnabled();
    fireEvent.click(grantButton());
    // Another group, the same permission.
    choose(SECOND_GROUP_ID, "Browse");
    expect(grantButton()).toBeEnabled();
    fireEvent.click(grantButton());

    expect(onRoleChange.mock.calls).toEqual([
      [RESEARCH_GROUP_ID, DATASET_ROLE_MAP.download, "assign"],
      [SECOND_GROUP_ID, DATASET_ROLE_MAP.browse, "assign"],
    ]);
  });

  it("waits for a pending grant, then offers the next one", () => {
    const onRoleChange = vi.fn();
    const { rerenderWith } = grantOnly({
      onRoleChange,
      reads: grantOnlyReads,
      capabilities: RECIPIENTS_UNSUPPORTED,
      operations: [
        operation({ role: DATASET_ROLE_MAP.browse, status: "pending" }),
      ],
    });
    expect(grantButton()).toBeDisabled();
    expect(
      screen.getByText(`Granting Browse to ${RESEARCH}…`),
    ).toBeInTheDocument();

    rerenderWith({
      onRoleChange,
      reads: grantOnlyReads,
      capabilities: RECIPIENTS_UNSUPPORTED,
      operations: [
        operation({ role: DATASET_ROLE_MAP.browse, status: "acknowledged" }),
      ],
    });
    choose(SECOND_GROUP_ID, "Search");
    expect(grantButton()).toBeEnabled();
    fireEvent.click(grantButton());
    expect(onRoleChange).toHaveBeenCalledWith(
      SECOND_GROUP_ID,
      DATASET_ROLE_MAP.search,
      "assign",
    );
  });

  it("keeps a restored unknown outcome on reopen, even for an unlisted group", () => {
    const unlisted = "9a8b7c6d-0000-4000-8000-000000000001";
    grantOnly({
      operations: [
        operation({
          operationId: "r1",
          role: DATASET_ROLE_MAP.browse,
          status: "uncertain",
          restored: true,
        }),
        operation({
          operationId: "r2",
          groupId: unlisted,
          role: DATASET_ROLE_MAP.edit,
          status: "uncertain",
          restored: true,
        }),
      ],
    });

    expect(
      screen.getByText(
        new RegExp(
          `^We couldn't confirm whether an earlier Browse grant to ${RESEARCH} was applied\\.`,
        ),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /^We couldn't confirm whether an earlier Edit grant to an unlisted group \(ID 9a8b7c6d\) was applied\./,
      ),
    ).toBeInTheDocument();
  });

  it("names an unknown change in the full editor when its row is not on screen", () => {
    renderView({
      operations: [
        operation({ role: DATASET_ROLE_MAP.edit, status: "uncertain" }),
      ],
    });
    fireEvent.change(screen.getByRole("textbox", { name: /search groups/i }), {
      target: { value: "consortium" },
    });

    expect(
      screen.getByText(/we couldn't confirm one access change/i).parentElement,
    ).toHaveTextContent(
      `${RESEARCH}: Edit: we couldn't confirm whether it was granted.`,
    );
  });

  it("keeps several notices on one long-named row readable and separate", () => {
    renderView({
      operations: [
        operation({
          operationId: "x",
          groupId: SECOND_GROUP_ID,
          role: DATASET_ROLE_MAP.edit,
          status: "uncertain",
        }),
        operation({
          operationId: "y",
          groupId: SECOND_GROUP_ID,
          role: DATASET_ROLE_MAP.browse,
          action: "remove",
          status: "refused",
        }),
      ],
    });

    expect(switchFor(LONG_GROUP_NAME, "Edit")).toHaveAccessibleDescription(
      /^Edit: we couldn't confirm whether it was granted/,
    );
    // The recorded direction, not the switch position, words the removal.
    expect(switchFor(LONG_GROUP_NAME, "Browse")).toHaveAccessibleDescription(
      "Browse permission wasn't removed.",
    );
  });
});

describe("DatasetAccessView — grant-only keyboard focus", () => {
  it("keeps focus on the results while a grant applies, instead of losing it", () => {
    const props = baseProps({
      reads: {
        status: "settled",
        groups: { kind: "read", groups: DISCOVERED_GROUPS },
        recipients: { kind: "unknown", reason: "not-supported" },
      },
      capabilities: RECIPIENTS_UNSUPPORTED,
    });
    const { rerender } = render(<DatasetAccessView {...props} />);
    fireEvent.change(screen.getByLabelText("Group"), {
      target: { value: RESEARCH_GROUP_ID },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Browse" }));
    const button = screen.getByRole("button", { name: "Grant access" });
    button.focus();

    rerender(
      <DatasetAccessView
        {...props}
        operations={[
          operation({ role: DATASET_ROLE_MAP.browse, status: "pending" }),
        ]}
      />,
    );

    expect(button).toBeDisabled();
    expect(document.activeElement).toBe(
      screen.getByText("Your changes").parentElement,
    );
  });
});
