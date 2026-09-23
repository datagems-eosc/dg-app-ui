"use client";

/**
 * Add a dataset — files and metadata, then one managed onboarding start.
 *
 * Revision 5 of the onboarding change replaced what this form used to do. The
 * old path ran `onboardDataset`, then optional group grants, then a delayed
 * profiling call that fell back to resolving the dataset **by title** when the
 * id it had just been given did not resolve — and finally showed an
 * unconditional "published successfully" modal. Each of those is now gone, and
 * none of them is reachable from a disabled flag or an error branch:
 *
 *  - one deliberate `Start processing` action replaces Next → Publish;
 *  - the sharing step and the collection selector are not offered, because a
 *    new dataset is created privately and sharing and collection assignment are
 *    separate later actions this flow does not perform;
 *  - the accepted submission owner (shared by `app/datasets/layout.tsx`) holds
 *    the attempt, so a repeated click sends one request, an accepted process
 *    reference survives the navigation to the processing page, and upload
 *    references consumed by an accepted or uncertain start are never sent
 *    again;
 *  - an accepted start navigates to the known process id; an uncertain one
 *    stays here and says so.
 *
 * What this component still owns is the form: fields, their validation, the
 * uploader and the feedback. What it deliberately does not own is any of the
 * submission rules — validation of retained files, the duplicate-start guard,
 * the reference ledger and the outcome classification all belong to the
 * accepted controller and adapter, and are not re-implemented here.
 */

import { Button } from "@ui/Button";
import { AdditionalInformation } from "@ui/datasets/AdditionalInformation";
import { BasicInformation } from "@ui/datasets/BasicInformation";
import { Classification } from "@ui/datasets/Classification";
import { DatasetUpload, type UploadedFile } from "@ui/datasets/DatasetUpload";
import { FormSectionLayout } from "@ui/FormSectionLayout";
import { Toast } from "@ui/Toast";
import {
  CircleCheck,
  CircleX,
  Info,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import type React from "react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useOptionalOnboardingSession } from "@/components/DatasetOnboarding/OnboardingSessionProvider";
import { APP_ROUTES } from "@/config/appUrls";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { useApi } from "@/hooks/useApi";
import {
  publicationDateOf,
  toOnboardingMetadata,
} from "@/lib/datasetOnboarding/form";
import type {
  SubmissionBlock,
  SubmissionRequest,
  UnresolvedFileReason,
} from "@/lib/datasetOnboarding/submission";
import { logError } from "@/lib/logger";
import { getNavigationUrl } from "@/lib/utils";

interface FormData {
  files: UploadedFile[];
  basicInfo: {
    title: string;
    headline: string;
    description: string;
    keywords: string[];
  };
  classification: {
    fieldsOfScience: string[];
    collection: string;
    license: string;
    languages: string[];
    countries: string[];
  };
  additionalInfo: {
    referenceString: string;
    sourceLink: string;
  };
}

interface FormErrors {
  files?: string;
  basicInfo: {
    title?: string;
    headline?: string;
    description?: string;
    keywords?: string;
  };
  classification: {
    fieldsOfScience?: string;
    collection?: string;
    license?: string;
    languages?: string;
    countries?: string;
  };
  additionalInfo: {
    referenceString?: string;
    sourceLink?: string;
  };
}

const initialFormData: FormData = {
  files: [],
  basicInfo: {
    title: "",
    headline: "",
    description: "",
    keywords: [],
  },
  classification: {
    fieldsOfScience: [],
    collection: "",
    license: "",
    languages: [],
    countries: [],
  },
  additionalInfo: {
    referenceString: "",
    sourceLink: "",
  },
};

const initialErrors: FormErrors = {
  basicInfo: {},
  classification: {},
  additionalInfo: {},
};

interface ToastState {
  readonly message: string;
  readonly visible: boolean;
  readonly type: "success" | "error";
}

const noToast: ToastState = { message: "", visible: false, type: "success" };

/**
 * Everything the contributor has entered but not yet submitted, tied to the
 * identity and environment it was entered under.
 *
 * The draft is scoped for the same reason the submission controller is: a
 * dataset is created *as somebody*, against *one* Gateway. The controller
 * already starts a new owner with an empty ledger when either changes, but
 * resetting submission state is not the same as isolating the creation input —
 * files, metadata and staging references entered as one principal must not be
 * displayed to, or submitted by, the next one.
 *
 * `draftId` is a counter, never a scope key, so returning to an earlier
 * principal produces a *new* draft rather than reviving the old one, and a
 * callback still holding the first visit's id stays stale through an
 * A → B → A transition.
 */
interface FormDraft {
  readonly draftId: number;
  /** The last *resolved* scope this draft belongs to; `null` until one is. */
  readonly scopeKey: string | null;
  readonly formData: FormData;
  readonly errors: FormErrors;
  readonly toast: ToastState;
  readonly navigationFailed: boolean;
}

const emptyDraft = (draftId: number, scopeKey: string | null): FormDraft => ({
  draftId,
  scopeKey,
  formData: initialFormData,
  errors: initialErrors,
  toast: noToast,
  navigationFailed: false,
});

/** NUL-separated, as in the submission hook, so no value can forge a key. */
const scopeKeyOf = (
  scope: {
    readonly principalId: string;
    readonly gatewayOrigin: string;
  } | null,
): string | null =>
  scope === null ? null : `${scope.principalId}\u0000${scope.gatewayOrigin}`;

// ---------------------------------------------------------------------------
// Feedback presentation
// ---------------------------------------------------------------------------

type NoticeTone = "neutral" | "caution" | "problem" | "success";

/**
 * The same tinted-surface hierarchy as the accepted processing view, so the two
 * halves of one journey read as one feature. Classes are concatenated rather
 * than merged through `cn`: the shared helper drops a typography class whenever
 * a text colour is merged in the same call, which is recorded in the 04B
 * handback and left untouched here.
 */
const TONE_SURFACE: Record<NoticeTone, string> = {
  neutral: "border-slate-200 bg-slate-75",
  caution: "border-amber-200 bg-amber-50",
  problem: "border-red-200 bg-red-50",
  success: "border-emerald-200 bg-emerald-50",
};

const TONE_TITLE: Record<NoticeTone, string> = {
  neutral: "text-gray-750",
  caution: "text-amber-900",
  problem: "text-red-800",
  success: "text-emerald-800",
};

const TONE_BODY: Record<NoticeTone, string> = {
  neutral: "text-gray-650",
  caution: "text-amber-800",
  problem: "text-red-700",
  success: "text-emerald-700",
};

const TONE_ICON: Record<NoticeTone, string> = {
  neutral: "text-icon",
  caution: "text-amber-600",
  problem: "text-red-550",
  success: "text-emerald-600",
};

const NoticeIcon = ({ tone, busy }: { tone: NoticeTone; busy: boolean }) => {
  const className = ["mt-0.5 h-5 w-5 shrink-0", TONE_ICON[tone]].join(" ");
  if (busy) {
    return (
      <LoaderCircle
        className={`${className} animate-spin motion-reduce:animate-none`}
        aria-hidden="true"
      />
    );
  }
  switch (tone) {
    case "success":
      return <CircleCheck className={className} aria-hidden="true" />;
    case "problem":
      return <CircleX className={className} aria-hidden="true" />;
    case "caution":
      return <TriangleAlert className={className} aria-hidden="true" />;
    default:
      return <Info className={className} aria-hidden="true" />;
  }
};

/** Text and icon carry the state; colour only reinforces it. */
const Notice = ({
  tone,
  title,
  busy = false,
  children,
  actions,
}: {
  tone: NoticeTone;
  title: string;
  busy?: boolean;
  children: ReactNode;
  actions?: ReactNode;
}) => (
  <div
    className={`rounded-xl border p-4 ${TONE_SURFACE[tone]}`}
    data-testid="submission-notice"
  >
    <div className="flex items-start gap-3">
      <NoticeIcon tone={tone} busy={busy} />
      <div className="min-w-0 flex-1">
        <p className={`break-words text-body-14-medium ${TONE_TITLE[tone]}`}>
          {title}
        </p>
        <div
          className={`mt-1 space-y-1 break-words text-body-14-regular ${TONE_BODY[tone]}`}
        >
          {children}
        </div>
        {actions === undefined ? null : <div className="mt-3">{actions}</div>}
      </div>
    </div>
  </div>
);

const UNRESOLVED_FILE_REASON: Record<UnresolvedFileReason, string> = {
  uploading: "still uploading",
  failed: "the upload failed",
  "missing-reference": "the upload returned no location",
  "invalid-reference": "the upload location cannot be sent",
  "duplicate-reference": "another file has the same upload location",
};

/**
 * Why new submissions are not available, when they are not.
 *
 * `checking` is deliberately separate from a refusal: telling someone to sign
 * in again while the session or the flag overrides are still resolving would
 * ask them to fix something that is not broken.
 */
type SubmissionAvailability =
  | { readonly kind: "available" }
  | { readonly kind: "checking" }
  | { readonly kind: "rollout-disabled" }
  | { readonly kind: "sign-in-required" }
  | { readonly kind: "session-unavailable" };

// ---------------------------------------------------------------------------

export default function AddDatasetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const api = useApi();
  const { flags, isHydrated } = useFeatureFlags();
  // `null` outside a provider. The shared owner is installed by
  // `app/datasets/layout.tsx`; rendering the form without it disables
  // submission honestly instead of throwing a page away.
  const session = useOptionalOnboardingSession();

  const datasetIdForEdit = searchParams.get("datasetId");
  const [allowedExtensions, setAllowedExtensions] = useState<string[]>([]);
  const [, setIsEditLoading] = useState(Boolean(datasetIdForEdit));

  const hasToken = api.hasToken;
  const getUploadAllowedExtensions = api.getUploadAllowedExtensions;
  const queryDatasets = api.queryDatasets;
  const onboardingScope = api.datasetOnboarding.scope;
  const onboardingAuth = api.datasetOnboarding.auth;

  // --- the scoped draft ----------------------------------------------------
  //
  // Reconciled during render, not in an effect. An effect would paint one frame
  // of the previous principal's files and metadata under the replacement
  // identity first — and, worse, would leave a submit in that frame reading the
  // old draft. This is the pattern the accepted submission hook already uses
  // for its own state, for the same reason.
  //
  // The draft's lifetime is tied to the submission owner's. The accepted hook
  // treats an unresolved scope as a *new owner with an empty ledger*, not as a
  // pause — so a draft that outlived the loss of its scope would come back to a
  // fresh owner still holding the upload references the previous owner had
  // already sent, and a second deliberate submit could repeat an uncertain
  // start with them. Keeping somebody's typing across a failed refresh is worth
  // less than that, so an owned draft is discarded the moment its scope stops
  // resolving, and the same principal returning gets a new draft rather than
  // the old one back.
  //
  // A token refresh that keeps a *valid* scope is not this case: the scope key
  // is unchanged, so the draft, the owner and the ledger all continue.

  const scopeKey = scopeKeyOf(onboardingScope);
  const draftCounterRef = useRef(0);
  const [storedDraft, setStoredDraft] = useState<FormDraft>(() =>
    emptyDraft((draftCounterRef.current += 1), scopeKey),
  );
  const draftRef = useRef(storedDraft);

  const navigatedForRef = useRef<string | null>(null);

  // An *owned* draft is one whose scope resolved at least once. It is replaced
  // when that scope changes and when it stops resolving at all; both are the
  // loss of the owner it belonged to.
  const ownedDraftLostItsScope =
    storedDraft.scopeKey !== null && storedDraft.scopeKey !== scopeKey;
  // A draft that has never been owned adopts the first scope that resolves,
  // rather than discarding what was typed while the session was still
  // resolving. Nothing in it was entered under a different identity, and no
  // reference in it has been sent by any owner.
  const unownedDraftAdoptsScope =
    scopeKey !== null && storedDraft.scopeKey === null;

  let draft = storedDraft;
  if (ownedDraftLostItsScope) {
    // A new draft id, so every callback the previous one issued — a pending
    // upload above all — is stale and cannot write into this one.
    draft = emptyDraft((draftCounterRef.current += 1), scopeKey);
    draftRef.current = draft;
    setStoredDraft(draft);
    // Scope-specific data fetched for the previous Gateway, and the record of
    // where we have already navigated. Refs are written here rather than in an
    // effect for the same reason the draft is.
    setAllowedExtensions([]);
    navigatedForRef.current = null;
  } else if (unownedDraftAdoptsScope) {
    draft = { ...storedDraft, scopeKey };
    draftRef.current = draft;
    setStoredDraft(draft);
  }

  const { draftId, formData, errors, toast, navigationFailed } = draft;

  /**
   * Applies an update on behalf of one draft, or drops it.
   *
   * Every callback below captures the `draftId` of the render that created it,
   * so a late upload completion, a slow edit-load response or a handler the
   * uploader kept hold of cannot write into a replacement scope's draft. The
   * check is against the ref, not the render closure, so it is correct even
   * within the same tick as the scope change.
   */
  const applyToDraft = useCallback(
    (
      ownerDraftId: number,
      update: (previous: FormDraft) => FormDraft,
    ): void => {
      if (draftRef.current.draftId !== ownerDraftId) return;
      const next = update(draftRef.current);
      if (next === draftRef.current) return;
      draftRef.current = next;
      setStoredDraft(next);
    },
    [],
  );

  const showToast = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      applyToDraft(draftId, (previous) => ({
        ...previous,
        toast: { message, visible: true, type },
      }));
    },
    [applyToDraft, draftId],
  );

  // --- rollout and identity gate -------------------------------------------
  //
  // Both flags are required, and only once the overrides have hydrated: before
  // that the resolved value is the default, and acting on it could start a
  // submission the environment has switched off. There is no legacy branch
  // behind either flag — when this is not `available`, nothing is sent at all.

  const availability: SubmissionAvailability = !isHydrated
    ? { kind: "checking" }
    : !(flags.datasetOnboarding && flags.datasetOnboardingMonitoring)
      ? { kind: "rollout-disabled" }
      : session === null
        ? { kind: "session-unavailable" }
        : onboardingAuth === "loading"
          ? { kind: "checking" }
          : onboardingScope === null
            ? { kind: "sign-in-required" }
            : { kind: "available" };

  const isEditRequest = Boolean(datasetIdForEdit);
  const canSubmit =
    availability.kind === "available" &&
    !isEditRequest &&
    session !== null &&
    session.status !== "starting" &&
    session.status !== "accepted";

  useEffect(() => {
    if (!hasToken) return;
    // Scoped like everything else: a list fetched for the previous Gateway must
    // not come back and describe the replacement one's uploader.
    let cancelled = false;
    getUploadAllowedExtensions()
      .then((extensions) => {
        if (!cancelled && draftRef.current.draftId === draftId) {
          setAllowedExtensions(extensions);
        }
      })
      .catch(() => {
        if (!cancelled && draftRef.current.draftId === draftId) {
          setAllowedExtensions([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [hasToken, getUploadAllowedExtensions, draftId]);

  useEffect(() => {
    if (!datasetIdForEdit || !hasToken || !queryDatasets) return;
    let cancelled = false;
    setIsEditLoading(true);
    queryDatasets({
      ids: [datasetIdForEdit],
      project: {
        fields: [
          "id",
          "name",
          "description",
          "headline",
          "keywords",
          "fieldOfScience",
          "license",
          "collections.id",
          "url",
          "citation",
        ],
      },
      page: { Offset: 0, Size: 1 },
      Order: { Items: ["+name"] },
      Metadata: { CountAll: false },
    })
      .then((res) => {
        if (cancelled) return;
        const items = Array.isArray(res.items) ? res.items : [];
        const item = items[0] as Record<string, unknown> | undefined;
        if (!item) return;
        const name = String(item.name ?? item.code ?? "");
        const description = String(item.description ?? "");
        const headline = String(item.headline ?? "");
        const keywords = Array.isArray(item.keywords)
          ? (item.keywords as string[])
          : typeof item.keywords === "string"
            ? [item.keywords]
            : [];
        const fieldOfScience = Array.isArray(item.fieldOfScience)
          ? (item.fieldOfScience as string[])
          : typeof item.fieldOfScience === "string"
            ? [item.fieldOfScience]
            : [];
        const license = String(item.license ?? "");
        const collections = Array.isArray(item.collections)
          ? (item.collections as Array<{ id?: string }>)
          : [];
        const collection = collections[0]?.id != null ? collections[0].id : "";
        const url = String(item.url ?? "");
        const citeAs = String(
          (item as { citation?: string }).citation ?? item.citeAs ?? "",
        );
        applyToDraft(draftId, (previous) => ({
          ...previous,
          formData: {
            ...previous.formData,
            basicInfo: {
              ...previous.formData.basicInfo,
              title: name,
              headline: headline || name,
              description,
              keywords,
            },
            classification: {
              ...previous.formData.classification,
              fieldsOfScience: fieldOfScience,
              collection,
              license,
            },
            additionalInfo: {
              sourceLink: url,
              referenceString: citeAs,
            },
          },
        }));
      })
      .catch((err) => {
        if (!cancelled) logError("Failed to load dataset for edit", err);
      })
      .finally(() => {
        if (!cancelled) setIsEditLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [datasetIdForEdit, hasToken, queryDatasets, applyToDraft, draftId]);

  // --- navigation to the accepted process ----------------------------------
  //
  // An effect, because acceptance arrives from the transport rather than from
  // the click: the handler returns as soon as the start is dispatched. It is
  // keyed on the accepted process id and guarded by a ref, so it runs once per
  // accepted process and a re-render, a token refresh or a returning user never
  // re-navigates. Nothing here starts, repeats or resets a submission.

  const acceptedProcessInstanceId = session?.processInstanceId ?? null;

  const openProcessingPage = useCallback(
    (processInstanceId: string) => {
      try {
        // A bare app route: Next applies the configured `basePath` itself, and
        // this matches the accepted monitoring page's own navigation.
        router.push(
          `/datasets/onboarding/${encodeURIComponent(processInstanceId)}`,
        );
        applyToDraft(draftId, (previous) =>
          previous.navigationFailed
            ? { ...previous, navigationFailed: false }
            : previous,
        );
      } catch (error) {
        // The process is real and still known. Offer the same navigation
        // again — never another start.
        logError("Failed to open the dataset processing page", error);
        applyToDraft(draftId, (previous) => ({
          ...previous,
          navigationFailed: true,
        }));
      }
    },
    [router, applyToDraft, draftId],
  );

  useEffect(() => {
    if (acceptedProcessInstanceId === null) return;
    if (navigatedForRef.current === acceptedProcessInstanceId) return;
    navigatedForRef.current = acceptedProcessInstanceId;
    openProcessingPage(acceptedProcessInstanceId);
  }, [acceptedProcessInstanceId, openProcessingPage]);

  // --- validation ----------------------------------------------------------

  const isValidUrl = (string: string): boolean => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {
      basicInfo: {},
      classification: {},
      additionalInfo: {},
    };

    if (!datasetIdForEdit && formData.files.length === 0) {
      newErrors.files = "At least one file must be uploaded";
    }

    if (!formData.basicInfo.title.trim()) {
      newErrors.basicInfo.title = "Title is required";
    }

    if (!formData.basicInfo.headline.trim()) {
      newErrors.basicInfo.headline = "Headline is required";
    } else if (formData.basicInfo.headline.length > 150) {
      newErrors.basicInfo.headline = "Headline must be 150 characters or less";
    }

    if (!formData.basicInfo.description.trim()) {
      newErrors.basicInfo.description = "Description is required";
    } else if (formData.basicInfo.description.length > 3000) {
      newErrors.basicInfo.description =
        "Description must be 3000 characters or less";
    }

    // Validate keywords: required and max combined length 250
    const combinedKeywords = formData.basicInfo.keywords
      .filter(Boolean)
      .join(", ");
    if (formData.basicInfo.keywords.length === 0) {
      newErrors.basicInfo.keywords = "Keywords are required";
    } else if (combinedKeywords.length > 250) {
      newErrors.basicInfo.keywords = "Keywords must be 250 characters or less";
    }

    if (formData.classification.fieldsOfScience.length === 0) {
      newErrors.classification.fieldsOfScience =
        "At least one field of science must be selected";
    }

    if (!formData.classification.license.trim()) {
      newErrors.classification.license = "License is required";
    }

    if (formData.additionalInfo.referenceString.length > 3000) {
      newErrors.additionalInfo.referenceString =
        "Reference string must be 3000 characters or less";
    }

    if (
      formData.additionalInfo.sourceLink.trim() &&
      !isValidUrl(formData.additionalInfo.sourceLink)
    ) {
      newErrors.additionalInfo.sourceLink = "Please enter a valid URL";
    }

    applyToDraft(draftId, (previous) => ({ ...previous, errors: newErrors }));

    // Check if there are any errors
    const hasErrors =
      !!newErrors.files ||
      Object.values(newErrors.basicInfo).some((error) => error) ||
      Object.values(newErrors.classification).some((error) => error) ||
      Object.values(newErrors.additionalInfo).some((error) => error);

    return !hasErrors;
  };

  // --- submission ----------------------------------------------------------

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    // The edit URL never creates a replacement dataset. This is checked before
    // anything else, so no validation result and no flag combination can lead
    // to a start from an edit request.
    if (datasetIdForEdit) {
      showToast(
        "Dataset update is not supported. Metadata changes cannot be saved.",
        "error",
      );
      return;
    }

    // The same gate as the button, repeated here: a disabled control is not a
    // guard. There is no fallback branch — a refused submission sends nothing.
    if (availability.kind !== "available" || session === null) return;

    // This draft must belong to the identity and environment that would send
    // it. The render above already replaces a draft whose scope changed, so
    // this is an invariant rather than a second reset — but it is checked
    // explicitly, because the one thing that must never happen is one
    // principal's files and metadata being created as another.
    if (draft.scopeKey !== scopeKey) return;

    if (!validateForm()) return;

    const request: SubmissionRequest = {
      // Every retained file is passed, including unresolved ones. The accepted
      // controller names them and refuses; silently dropping them here is the
      // behaviour this replaces.
      files: formData.files,
      metadata: toOnboardingMetadata(
        {
          title: formData.basicInfo.title,
          headline: formData.basicInfo.headline,
          description: formData.basicInfo.description,
          keywords: formData.basicInfo.keywords,
          fieldsOfScience: formData.classification.fieldsOfScience,
          license: formData.classification.license,
          languages: formData.classification.languages,
          countries: formData.classification.countries,
          sourceLink: formData.additionalInfo.sourceLink,
          referenceString: formData.additionalInfo.referenceString,
        },
        publicationDateOf(new Date()),
      ),
      // Explicitly nothing: this flow requests no sharing and assigns no
      // collection. A fabricated selection would claim a choice that was never
      // offered and leave a reconciliation task nothing could close.
      sharing: null,
    };

    // The returned refusal is deliberately not stored. A refusal that belongs
    // to the current owner is already in `session.blocked`; one returned for a
    // stale handle (`owner-inactive`) must not be rendered against a
    // replacement owner's state.
    session.submit(request);
  };

  // Each of these captures this render's `draftId`. The uploader in particular
  // resolves its upload asynchronously and calls back with the file list it
  // started from; that call is dropped if the scope has moved on.

  const handleFilesChange = (files: UploadedFile[]) => {
    applyToDraft(draftId, (previous) => ({
      ...previous,
      formData: { ...previous.formData, files },
      // Clear file error if files are added
      errors:
        files.length > 0 && previous.errors.files
          ? { ...previous.errors, files: undefined }
          : previous.errors,
    }));
  };

  const handleBasicInfoChange = (basicInfo: FormData["basicInfo"]) => {
    applyToDraft(draftId, (previous) => ({
      ...previous,
      formData: { ...previous.formData, basicInfo },
    }));
  };

  const handleClassificationChange = (
    classification: FormData["classification"],
  ) => {
    applyToDraft(draftId, (previous) => ({
      ...previous,
      formData: { ...previous.formData, classification },
    }));
  };

  const handleAdditionalInfoChange = (
    additionalInfo: FormData["additionalInfo"],
  ) => {
    applyToDraft(draftId, (previous) => ({
      ...previous,
      formData: { ...previous.formData, additionalInfo },
    }));
  };

  // --- feedback ------------------------------------------------------------

  const renderAvailability = (): ReactNode => {
    if (isEditRequest) {
      return (
        <Notice tone="caution" title="Editing a dataset is not supported here">
          <p>
            This page can only create a new dataset. Nothing you change here is
            saved to the existing one, and submitting would not create a
            replacement.
          </p>
        </Notice>
      );
    }
    switch (availability.kind) {
      case "available":
        return null;
      case "checking":
        return (
          <Notice tone="neutral" title="Checking whether uploads are available">
            <p>One moment.</p>
          </Notice>
        );
      case "rollout-disabled":
        return (
          <Notice tone="caution" title="New dataset uploads are turned off">
            <p>
              Starting a dataset is currently disabled in this environment.
              Datasets that have already started keep their processing page and
              can still be opened.
            </p>
          </Notice>
        );
      case "sign-in-required":
        return (
          <Notice tone="caution" title="Your sign-in is not usable right now">
            <p>Sign in again before starting a dataset.</p>
          </Notice>
        );
      default:
        return (
          <Notice
            tone="caution"
            title="This form is not connected to an onboarding session"
          >
            <p>Reload the page before starting a dataset.</p>
          </Notice>
        );
    }
  };

  const renderBlock = (block: SubmissionBlock): ReactNode => {
    switch (block.kind) {
      case "no-files":
        return (
          <Notice tone="problem" title="Add a file before starting">
            <p>At least one uploaded file is required.</p>
          </Notice>
        );
      case "unresolved-files":
        return (
          <Notice tone="problem" title="Some files are not ready to be sent">
            <p>Resolve or remove these files, then start again:</p>
            <ul className="list-disc space-y-0.5 pl-5">
              {block.files.map((file) => (
                <li key={file.fileId}>
                  {file.name} — {UNRESOLVED_FILE_REASON[file.reason]}
                </li>
              ))}
            </ul>
            <p>No file is left out of a submission.</p>
          </Notice>
        );
      case "references-unusable":
        return (
          <Notice tone="problem" title="These uploads were already submitted">
            <p>
              They were sent with an earlier attempt on this page, so they
              cannot be sent again. Remove them and upload the files again:
            </p>
            <ul className="list-disc space-y-0.5 pl-5">
              {block.files.map((file) => (
                <li key={file.fileId}>{file.name}</li>
              ))}
            </ul>
          </Notice>
        );
      case "already-starting":
        return (
          <Notice tone="neutral" title="A start is already in progress" busy>
            <p>Only one request is sent. Wait for the result.</p>
          </Notice>
        );
      case "attempt-accepted":
        return (
          <Notice tone="neutral" title="This dataset has already been started">
            <p>Open its processing page to follow the run.</p>
          </Notice>
        );
      case "attempt-unknown":
        return (
          <Notice
            tone="caution"
            title="The previous attempt has not been resolved"
          >
            <p>
              Its outcome is still unknown, so nothing is submitted again from
              here. Check Browse for the dataset first.
            </p>
          </Notice>
        );
      case "identity-unavailable":
        return (
          <Notice tone="caution" title="Your sign-in is not usable right now">
            <p>Sign in again before starting a dataset.</p>
          </Notice>
        );
      default:
        // `owner-inactive` is never stored against the current owner, so it
        // cannot reach this branch from `session.blocked`.
        return null;
    }
  };

  const renderOutcome = (): ReactNode => {
    if (session === null) return null;
    switch (session.status) {
      case "starting":
        return (
          <Notice tone="neutral" title="Starting the onboarding process" busy>
            <p>One request is sent. Repeating the action does not send more.</p>
          </Notice>
        );
      case "accepted":
        return (
          <Notice
            tone="success"
            title="Processing started"
            actions={
              acceptedProcessInstanceId === null ? undefined : (
                <Button
                  type="button"
                  onClick={() => openProcessingPage(acceptedProcessInstanceId)}
                >
                  Open processing page
                </Button>
              )
            }
          >
            <p>
              {navigationFailed
                ? "The processing page did not open. The dataset was still started; open it again below."
                : "Opening the processing page. The dataset is not started again."}
            </p>
          </Notice>
        );
      case "rejected":
        return (
          <Notice tone="problem" title="The dataset was not created">
            <p>
              The service refused this submission
              {session.rejection === null
                ? ""
                : ` (HTTP ${session.rejection.httpStatus})`}
              . Nothing was created.
            </p>
            <p>
              The files that were sent have to be uploaded again before another
              attempt: a refusal does not establish that they are still
              available.
            </p>
          </Notice>
        );
      case "unknown":
        return (
          <Notice
            tone="caution"
            title="We could not confirm what happened"
            actions={
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(getNavigationUrl(APP_ROUTES.BROWSE))}
              >
                Go to Browse
              </Button>
            }
          >
            <p>
              The request was sent but its result could not be read, so the
              dataset may or may not have been created. Nothing is sent again
              automatically.
            </p>
            <p>
              Look for the dataset in Browse. A dataset with a similar name is
              not proof that this is the one, and not finding it is not proof
              that nothing was created — ask support with the time of this
              attempt if it stays unclear.
            </p>
          </Notice>
        );
      default:
        return null;
    }
  };

  const availabilityNotice = renderAvailability();
  const outcomeNotice = renderOutcome();
  const blockNotice =
    session?.blocked == null ? null : renderBlock(session.blocked);

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/*
        Keyed by the draft, so a scope change also discards the field
        components' own internal state — the uploader's in-flight banner, the
        licence card, a half-typed custom licence name. Clearing `formData`
        alone would leave the previous identity's selections on screen. This
        keys the *fields*; the submission provider above is never keyed, so the
        shared owner survives a token refresh and the add → processing
        navigation unchanged.
      */}
      <div key={draftId} className="space-y-6 sm:space-y-8">
        {[
          {
            key: "upload",
            title: "Dataset upload",
            description: "Upload the files of your dataset",
            content: (
              <DatasetUpload
                files={formData.files}
                onFilesChange={handleFilesChange}
                onUpload={api.uploadDatasetFiles}
                allowedExtensions={allowedExtensions}
                onRemoteUploadNotSupported={(msg) => showToast(msg, "error")}
              />
            ),
            errorText: errors.files,
          },
          {
            key: "basic",
            title: "Basic information",
            description: "Provide the essential details about your dataset",
            content: (
              <BasicInformation
                data={formData.basicInfo}
                onChange={handleBasicInfoChange}
                errors={errors.basicInfo}
              />
            ),
          },
          {
            key: "classification",
            title: "Classification",
            description: "Categorize your dataset for better discoverability",
            content: (
              <Classification
                data={formData.classification}
                onChange={handleClassificationChange}
                errors={errors.classification}
                // Collections are assigned later, from the dataset itself.
                showCollection={false}
              />
            ),
          },
          {
            key: "additional",
            title: "Additional Information",
            description: "Dataset citation",
            content: (
              <AdditionalInformation
                data={formData.additionalInfo}
                onChange={handleAdditionalInfoChange}
                errors={errors.additionalInfo}
              />
            ),
          },
        ].map((section) => (
          <FormSectionLayout
            key={section.key}
            title={section.title}
            description={section.description}
            errorText={section.errorText}
          >
            {section.content}
          </FormSectionLayout>
        ))}
      </div>

      {/*
        One region for every submission state. `aria-live` announces the
        transition that follows an action rather than the whole page, and the
        region exists from the first render so an inserted notice is announced.
      */}
      <div
        className="mt-6 space-y-3 sm:mt-8"
        aria-live="polite"
        data-testid="submission-feedback"
      >
        {availabilityNotice}
        {outcomeNotice}
        {blockNotice}
      </div>

      <div className="mt-6 sm:mt-8">
        <p className="text-body-14-regular text-gray-650">
          Sharing and collection assignment are separate from uploading.
        </p>
        <div className="mt-3 flex flex-col justify-end gap-3 sm:flex-row">
          <Button
            type="submit"
            disabled={!canSubmit}
            className="order-1 w-full px-6 sm:order-1 sm:w-auto sm:px-8"
          >
            Start processing
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(getNavigationUrl(APP_ROUTES.BROWSE))}
            className="order-2 w-full sm:order-2 sm:w-auto"
          >
            Cancel
          </Button>
        </div>
      </div>

      <Toast
        message={toast.message}
        isVisible={toast.visible}
        onClose={() =>
          applyToDraft(draftId, (previous) => ({
            ...previous,
            toast: { ...previous.toast, visible: false },
          }))
        }
        type={toast.type}
      />
    </form>
  );
}
