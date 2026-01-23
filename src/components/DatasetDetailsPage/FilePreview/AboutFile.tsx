"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import styles from "./AboutFile.module.scss";

interface AboutFileProps {
  description: string;
}

// Approximate character count for 3 lines
const APPROX_MAX_CHARS = 200;

export default function AboutFile({ description }: AboutFileProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Check if text is long enough to need truncation
  const needsTruncation = description.length > APPROX_MAX_CHARS;
  const displayText =
    isExpanded || !needsTruncation
      ? description
      : `${description.slice(0, APPROX_MAX_CHARS)}…`;

  return (
    <div className={styles.aboutFile}>
      <h4 className={styles.aboutFile__title}>About this file</h4>
      <p
        className={`${styles.aboutFile__text} ${
          !isExpanded && needsTruncation
            ? styles["aboutFile__text--truncated"]
            : ""
        }`}
      >
        {displayText}
      </p>
      {needsTruncation && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={styles.aboutFile__toggle}
        >
          {isExpanded ? "Show less" : "Show more"}
          <ChevronDown className={styles.aboutFile__toggleIcon} />
        </button>
      )}
    </div>
  );
}
