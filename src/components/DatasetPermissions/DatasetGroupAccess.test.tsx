import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseSession = vi.fn();
const mockGetSession = vi.fn();
const mockUseFeatureFlag = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
  getSession: () => mockGetSession(),
}));

vi.mock("@/contexts/FeatureFlagsContext", () => ({
  useFeatureFlag: (id: string) => mockUseFeatureFlag(id),
}));

import { DATASET_ROLE_MAP } from "@/config/contextGrantRoles";
import {
  DATASET_ID,
  EVERYONE_GROUP_ID,
  RESEARCH_GROUP_ID,
  UNDISCOVERED_GROUP_ID,
} from "@/lib/datasetPermissions/fixtures";
import {
  OPERATION_JOURNAL_KEY,
  type OperationStorageLike,
} from "@/lib/datasetPermissions/journal";
import { ACCESS_ACTION_NAMES } from "@/lib/datasetPermissions/types";
import { DatasetGroupAccess } from "./DatasetGroupAccess";

/**
 * The shared destination, end to end, with the network intercepted.
 *
 * Everything between the session and `fetch` is the real application code:
 * `useApi`'s private transport, `fetchWithAuth`, the accepted adapter, the
 * read orchestration, the operation lifecycle and the view. Only two things
 * are faked — who is signed in, and what the Gateway replies — so the requests
 * counted here are the ones a browser would send.
 *
 * No real dataset, account or grant is involved: every identity and payload
 * below is synthetic, and no request leaves the test process.
 */

const API_BASE = "https://gateway.test/dg";
const PRINCIPAL = "0d6f2a3c-1b44-4e9a-8f07-52c1a7d9e380";
const DATASET_NAME = "Baltic Sea Salinity Profiles";
const BROWSE = DATASET_ROLE_MAP.browse;

const GROUPS_BODY = {
  items: [
    { id: EVERYONE_GROUP_ID, name: "Everyone", semantics: ["everyone"] },
    { id: RESEARCH_GROUP_ID, name: "Baltic Modelling Team", semantics: [] },
  ],
};

interface Reply {
  readonly status?: number;
  readonly body?: unknown;
  /** Never settles, for observing a request that is genuinely in flight. */
  readonly pending?: boolean;
}

interface Replies {
  readonly me?: Reply;
  readonly dataset?: Reply;
  readonly groups?: Reply;
  /** The dataset inventory; a function is asked per read, numbered from 0. */
  readonly inventory?: Reply | ((read: number) => Reply);
  readonly mutation?: Reply;
}

/** `GET /principal/context-grants/dataset` for this dataset, synthetic. */
const inventoryBody = (
  userGroups: readonly { id: string; roles: readonly string[] }[],
) => [{ datasetId: DATASET_ID, users: [], userGroups }];

const RESEARCH_BROWSE = inventoryBody([
  { id: RESEARCH_GROUP_ID, roles: [DATASET_ROLE_MAP.browse] },
]);

const ALL_PERMISSIONS = [
  ACCESS_ACTION_NAMES.grant,
  ACCESS_ACTION_NAMES.revoke,
  ACCESS_ACTION_NAMES.lookupRecipients,
];

interface Recorded {
  readonly url: string;
  readonly method: string;
}

/**
 * Routes by URL, and **denies anything unrecognised**.
 *
 * An unexpected request is a failed test, not a silent 404: the point of
 * several cases below is that a particular request was never made.
 */
const intercept = (replies: Replies = {}) => {
  const calls: Recorded[] = [];
  const never = () => new Promise<Response>(() => {});

  const respond = (reply: Reply | undefined, fallback: unknown): Response => {
    if (reply?.pending) return never() as unknown as Response;
    const status = reply?.status ?? 200;
    const body = reply?.body ?? fallback;
    return status === 204 || body === null
      ? new Response(null, { status })
      : new Response(JSON.stringify(body), { status });
  };

  let inventoryReads = 0;

  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      calls.push({ url, method });

      if (url.includes("/principal/me")) {
        return respond(replies.me, { permissions: ALL_PERMISSIONS });
      }
      // The dataset inventory. The per-group route is deliberately *not*
      // routed: a request to it falls through to the unexpected-request throw.
      if (
        method === "GET" &&
        url.includes("/principal/context-grants/dataset?")
      ) {
        const read = inventoryReads;
        inventoryReads += 1;
        const reply =
          typeof replies.inventory === "function"
            ? replies.inventory(read)
            : replies.inventory;
        return respond(reply, inventoryBody([]));
      }
      if (url.includes("/principal/context-grants/group/")) {
        return respond(replies.mutation, null);
      }
      if (url.includes("/user/group/query")) {
        return respond(replies.groups, GROUPS_BODY);
      }
      if (url.includes("/dataset/")) {
        return respond(replies.dataset, { id: DATASET_ID, permissions: [] });
      }
      throw new Error(`unexpected request: ${method} ${url}`);
    },
  );

  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock };
};

const makeStorage = (options: { failWrites?: boolean } = {}) => {
  const entries = new Map<string, string>();
  const storage: OperationStorageLike = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      if (options.failWrites) throw new Error("quota");
      entries.set(key, value);
    },
    removeItem: (key) => {
      entries.delete(key);
    },
  };
  return { storage, entries };
};

const journalEntries = (entries: Map<string, string>) => {
  const raw = entries.get(OPERATION_JOURNAL_KEY);
  return raw === undefined ? [] : JSON.parse(raw).entries;
};

const mount = (
  props: {
    storage?: OperationStorageLike | null;
    onDone?: () => void;
    onUnavailable?: () => void;
    datasetId?: string;
  } = {},
) =>
  render(
    <DatasetGroupAccess
      datasetId={props.datasetId ?? DATASET_ID}
      datasetName={DATASET_NAME}
      onDone={props.onDone ?? (() => undefined)}
      onUnavailable={props.onUnavailable}
      storage={
        props.storage === undefined ? makeStorage().storage : props.storage
      }
    />,
  );

const switchFor = (group: string, role: string) =>
  screen.getByRole("switch", { name: `${group} — ${role}` });

const RESEARCH = "Baltic Modelling Team";

const mutationCalls = (calls: readonly Recorded[]) =>
  calls.filter((call) => call.url.includes("/principal/context-grants/group/"));

const inventoryCalls = (calls: readonly Recorded[]) =>
  calls.filter((call) =>
    call.url.includes("/principal/context-grants/dataset?"),
  );

/** Requests to the retired per-group route. Always expected to be none. */
const perGroupCalls = (calls: readonly Recorded[]) =>
  calls.filter((call) => call.url.includes("/principal/group/"));

beforeEach(() => {
  vi.clearAllMocks();
  window.__env = { ...window.__env, DATAGEMS_API_BASE_URL: API_BASE };
  mockUseSession.mockReturnValue({
    status: "authenticated",
    data: { accessToken: "token-1", user: { id: PRINCIPAL } },
  });
  mockUseFeatureFlag.mockReturnValue(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the full editor, through the real binding", () => {
  it("reads capabilities, groups and the inventory, then shows known assignments", async () => {
    const { calls } = intercept({ inventory: { body: RESEARCH_BROWSE } });

    mount();

    await waitFor(() =>
      expect(switchFor(RESEARCH, "Browse")).toHaveAttribute(
        "aria-checked",
        "true",
      ),
    );
    expect(switchFor(RESEARCH, "Edit")).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(switchFor("Everyone", "Browse")).toHaveAttribute(
      "aria-checked",
      "false",
    );

    // Two capability reads, one discovery, one inventory read — and no
    // per-group read at all.
    expect(calls.filter((c) => c.url.includes("/principal/me"))).toHaveLength(
      1,
    );
    expect(
      calls.filter((c) => c.url.includes("/user/group/query")),
    ).toHaveLength(1);
    expect(inventoryCalls(calls)).toEqual([
      {
        url: `${API_BASE}/gw/api/principal/context-grants/dataset?id=${DATASET_ID}`,
        method: "GET",
      },
    ]);
    expect(perGroupCalls(calls)).toHaveLength(0);
    expect(mutationCalls(calls)).toHaveLength(0);
  });

  it("gives a dataset manager the editor without the old global lookup", async () => {
    const { calls } = intercept({
      me: { body: { permissions: ["BrowseDataset"] } },
      dataset: {
        body: {
          id: DATASET_ID,
          permissions: [
            "addusertocontextgrantgroup",
            "removeuserfromcontextgrantgroup",
            "lookupdatasetcontextgrants",
          ],
        },
      },
      inventory: { body: RESEARCH_BROWSE },
    });

    mount();

    await waitFor(() =>
      expect(switchFor(RESEARCH, "Browse")).toHaveAttribute(
        "aria-checked",
        "true",
      ),
    );
    expect(switchFor(RESEARCH, "Edit")).toBeEnabled();
    expect(perGroupCalls(calls)).toHaveLength(0);
  });

  it("shows a holder discovery cannot identify, read-only", async () => {
    intercept({
      inventory: {
        body: inventoryBody([
          { id: UNDISCOVERED_GROUP_ID, roles: [DATASET_ROLE_MAP.edit] },
        ]),
      },
    });

    mount();

    await waitFor(() =>
      expect(
        screen.getByText(`Group ${UNDISCOVERED_GROUP_ID}`),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("Permissions: Edit")).toBeInTheDocument();
    expect(
      screen.getByText("Group details unavailable. Permissions are read-only."),
    ).toBeInTheDocument();
    // No control for it: there is no verified target to change.
    expect(
      screen.queryByRole("switch", {
        name: new RegExp(UNDISCOVERED_GROUP_ID),
      }),
    ).toBeNull();
  });

  it("says an explicit empty inventory assigns no group permissions", async () => {
    intercept();
    mount();

    await waitFor(() =>
      expect(
        screen.getByText("No group permissions assigned."),
      ).toBeInTheDocument(),
    );
    // Discoverable groups remain as unassigned targets.
    expect(switchFor(RESEARCH, "Browse")).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.queryByText(/nobody|no one/i)).toBeNull();
  });

  it("sends exactly one request for one deliberate change, and records it first", async () => {
    const { storage, entries } = makeStorage();
    const { calls } = intercept({ mutation: { pending: true } });

    mount({ storage });
    await waitFor(() => switchFor(RESEARCH, "Edit"));

    fireEvent.click(switchFor(RESEARCH, "Edit"));

    await waitFor(() => expect(mutationCalls(calls)).toHaveLength(1));
    expect(mutationCalls(calls)[0]).toEqual({
      url:
        `${API_BASE}/gw/api/principal/context-grants/group/${RESEARCH_GROUP_ID}` +
        `/dataset/${DATASET_ID}/role/${DATASET_ROLE_MAP.edit}`,
      method: "POST",
    });
    // The recovery record exists before the response does.
    expect(journalEntries(entries)).toHaveLength(1);
  });

  it("refuses a second change while one is in flight", async () => {
    const { calls } = intercept({ mutation: { pending: true } });

    mount();
    await waitFor(() => switchFor(RESEARCH, "Edit"));

    fireEvent.click(switchFor(RESEARCH, "Edit"));
    await waitFor(() => expect(mutationCalls(calls)).toHaveLength(1));
    fireEvent.click(switchFor(RESEARCH, "Search"));

    expect(mutationCalls(calls)).toHaveLength(1);
  });

  it("reads the dataset inventory once more after the Gateway acknowledges", async () => {
    const { calls } = intercept({
      mutation: { status: 200 },
      inventory: (read) => ({
        body:
          read === 0
            ? inventoryBody([])
            : inventoryBody([
                { id: RESEARCH_GROUP_ID, roles: [DATASET_ROLE_MAP.edit] },
              ]),
      }),
    });

    mount();
    await waitFor(() => switchFor(RESEARCH, "Edit"));
    expect(inventoryCalls(calls)).toHaveLength(1);

    fireEvent.click(switchFor(RESEARCH, "Edit"));

    await waitFor(() => expect(inventoryCalls(calls)).toHaveLength(2));
    await waitFor(() =>
      expect(switchFor(RESEARCH, "Search")).not.toHaveAttribute(
        "aria-disabled",
      ),
    );
    expect(switchFor(RESEARCH, "Edit")).toHaveAttribute("aria-checked", "true");
    // The matching read leaves nothing to refresh.
    expect(screen.queryByRole("button", { name: "Refresh access" })).toBeNull();
    expect(perGroupCalls(calls)).toHaveLength(0);
    expect(mutationCalls(calls)).toHaveLength(1);
  });

  it("does not roll a change back when the following read disagrees", async () => {
    // The read reports the role as absent — the read and the write may
    // simply have crossed. An acknowledgement is not undone by a later read.
    const { calls } = intercept({ mutation: { status: 200 } });

    mount();
    await waitFor(() => switchFor(RESEARCH, "Edit"));
    fireEvent.click(switchFor(RESEARCH, "Edit"));

    await waitFor(() =>
      expect(
        screen.getByText("Change saved. Current access couldn't be refreshed."),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("Edit permission granted.")).toBeInTheDocument();
    expect(switchFor(RESEARCH, "Edit")).toHaveAttribute("aria-checked", "true");

    // A stale list authorizes nothing: every switch waits for a good read.
    // Held rather than natively disabled, so focus is never dropped.
    expect(switchFor(RESEARCH, "Search")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    fireEvent.click(switchFor(RESEARCH, "Search"));
    expect(mutationCalls(calls)).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Refresh access" }),
    ).toBeVisible();
  });

  it("keeps an acknowledged change and offers Refresh access when the read fails", async () => {
    const { calls } = intercept({
      mutation: { status: 200 },
      inventory: (read) =>
        read === 0 ? { body: inventoryBody([]) } : { status: 503, body: null },
    });

    mount();
    await waitFor(() => switchFor(RESEARCH, "Edit"));
    fireEvent.click(switchFor(RESEARCH, "Edit"));

    await waitFor(() =>
      expect(
        screen.getByText("Change saved. Current access couldn't be refreshed."),
      ).toBeInTheDocument(),
    );
    expect(switchFor(RESEARCH, "Edit")).toHaveAttribute("aria-checked", "true");
    expect(mutationCalls(calls)).toHaveLength(1);
  });

  describe("an acknowledged first grant on an empty inventory", () => {
    const EMPTY_MESSAGE = "No group permissions assigned.";
    const RESEARCH_EDIT = inventoryBody([
      { id: RESEARCH_GROUP_ID, roles: [DATASET_ROLE_MAP.edit] },
    ]);

    const grantFirst = async () => {
      await waitFor(() => screen.getByText(EMPTY_MESSAGE));
      fireEvent.click(switchFor(RESEARCH, "Edit"));
      await waitFor(() =>
        expect(
          screen.getByText("Edit permission granted."),
        ).toBeInTheDocument(),
      );
    };

    it("drops the empty message while the following read runs", async () => {
      let readsSeen = 0;
      intercept({
        mutation: { status: 200 },
        inventory: () => {
          readsSeen += 1;
          return readsSeen === 1
            ? { body: inventoryBody([]) }
            : { pending: true };
        },
      });
      mount();
      await grantFirst();

      expect(switchFor(RESEARCH, "Edit")).toHaveAttribute(
        "aria-checked",
        "true",
      );
      expect(screen.queryByText(EMPTY_MESSAGE)).toBeNull();
    });

    it("does not deny the grant when the following read fails", async () => {
      intercept({
        mutation: { status: 200 },
        inventory: (read) =>
          read === 0
            ? { body: inventoryBody([]) }
            : { status: 503, body: null },
      });
      mount();
      await grantFirst();

      await waitFor(() =>
        screen.getByText("Change saved. Current access couldn't be refreshed."),
      );
      expect(switchFor(RESEARCH, "Edit")).toHaveAttribute(
        "aria-checked",
        "true",
      );
      expect(screen.queryByText(EMPTY_MESSAGE)).toBeNull();
    });

    it("does not deny the grant when the following read comes back empty", async () => {
      intercept({ mutation: { status: 200 } });
      mount();
      await grantFirst();

      await waitFor(() =>
        screen.getByText("Change saved. Current access couldn't be refreshed."),
      );
      expect(switchFor(RESEARCH, "Edit")).toHaveAttribute(
        "aria-checked",
        "true",
      );
      expect(screen.queryByText(EMPTY_MESSAGE)).toBeNull();
    });

    it("recovers through Refresh access without the empty message", async () => {
      const { calls } = intercept({
        mutation: { status: 200 },
        inventory: (read) =>
          read === 0
            ? { body: inventoryBody([]) }
            : read === 1
              ? { status: 503, body: null }
              : { body: RESEARCH_EDIT },
      });
      mount();
      await grantFirst();
      fireEvent.click(
        await screen.findByRole("button", { name: "Refresh access" }),
      );

      await waitFor(() =>
        expect(
          screen.queryByRole("button", { name: "Refresh access" }),
        ).toBeNull(),
      );
      expect(switchFor(RESEARCH, "Edit")).toHaveAttribute(
        "aria-checked",
        "true",
      );
      expect(screen.queryByText(EMPTY_MESSAGE)).toBeNull();
      expect(mutationCalls(calls)).toHaveLength(1);
    });
  });

  it("recovers through Refresh access with one GET and no write", async () => {
    const { calls } = intercept({
      mutation: { status: 200 },
      inventory: (read) =>
        read === 0
          ? { body: inventoryBody([]) }
          : read === 1
            ? { status: 503, body: null }
            : {
                body: inventoryBody([
                  { id: RESEARCH_GROUP_ID, roles: [DATASET_ROLE_MAP.edit] },
                ]),
              },
    });

    mount();
    await waitFor(() => switchFor(RESEARCH, "Edit"));
    fireEvent.click(switchFor(RESEARCH, "Edit"));
    const refresh = await screen.findByRole("button", {
      name: "Refresh access",
    });

    refresh.focus();
    fireEvent.click(refresh);

    // While its read runs the button stays, so the focus on it is kept.
    expect(refresh).toHaveFocus();
    expect(refresh).toHaveAttribute("aria-busy", "true");

    await waitFor(() =>
      expect(switchFor(RESEARCH, "Search")).not.toHaveAttribute(
        "aria-disabled",
      ),
    );
    expect(
      screen.queryByText("Change saved. Current access couldn't be refreshed."),
    ).toBeNull();
    expect(inventoryCalls(calls)).toHaveLength(3);
    expect(mutationCalls(calls)).toHaveLength(1);
    // The button has gone; focus is kept inside the surface, on Done.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Done" })).toHaveFocus(),
    );
    expect(screen.queryByRole("button", { name: "Refresh access" })).toBeNull();
  });

  it("keeps an uncertain outcome blocked and never replays it", async () => {
    // 424: the group lookup may have failed before any write, or Keycloak may
    // have failed after one. The response does not say which.
    const { calls } = intercept({ mutation: { status: 424 } });

    mount();
    await waitFor(() => switchFor(RESEARCH, "Edit"));
    fireEvent.click(switchFor(RESEARCH, "Edit"));

    await waitFor(() =>
      expect(
        screen.getByText(/^Edit: we couldn't confirm whether it was granted/),
      ).toBeInTheDocument(),
    );
    // Refused, but kept focusable: it is the switch the user just operated.
    expect(switchFor(RESEARCH, "Edit")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    // Neither repeating it nor sending its inverse is offered.
    fireEvent.click(switchFor(RESEARCH, "Edit"));
    expect(mutationCalls(calls)).toHaveLength(1);
  });

  it("sends nothing when the recovery record cannot be stored", async () => {
    // The store reads fine and refuses writes, which is the realistic shape of
    // a quota or blocked-site-data failure: it is discovered at the moment the
    // intent must be recorded, not on mount.
    const { storage } = makeStorage({ failWrites: true });
    const { calls } = intercept();

    mount({ storage });
    await waitFor(() => switchFor(RESEARCH, "Edit"));
    fireEvent.click(switchFor(RESEARCH, "Edit"));

    await waitFor(() =>
      expect(
        screen.getByText(/unavailable in this browser tab/i),
      ).toBeVisible(),
    );
    // Stopped *before* dispatch: a lost response with no record would invite a
    // repeat of a write that may already have happened.
    expect(mutationCalls(calls)).toHaveLength(0);
    expect(switchFor(RESEARCH, "Edit")).toBeDisabled();
  });

  it("confirms an elevated role before sending it", async () => {
    const { calls } = intercept({ mutation: { status: 200 } });

    mount();
    await waitFor(() => switchFor(RESEARCH, "Manage"));
    fireEvent.click(switchFor(RESEARCH, "Manage"));

    expect(
      screen.getByText(/change who has access to the dataset/i),
    ).toBeInTheDocument();
    expect(mutationCalls(calls)).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: /grant manage/i }));
    await waitFor(() => expect(mutationCalls(calls)).toHaveLength(1));
  });

  it("confirms Everyone Browse, and never bundles another role with it", async () => {
    const { calls } = intercept({ mutation: { status: 200 } });

    mount();
    await waitFor(() => switchFor("Everyone", "Browse"));
    fireEvent.click(switchFor("Everyone", "Browse"));

    expect(
      screen.getByText(/everyone who can sign in to DataGEMS/i),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /grant browse/i }));

    await waitFor(() => expect(mutationCalls(calls)).toHaveLength(1));
    expect(mutationCalls(calls)[0].url).toContain(`/role/${BROWSE}`);
  });
});

describe("the grant-only presentation", () => {
  /**
   * Complete global and dataset reads without the lookup permission confirm
   * the policy, and the dataset read is refused accordingly.
   */
  const managerReplies: Replies = {
    me: { body: { permissions: [ACCESS_ACTION_NAMES.grant] } },
    inventory: { status: 403, body: null },
  };

  it("is selected by a confirmed lookup restriction and a refused inventory", async () => {
    const { calls } = intercept(managerReplies);

    mount();

    await waitFor(() =>
      expect(
        screen.getByText(/can't view existing permissions/i),
      ).toBeInTheDocument(),
    );
    // Asked once — the endpoint decides — and never per group.
    expect(inventoryCalls(calls)).toHaveLength(1);
    expect(perGroupCalls(calls)).toHaveLength(0);
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
  });

  it("does not read the inventory again after a grant-only change", async () => {
    const { calls } = intercept({
      ...managerReplies,
      mutation: { status: 200 },
    });
    mount();

    await waitFor(() => screen.getByLabelText("Group"));
    fireEvent.change(screen.getByLabelText("Group"), {
      target: { value: RESEARCH_GROUP_ID },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Download" }));
    fireEvent.click(screen.getByRole("button", { name: /grant access/i }));

    await waitFor(() =>
      expect(
        screen.getByText(
          "Download permission granted to Baltic Modelling Team.",
        ),
      ).toBeInTheDocument(),
    );
    expect(inventoryCalls(calls)).toHaveLength(1);
  });

  it("offers no revocation and no sharing summary", async () => {
    intercept(managerReplies);
    mount();

    await waitFor(() => screen.getByLabelText("Group"));
    expect(
      screen.getByText(
        /to review or remove them, ask a DataGEMS administrator/i,
      ),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: /remove/i })).toBeNull();
    expect(screen.queryByText(/open access/i)).toBeNull();
  });

  it("sends exactly the chosen group and role", async () => {
    const { calls } = intercept({
      ...managerReplies,
      mutation: { status: 200 },
    });
    mount();

    await waitFor(() => screen.getByLabelText("Group"));
    fireEvent.change(screen.getByLabelText("Group"), {
      target: { value: RESEARCH_GROUP_ID },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Download" }));
    fireEvent.click(screen.getByRole("button", { name: /grant access/i }));

    await waitFor(() => expect(mutationCalls(calls)).toHaveLength(1));
    expect(mutationCalls(calls)[0]).toEqual({
      url:
        `${API_BASE}/gw/api/principal/context-grants/group/${RESEARCH_GROUP_ID}` +
        `/dataset/${DATASET_ID}/role/${DATASET_ROLE_MAP.download}`,
      method: "POST",
    });
  });

  it("will not submit without both a group and a role", async () => {
    const { calls } = intercept(managerReplies);
    mount();

    await waitFor(() => screen.getByLabelText("Group"));
    expect(
      screen.getByRole("button", { name: /grant access/i }),
    ).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Group"), {
      target: { value: RESEARCH_GROUP_ID },
    });
    expect(
      screen.getByRole("button", { name: /grant access/i }),
    ).toBeDisabled();
    expect(mutationCalls(calls)).toHaveLength(0);
  });

  it("names an unknown grant, blocks repeating it before the click, and keeps it on reopen", async () => {
    // 424: the Gateway's reply does not establish whether the grant happened.
    const { calls } = intercept({
      ...managerReplies,
      mutation: { status: 424 },
    });
    const { storage } = makeStorage();
    const choose = (role: string) => {
      fireEvent.change(screen.getByLabelText("Group"), {
        target: { value: RESEARCH_GROUP_ID },
      });
      fireEvent.click(screen.getByRole("radio", { name: role }));
    };
    const grantButton = () =>
      screen.getByRole("button", { name: /grant access/i });

    const first = mount({ storage });
    await waitFor(() => screen.getByLabelText("Group"));
    choose("Download");
    fireEvent.click(grantButton());

    await waitFor(() =>
      expect(
        screen.getByText(
          /^We couldn't confirm whether Download permission was granted to Baltic Modelling Team\./,
        ),
      ).toBeInTheDocument(),
    );
    // The same choice is disabled and explained, not silently ignored.
    expect(grantButton()).toBeDisabled();
    expect(grantButton()).toHaveAccessibleDescription(
      /can't change Download for/,
    );
    fireEvent.click(grantButton());
    expect(mutationCalls(calls)).toHaveLength(1);

    first.unmount();
    mount({ storage });
    await waitFor(() =>
      expect(
        screen.getByText(
          /^We couldn't confirm whether an earlier Download grant to Baltic Modelling Team was applied\./,
        ),
      ).toBeInTheDocument(),
    );
    choose("Download");
    expect(grantButton()).toBeDisabled();
    // Another permission for the same group is still available.
    choose("Search");
    expect(grantButton()).toBeEnabled();
    expect(mutationCalls(calls)).toHaveLength(1);
  });

  it("confirms a grant to the public audience", async () => {
    const { calls } = intercept({
      ...managerReplies,
      mutation: { status: 200 },
    });
    mount();

    await waitFor(() => screen.getByLabelText("Group"));
    fireEvent.change(screen.getByLabelText("Group"), {
      target: { value: EVERYONE_GROUP_ID },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Browse" }));
    fireEvent.click(screen.getByRole("button", { name: /grant access/i }));

    expect(mutationCalls(calls)).toHaveLength(0);
    expect(
      screen.getByText(/will be able to find and open this dataset/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /grant browse/i }));
    await waitFor(() => expect(mutationCalls(calls)).toHaveLength(1));
  });
});

describe("read failure is never worked around", () => {
  it("explains an unexpected recipient refusal instead of offering the grant form", async () => {
    // The caller's lookup capability is positively established, and the read
    // is refused anyway. One refusal is not a policy.
    intercept({ inventory: { status: 403, body: null } });

    mount();

    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: "Couldn't load group permissions",
        }),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByLabelText("Group")).toBeNull();
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
  });

  it.each([
    ["a server error", { status: 500, body: null }],
    ["a missing route", { status: 404, body: null }],
    ["an unsupported method", { status: 405, body: null }],
    ["a session that stays unauthorized", { status: 401, body: null }],
    ["a malformed body", { body: [] }],
  ])(
    "explains %s without downgrading or trying another route",
    async (_label, reply) => {
      const { calls } = intercept({ inventory: reply });

      mount();

      await waitFor(() =>
        expect(
          screen.getByRole("heading", {
            name: "Couldn't load group permissions",
          }),
        ).toBeInTheDocument(),
      );
      expect(screen.queryByLabelText("Group")).toBeNull();
      expect(screen.queryAllByRole("switch")).toHaveLength(0);
      expect(perGroupCalls(calls)).toHaveLength(0);
      expect(
        screen.getByRole("button", { name: "Refresh access" }),
      ).toBeVisible();
    },
  );

  it("recovers from a failed read on open through Refresh access", async () => {
    const { calls } = intercept({
      inventory: (read) =>
        read === 0 ? { status: 503, body: null } : { body: RESEARCH_BROWSE },
    });

    mount();
    fireEvent.click(
      await screen.findByRole("button", { name: "Refresh access" }),
    );

    await waitFor(() =>
      expect(switchFor(RESEARCH, "Browse")).toHaveAttribute(
        "aria-checked",
        "true",
      ),
    );
    expect(inventoryCalls(calls)).toHaveLength(2);
    // Discovery and capabilities are not re-read; nothing is written.
    expect(calls.filter((c) => c.url.includes("/principal/me"))).toHaveLength(
      1,
    );
    expect(
      calls.filter((c) => c.url.includes("/user/group/query")),
    ).toHaveLength(1);
    expect(mutationCalls(calls)).toHaveLength(0);
  });

  it("keeps the inventory visible, read-only, when group discovery fails", async () => {
    intercept({
      groups: { status: 500, body: null },
      inventory: { body: RESEARCH_BROWSE },
    });

    mount();

    await waitFor(() =>
      expect(
        screen.getByText(`Group ${RESEARCH_GROUP_ID}`),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("Permissions: Browse")).toBeInTheDocument();
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
  });

  it("offers no editor when nothing about the caller could be established", async () => {
    intercept({
      me: { status: 500, body: null },
      inventory: { status: 403, body: null },
    });

    mount();

    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: "Couldn't load group permissions",
        }),
      ).toBeVisible(),
    );
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
    expect(screen.queryByLabelText("Group")).toBeNull();
  });
});

describe("the rollout flag", () => {
  it("mounts nothing and requests nothing while it is off", async () => {
    mockUseFeatureFlag.mockReturnValue(false);
    const { fetchMock } = intercept();
    const onUnavailable = vi.fn();

    const { container } = mount({ onUnavailable });

    await waitFor(() => expect(onUnavailable).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("closes the surface and keeps the journal when the flag is lost", async () => {
    const { storage, entries } = makeStorage();
    const { calls } = intercept({ mutation: { pending: true } });
    const onUnavailable = vi.fn();

    const { rerender } = render(
      <DatasetGroupAccess
        datasetId={DATASET_ID}
        datasetName={DATASET_NAME}
        onDone={() => undefined}
        onUnavailable={onUnavailable}
        storage={storage}
      />,
    );
    await waitFor(() => switchFor(RESEARCH, "Edit"));
    fireEvent.click(switchFor(RESEARCH, "Edit"));
    await waitFor(() => expect(mutationCalls(calls)).toHaveLength(1));

    mockUseFeatureFlag.mockReturnValue(false);
    rerender(
      <DatasetGroupAccess
        datasetId={DATASET_ID}
        datasetName={DATASET_NAME}
        onDone={() => undefined}
        onUnavailable={onUnavailable}
        storage={storage}
      />,
    );

    expect(onUnavailable).toHaveBeenCalled();
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
    // The unresolved record is recovery evidence, not part of the surface.
    expect(journalEntries(entries)).toHaveLength(1);
    expect(mutationCalls(calls)).toHaveLength(1);
  });

  it("dispatches nothing new after the flag is lost with a confirmation open", async () => {
    const { calls } = intercept({ mutation: { status: 200 } });

    const { rerender } = render(
      <DatasetGroupAccess
        datasetId={DATASET_ID}
        datasetName={DATASET_NAME}
        onDone={() => undefined}
        storage={makeStorage().storage}
      />,
    );
    await waitFor(() => switchFor(RESEARCH, "Manage"));
    fireEvent.click(switchFor(RESEARCH, "Manage"));
    expect(screen.getByRole("button", { name: /grant manage/i })).toBeVisible();

    mockUseFeatureFlag.mockReturnValue(false);
    rerender(
      <DatasetGroupAccess
        datasetId={DATASET_ID}
        datasetName={DATASET_NAME}
        onDone={() => undefined}
        storage={makeStorage().storage}
      />,
    );

    expect(screen.queryByRole("button", { name: /grant manage/i })).toBeNull();
    expect(mutationCalls(calls)).toHaveLength(0);
  });
});

describe("identity", () => {
  it("requests nothing before the session resolves", async () => {
    mockUseSession.mockReturnValue({ status: "loading", data: null });
    const { fetchMock } = intercept();

    mount();
    await waitFor(() =>
      expect(screen.getByText(/access settings unavailable/i)).toBeVisible(),
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("starts a fresh read for a replacement account and shows nothing of the previous one", async () => {
    const { calls } = intercept({ inventory: { body: RESEARCH_BROWSE } });

    const { rerender } = mount();
    await waitFor(() =>
      expect(switchFor(RESEARCH, "Browse")).toHaveAttribute(
        "aria-checked",
        "true",
      ),
    );

    mockUseSession.mockReturnValue({
      status: "authenticated",
      data: {
        accessToken: "token-2",
        user: { id: "f19c5b02-77ae-4d31-9c5e-2a840be6f1cc" },
      },
    });
    rerender(
      <DatasetGroupAccess
        datasetId={DATASET_ID}
        datasetName={DATASET_NAME}
        onDone={() => undefined}
        storage={makeStorage().storage}
      />,
    );

    // No previous owner's recipients on screen, not even for one frame.
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
    await waitFor(() =>
      expect(
        calls.filter((c) => c.url.includes("/principal/me")).length,
      ).toBeGreaterThan(1),
    );
  });
});

describe("the default operation journal store", () => {
  // No `storage` prop: this is the store the application actually uses.
  const mountDefault = () =>
    render(
      <DatasetGroupAccess
        datasetId={DATASET_ID}
        datasetName={DATASET_NAME}
        onDone={() => undefined}
      />,
    );

  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  afterEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("keeps an unknown outcome in this tab's sessionStorage across close and reopen", async () => {
    const { calls } = intercept({ mutation: { status: 424 } });

    const first = mountDefault();
    await waitFor(() => switchFor(RESEARCH, "Edit"));
    fireEvent.click(switchFor(RESEARCH, "Edit"));
    await waitFor(() =>
      expect(
        screen.getByText(/^Edit: we couldn't confirm whether it was granted/),
      ).toBeInTheDocument(),
    );

    const stored = window.sessionStorage.getItem(OPERATION_JOURNAL_KEY);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored ?? "{}").entries).toHaveLength(1);
    // Nothing was written to the store shared by every tab.
    expect(window.localStorage.length).toBe(0);

    first.unmount();
    mountDefault();

    await waitFor(() =>
      expect(
        screen.getByText(
          /^Edit: we couldn't confirm whether an earlier grant was applied/,
        ),
      ).toBeInTheDocument(),
    );
    expect(switchFor(RESEARCH, "Edit")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    fireEvent.click(switchFor(RESEARCH, "Edit"));
    expect(mutationCalls(calls)).toHaveLength(1);
  });

  it("does not read a journal left in localStorage", async () => {
    // A record in the shared store must not surface: the journal is tab-local.
    const { calls } = intercept({ mutation: { status: 424 } });
    const first = mountDefault();
    await waitFor(() => switchFor(RESEARCH, "Edit"));
    fireEvent.click(switchFor(RESEARCH, "Edit"));
    await waitFor(() =>
      expect(
        screen.getByText(/^Edit: we couldn't confirm whether it was granted/),
      ).toBeInTheDocument(),
    );
    const record = window.sessionStorage.getItem(OPERATION_JOURNAL_KEY) ?? "";
    first.unmount();

    window.sessionStorage.clear();
    window.localStorage.setItem(OPERATION_JOURNAL_KEY, record);
    mountDefault();

    await waitFor(() =>
      expect(switchFor(RESEARCH, "Edit")).toHaveAttribute(
        "aria-checked",
        "false",
      ),
    );
    expect(screen.queryByText(/we couldn't confirm/i)).not.toBeInTheDocument();
    expect(switchFor(RESEARCH, "Edit")).toBeEnabled();
    expect(mutationCalls(calls)).toHaveLength(1);
  });

  it("blocks every mutation when sessionStorage is unavailable", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      window,
      "sessionStorage",
    );
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get: () => {
        throw new DOMException("blocked", "SecurityError");
      },
    });
    try {
      const { calls } = intercept();
      mountDefault();

      await waitFor(() => switchFor(RESEARCH, "Edit"));
      expect(
        screen.getByText(/unavailable in this browser tab/i),
      ).toBeVisible();
      expect(switchFor(RESEARCH, "Edit")).toBeDisabled();
      fireEvent.click(switchFor(RESEARCH, "Edit"));
      expect(mutationCalls(calls)).toHaveLength(0);
      // Falling back to the shared store would be a silent downgrade.
      expect(window.localStorage.length).toBe(0);
    } finally {
      if (descriptor !== undefined) {
        Object.defineProperty(window, "sessionStorage", descriptor);
      }
    }
  });
});
