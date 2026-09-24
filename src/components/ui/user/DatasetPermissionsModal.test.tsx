import {
  act,
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactElement, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorProvider } from "@/contexts/ErrorContext";
import { ConfirmationModal } from "../ConfirmationModal";
import { DatasetPermissionsModal } from "./DatasetPermissionsModal";

const mockUseApi = vi.fn();
const mockUseFeatureFlag = vi.fn();

vi.mock("@/hooks/useApi", () => ({
  useApi: () => mockUseApi(),
}));

// Every case in this file is the legacy group editor, which is what the
// rollout flag preserves while it is off. The new surface is covered in
// `components/DatasetPermissions`, and its flag-on wiring at the end of this
// file.
vi.mock("@/contexts/FeatureFlagsContext", () => ({
  useFeatureFlag: (id: string) => mockUseFeatureFlag(id),
}));

vi.mock("@/components/DatasetPermissions/DatasetGroupAccess", () => ({
  DatasetGroupAccess: (props: GroupAccessStandInProps) => (
    <GroupAccessStandIn {...props} />
  ),
}));

interface GroupAccessStandInProps {
  datasetId: string;
  datasetName: string;
  onDone: () => void;
}

/**
 * Stands in for the new surface with the shape that matters to the shell's
 * focus handling: a control that raises the same layered confirmation the
 * real view uses, and a Done.
 */
function GroupAccessStandIn({
  datasetId,
  datasetName,
  onDone,
}: GroupAccessStandInProps) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div data-testid="group-access">
      {`${datasetId}|${datasetName}`}
      <button type="button" onClick={() => setConfirming(true)}>
        Change a role
      </button>
      <button type="button" onClick={onDone}>
        Done
      </button>
      <ConfirmationModal
        isVisible={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => setConfirming(false)}
        title="Confirm the change"
        message1="Confirm"
        message2=""
        confirmText="Apply"
        focusScope="layered"
      />
    </div>
  );
}

beforeEach(() => {
  mockUseFeatureFlag.mockReset();
  mockUseFeatureFlag.mockReturnValue(false);
});

// The modal reports API failures through the ErrorContext toast.
const render = (ui: ReactElement) => {
  const result = rtlRender(<ErrorProvider>{ui}</ErrorProvider>);
  return {
    ...result,
    rerender: (next: ReactElement) =>
      result.rerender(<ErrorProvider>{next}</ErrorProvider>),
  };
};

const readFailureMessage = /couldn't load group permissions/i;

// One stable api object per test: useApi() returns memoized callbacks, so the
// modal's load effect must not re-run on every render.
const createApi = (overrides: Record<string, unknown> = {}) => ({
  hasToken: true,
  queryUserGroups: vi.fn().mockResolvedValue({
    items: [{ id: "group-1", name: "Research Team" }],
  }),
  getGroupDatasetGrants: vi.fn().mockResolvedValue({ "dataset-1": [] }),
  assignGroupDatasetGrant: vi.fn().mockResolvedValue(undefined),
  unassignGroupDatasetGrant: vi.fn().mockResolvedValue(undefined),
  queryUsers: vi.fn().mockResolvedValue({ items: [] }),
  getUserDatasetGrants: vi.fn().mockResolvedValue({}),
  assignUserDatasetGrant: vi.fn().mockResolvedValue(undefined),
  unassignUserDatasetGrant: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const renderModal = (props: { datasetId?: string; isOpen?: boolean } = {}) => {
  const { datasetId = "dataset-1", isOpen = true } = props;
  return (
    <DatasetPermissionsModal
      isOpen={isOpen}
      datasetId={datasetId}
      datasetName="Dataset One"
      onClose={vi.fn()}
    />
  );
};

describe("DatasetPermissionsModal", () => {
  it("updates group permissions via context grants", async () => {
    const assignGroupDatasetGrant = vi.fn().mockResolvedValue(undefined);
    const unassignGroupDatasetGrant = vi.fn().mockResolvedValue(undefined);

    mockUseApi.mockReturnValue({
      hasToken: true,
      queryUserGroups: vi.fn().mockResolvedValue({
        items: [{ id: "group-1", name: "Research Team" }],
      }),
      getGroupDatasetGrants: vi
        .fn()
        .mockResolvedValue({ "dataset-1": ["dg_ds-browse"] }),
      assignGroupDatasetGrant,
      unassignGroupDatasetGrant,
      queryUsers: vi.fn().mockResolvedValue({ items: [] }),
      getUserDatasetGrants: vi.fn().mockResolvedValue({}),
      assignUserDatasetGrant: vi.fn().mockResolvedValue(undefined),
      unassignUserDatasetGrant: vi.fn().mockResolvedValue(undefined),
    });

    render(
      <DatasetPermissionsModal
        isOpen
        datasetId="dataset-1"
        datasetName="Dataset One"
        onClose={vi.fn()}
      />,
    );

    const browseToggle = await screen.findByLabelText("Research Team Browse");
    expect(browseToggle).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(browseToggle);

    await waitFor(() => {
      expect(unassignGroupDatasetGrant).toHaveBeenCalledWith(
        "group-1",
        "dataset-1",
        "dg_ds-browse",
      );
    });

    const downloadToggle = await screen.findByLabelText(
      "Research Team Download",
    );
    fireEvent.click(downloadToggle);

    await waitFor(() => {
      expect(assignGroupDatasetGrant).toHaveBeenCalledWith(
        "group-1",
        "dataset-1",
        "dg_ds-download",
      );
    });
  });

  it("removes user permissions when user is removed", async () => {
    const unassignUserDatasetGrant = vi.fn().mockResolvedValue(undefined);

    mockUseApi.mockReturnValue({
      hasToken: true,
      queryUserGroups: vi.fn().mockResolvedValue({
        items: [{ id: "group-1", name: "Research Team" }],
      }),
      getGroupDatasetGrants: vi.fn().mockResolvedValue({ "dataset-1": [] }),
      assignGroupDatasetGrant: vi.fn().mockResolvedValue(undefined),
      unassignGroupDatasetGrant: vi.fn().mockResolvedValue(undefined),
      queryUsers: vi.fn().mockResolvedValue({
        items: [
          {
            id: "user-1",
            name: "Ada Lovelace",
            email: "ada@example.com",
          },
        ],
      }),
      getUserDatasetGrants: vi.fn().mockResolvedValue({
        "dataset-1": ["dg_ds-browse", "dg_ds-download"],
      }),
      assignUserDatasetGrant: vi.fn().mockResolvedValue(undefined),
      unassignUserDatasetGrant,
    });

    render(
      <DatasetPermissionsModal
        isOpen
        datasetId="dataset-1"
        datasetName="Dataset One"
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByText("Invite by E-mail"));
    const emailInput = screen.getByPlaceholderText("Email address");
    fireEvent.change(emailInput, { target: { value: "ada@example.com" } });
    fireEvent.click(screen.getByText("Invite"));

    const removeButton = await screen.findByLabelText("Remove Ada Lovelace");
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(unassignUserDatasetGrant).toHaveBeenCalledWith(
        "user-1",
        "dataset-1",
        "dg_ds-browse",
      );
      expect(unassignUserDatasetGrant).toHaveBeenCalledWith(
        "user-1",
        "dataset-1",
        "dg_ds-download",
      );
    });
  });

  it("shows an error toast and keeps the switch state when the server rejects the change", async () => {
    const assignGroupDatasetGrant = vi
      .fn()
      .mockRejectedValue(new Error("403 Forbidden"));

    mockUseApi.mockReturnValue({
      hasToken: true,
      queryUserGroups: vi.fn().mockResolvedValue({
        items: [{ id: "group-1", name: "Research Team" }],
      }),
      getGroupDatasetGrants: vi.fn().mockResolvedValue({ "dataset-1": [] }),
      assignGroupDatasetGrant,
      unassignGroupDatasetGrant: vi.fn().mockResolvedValue(undefined),
      queryUsers: vi.fn().mockResolvedValue({ items: [] }),
      getUserDatasetGrants: vi.fn().mockResolvedValue({}),
      assignUserDatasetGrant: vi.fn().mockResolvedValue(undefined),
      unassignUserDatasetGrant: vi.fn().mockResolvedValue(undefined),
    });

    render(
      <DatasetPermissionsModal
        isOpen
        datasetId="dataset-1"
        datasetName="Dataset One"
        onClose={vi.fn()}
      />,
    );

    const browseToggle = await screen.findByLabelText("Research Team Browse");
    expect(browseToggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(browseToggle);

    await waitFor(() => {
      expect(assignGroupDatasetGrant).toHaveBeenCalled();
      expect(
        screen.getByText(/server rejected the permission change/i),
      ).toBeInTheDocument();
    });
    expect(browseToggle).toHaveAttribute("aria-pressed", "false");
  });

  it("filters groups with Manage Groups selection", async () => {
    mockUseApi.mockReturnValue({
      hasToken: true,
      queryUserGroups: vi.fn().mockResolvedValue({
        items: [
          { id: "group-1", name: "Research Team" },
          { id: "group-2", name: "Analytics" },
        ],
      }),
      getGroupDatasetGrants: vi.fn().mockResolvedValue({ "dataset-1": [] }),
      assignGroupDatasetGrant: vi.fn().mockResolvedValue(undefined),
      unassignGroupDatasetGrant: vi.fn().mockResolvedValue(undefined),
      queryUsers: vi.fn().mockResolvedValue({ items: [] }),
      getUserDatasetGrants: vi.fn().mockResolvedValue({}),
      assignUserDatasetGrant: vi.fn().mockResolvedValue(undefined),
      unassignUserDatasetGrant: vi.fn().mockResolvedValue(undefined),
    });

    render(
      <DatasetPermissionsModal
        isOpen
        datasetId="dataset-1"
        datasetName="Dataset One"
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText("Research Team")).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Manage" }));
    const manageDialog = await screen.findByLabelText("Manage Groups");

    const groupCheckbox = document.getElementById("group-group-2");
    const groupCheckboxWrapper = groupCheckbox?.parentElement?.parentElement;
    if (!groupCheckboxWrapper) {
      throw new Error("Group checkbox not found");
    }
    fireEvent.click(groupCheckboxWrapper);

    fireEvent.click(within(manageDialog).getByText("Save"));

    await waitFor(() => {
      expect(screen.queryByText("Analytics")).not.toBeInTheDocument();
      expect(screen.getByText("Research Team")).toBeInTheDocument();
    });
  });

  it("reports a failed read instead of an empty result when group discovery fails", async () => {
    const api = createApi({
      queryUserGroups: vi.fn().mockRejectedValue(new Error("network down")),
    });
    mockUseApi.mockReturnValue(api);

    render(renderModal());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      readFailureMessage,
    );
    expect(screen.queryByText("No groups found")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manage" })).toBeDisabled();
    expect(api.assignGroupDatasetGrant).not.toHaveBeenCalled();
    expect(api.unassignGroupDatasetGrant).not.toHaveBeenCalled();
  });

  it("reports a failed read when a discovered group's grants cannot be read", async () => {
    const api = createApi({
      getGroupDatasetGrants: vi
        .fn()
        .mockRejectedValue(new Error("403 Forbidden")),
    });
    mockUseApi.mockReturnValue(api);

    render(renderModal());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      readFailureMessage,
    );
    expect(screen.queryByText("No groups found")).not.toBeInTheDocument();
    expect(screen.queryByText("Research Team")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Research Team Browse"),
    ).not.toBeInTheDocument();
    expect(api.assignGroupDatasetGrant).not.toHaveBeenCalled();
    expect(api.unassignGroupDatasetGrant).not.toHaveBeenCalled();
  });

  it("keeps the empty result for a successful read that returns no groups", async () => {
    const api = createApi({
      queryUserGroups: vi.fn().mockResolvedValue({ items: [] }),
    });
    mockUseApi.mockReturnValue(api);

    render(renderModal());

    expect(await screen.findByText("No groups found")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manage" })).toBeEnabled();
  });

  it("drops the previous dataset's rows when the next load fails", async () => {
    const api = createApi({
      getGroupDatasetGrants: vi.fn(
        async (_groupId: string, datasetIds: string[]) => {
          if (datasetIds[0] === "dataset-2") {
            throw new Error("403 Forbidden");
          }
          return { "dataset-1": ["dg_ds-browse"] };
        },
      ),
    });
    mockUseApi.mockReturnValue(api);

    const { rerender } = render(renderModal({ datasetId: "dataset-1" }));

    expect(
      await screen.findByLabelText("Research Team Browse"),
    ).toHaveAttribute("aria-pressed", "true");

    rerender(renderModal({ datasetId: "dataset-2" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      readFailureMessage,
    );
    expect(
      screen.queryByLabelText("Research Team Browse"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Research Team")).not.toBeInTheDocument();
    expect(api.assignGroupDatasetGrant).not.toHaveBeenCalled();
    expect(api.unassignGroupDatasetGrant).not.toHaveBeenCalled();
  });

  it("ignores a superseded dataset's late response", async () => {
    let resolveFirstRead: (grants: Record<string, string[]>) => void = () => {};
    const api = createApi({
      getGroupDatasetGrants: vi.fn((_groupId: string, datasetIds: string[]) => {
        if (datasetIds[0] === "dataset-1") {
          return new Promise<Record<string, string[]>>((resolve) => {
            resolveFirstRead = resolve;
          });
        }
        return Promise.resolve({ "dataset-2": [] });
      }),
    });
    mockUseApi.mockReturnValue(api);

    const { rerender } = render(renderModal({ datasetId: "dataset-1" }));

    expect(await screen.findByText("Loading groups...")).toBeInTheDocument();

    rerender(renderModal({ datasetId: "dataset-2" }));

    const browseToggle = await screen.findByLabelText("Research Team Browse");
    expect(browseToggle).toHaveAttribute("aria-pressed", "false");

    await act(async () => {
      resolveFirstRead({ "dataset-1": ["dg_ds-browse", "dg_ds-download"] });
    });

    expect(screen.getAllByLabelText("Research Team Browse")).toHaveLength(1);
    expect(screen.getByLabelText("Research Team Browse")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("recovers from a failed read after close and reopen", async () => {
    let shouldFail = true;
    const api = createApi({
      queryUserGroups: vi.fn(() =>
        shouldFail
          ? Promise.reject(new Error("network down"))
          : Promise.resolve({
              items: [{ id: "group-1", name: "Research Team" }],
            }),
      ),
      getGroupDatasetGrants: vi
        .fn()
        .mockResolvedValue({ "dataset-1": ["dg_ds-browse"] }),
    });
    mockUseApi.mockReturnValue(api);

    const { rerender } = render(renderModal());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      readFailureMessage,
    );

    rerender(renderModal({ isOpen: false }));
    shouldFail = false;
    rerender(renderModal());

    expect(
      await screen.findByLabelText("Research Team Browse"),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(api.assignGroupDatasetGrant).not.toHaveBeenCalled();
    expect(api.unassignGroupDatasetGrant).not.toHaveBeenCalled();
  });
});

/**
 * The rollout flag at this entry point.
 *
 * The flag-off expectation is the whole suite above: unchanged behaviour, same
 * requests, same controls. What is added here is that "off" also means *no new
 * requests*, that "on" replaces this surface rather than sitting beside it, and
 * that losing the flag mid-session closes instead of revealing the legacy
 * editor underneath.
 */
describe("DatasetPermissionsModal — datasetGroupAccess rollout", () => {
  it("issues no new-flow request and mounts nothing new while the flag is off", () => {
    const api = createApi();
    mockUseApi.mockReturnValue(api);
    mockUseFeatureFlag.mockReturnValue(false);

    render(renderModal());

    expect(screen.queryByTestId("group-access")).toBeNull();
    // The legacy reader is the one that ran, exactly as before.
    expect(api.queryUserGroups).toHaveBeenCalledTimes(1);
  });

  it("replaces the legacy group editor when the flag is on, and reads nothing through it", () => {
    const api = createApi();
    mockUseApi.mockReturnValue(api);
    mockUseFeatureFlag.mockReturnValue(true);

    render(renderModal());

    expect(screen.getByTestId("group-access")).toHaveTextContent(
      "dataset-1|Dataset One",
    );
    // Two readers for one dataset would double every request and give the
    // screen an older second answer to disagree with.
    expect(api.queryUserGroups).not.toHaveBeenCalled();
    expect(api.getGroupDatasetGrants).not.toHaveBeenCalled();
    // No Save/Cancel beside a surface whose footer says closing changes
    // nothing.
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("is group-only while the flag is on: no invitation surface or user calls", async () => {
    const api = createApi();
    mockUseApi.mockReturnValue(api);
    mockUseFeatureFlag.mockReturnValue(true);

    render(renderModal());
    expect(screen.getByTestId("group-access")).toBeInTheDocument();

    expect(screen.queryByText("Invite by E-mail")).toBeNull();
    expect(screen.queryByRole("button", { name: "Groups" })).toBeNull();
    expect(screen.queryByPlaceholderText("Email address")).toBeNull();
    expect(screen.queryByRole("button", { name: "Invite" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();

    // Nothing reaches the individual-user helpers, however long it stays open.
    await act(async () => {});
    expect(api.queryUsers).not.toHaveBeenCalled();
    expect(api.getUserDatasetGrants).not.toHaveBeenCalled();
    expect(api.assignUserDatasetGrant).not.toHaveBeenCalled();
    expect(api.unassignUserDatasetGrant).not.toHaveBeenCalled();
  });

  it("keeps the legacy invitation flow while the flag is off", async () => {
    const api = createApi({
      queryUsers: vi.fn().mockResolvedValue({
        items: [
          { id: "user-1", name: "Ada Lovelace", email: "ada@example.com" },
        ],
      }),
    });
    mockUseApi.mockReturnValue(api);
    mockUseFeatureFlag.mockReturnValue(false);

    render(renderModal());
    fireEvent.click(await screen.findByText("Invite by E-mail"));
    fireEvent.change(screen.getByPlaceholderText("Email address"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Invite" }));

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(api.queryUsers).toHaveBeenCalledWith({ like: "ada@example.com" });
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.queryByTestId("group-access")).toBeNull();
  });

  it("does not swap in the legacy editor when the flag is lost mid-session", () => {
    const api = createApi();
    mockUseApi.mockReturnValue(api);
    mockUseFeatureFlag.mockReturnValue(true);

    const { rerender } = render(renderModal());
    expect(screen.getByTestId("group-access")).toBeInTheDocument();

    // The flag going away is not evidence that the old path is now correct.
    mockUseFeatureFlag.mockReturnValue(false);
    rerender(renderModal());

    expect(screen.queryByRole("switch")).toBeNull();
    expect(api.queryUserGroups).not.toHaveBeenCalled();
  });

  it("re-evaluates the flag on the next opening", () => {
    const api = createApi();
    mockUseApi.mockReturnValue(api);
    mockUseFeatureFlag.mockReturnValue(true);

    const { rerender } = render(renderModal());
    expect(screen.getByTestId("group-access")).toBeInTheDocument();

    rerender(renderModal({ isOpen: false }));
    mockUseFeatureFlag.mockReturnValue(false);
    rerender(renderModal({ isOpen: true }));

    expect(screen.queryByTestId("group-access")).toBeNull();
    expect(api.queryUserGroups).toHaveBeenCalled();
  });
});

describe("DatasetPermissionsModal — keyboard focus with the flag on", () => {
  /** Closes the host from outside, as losing the rollout flag does. */
  let closeHost = () => {};

  /** A details-page-like host: a launcher that mounts the modal, and a page. */
  function Host({ onClose = () => {} }: { onClose?: () => void }) {
    const [open, setOpen] = useState(false);
    closeHost = () => setOpen(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Manage access
        </button>
        <button type="button">Background link</button>
        {open && (
          <DatasetPermissionsModal
            isOpen
            datasetId="dataset-1"
            datasetName="Dataset One"
            onClose={() => {
              onClose();
              setOpen(false);
            }}
          />
        )}
      </>
    );
  }

  const openFromLauncher = async (onClose?: () => void) => {
    const user = userEvent.setup();
    render(<Host onClose={onClose} />);
    const launcher = screen.getByRole("button", { name: "Manage access" });
    await user.click(launcher);
    return { user, launcher };
  };

  beforeEach(() => {
    mockUseApi.mockReturnValue(createApi());
    mockUseFeatureFlag.mockReturnValue(true);
  });

  it("starts on the dialog and keeps Tab and Shift+Tab inside it", async () => {
    const { user } = await openFromLauncher();
    const dialog = screen.getByRole("dialog", { name: "Dataset One" });
    expect(dialog).toHaveFocus();

    const close = screen.getByRole("button", { name: "Close modal" });
    const done = screen.getByRole("button", { name: "Done" });
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab();
    await user.tab();
    expect(done).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(done).toHaveFocus();
    expect(
      screen.getByRole("button", { name: "Background link" }),
    ).not.toHaveFocus();
  });

  it.each([
    [
      "Escape",
      async (user: ReturnType<typeof userEvent.setup>) => {
        await user.keyboard("{Escape}");
      },
    ],
    [
      "Done",
      async (user: ReturnType<typeof userEvent.setup>) => {
        await user.click(screen.getByRole("button", { name: "Done" }));
      },
    ],
    [
      "the close button",
      async (user: ReturnType<typeof userEvent.setup>) => {
        await user.click(screen.getByRole("button", { name: "Close modal" }));
      },
    ],
  ])(
    "returns focus to the launcher after closing with %s",
    async (_, close) => {
      const onClose = vi.fn();
      const { user, launcher } = await openFromLauncher(onClose);
      await close(user);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(launcher).toHaveFocus();
      expect(document.body.style.overflow).not.toBe("hidden");
    },
  );

  it("restores the settings-style launcher when isOpen turns false", async () => {
    const user = userEvent.setup();
    function SettingsHost() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open dataset
          </button>
          <DatasetPermissionsModal
            isOpen={open}
            datasetId={open ? "dataset-1" : ""}
            datasetName="Dataset One"
            onClose={() => setOpen(false)}
          />
        </>
      );
    }
    render(<SettingsHost />);
    const launcher = screen.getByRole("button", { name: "Open dataset" });
    await user.click(launcher);
    expect(screen.getByRole("dialog", { name: "Dataset One" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(launcher).toHaveFocus();
  });

  it("lets one Escape close only the confirmation, which owns Tab while open", async () => {
    const onClose = vi.fn();
    const { user, launcher } = await openFromLauncher(onClose);
    const change = screen.getByRole("button", { name: "Change a role" });
    change.focus();
    await user.keyboard("{Enter}");

    const confirmation = screen.getByRole("dialog", {
      name: "Confirm the change",
    });
    expect(confirmation).toContainElement(
      document.activeElement as HTMLElement,
    );
    for (let i = 0; i < 4; i += 1) {
      await user.tab();
      expect(confirmation).toContainElement(
        document.activeElement as HTMLElement,
      );
    }

    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: "Confirm the change" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Dataset One" })).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
    expect(change).toHaveFocus();
    // Closing the confirmation must not unlock the page behind the dialog.
    expect(document.body.style.overflow).toBe("hidden");

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(launcher).toHaveFocus();
  });

  it("returns to the launcher when the dialog closes with its confirmation open", async () => {
    const { user, launcher } = await openFromLauncher();
    await user.click(screen.getByRole("button", { name: "Change a role" }));
    expect(
      screen.getByRole("dialog", { name: "Confirm the change" }),
    ).toBeInTheDocument();

    // As when the rollout flag is lost: the whole surface goes at once.
    act(() => closeHost());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(launcher).toHaveFocus();
  });
});

describe("DatasetPermissionsModal — flag-off focus behaviour is unchanged", () => {
  it("keeps the legacy Escape handling and does not take over focus", async () => {
    const user = userEvent.setup();
    mockUseApi.mockReturnValue(createApi());
    mockUseFeatureFlag.mockReturnValue(false);
    const onClose = vi.fn();
    const launcher = document.createElement("button");
    document.body.appendChild(launcher);
    try {
      launcher.focus();
      render(
        <DatasetPermissionsModal
          isOpen
          datasetId="dataset-1"
          datasetName="Dataset One"
          onClose={onClose}
        />,
      );
      await screen.findByLabelText("Research Team Browse");

      expect(screen.getByRole("dialog")).not.toHaveAttribute("tabindex");
      expect(launcher).toHaveFocus();
      expect(document.body.style.overflow).toBe("hidden");
      await user.keyboard("{Escape}");
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      launcher.remove();
    }
  });
});
