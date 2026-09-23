import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseSession = vi.fn();
const mockGetSession = vi.fn();
const mockPush = vi.fn();
const mockSearchParams = vi.fn(() => new URLSearchParams());

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
  getSession: () => mockGetSession(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  useSearchParams: () => mockSearchParams(),
}));

// The shell's collections context. It is unrelated to onboarding and is the
// only application boundary replaced here.
vi.mock("@/contexts/CollectionsContext", () => ({
  useCollections: () => ({
    apiCollections: [{ id: "collection-1", name: "Weather", code: "weather" }],
    isLoadingApiCollections: false,
    extraCollections: [],
    refreshExtraCollections: vi.fn(),
    notifyCollectionModified: vi.fn(),
  }),
}));

import { DatasetOnboardingSessionBoundary } from "@/components/DatasetOnboarding/DatasetOnboardingSessionBoundary";
import type { FeatureFlagId } from "@/config/featureFlags";
import {
  FeatureFlagsProvider,
  useFeatureFlags,
} from "@/contexts/FeatureFlagsContext";
import { PROCESS_INSTANCE_ID } from "@/lib/datasetOnboarding/fixtures";
import { FEATURE_FLAGS_STORAGE_KEY } from "@/lib/featureFlags/storage";
import AddDatasetForm from "./AddDatasetForm";

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------
//
// Mocked boundaries, and nothing else: the NextAuth session, Next navigation,
// the shell's collections context, `fetch` and `XMLHttpRequest` (which is what
// the existing uploader uses). `useApi`, `makeRequest`, `fetchWithAuth`, the
// accepted adapter, the accepted submission controller and provider, the flag
// resolver and every form component run for real — so the request ledger below
// is the one a browser would produce.

const API_BASE = "https://gateway.test/dg";
const PRINCIPAL = "0d6f2a3c-1b44-4e9a-8f07-52c1a7d9e380";
const STAGED = "/storage/datagems/gw/dataset_upload/readings.csv";

const OTHER_PRINCIPAL = "f19c5b02-77ae-4d31-9c5e-2a840be6f1cc";

const session = (
  options: {
    readonly userId?: unknown;
    readonly accessToken?: string;
    /** A failed refresh. The accepted binding reports no usable scope for it. */
    readonly error?: string;
  } = {},
) => ({
  status: "authenticated" as const,
  data: {
    accessToken: options.accessToken ?? "token-1",
    ...(options.error === undefined ? {} : { error: options.error }),
    ...("userId" in options
      ? options.userId === undefined
        ? {}
        : { user: { id: options.userId } }
      : { user: { id: PRINCIPAL } }),
  },
});

const FIELDS_OF_SCIENCE = {
  hierarchy: [
    {
      ordinal: 1,
      code: "1",
      name: "NATURAL SCIENCES",
      children: [
        {
          ordinal: 1,
          code: "1.5",
          name: "EARTH AND RELATED ENVIRONMENTAL SCIENCES",
        },
      ],
    },
  ],
};

const LICENSES = [
  { code: "cc-by-4.0", name: "CC BY 4.0", description: "Attribution." },
];

interface GatewayOptions {
  /** Answer to `POST /workflow-process/onboard`. */
  readonly start?: { readonly status: number; readonly body: unknown };
  /** Answer to the upload XHR. */
  readonly upload?: { readonly status: number; readonly body: string };
  /** Hold the start open until `release()` is called. */
  readonly holdStart?: boolean;
  /** Hold every upload open until `releaseUpload()` is called. */
  readonly holdUpload?: boolean;
}

interface Ledger {
  readonly requests: { method: string; url: string; body: string }[];
  readonly uploads: { method: string; url: string }[];
  release: () => void;
  releaseUpload: () => void;
  starts: () => { method: string; url: string; body: string }[];
}

const stubBoundaries = (options: GatewayOptions = {}): Ledger => {
  const requests: Ledger["requests"] = [];
  const uploads: Ledger["uploads"] = [];
  let release: () => void = () => {};
  const gate = options.holdStart
    ? new Promise<void>((resolve) => {
        release = resolve;
      })
    : Promise.resolve();

  const start = options.start ?? {
    status: 200,
    body: { id: PROCESS_INSTANCE_ID },
  };
  const upload = options.upload ?? {
    status: 200,
    body: JSON.stringify([STAGED]),
  };

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      requests.push({
        method,
        url,
        body: typeof init?.body === "string" ? init.body : "",
      });

      if (url.includes("/storage/upload/allowed-extension")) {
        return new Response(JSON.stringify([".csv"]), { status: 200 });
      }
      if (url.includes("/vocabulary/fields-of-science")) {
        return new Response(JSON.stringify(FIELDS_OF_SCIENCE), { status: 200 });
      }
      if (url.includes("/vocabulary/license")) {
        return new Response(JSON.stringify(LICENSES), { status: 200 });
      }
      if (url.includes("/workflow-process/onboard")) {
        await gate;
        return new Response(JSON.stringify(start.body), {
          status: start.status,
        });
      }
      // Anything else is a request this form must not make. It is recorded and
      // answered with a refusal rather than a convenient 200.
      return new Response(JSON.stringify({ error: "unexpected" }), {
        status: 500,
      });
    }),
  );

  let releaseUpload: () => void = () => {};
  const uploadGate = options.holdUpload
    ? new Promise<void>((resolve) => {
        releaseUpload = resolve;
      })
    : Promise.resolve();

  class FakeXhr {
    status = 0;
    responseText = "";
    readonly upload = { addEventListener: () => {} };
    private readonly listeners = new Map<string, (() => void)[]>();
    addEventListener(type: string, handler: () => void) {
      this.listeners.set(type, [...(this.listeners.get(type) ?? []), handler]);
    }
    open(method: string, url: string) {
      uploads.push({ method, url });
    }
    setRequestHeader() {}
    send() {
      void uploadGate.then(() => {
        this.status = upload.status;
        this.responseText = upload.body;
        for (const handler of this.listeners.get("load") ?? []) handler();
      });
    }
  }
  vi.stubGlobal("XMLHttpRequest", FakeXhr);

  return {
    requests,
    uploads,
    release: () => release(),
    releaseUpload: () => releaseUpload(),
    starts: () =>
      requests.filter((request) =>
        request.url.includes("/workflow-process/onboard"),
      ),
  };
};

/** Flips a resolved override from inside the provider, as the settings UI does. */
const FlagSwitch = ({ flag }: { flag: FeatureFlagId }) => {
  const { setOverride } = useFeatureFlags();
  return (
    <button type="button" onClick={() => setOverride(flag, false)}>
      {`turn off ${flag}`}
    </button>
  );
};

const setFlags = (overrides: Partial<Record<FeatureFlagId, boolean>>) => {
  window.localStorage.setItem(
    FEATURE_FLAGS_STORAGE_KEY,
    JSON.stringify(overrides),
  );
};

/**
 * The real route composition. Kept as one expression so a `rerender` reuses the
 * identical element tree: nothing is keyed, so React reconciles rather than
 * remounts, and the submission provider — and its owner — survives.
 */
const tree = (extra?: React.ReactNode) => (
  <FeatureFlagsProvider>
    <DatasetOnboardingSessionBoundary>
      <AddDatasetForm />
      {extra}
    </DatasetOnboardingSessionBoundary>
  </FeatureFlagsProvider>
);

const mount = (extra?: React.ReactNode) => render(tree(extra));

const startButton = () =>
  screen.getByRole("button", { name: "Start processing" });

const uploadFile = async (
  user: ReturnType<typeof userEvent.setup>,
  container: HTMLElement,
) => {
  const input = container.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  await user.upload(
    input,
    new File(["a,b\n1,2\n"], "readings.csv", { type: "text/csv" }),
  );
  await waitFor(() => {
    expect(screen.getByText("readings.csv")).toBeInTheDocument();
  });
};

/** Fills every required field through the real controls. */
const fillMetadata = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(
    screen.getByPlaceholderText("Enter dataset title"),
    "Sensor readings 2026",
  );
  await user.type(
    screen.getByPlaceholderText("Enter short headline"),
    "Pilot network readings",
  );
  // The description is a Markdown editor loaded through `next/dynamic`, so its
  // textarea appears only once that chunk resolves — `findBy` rather than a
  // positional `querySelector`, which would otherwise pick up the citation
  // textarea further down the form. Typing 40 characters through the editor is
  // needlessly slow, and the editor forwards its value to the form through an
  // effect, so the form's own character counter (the parent state) is what we
  // wait for.
  const DESCRIPTION = "Hourly readings from the pilot network.";
  const description = await screen.findByPlaceholderText(
    "Provide a detailed description of the dataset contents",
  );
  fireEvent.change(description, { target: { value: DESCRIPTION } });
  await waitFor(() => {
    expect(screen.getByText(`${DESCRIPTION.length}/3000`)).toBeInTheDocument();
  });
  const keywords = screen.getByPlaceholderText(
    "Separate with commas e.g. encyclopedia, historical texts, knowledge graph",
  );
  await user.type(keywords, "sensors{Enter}");

  await waitFor(() => {
    expect(screen.getByText("Natural sciences")).toBeInTheDocument();
  });
  await user.click(screen.getByText("Natural sciences"));
  await user.click(
    screen.getByLabelText("Earth and related environmental sciences"),
  );

  await user.click(screen.getByText("Select a license"));
  await user.click(screen.getByText("CC BY 4.0"));
};

beforeEach(() => {
  vi.clearAllMocks();
  window.__env = { ...window.__env, DATAGEMS_API_BASE_URL: API_BASE };
  window.localStorage.clear();
  window.sessionStorage.clear();
  mockUseSession.mockReturnValue(session());
  mockSearchParams.mockReturnValue(new URLSearchParams());
  setFlags({ datasetOnboarding: true, datasetOnboardingMonitoring: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------

describe("AddDatasetForm sections and validation", () => {
  it("keeps the existing sections and offers one deliberate submit", async () => {
    stubBoundaries();
    mount();

    expect(screen.getByText("Dataset upload")).toBeInTheDocument();
    expect(screen.getByText("Basic information")).toBeInTheDocument();
    expect(screen.getByText("Classification")).toBeInTheDocument();
    expect(screen.getByText("Additional Information")).toBeInTheDocument();

    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
    // The two-step publish chain is gone, and so is the upload-time sharing
    // step and the collection selector.
    expect(screen.queryByRole("button", { name: /^Next$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Publish/i })).toBeNull();
    expect(screen.queryByText("Collection")).toBeNull();
    expect(screen.queryByText(/Who can access/i)).toBeNull();
    expect(
      screen.getByText(
        "Sharing and collection assignment are separate from uploading.",
      ),
    ).toBeInTheDocument();
  });

  it("still reports the existing field validation, and sends nothing", async () => {
    const user = userEvent.setup();
    const ledger = stubBoundaries();
    mount();

    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
    await user.click(startButton());

    await waitFor(() => {
      expect(
        screen.getByText("At least one file must be uploaded"),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Title is required")).toBeInTheDocument();
    expect(ledger.starts()).toHaveLength(0);
  });
});

describe("AddDatasetForm managed submission", () => {
  it("sends one start for a repeated action and navigates to the known process", async () => {
    const user = userEvent.setup();
    const ledger = stubBoundaries({ holdStart: true });
    const { container } = mount();

    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
    await uploadFile(user, container);
    await fillMetadata(user);

    await user.click(startButton());
    // Disabled while pending, and the handler refuses a repeat regardless.
    expect(startButton()).toBeDisabled();
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);

    await waitFor(() => {
      expect(
        screen.getByText("Starting the onboarding process"),
      ).toBeInTheDocument();
    });

    await act(async () => {
      ledger.release();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.getByText("Processing started")).toBeInTheDocument();
    });

    const starts = ledger.starts();
    expect(starts).toHaveLength(1);
    expect(starts[0]?.url).toBe(
      `${API_BASE}/gw/api/workflow-process/onboard?f=id`,
    );
    expect(starts[0]?.method).toBe("POST");

    // The one navigation, by the returned process instance id.
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith(
      `/datasets/onboarding/${encodeURIComponent(PROCESS_INSTANCE_ID)}`,
    );

    // No legacy creation, profiling, title resolution, grant or collection
    // request, at any point in the journey.
    for (const forbidden of [
      "/dataset/onboard",
      "/dataset/profile",
      "/dataset/query",
      "context-grant",
      "/collection",
    ]) {
      expect(
        ledger.requests.filter((request) => request.url.includes(forbidden)),
      ).toEqual([]);
    }
    expect(ledger.uploads).toHaveLength(1);
  });

  it("sends the metadata and file locations the form collected, and nothing else", async () => {
    const user = userEvent.setup();
    const ledger = stubBoundaries();
    const { container } = mount();

    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
    await uploadFile(user, container);
    await fillMetadata(user);
    await user.click(startButton());

    await waitFor(() => {
      expect(ledger.starts()).toHaveLength(1);
    });

    const body = JSON.parse(ledger.starts()[0]?.body as string);
    expect(body).toMatchObject({
      name: "Sensor readings 2026",
      headline: "Pilot network readings",
      description: "Hourly readings from the pilot network.",
      license: "cc-by-4.0",
      keywords: ["sensors"],
      fieldOfScience: ["1.5"],
      dataLocations: [{ kind: 0, location: STAGED }],
    });
    expect(body.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const absent of [
      "sharing",
      "accessType",
      "groups",
      "collection",
      "collections",
      "code",
      "size",
      "mimeType",
      "id",
    ]) {
      expect(body).not.toHaveProperty(absent);
    }
  });

  it("blocks on an unresolved file and names it, without sending anything", async () => {
    const user = userEvent.setup();
    const ledger = stubBoundaries({
      upload: { status: 500, body: JSON.stringify({ error: "disk full" }) },
    });
    const { container } = mount();

    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
    await uploadFile(user, container);
    await fillMetadata(user);
    await user.click(startButton());

    await waitFor(() => {
      expect(
        screen.getByText("Some files are not ready to be sent"),
      ).toBeInTheDocument();
    });
    // Named rather than silently dropped, which is what the old form did.
    expect(
      screen.getByText(/readings\.csv — the upload failed/),
    ).toBeInTheDocument();
    expect(ledger.starts()).toHaveLength(0);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("reports a definite refusal without creating anything or retrying", async () => {
    const user = userEvent.setup();
    const ledger = stubBoundaries({
      start: { status: 400, body: { error: "invalid" } },
    });
    const { container } = mount();

    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
    await uploadFile(user, container);
    await fillMetadata(user);
    await user.click(startButton());

    await waitFor(() => {
      expect(
        screen.getByText("The dataset was not created"),
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/HTTP 400/)).toBeInTheDocument();
    expect(ledger.starts()).toHaveLength(1);
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.queryByText("Processing started")).toBeNull();
  });

  it("keeps an uncertain outcome uncertain and refuses to resubmit it", async () => {
    const user = userEvent.setup();
    const ledger = stubBoundaries({
      start: { status: 500, body: { error: "gateway" } },
    });
    const { container } = mount();

    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
    await uploadFile(user, container);
    await fillMetadata(user);
    await user.click(startButton());

    await waitFor(() => {
      expect(
        screen.getByText("We could not confirm what happened"),
      ).toBeInTheDocument();
    });
    // Browse assistance, never an automatic replay or a success claim.
    expect(screen.getByRole("button", { name: "Go to Browse" })).toBeEnabled();
    expect(mockPush).not.toHaveBeenCalled();

    await user.click(startButton());
    await waitFor(() => {
      expect(
        screen.getByText("The previous attempt has not been resolved"),
      ).toBeInTheDocument();
    });
    expect(ledger.starts()).toHaveLength(1);
  });

  it("retains the accepted process and offers navigation again when it fails", async () => {
    const user = userEvent.setup();
    const ledger = stubBoundaries();
    mockPush.mockImplementationOnce(() => {
      throw new Error("navigation unavailable");
    });
    const { container } = mount();

    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
    await uploadFile(user, container);
    await fillMetadata(user);
    await user.click(startButton());

    await waitFor(() => {
      expect(
        screen.getByText(/The processing page did not open/),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: "Open processing page" }),
    );

    expect(mockPush).toHaveBeenCalledTimes(2);
    expect(mockPush).toHaveBeenLastCalledWith(
      `/datasets/onboarding/${encodeURIComponent(PROCESS_INSTANCE_ID)}`,
    );
    // Navigating again is not another start.
    expect(ledger.starts()).toHaveLength(1);
  });
});

describe("AddDatasetForm rollout flags", () => {
  it.each([
    [{ datasetOnboarding: true, datasetOnboardingMonitoring: true }, true],
    [{ datasetOnboarding: true, datasetOnboardingMonitoring: false }, false],
    [{ datasetOnboarding: false, datasetOnboardingMonitoring: true }, false],
    [{ datasetOnboarding: false, datasetOnboardingMonitoring: false }, false],
  ])(
    "permits a start only with both flags on (%o)",
    async (overrides, enabled) => {
      const ledger = stubBoundaries();
      setFlags(overrides);
      const { container } = mount();

      await waitFor(() => {
        expect(startButton()).toBeInTheDocument();
      });

      if (enabled) {
        await waitFor(() => {
          expect(startButton()).toBeEnabled();
        });
        expect(
          screen.queryByText("New dataset uploads are turned off"),
        ).toBeNull();
        return;
      }

      await waitFor(() => {
        expect(
          screen.getByText("New dataset uploads are turned off"),
        ).toBeInTheDocument();
      });
      expect(startButton()).toBeDisabled();

      // The handler is a guard too: submitting the form directly still sends
      // nothing, and there is no legacy path behind the refusal.
      fireEvent.submit(container.querySelector("form") as HTMLFormElement);
      await act(async () => {
        await Promise.resolve();
      });
      expect(ledger.starts()).toHaveLength(0);
      expect(
        ledger.requests.filter((request) =>
          request.url.includes("/dataset/onboard"),
        ),
      ).toEqual([]);
    },
  );

  it("does not undo a dispatched start when a flag is switched off mid-flight", async () => {
    const user = userEvent.setup();
    const ledger = stubBoundaries({ holdStart: true });
    const { container } = mount(
      <FlagSwitch flag="datasetOnboardingMonitoring" />,
    );

    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
    await uploadFile(user, container);
    await fillMetadata(user);
    await user.click(startButton());
    expect(
      screen.getByText("Starting the onboarding process"),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "turn off datasetOnboardingMonitoring",
      }),
    );
    await waitFor(() => {
      expect(
        screen.getByText("New dataset uploads are turned off"),
      ).toBeInTheDocument();
    });
    expect(startButton()).toBeDisabled();

    await act(async () => {
      ledger.release();
      await Promise.resolve();
    });

    // The request the server already received is not undone by a client flag.
    await waitFor(() => {
      expect(screen.getByText("Processing started")).toBeInTheDocument();
    });
    expect(ledger.starts()).toHaveLength(1);
  });
});

describe("AddDatasetForm identity and edit guards", () => {
  it("refuses to start without a resolved principal", async () => {
    const ledger = stubBoundaries();
    mockUseSession.mockReturnValue(session({ userId: undefined }));
    const { container } = mount();

    await waitFor(() => {
      expect(
        screen.getByText("Your sign-in is not usable right now"),
      ).toBeInTheDocument();
    });
    expect(startButton()).toBeDisabled();

    fireEvent.submit(container.querySelector("form") as HTMLFormElement);
    await act(async () => {
      await Promise.resolve();
    });
    expect(ledger.starts()).toHaveLength(0);
  });

  it("never creates a dataset from an edit URL", async () => {
    const ledger = stubBoundaries();
    mockSearchParams.mockReturnValue(
      new URLSearchParams({
        datasetId: "0f8f6f4e-0f0c-4a6e-9b1b-2b0f1f1d7a10",
      }),
    );
    const { container } = mount();

    await waitFor(() => {
      expect(
        screen.getByText("Editing a dataset is not supported here"),
      ).toBeInTheDocument();
    });
    expect(startButton()).toBeDisabled();

    fireEvent.submit(container.querySelector("form") as HTMLFormElement);
    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        screen.getByText(
          "Dataset update is not supported. Metadata changes cannot be saved.",
        ),
      ).toBeInTheDocument();
    });
    expect(ledger.starts()).toHaveLength(0);
    expect(mockPush).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// R1: the draft belongs to the identity that entered it
// ---------------------------------------------------------------------------
//
// The submission owner resets for a replacement scope, but resetting
// submission state is not the same as isolating the creation input. These
// cases exercise the **form**, populated, across an identity change — the gap
// the 05B review named. Nothing is keyed in `tree()`, so the provider is
// reconciled rather than remounted throughout.

const titleField = () => screen.getByPlaceholderText("Enter dataset title");

describe("AddDatasetForm draft ownership", () => {
  it("clears a populated draft when the authenticated principal changes", async () => {
    const user = userEvent.setup();
    const ledger = stubBoundaries();
    const { container, rerender } = mount();

    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
    await uploadFile(user, container);
    await fillMetadata(user);
    expect(titleField()).toHaveValue("Sensor readings 2026");

    mockUseSession.mockReturnValue(
      session({ userId: OTHER_PRINCIPAL, accessToken: "token-2" }),
    );
    rerender(tree());

    // The previous account's files and metadata are gone from the screen, not
    // merely unsubmittable.
    expect(screen.queryByText("readings.csv")).toBeNull();
    expect(titleField()).toHaveValue("");
    expect(screen.queryByPlaceholderText("Enter short headline")).toHaveValue(
      "",
    );

    fireEvent.submit(container.querySelector("form") as HTMLFormElement);
    await act(async () => {
      await Promise.resolve();
    });

    expect(ledger.starts()).toHaveLength(0);
    // The replacement identity gets a usable form, not a disabled one.
    expect(startButton()).toBeEnabled();
  });

  it("keeps the draft across a same-principal token refresh and still starts once", async () => {
    const user = userEvent.setup();
    const ledger = stubBoundaries();
    const { container, rerender } = mount();

    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
    await uploadFile(user, container);
    await fillMetadata(user);

    // A refreshed token is a new session object and a new adapter. It is not a
    // different principal, so nothing may be discarded.
    mockUseSession.mockReturnValue(session({ accessToken: "token-refreshed" }));
    rerender(tree());

    expect(titleField()).toHaveValue("Sensor readings 2026");
    expect(screen.getByText("readings.csv")).toBeInTheDocument();

    await user.click(startButton());
    await waitFor(() => {
      expect(ledger.starts()).toHaveLength(1);
    });
    expect(mockPush).toHaveBeenCalledWith(
      `/datasets/onboarding/${encodeURIComponent(PROCESS_INSTANCE_ID)}`,
    );
  });

  it("drops a late upload result that belongs to a replaced scope", async () => {
    const user = userEvent.setup();
    const ledger = stubBoundaries({ holdUpload: true });
    const { container, rerender } = mount();

    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(
      input,
      new File(["a,b\n1,2\n"], "readings.csv", { type: "text/csv" }),
    );
    await waitFor(() => {
      expect(screen.getByText("readings.csv")).toBeInTheDocument();
    });

    mockUseSession.mockReturnValue(
      session({ userId: OTHER_PRINCIPAL, accessToken: "token-2" }),
    );
    rerender(tree());
    expect(screen.queryByText("readings.csv")).toBeNull();

    // The upload finishes for the account that started it. Its callback must
    // not put that file, or its staging reference, into the new draft.
    await act(async () => {
      ledger.releaseUpload();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByText("readings.csv")).toBeNull();
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);
    await act(async () => {
      await Promise.resolve();
    });
    expect(ledger.starts()).toHaveLength(0);
  });

  it("does not revive the first visit's callbacks after A to B to A", async () => {
    const user = userEvent.setup();
    const ledger = stubBoundaries({ holdUpload: true });
    const { container, rerender } = mount();

    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(
      input,
      new File(["a,b\n1,2\n"], "readings.csv", { type: "text/csv" }),
    );
    await user.type(titleField(), "First visit");
    await waitFor(() => {
      expect(screen.getByText("readings.csv")).toBeInTheDocument();
    });

    mockUseSession.mockReturnValue(
      session({ userId: OTHER_PRINCIPAL, accessToken: "token-2" }),
    );
    rerender(tree());

    // Back to the original principal. This is a *new* draft, not the first
    // one resumed: the draft counter never reuses an identity's number.
    mockUseSession.mockReturnValue(session({ accessToken: "token-3" }));
    rerender(tree());

    expect(titleField()).toHaveValue("");
    expect(screen.queryByText("readings.csv")).toBeNull();

    await act(async () => {
      ledger.releaseUpload();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByText("readings.csv")).toBeNull();
    expect(titleField()).toHaveValue("");

    fireEvent.submit(container.querySelector("form") as HTMLFormElement);
    await act(async () => {
      await Promise.resolve();
    });
    expect(ledger.starts()).toHaveLength(0);

    // …and the form is usable again for the returning account.
    await user.type(titleField(), "Second visit");
    expect(titleField()).toHaveValue("Second visit");
  });

  it("binds a mount to the Gateway base it resolved, however late the config changes", async () => {
    // The other half of the draft's scope key is the Gateway origin. It cannot
    // change under a rendered page: `useApi` reads `getApiBaseUrl()` once per
    // mounted instance (`useMemo(..., [])`), so a post-mount `window.__env`
    // edit is a harness event, not an application one — which is why the draft
    // is deliberately *not* discarded here. What matters for safety is the
    // assertion at the end: the start goes to the origin this mount resolved,
    // so a draft can never be sent to a different Gateway than the one it
    // belongs to. A genuine environment change is a fresh page load, and the
    // accepted submission hook covers the scope-key half directly with an
    // injected identity.
    const user = userEvent.setup();
    const ledger = stubBoundaries();
    const { container, rerender } = mount();

    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
    await uploadFile(user, container);
    await fillMetadata(user);

    window.__env = {
      ...window.__env,
      DATAGEMS_API_BASE_URL: "https://other-gateway.test/dg",
    };
    rerender(tree());

    expect(titleField()).toHaveValue("Sensor readings 2026");
    await user.click(startButton());
    await waitFor(() => {
      expect(ledger.starts()).toHaveLength(1);
    });
    expect(ledger.starts()[0]?.url).toBe(
      `${API_BASE}/gw/api/workflow-process/onboard?f=id`,
    );
    expect(
      ledger.requests.filter((request) =>
        request.url.includes("other-gateway.test"),
      ),
    ).toEqual([]);
  });

  it("clears the draft's own transient feedback with it", async () => {
    const user = userEvent.setup();
    const ledger = stubBoundaries({
      start: { status: 500, body: { error: "gateway" } },
    });
    const { container, rerender } = mount();

    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
    await uploadFile(user, container);
    await fillMetadata(user);
    await user.click(startButton());
    await waitFor(() => {
      expect(
        screen.getByText("We could not confirm what happened"),
      ).toBeInTheDocument();
    });

    // Validation messages belong to the draft, so they are the decisive
    // assertion here. Provoke them under the first account.
    await user.clear(titleField());
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);
    await waitFor(() => {
      expect(screen.getByText("Title is required")).toBeInTheDocument();
    });

    mockUseSession.mockReturnValue(
      session({ userId: OTHER_PRINCIPAL, accessToken: "token-2" }),
    );
    rerender(tree());

    expect(screen.queryByText("Title is required")).toBeNull();
    // The outcome notice goes too — that one is the accepted controller's own
    // scope isolation, recorded here as a companion fact, not as this
    // correction's proof.
    expect(screen.queryByText("We could not confirm what happened")).toBeNull();
    // Still exactly the one start the first account dispatched; a dispatched
    // request is never undone by a scope change.
    expect(ledger.starts()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// R1 recheck: a draft does not outlive the owner it belongs to
// ---------------------------------------------------------------------------
//
// The accepted submission hook treats an unresolved scope as a new owner with
// an empty ledger, not as a pause. A draft that survived that interval would
// come back to a fresh owner still holding upload references the previous
// owner had already sent — and a second deliberate submit could repeat an
// uncertain start with them.

describe("AddDatasetForm draft lifetime across an unavailable session", () => {
  it("does not resend an unknown attempt after a session error and recovery", async () => {
    const user = userEvent.setup();
    const ledger = stubBoundaries({
      start: { status: 500, body: { error: "gateway" } },
    });
    const { container, rerender } = mount();

    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
    await uploadFile(user, container);
    await fillMetadata(user);
    await user.click(startButton());

    await waitFor(() => {
      expect(
        screen.getByText("We could not confirm what happened"),
      ).toBeInTheDocument();
    });
    expect(ledger.starts()).toHaveLength(1);

    // A failed refresh: the session is still "authenticated" but carries an
    // error, so the accepted binding resolves no scope and the owner is gone.
    mockUseSession.mockReturnValue(
      session({ error: "RefreshAccessTokenError" }),
    );
    rerender(tree());
    expect(startButton()).toBeDisabled();
    expect(screen.queryByText("readings.csv")).toBeNull();

    // The same principal comes back. The controller has a fresh, empty ledger,
    // so the draft must not still be holding the references the first attempt
    // may already have consumed.
    mockUseSession.mockReturnValue(session({ accessToken: "restored-token" }));
    rerender(tree());

    expect(screen.queryByText("readings.csv")).toBeNull();
    expect(titleField()).toHaveValue("");

    await act(async () => {
      fireEvent.submit(container.querySelector("form") as HTMLFormElement);
      await Promise.resolve();
    });

    expect(ledger.starts()).toHaveLength(1);
    expect(ledger.uploads).toHaveLength(1);
  });

  it("drops an upload that completes while the session is unavailable", async () => {
    const user = userEvent.setup();
    const ledger = stubBoundaries({ holdUpload: true });
    const { container, rerender } = mount();

    await waitFor(() => {
      expect(startButton()).toBeEnabled();
    });
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await user.upload(
      input,
      new File(["a,b\n1,2\n"], "readings.csv", { type: "text/csv" }),
    );
    await user.type(titleField(), "Before the refresh failed");
    await waitFor(() => {
      expect(screen.getByText("readings.csv")).toBeInTheDocument();
    });

    mockUseSession.mockReturnValue(
      session({ error: "RefreshAccessTokenError" }),
    );
    rerender(tree());
    expect(screen.queryByText("readings.csv")).toBeNull();
    expect(titleField()).toHaveValue("");

    // Back as the same principal, and only then does the upload land.
    mockUseSession.mockReturnValue(session({ accessToken: "restored-token" }));
    rerender(tree());
    await act(async () => {
      ledger.releaseUpload();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByText("readings.csv")).toBeNull();
    expect(titleField()).toHaveValue("");

    await act(async () => {
      fireEvent.submit(container.querySelector("form") as HTMLFormElement);
      await Promise.resolve();
    });
    expect(ledger.starts()).toHaveLength(0);

    // The recovered session is usable: a fresh upload and a fresh draft work.
    await user.type(titleField(), "After recovery");
    expect(titleField()).toHaveValue("After recovery");
    expect(startButton()).toBeEnabled();
  });
});
