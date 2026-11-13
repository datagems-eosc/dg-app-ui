import type { HierarchicalCategory } from "@ui/HierarchicalDropdown";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  processFieldsOfScience,
  processLicenses,
} from "@/config/filterOptions";
import { useApi } from "@/hooks/useApi";
import { logError } from "@/lib/logger";

type LicenseOption = { value: string; label: string };
type Vocabulary = "fieldsOfScience" | "licenses";

const ALL: Vocabulary[] = ["fieldsOfScience", "licenses"];

/**
 * The fields-of-science and licence vocabularies for the dataset filters,
 * requested once per mount. A vocabulary that fails stays empty until
 * `retryFailed` asks for it again (the filter dialog does on opening).
 */
export function useDatasetVocabularies() {
  // `useApi()` is a new object every render; depend on its stable members.
  const { hasToken, getFieldsOfScience, getLicenses } = useApi();
  const [fieldsOfScienceCategories, setFieldsOfScienceCategories] = useState<
    HierarchicalCategory[]
  >([]);
  const [licenses, setLicenses] = useState<LicenseOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const failed = useRef<Vocabulary[]>([]);
  // Loading lasts until every load started so far has settled.
  const inFlight = useRef(0);

  const load = useCallback(
    async (vocabularies: Vocabulary[]) => {
      const requests: Record<Vocabulary, () => Promise<void>> = {
        fieldsOfScience: () =>
          getFieldsOfScience().then((data) =>
            setFieldsOfScienceCategories(processFieldsOfScience(data)),
          ),
        licenses: () =>
          getLicenses().then((data) => setLicenses(processLicenses(data))),
      };
      failed.current = failed.current.filter((v) => !vocabularies.includes(v));
      inFlight.current += 1;
      setIsLoading(true);
      const results = await Promise.allSettled(
        vocabularies.map((v) => requests[v]()),
      );
      results.forEach((result, i) => {
        const vocabulary = vocabularies[i];
        if (result.status === "fulfilled") return;
        logError(`Failed to fetch ${vocabulary}`, result.reason);
        // StrictMode loads twice in development: record each failure once.
        if (!failed.current.includes(vocabulary)) {
          failed.current.push(vocabulary);
        }
      });
      inFlight.current -= 1;
      if (inFlight.current === 0) setIsLoading(false);
    },
    [getFieldsOfScience, getLicenses],
  );

  useEffect(() => {
    if (hasToken) void load(ALL);
  }, [hasToken, load]);

  const retryFailed = useCallback(() => {
    if (hasToken && failed.current.length > 0) void load(failed.current);
  }, [hasToken, load]);

  return { fieldsOfScienceCategories, licenses, isLoading, retryFailed };
}
