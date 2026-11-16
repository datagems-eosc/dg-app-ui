import type { DatasetProfileMetadata } from "@/lib/datasetProfileMetadata";
import DatasetDescriptionSection from "../DatasetDescriptionSection/DatasetDescriptionSection";
import DatasetTagsSection from "../DatasetTagsSection/DatasetTagsSection";
import styles from "./DatasetProfilingSections.module.scss";

interface DatasetProfilingSectionsProps {
  entries: DatasetProfileMetadata["profiling"];
}

export default function DatasetProfilingSections({
  entries,
}: DatasetProfilingSectionsProps) {
  const grouped = entries.length > 1;
  const labelled = entries.map((entry, index) => ({
    ...entry,
    label: entry.name
      ? `${entry.name} (${index + 1})`
      : `Record set ${index + 1}`,
  }));
  const summaries = labelled.filter((entry) => entry.summary);
  const keywords = labelled.filter((entry) => entry.keywords.length);

  return (
    <>
      {summaries.length > 0 && (
        <section aria-label="Profiling summary" className={styles.section}>
          {grouped && <h3 className={styles.title}>Profiling summary</h3>}
          {summaries.map((entry) => (
            <DatasetDescriptionSection
              key={entry.id}
              title={grouped ? entry.label : "Profiling summary"}
              headingLevel={grouped ? 4 : 3}
              description={entry.summary ?? ""}
            />
          ))}
        </section>
      )}
      {keywords.length > 0 && (
        <section aria-label="Profiling keywords" className={styles.section}>
          {grouped && <h3 className={styles.title}>Profiling keywords</h3>}
          {keywords.map((entry) => (
            <DatasetTagsSection
              key={entry.id}
              title={grouped ? entry.label : "Profiling keywords"}
              headingLevel={grouped ? 4 : 3}
              items={entry.keywords}
            />
          ))}
        </section>
      )}
    </>
  );
}
