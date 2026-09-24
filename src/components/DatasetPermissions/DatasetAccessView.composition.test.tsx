/**
 * The view over the real `useDatasetPermissions`.
 *
 * The component tests drive the view through fake props, which proves what it
 * renders but not that the two halves of batch 2 fit together. This file wires
 * the actual hook to the actual view and exercises one acknowledged and one
 * uncertain action end to end. Only the transport and the journal's storage are
 * fakes — the hook itself is not mocked, because a mock of the thing under
 * question would prove nothing about it.
 */

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, useRef } from "react";
import { describe, expect, it } from "vitest";
import { DATASET_ROLE_MAP } from "@/config/contextGrantRoles";
import {
  type DatasetRoleOperations,
  useDatasetPermissions,
} from "@/hooks/useDatasetPermissions";
import { useModalFocus } from "@/hooks/useModalFocus";
import { RESEARCH_GROUP_ID } from "@/lib/datasetPermissions/fixtures";
import type { OperationStorageLike } from "@/lib/datasetPermissions/journal";
import type {
  DatasetRoleOperation,
  DatasetRoleOutcome,
} from "@/lib/datasetPermissions/types";
import { DatasetAccessView } from "./DatasetAccessView";
import {
  ALL_ALLOWED,
  DATASET_NAME,
  DISCOVERED_GROUPS,
  EVERYONE_IDENTIFIED,
  KNOWN_GRANTS,
  RECIPIENTS_UNSUPPORTED,
} from "./fixtures";

const DATASET_ID = "dataset-1";
const SCOPE = {
  principalId: "principal-a",
  gatewayOrigin: "https://gateway.example",
  datasetId: DATASET_ID,
};

const memoryStorage = (): OperationStorageLike => {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
};

/** A transport whose replies this test hands back one at a time. */
const deferredOperations = () => {
  const sent: DatasetRoleOperation[] = [];
  let settle: ((outcome: DatasetRoleOutcome) => void) | null = null;

  const send = (operation: DatasetRoleOperation) => {
    sent.push(operation);
    return new Promise<DatasetRoleOutcome>((resolve) => {
      settle = resolve;
    });
  };

  const operations: DatasetRoleOperations = {
    assignRole: send,
    removeRole: send,
  };

  return {
    operations,
    sent,
    reply: async (outcome: DatasetRoleOutcome) => {
      const resolve = settle;
      settle = null;
      await act(async () => {
        resolve?.(outcome);
      });
    },
  };
};

function Harness({
  operations,
  storage,
  grantOnly = false,
}: {
  operations: DatasetRoleOperations;
  storage: OperationStorageLike | null;
  /** The presentation for a caller who may grant but not read recipients. */
  grantOnly?: boolean;
}) {
  const controller = useDatasetPermissions({
    scope: SCOPE,
    operations,
    storage,
    capabilities: { grant: "allowed", revoke: "allowed" },
  });

  return (
    <DatasetAccessView
      datasetName={DATASET_NAME}
      // Readable recipients: the full editor is the presentation this
      // composition is about, and `selectAccessMode` selects it from exactly
      // the reads passed below.
      mode={{ kind: grantOnly ? "grant-only" : "full-editor" }}
      scopeKey={`${SCOPE.principalId}|${SCOPE.gatewayOrigin}|${SCOPE.datasetId}`}
      reads={{
        status: "settled",
        groups: { kind: "read", groups: DISCOVERED_GROUPS },
        recipients: grantOnly
          ? { kind: "unknown", reason: "not-supported" }
          : { kind: "known", grants: [...KNOWN_GRANTS] },
      }}
      capabilities={grantOnly ? RECIPIENTS_UNSUPPORTED : ALL_ALLOWED}
      everyone={EVERYONE_IDENTIFIED}
      operations={controller.operations}
      storageAvailable={controller.storageAvailable}
      canAttempt={controller.canAttempt}
      onRoleChange={(groupId, role, action) => {
        controller.requestRoleChange(groupId, role, action);
      }}
      onDone={() => undefined}
    />
  );
}

const RESEARCH = "Baltic Modelling Team";

const switchFor = (group: string, role: string) =>
  screen.getByRole("switch", { name: `${group} — ${role}` });

describe("DatasetAccessView over useDatasetPermissions", () => {
  it("shows an acknowledged grant as applied, with the exact request sent once", async () => {
    const transport = deferredOperations();
    render(
      <Harness operations={transport.operations} storage={memoryStorage()} />,
    );

    fireEvent.click(switchFor(RESEARCH, "Edit"));

    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0]).toMatchObject({
      datasetId: DATASET_ID,
      groupId: RESEARCH_GROUP_ID,
      role: DATASET_ROLE_MAP.edit,
      action: "assign",
    });
    expect(screen.getByText("Granting Edit…")).toBeInTheDocument();
    // The dataset-wide guard: nothing else may be started meanwhile.
    expect(switchFor(RESEARCH, "Search")).toBeDisabled();

    await transport.reply({ kind: "acknowledged", httpStatus: 204 });

    expect(screen.getByText("Edit permission granted.")).toBeInTheDocument();
    expect(switchFor(RESEARCH, "Edit")).toHaveAttribute("aria-checked", "true");
    expect(switchFor(RESEARCH, "Search")).toBeEnabled();
    expect(transport.sent).toHaveLength(1);
  });

  it("leaves an uncertain grant unknown, blocked, and its inverse blocked too", async () => {
    const transport = deferredOperations();
    render(
      <Harness operations={transport.operations} storage={memoryStorage()} />,
    );

    fireEvent.click(switchFor(RESEARCH, "Search"));
    await transport.reply({ kind: "uncertain", reason: "no-response" });

    expect(
      screen.getByText(/^Search: we couldn't confirm whether it was granted/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/we couldn't confirm one access change/i),
    ).toBeInTheDocument();

    // Not drawn as granted: nothing established that it was applied.
    const control = switchFor(RESEARCH, "Search");
    expect(control).toHaveAttribute("aria-checked", "false");

    // Repeating it and undoing it are equally unknown, so neither is offered.
    expect(control).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(control);
    expect(transport.sent).toHaveLength(1);

    // An acknowledged change elsewhere stays possible and stays visible.
    fireEvent.click(switchFor(RESEARCH, "Edit"));
    await transport.reply({ kind: "acknowledged", httpStatus: 204 });
    expect(screen.getByText("Edit permission granted.")).toBeInTheDocument();
    expect(
      screen.getByText(/^Search: we couldn't confirm whether it was granted/),
    ).toBeInTheDocument();
  });

  it("sends nothing at all when the journal cannot be stored", () => {
    const transport = deferredOperations();
    render(<Harness operations={transport.operations} storage={null} />);

    expect(
      screen.getByText(/unavailable in this browser tab/i),
    ).toBeInTheDocument();
    fireEvent.click(switchFor(RESEARCH, "Edit"));
    expect(transport.sent).toHaveLength(0);
  });
});

describe("DatasetAccessView over useDatasetPermissions — keyboard focus", () => {
  it("keeps focus on the switch through a keyboard grant and its acknowledgement", async () => {
    const user = userEvent.setup();
    const transport = deferredOperations();
    render(
      <Harness operations={transport.operations} storage={memoryStorage()} />,
    );
    const control = switchFor(RESEARCH, "Edit");
    control.focus();
    await user.keyboard(" ");

    expect(transport.sent).toHaveLength(1);
    expect(control).toHaveFocus();
    // The one-write guard holds against every activation route.
    await user.keyboard(" ");
    await user.keyboard("{Enter}");
    await user.click(control);
    expect(transport.sent).toHaveLength(1);

    await transport.reply({ kind: "acknowledged", httpStatus: 204 });
    expect(control).toHaveFocus();
    expect(control).toHaveAttribute("aria-checked", "true");
    expect(control).toBeEnabled();
  });

  it("returns focus to the switch after confirming a removal, and keeps it when unconfirmed", async () => {
    const user = userEvent.setup();
    const transport = deferredOperations();
    render(
      <Harness operations={transport.operations} storage={memoryStorage()} />,
    );
    // Browse is a known grant, so switching it off is a confirmed removal.
    const control = switchFor(RESEARCH, "Browse");
    control.focus();
    await user.keyboard("{Enter}");
    const buttons = within(screen.getByRole("dialog")).getAllByRole("button");
    buttons[buttons.length - 1]?.focus();
    await user.keyboard("{Enter}");

    // Pending is recorded in the same event that closes the dialog, so the
    // switch is already refused when focus comes back to it.
    expect(transport.sent).toHaveLength(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(control).toHaveFocus();
    expect(control).toHaveAttribute("aria-disabled", "true");

    await transport.reply({ kind: "uncertain", reason: "no-response" });
    expect(control).toHaveFocus();
    await user.keyboard(" ");
    await user.keyboard("{Enter}");
    expect(transport.sent).toHaveLength(1);
  });

  it("moves no focus when a change completes after the view has closed", async () => {
    const user = userEvent.setup();
    const transport = deferredOperations();
    const storage = memoryStorage();
    const { rerender } = render(
      <>
        <button type="button">Elsewhere</button>
        <Harness operations={transport.operations} storage={storage} />
      </>,
    );
    switchFor(RESEARCH, "Edit").focus();
    await user.keyboard(" ");
    expect(transport.sent).toHaveLength(1);

    rerender(<button type="button">Elsewhere</button>);
    const elsewhere = screen.getByRole("button", { name: "Elsewhere" });
    elsewhere.focus();
    await transport.reply({ kind: "acknowledged", httpStatus: 204 });
    expect(elsewhere).toHaveFocus();
  });

  it("hands focus from the shell to the grant results when Grant can no longer take it", async () => {
    // The real shell is a focus layer too: the closing confirmation falls back
    // to it because Grant is already disabled, and the form takes it from there.
    function Shell({ children }: { children: ReactNode }) {
      const ref = useRef<HTMLDivElement>(null);
      useModalFocus({
        active: true,
        containerRef: ref,
        initialFocus: "container",
      });
      return (
        <div ref={ref} role="dialog" aria-label="Shell" tabIndex={-1}>
          {children}
        </div>
      );
    }
    const user = userEvent.setup();
    const transport = deferredOperations();
    render(
      <Shell>
        <Harness
          operations={transport.operations}
          storage={memoryStorage()}
          grantOnly
        />
      </Shell>,
    );
    await user.selectOptions(screen.getByLabelText("Group"), RESEARCH_GROUP_ID);
    await user.click(screen.getByRole("radio", { name: "Manage" }));
    screen.getByRole("button", { name: "Grant access" }).focus();
    await user.keyboard("{Enter}");
    const buttons = within(
      screen.getByRole("dialog", { name: /grant manage/i }),
    ).getAllByRole("button");
    buttons[buttons.length - 1]?.focus();
    await user.keyboard("{Enter}");

    expect(transport.sent).toHaveLength(1);
    expect(screen.getByText("Your changes").parentElement).toHaveFocus();
  });

  it("puts focus on the grant results after a confirmed grant disables the form", async () => {
    const user = userEvent.setup();
    const transport = deferredOperations();
    render(
      <Harness
        operations={transport.operations}
        storage={memoryStorage()}
        grantOnly
      />,
    );
    await user.selectOptions(screen.getByLabelText("Group"), RESEARCH_GROUP_ID);
    await user.click(screen.getByRole("radio", { name: "Manage" }));
    const grant = screen.getByRole("button", { name: "Grant access" });
    grant.focus();
    await user.keyboard("{Enter}");
    const buttons = within(screen.getByRole("dialog")).getAllByRole("button");
    buttons[buttons.length - 1]?.focus();
    await user.keyboard("{Enter}");

    expect(transport.sent).toHaveLength(1);
    expect(grant).toBeDisabled();
    const results = screen.getByText("Your changes").parentElement;
    expect(results).toHaveFocus();

    await transport.reply({ kind: "acknowledged", httpStatus: 204 });
    expect(results).toHaveFocus();
  });
});
