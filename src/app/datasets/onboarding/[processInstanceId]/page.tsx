"use client";

/**
 * `/datasets/onboarding/[processInstanceId]` — the public processing page.
 *
 * Thin by design. It supplies three things the composition cannot supply
 * itself — the shell, the route parameter and navigation — and delegates
 * everything else to the accepted controller, the accepted model and the
 * design-approved view.
 *
 * It deliberately does not: fetch, poll, decode, decide an action, hold
 * workflow state, read storage, start or repeat anything, or gate itself on a
 * submission rollout flag. A process that already exists stays readable to an
 * authorised user regardless of whether new submissions are enabled.
 */

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  PROCESSING_HEADING_ID,
  ProcessingView,
} from "@/components/DatasetOnboarding/ProcessingView";
import { useDatasetOnboardingPage } from "@/hooks/useDatasetOnboardingPage";
import type { DatasetId } from "@/lib/datasetOnboarding/types";

export default function DatasetOnboardingProcessPage() {
  const params = useParams<{ processInstanceId?: string | string[] }>();
  const router = useRouter();

  const page = useDatasetOnboardingPage({
    // Next has already decoded this. Decoding it again would corrupt any id
    // containing a literal `%`; the accepted controller validates it.
    processInstanceIdParam: params?.processInstanceId,
  });

  const { controller } = page;

  /**
   * Move focus to the heading when the user arrives, and again when the page
   * starts monitoring a different process — the two moments where the content
   * changes out from under someone who cannot see it.
   *
   * Keyed on the process reference, so a poll, a re-render, a token refresh or
   * a status transition never steals focus from a control the user is on.
   */
  const focusedReferenceRef = useRef<string | null>(null);
  const focusKey =
    controller.processInstanceId ?? `invalid:${controller.reference}`;

  useEffect(() => {
    if (focusedReferenceRef.current === focusKey) return;
    focusedReferenceRef.current = focusKey;
    // The view owns the only h1 and exposes it by a stable id.
    document.getElementById(PROCESSING_HEADING_ID)?.focus();
  }, [focusKey]);

  const handleViewDataset = useCallback(
    (datasetId: DatasetId) => {
      // Exactly one deployment base path: Next's router applies the configured
      // `basePath` itself, so the path handed to it must not already carry one.
      // (`getNavigationUrl` prepends a *second*, separately configured base
      // path; combining the two is the defect recorded in the handback.)
      router.push(`/datasets/${encodeURIComponent(datasetId)}`);
    },
    [router],
  );

  return (
    <DashboardLayout>
      <div className="relative mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-6 lg:py-10">
        <ProcessingView
          view={page.view}
          {...(page.datasetTitle === undefined
            ? {}
            : { datasetTitle: page.datasetTitle })}
          read={page.read}
          sharingNeedsReconciliation={page.sharingNeedsReconciliation}
          onCheckAgain={page.checkAgain}
          onRetryConfiguration={page.retryConfiguration}
          onViewDataset={handleViewDataset}
        />
      </div>
    </DashboardLayout>
  );
}
