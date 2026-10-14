import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DATASET_ROLE_MAP } from "@/config/contextGrantRoles";
import {
  EVERYONE_GROUP_ID,
  RESEARCH_GROUP_ID,
  SECOND_GROUP_ID,
  UNDISCOVERED_GROUP_ID,
} from "@/lib/datasetPermissions/fixtures";
import { DatasetAccessView } from "./DatasetAccessView";
import {
  AMBIGUOUS_GROUPS,
  baseProps,
  DATASET_NAME,
  DISCOVERED_GROUPS,
  DUPLICATE_EVERYONE_GROUP,
  EVERYONE_AMBIGUOUS,
  GRANTS_WITH_UNDISCOVERED_HOLDER,
  KNOWN_GRANTS,
  LONG_GROUP_NAME,
  operation,
  READ_ONLY_CAPABILITIES,
  RECIPIENTS_UNSUPPORTED,
  UNKNOWN_CAPABILITIES,
} from "./fixtures";
import type { DatasetAccessViewProps, DatasetInventoryStatus } from "./types";

const inventoryStatus = (
  overrides: Partial<DatasetInventoryStatus> = {},
): DatasetInventoryStatus => ({
  freshness: "current",
  staleReason: null,
  revision: 1,
  confirmedOperationIds: new Set(),
  ...overrides,
});

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
      screen.getByRole("heading", { name: "Couldn't load group permissions" }),
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

  it("says an explicit empty inventory assigns no group permissions, and no more", () => {
    renderView({
      reads: {
        status: "settled",
        groups: { kind: "read", groups: DISCOVERED_GROUPS },
        recipients: { kind: "known", grants: [] },
      },
    });
    expect(
      screen.getByText("No group permissions assigned."),
    ).toBeInTheDocument();
    // Discoverable groups stay as unassigned targets.
    expect(screen.getAllByRole("switch")).toHaveLength(
      DISCOVERED_GROUPS.length * 6,
    );
    // Not a claim that nobody has access or that the dataset is private.
    expect(screen.queryByText(/nobody|no one|private/i)).toBeNull();
  });

  it("does not show the empty-inventory message when groups hold roles", () => {
    renderView();
    expect(screen.queryByText("No group permissions assigned.")).toBeNull();
  });

  it("captions the list as this dataset's group permissions", () => {
    renderView();
    // Under its heading, before the first group, rather than after the list.
    const caption = screen.getByText("Group permissions for this dataset.");
    const heading = screen.getByRole("heading", { name: "Group permissions" });
    const firstSwitch = screen.getAllByRole("switch")[0];
    expect(
      heading.compareDocumentPosition(caption) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      firstSwitch !== undefined &&
        caption.compareDocumentPosition(firstSwitch) &
          Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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
    expect(control).toHaveAttribute("aria-disabled", "true");
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
    // Busy is shown at the pending switch and named for assistive technology,
    // not in a dataset-wide banner.
    expect(screen.queryByText(/applying change/i)).toBeNull();
    const pending = switchFor(RESEARCH, "Edit");
    expect(pending).toHaveAttribute("aria-busy", "true");
    expect(pending).toHaveAccessibleDescription("Granting Edit…");
    expect(other).not.toHaveAttribute("aria-busy");
  });

  it("does not present an unconfirmed change as busy", () => {
    renderView({
      operations: [
        operation({
          role: DATASET_ROLE_MAP.edit,
          status: "uncertain",
          uncertainReason: "no-response",
        }),
      ],
    });
    const control = switchFor(RESEARCH, "Edit");
    expect(control).not.toHaveAttribute("aria-busy");
    expect(control).toHaveAttribute("aria-disabled", "true");
    expect(control).toHaveAccessibleDescription(
      /Edit: we couldn't confirm whether it was granted/,
    );
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
    expect(screen.getByText("Choose a group and a permission.")).toBeVisible();
    // The shell's heading names the dataset; the form does not repeat it.
    expect(screen.queryByText(new RegExp(DATASET_NAME))).toBeNull();
    expect(screen.getAllByText(/existing permissions/i)).toHaveLength(1);
    // No removal action exists here, so no warning about one.
    expect(
      screen.queryByText(/permission to remove access/i),
    ).not.toBeInTheDocument();
    // No explanation of absent controls, and no banners at all.
    expect(screen.queryByText(/save|undo/i)).not.toBeInTheDocument();
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
  });

  it("keeps one Grant beside Done, outside the scrolling fields", () => {
    grantOnly();
    const grants = screen.getAllByRole("button", { name: "Grant access" });
    expect(grants).toHaveLength(1);
    const [grant] = grants;
    const done = screen.getByRole("button", { name: "Done" });
    expect(screen.getAllByRole("button", { name: "Done" })).toHaveLength(1);
    // One action area, Grant first in the tab order.
    expect(grant?.parentElement).toBe(done.parentElement);
    expect(
      grant?.compareDocumentPosition(done) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const body = screen.getByLabelText("Group").closest(".overflow-y-auto");
    expect(body).not.toBeNull();
    expect(body).not.toContainElement(grant ?? null);
    expect(body).not.toContainElement(done);
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

    expect(
      screen.getByRole("heading", { name: "Couldn't load group permissions" }),
    ).toBeVisible();
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
      screen.getByRole("heading", { name: "Couldn't load group permissions" }),
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

describe("DatasetAccessView — inventory freshness", () => {
  it("says a change is saved but unconfirmed, without moving anything", () => {
    const onRoleChange = vi.fn();
    renderView({
      inventory: inventoryStatus({
        freshness: "stale",
        staleReason: "change-unconfirmed",
      }),
      onRefreshAccess: vi.fn(),
      onRoleChange,
      operations: [operation({ status: "acknowledged" })],
    });

    expect(
      screen.getByText("Change saved. Current access couldn't be refreshed."),
    ).toBeVisible();
    expect(switchFor(RESEARCH, "Edit")).toHaveAttribute("aria-checked", "true");
  });

  it("holds every change while the inventory is stale", () => {
    const onRoleChange = vi.fn();
    renderView({
      inventory: inventoryStatus({
        freshness: "stale",
        staleReason: "refresh-failed",
      }),
      onRefreshAccess: vi.fn(),
      onRoleChange,
    });

    expect(
      screen.getByText("Couldn't refresh group permissions."),
    ).toBeVisible();
    for (const control of screen.getAllByRole("switch")) {
      expect(control).toHaveAttribute("aria-disabled", "true");
    }
    fireEvent.click(switchFor(RESEARCH, "Edit"));
    expect(onRoleChange).not.toHaveBeenCalled();
  });

  it("holds every change while the inventory is being read again", () => {
    const onRoleChange = vi.fn();
    renderView({
      inventory: inventoryStatus({ freshness: "refreshing" }),
      onRoleChange,
    });

    expect(screen.getByText("Refreshing group permissions…")).toBeVisible();
    // Last-known roles stay on screen as they were.
    expect(switchFor(RESEARCH, "Browse")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    for (const control of screen.getAllByRole("switch")) {
      expect(control).toHaveAttribute("aria-disabled", "true");
    }
    fireEvent.click(switchFor(RESEARCH, "Edit"));
    expect(onRoleChange).not.toHaveBeenCalled();
  });

  it("offers Refresh access only where reading again can help", () => {
    const onRefreshAccess = vi.fn();
    const { rerenderWith } = renderView({ onRefreshAccess });
    // Current inventory: nothing to refresh.
    expect(screen.queryByRole("button", { name: "Refresh access" })).toBeNull();

    rerenderWith({
      inventory: inventoryStatus({
        freshness: "stale",
        staleReason: "refresh-failed",
      }),
    });
    fireEvent.click(screen.getByRole("button", { name: "Refresh access" }));
    expect(onRefreshAccess).toHaveBeenCalledTimes(1);
  });

  it("keeps Refresh access focusable but inert while its own read runs", async () => {
    const user = userEvent.setup();
    const onRefreshAccess = vi.fn();
    const { rerenderWith } = renderView({
      reads: {
        status: "settled",
        groups: { kind: "read", groups: DISCOVERED_GROUPS },
        recipients: { kind: "failed" },
      },
      onRefreshAccess,
    });

    const refresh = screen.getByRole("button", { name: "Refresh access" });
    await user.click(refresh);
    expect(onRefreshAccess).toHaveBeenCalledTimes(1);

    rerenderWith({ inventory: inventoryStatus({ freshness: "refreshing" }) });
    const held = screen.getByRole("button", { name: "Refresh access" });
    expect(held).toHaveFocus();
    expect(held).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Enter}");
    expect(onRefreshAccess).toHaveBeenCalledTimes(1);
  });

  it("shows no Refresh access action without a refresh handler", () => {
    renderView({
      reads: {
        status: "settled",
        groups: { kind: "read", groups: DISCOVERED_GROUPS },
        recipients: { kind: "failed" },
      },
    });
    expect(screen.queryByRole("button", { name: "Refresh access" })).toBeNull();
  });

  it("drops an open confirmation when a newer inventory replaces the one it was raised on", () => {
    const onRoleChange = vi.fn();
    const { rerenderWith } = renderView({
      inventory: inventoryStatus({ revision: 1 }),
      onRoleChange,
    });
    fireEvent.click(switchFor(RESEARCH, "Manage"));
    expect(screen.getByRole("button", { name: /grant manage/i })).toBeVisible();

    rerenderWith({ inventory: inventoryStatus({ revision: 2 }), onRoleChange });

    expect(screen.queryByRole("button", { name: /grant manage/i })).toBeNull();
    expect(onRoleChange).not.toHaveBeenCalled();
  });

  it("drops an open confirmation when group details are lost", () => {
    const onRoleChange = vi.fn();
    const { rerenderWith } = renderView({ onRoleChange });
    fireEvent.click(switchFor(RESEARCH, "Browse"));
    expect(
      screen.getByRole("button", { name: /remove browse/i }),
    ).toBeVisible();

    rerenderWith({
      reads: {
        status: "settled",
        groups: { kind: "failed" },
        recipients: { kind: "known", grants: [...KNOWN_GRANTS] },
      },
      onRoleChange,
    });

    expect(screen.queryByRole("button", { name: /remove browse/i })).toBeNull();
    expect(onRoleChange).not.toHaveBeenCalled();
  });

  it("draws a confirmed change from the read, not from its acknowledgement", () => {
    renderView({
      operations: [operation({ operationId: "ack", status: "acknowledged" })],
      inventory: inventoryStatus({ confirmedOperationIds: new Set(["ack"]) }),
    });
    // The newer read no longer shows Edit; once confirmed, the read wins.
    expect(switchFor(RESEARCH, "Edit")).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });
});

describe("DatasetAccessView — the empty message agrees with what is shown", () => {
  const EMPTY_MESSAGE = "No group permissions assigned.";
  const emptySnapshot = {
    status: "settled",
    groups: { kind: "read", groups: DISCOVERED_GROUPS },
    recipients: { kind: "known", grants: [] },
  } as const;
  const firstGrant = operation({
    operationId: "first",
    status: "acknowledged",
  });

  it.each([
    [
      "the read after it is still running",
      inventoryStatus({ freshness: "refreshing" }),
    ],
    [
      "the read after it failed",
      inventoryStatus({
        freshness: "stale",
        staleReason: "change-unconfirmed",
      }),
    ],
    [
      "the read after it came back empty",
      // A contradicting read replaces the snapshot with an empty one and
      // leaves the acknowledgement unconfirmed.
      inventoryStatus({
        freshness: "stale",
        staleReason: "change-unconfirmed",
        revision: 2,
      }),
    ],
  ])("is not shown beside an acknowledged first grant while %s", (_l, inv) => {
    renderView({
      reads: emptySnapshot,
      operations: [firstGrant],
      inventory: inv,
    });
    expect(switchFor(RESEARCH, "Edit")).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByText(EMPTY_MESSAGE)).toBeNull();
  });

  it("is not shown for an empty snapshot that is being re-read", () => {
    renderView({
      reads: emptySnapshot,
      inventory: inventoryStatus({ freshness: "refreshing" }),
    });
    expect(screen.queryByText(EMPTY_MESSAGE)).toBeNull();
  });

  it("is not shown for an empty snapshot that could not be refreshed", () => {
    renderView({
      reads: emptySnapshot,
      inventory: inventoryStatus({
        freshness: "stale",
        staleReason: "refresh-failed",
      }),
    });
    expect(screen.queryByText(EMPTY_MESSAGE)).toBeNull();
  });

  it("is shown for a current, genuinely empty inventory", () => {
    renderView({ reads: emptySnapshot });
    expect(screen.getByText(EMPTY_MESSAGE)).toBeVisible();
  });

  it("is not shown once the first grant is confirmed by a current read", () => {
    renderView({
      reads: {
        ...emptySnapshot,
        recipients: {
          kind: "known",
          grants: [{ groupId: RESEARCH_GROUP_ID, role: DATASET_ROLE_MAP.edit }],
        },
      },
      operations: [firstGrant],
      inventory: inventoryStatus({ confirmedOperationIds: new Set(["first"]) }),
    });
    expect(screen.queryByText(EMPTY_MESSAGE)).toBeNull();
  });

  it("returns when a current read confirms the last role was removed", () => {
    renderView({
      reads: emptySnapshot,
      operations: [
        operation({
          operationId: "removed",
          role: DATASET_ROLE_MAP.browse,
          action: "remove",
          status: "acknowledged",
        }),
      ],
      inventory: inventoryStatus({
        confirmedOperationIds: new Set(["removed"]),
      }),
    });
    expect(screen.getByText(EMPTY_MESSAGE)).toBeVisible();
  });

  it("is not shown when the only holder is one discovery cannot identify", () => {
    renderView({
      reads: {
        ...emptySnapshot,
        recipients: {
          kind: "known",
          grants: [{ groupId: UNDISCOVERED_GROUP_ID, role: "dg_ds-curate" }],
        },
      },
    });
    expect(screen.queryByText(EMPTY_MESSAGE)).toBeNull();
  });
});

describe("DatasetAccessView — holders and roles without a control", () => {
  const withHolder = (overrides: Partial<DatasetAccessViewProps> = {}) =>
    renderView({
      reads: {
        status: "settled",
        groups: { kind: "read", groups: DISCOVERED_GROUPS },
        recipients: {
          kind: "known",
          grants: [...GRANTS_WITH_UNDISCOVERED_HOLDER],
        },
      },
      ...overrides,
    });

  it("keeps a holder discovery cannot identify, by id, with its roles, read-only", () => {
    withHolder();
    const item = screen
      .getByText(`Group ${UNDISCOVERED_GROUP_ID}`)
      .closest("li") as HTMLElement;

    expect(
      within(item).getByText("Permissions: Edit, dg_ds-curate"),
    ).toBeVisible();
    expect(
      within(item).getByText(
        "Group details unavailable. Permissions are read-only.",
      ),
    ).toBeVisible();
    expect(within(item).queryAllByRole("switch")).toHaveLength(0);
    expect(within(item).queryAllByRole("button")).toHaveLength(0);
    // No audience is guessed for it.
    expect(within(item).queryByText("All DataGEMS users")).toBeNull();
  });

  it("finds a holder by its id in search", async () => {
    const user = userEvent.setup();
    withHolder();
    await user.type(
      screen.getByRole("textbox", { name: "Search groups" }),
      UNDISCOVERED_GROUP_ID.slice(0, 8),
    );
    expect(screen.getByText(`Group ${UNDISCOVERED_GROUP_ID}`)).toBeVisible();
    expect(screen.queryByText(RESEARCH)).toBeNull();
  });

  it("names a role with no control as text on an editable row", () => {
    withHolder();
    const item = screen.getByText(RESEARCH).closest("li") as HTMLElement;
    expect(
      within(item).getByText(
        "Other permissions: dg_ds-curate. These can't be changed here.",
      ),
    ).toBeVisible();
    // The known roles keep their switches.
    expect(within(item).getAllByRole("switch")).toHaveLength(6);
  });

  it("leaves no keyboard stop on a read-only holder", async () => {
    const user = userEvent.setup();
    withHolder({
      reads: {
        status: "settled",
        groups: { kind: "failed" },
        recipients: {
          kind: "known",
          grants: [...GRANTS_WITH_UNDISCOVERED_HOLDER],
        },
      },
    });

    // Search, then Done: nothing in between, because nothing there can act.
    await user.tab();
    expect(
      screen.getByRole("textbox", { name: "Search groups" }),
    ).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Done" })).toHaveFocus();
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
  it("leaves focus on the dialog when the form appears already blocked", () => {
    const props = baseProps({
      reads: {
        status: "settled",
        groups: { kind: "read", groups: DISCOVERED_GROUPS },
        recipients: { kind: "unknown", reason: "not-supported" },
      },
      capabilities: RECIPIENTS_UNSUPPORTED,
      storageAvailable: false,
    });
    // The shell focuses its dialog on open; the reads settling later must not
    // move that focus anywhere.
    const { rerender } = render(
      <div role="dialog" aria-label="Shell" tabIndex={-1} />,
    );
    const shell = screen.getByRole("dialog", { name: "Shell" });
    shell.focus();
    rerender(
      <div role="dialog" aria-label="Shell" tabIndex={-1}>
        <DatasetAccessView {...props} />
      </div>,
    );
    expect(screen.getByRole("button", { name: "Grant access" })).toBeDisabled();
    expect(shell).toHaveFocus();
  });

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

  it("leaves focus on Done, which stays usable while a grant applies", () => {
    const onDone = vi.fn();
    const props = baseProps({
      reads: {
        status: "settled",
        groups: { kind: "read", groups: DISCOVERED_GROUPS },
        recipients: { kind: "unknown", reason: "not-supported" },
      },
      capabilities: RECIPIENTS_UNSUPPORTED,
      onDone,
    });
    const { rerender } = render(<DatasetAccessView {...props} />);
    const done = screen.getByRole("button", { name: "Done" });
    done.focus();

    rerender(
      <DatasetAccessView
        {...props}
        operations={[
          operation({ role: DATASET_ROLE_MAP.browse, status: "pending" }),
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "Grant access" })).toBeDisabled();
    expect(done).toHaveFocus();
    fireEvent.click(done);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe("DatasetAccessView — full-editor keyboard focus", () => {
  it.each([
    ["acknowledged", false],
    ["refused", false],
    ["uncertain", true],
  ] as const)(
    "keeps focus on a switch used from the keyboard while pending and once %s",
    async (status, stillHeld) => {
      const user = userEvent.setup();
      const onRoleChange = vi.fn();
      const { rerenderWith } = renderView({ onRoleChange });
      const control = switchFor(RESEARCH, "Edit");
      control.focus();
      await user.keyboard(" ");
      expect(onRoleChange).toHaveBeenCalledTimes(1);

      rerenderWith({
        onRoleChange,
        operations: [operation({ role: DATASET_ROLE_MAP.edit })],
      });
      // Refused, yet still where the keyboard left it.
      expect(control).toHaveFocus();
      expect(control).not.toBeDisabled();
      expect(control).toHaveAttribute("aria-disabled", "true");
      expect(control).toHaveAccessibleDescription("Granting Edit…");
      await user.keyboard(" ");
      await user.keyboard("{Enter}");
      await user.click(control);
      expect(onRoleChange).toHaveBeenCalledTimes(1);
      // Only its own switch is held; the dataset-wide guard stays native.
      expect(switchFor(RESEARCH, "Search")).toBeDisabled();

      rerenderWith({
        onRoleChange,
        operations: [operation({ role: DATASET_ROLE_MAP.edit, status })],
      });
      expect(control).toHaveFocus();
      if (stillHeld) {
        expect(control).toHaveAttribute("aria-disabled", "true");
        await user.keyboard(" ");
        expect(onRoleChange).toHaveBeenCalledTimes(1);
      } else {
        expect(control).not.toHaveAttribute("aria-disabled");
        expect(control).toBeEnabled();
      }
    },
  );

  it("does not hold a switch that has no change of its own", () => {
    renderView({
      canAttempt: () => ({ kind: "blocked", reason: "uncertain-outcome" }),
    });
    const control = switchFor(RESEARCH, "Edit");
    expect(control).toBeDisabled();
    expect(control).not.toHaveAttribute("aria-disabled");
  });

  it("gives the confirmation Tab and Escape, then returns to the switch", async () => {
    const user = userEvent.setup();
    const onRoleChange = vi.fn();
    const onDone = vi.fn();
    renderView({ onRoleChange, onDone });
    const control = switchFor(RESEARCH, "Manage");
    control.focus();
    await user.keyboard("{Enter}");

    const dialog = screen.getByRole("dialog");
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    for (let i = 0; i < 4; i += 1) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    expect(onRoleChange).not.toHaveBeenCalled();
    expect(control).toHaveFocus();

    await user.keyboard("{Enter}");
    const buttons = within(screen.getByRole("dialog")).getAllByRole("button");
    buttons[buttons.length - 1]?.focus();
    await user.keyboard("{Enter}");
    expect(onRoleChange).toHaveBeenCalledTimes(1);
    expect(control).toHaveFocus();
  });
});
