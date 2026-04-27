"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import styles from "./FilePreviewMetadata.module.scss";

interface FilePreviewMetadataProps {
  description: string;
  keywords?: string[];
}

const DESCRIPTION_APPROX_CHARS = 200;
const KEYWORDS_VISIBLE_WHEN_TRUNCATED = 6;

function KeywordsSection({
  keywords,
  needsTruncation,
  styles: s,
}: {
  keywords: string[];
  needsTruncation: boolean;
  styles: Record<string, string>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const visibleKeywords =
    needsTruncation && !isExpanded
      ? keywords.slice(0, KEYWORDS_VISIBLE_WHEN_TRUNCATED)
      : keywords;

  return (
    <div className={s.filePreviewMetadata__section}>
      <h4 className={s.filePreviewMetadata__title}>File Keywords</h4>
      <div className={s.filePreviewMetadata__keywords}>
        {visibleKeywords.map((kw) => (
          <span key={kw} className={s.filePreviewMetadata__tag}>
            {kw}
          </span>
        ))}
      </div>
      {needsTruncation && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={s.filePreviewMetadata__toggle}
          aria-expanded={isExpanded}
        >
          {isExpanded ? "Show less" : "Show more"}
          <ChevronDown className={s.filePreviewMetadata__toggleIcon} />
        </button>
      )}
    </div>
  );
}

function TruncatableSection({
  title,
  children,
  needsTruncation,
  lineClampClass,
  contentClass,
}: {
  title: string;
  children: React.ReactNode;
  needsTruncation: boolean;
  lineClampClass: string;
  contentClass?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={styles.filePreviewMetadata__section}>
      <h4 className={styles.filePreviewMetadata__title}>{title}</h4>
      <div
        className={`${contentClass ?? ""} ${
          !isExpanded && needsTruncation ? lineClampClass : ""
        }`}
      >
        {children}
      </div>
      {needsTruncation && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={styles.filePreviewMetadata__toggle}
          aria-expanded={isExpanded}
        >
          {isExpanded ? "Show less" : "Show more"}
          <ChevronDown className={styles.filePreviewMetadata__toggleIcon} />
        </button>
      )}
    </div>
  );
}

export default function FilePreviewMetadata({
  description,
  keywords = [],
}: FilePreviewMetadataProps) {
  const descNeedsTruncation = description.length > DESCRIPTION_APPROX_CHARS;
  const hasKeywords = keywords.length > 0;
  const keywordsNeedsTruncation =
    hasKeywords && keywords.length > KEYWORDS_VISIBLE_WHEN_TRUNCATED;

  return (
    <div className={styles.filePreviewMetadata}>
      <TruncatableSection
        title="About this file"
        needsTruncation={descNeedsTruncation}
        lineClampClass={styles["filePreviewMetadata__description--truncated"]}
        contentClass={styles.filePreviewMetadata__description}
      >
        <p>{description}</p>
      </TruncatableSection>

      {hasKeywords && (
        <KeywordsSection
          keywords={keywords}
          needsTruncation={keywordsNeedsTruncation}
          styles={styles}
        />
      )}
    </div>
  );
}
