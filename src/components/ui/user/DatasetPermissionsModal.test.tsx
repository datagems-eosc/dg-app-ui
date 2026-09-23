import {
  act,
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { ErrorProvider } from "@/contexts/ErrorContext";
import { DatasetPermissionsModal } from "./DatasetPermissionsModal";

const mockUseApi = vi.fn();

vi.mock("@/hooks/useApi", () => ({
  useApi: () => mockUseApi(),
}));

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
