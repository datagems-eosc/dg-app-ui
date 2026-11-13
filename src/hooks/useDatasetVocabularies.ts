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
type Status = "loading" | "loaded" | "failed";

const ALL: Vocabulary[] = ["fieldsOfScience", "licenses"];

/**
 * The fields-of-science and licence vocabularies for the dataset filters,
 * requested once per sign-in. A vocabulary that fails stays empty until
 * `retryFailed` asks for it again (the filter dialog does on opening).
 */
export function useDatasetVocabularies() {
  const { hasToken, getFieldsOfScience, getLicenses } = useApi();
  // useApi rebuilds its calls whenever the access token is refreshed. Read
  // the latest ones through a ref so a refresh does not load again.
  const calls = useRef({ getFieldsOfScience, getLicenses });
  calls.current = { getFieldsOfScience, getLicenses };
  const [fieldsOfScienceCategories, setFieldsOfScienceCategories] = useState<
    HierarchicalCategory[]
  >([]);
  const [licenses, setLicenses] = useState<LicenseOption[]>([]);
  const [status, setStatus] = useState<Record<Vocabulary, Status>>({
    fieldsOfScience: "loading",
    licenses: "loading",
  });

  const load = useCallback((vocabularies: Vocabulary[]) => {
    for (const vocabulary of vocabularies) {
      const settle = (next: Status) =>
        setStatus((current) => ({ ...current, [vocabulary]: next }));
      settle("loading");
      const request =
        vocabulary === "fieldsOfScience"
          ? calls.current
              .getFieldsOfScience()
              .then((data) =>
                setFieldsOfScienceCategories(processFieldsOfScience(data)),
              )
          : calls.current
              .getLicenses()
              .then((data) => setLicenses(processLicenses(data)));
      request.then(
        () => settle("loaded"),
        (reason: unknown) => {
          logError(`Failed to fetch ${vocabulary}`, reason);
          settle("failed");
        },
      );
    }
  }, []);

  useEffect(() => {
    if (hasToken) load(ALL);
  }, [hasToken, load]);

  const retryFailed = useCallback(() => {
    const failed = ALL.filter((vocabulary) => status[vocabulary] === "failed");
    if (hasToken && failed.length > 0) load(failed);
  }, [hasToken, status, load]);

  return {
    fieldsOfScienceCategories,
    licenses,
    isLoadingFieldsOfScience: status.fieldsOfScience === "loading",
    isLoadingLicenses: status.licenses === "loading",
    retryFailed,
  };
}
