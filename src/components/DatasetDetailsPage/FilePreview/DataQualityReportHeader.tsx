import styles from "./DataQualityReportHeader.module.scss";

export default function DataQualityReportHeader({
  summary,
}: {
  summary: string;
}) {
  return (
    <header className={styles.reportHeader}>
      <h4 className={styles.reportHeader__title}>Data quality report</h4>
      <p className={styles.reportHeader__description}>{summary}</p>
    </header>
  );
}
