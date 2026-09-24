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

import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DATASET_ROLE_MAP } from "@/config/contextGrantRoles";
import {
  type DatasetRoleOperations,
  useDatasetPermissions,
} from "@/hooks/useDatasetPermissions";
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
}: {
  operations: DatasetRoleOperations;
  storage: OperationStorageLike | null;
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
      mode={{ kind: "full-editor" }}
      scopeKey={`${SCOPE.principalId}|${SCOPE.gatewayOrigin}|${SCOPE.datasetId}`}
      reads={{
        status: "settled",
        groups: { kind: "read", groups: DISCOVERED_GROUPS },
        recipients: { kind: "known", grants: [...KNOWN_GRANTS] },
      }}
      capabilities={ALL_ALLOWED}
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
    expect(control).toBeDisabled();
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
