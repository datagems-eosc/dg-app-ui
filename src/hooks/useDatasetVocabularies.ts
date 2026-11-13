import type { HierarchicalCategory } from "@ui/HierarchicalDropdown";
import { useEffect, useState } from "react";
import {
  processFieldsOfScience,
  processLicenses,
} from "@/config/filterOptions";
import { useApi } from "@/hooks/useApi";
import { logError } from "@/lib/logger";

type LicenseOption = { value: string; label: string };

/**
 * The fields-of-science and licence vocabularies for the dataset filters,
 * requested once per mount. A failed vocabulary stays empty.
 */
export function useDatasetVocabularies() {
  // `useApi()` is a new object every render; depend on its stable members.
  const { hasToken, getFieldsOfScience, getLicenses } = useApi();
  const [fieldsOfScienceCategories, setFieldsOfScienceCategories] = useState<
    HierarchicalCategory[]
  >([]);
  const [licenses, setLicenses] = useState<LicenseOption[]>([]);
  const [isLoadingFields, setIsLoadingFields] = useState(true);
  const [isLoadingLicenses, setIsLoadingLicenses] = useState(true);

  useEffect(() => {
    if (!hasToken) return;
    let cancelled = false;

    getFieldsOfScience()
      .then((data) => {
        if (!cancelled)
          setFieldsOfScienceCategories(processFieldsOfScience(data));
      })
      .catch((error) => {
        logError("Failed to fetch fields of science", error);
        if (!cancelled) setFieldsOfScienceCategories([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingFields(false);
      });

    getLicenses()
      .then((data) => {
        if (!cancelled) setLicenses(processLicenses(data));
      })
      .catch((error) => {
        logError("Failed to fetch licenses", error);
        if (!cancelled) setLicenses([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingLicenses(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hasToken, getFieldsOfScience, getLicenses]);

  return {
    fieldsOfScienceCategories,
    licenses,
    isLoading: isLoadingFields || isLoadingLicenses,
  };
}
