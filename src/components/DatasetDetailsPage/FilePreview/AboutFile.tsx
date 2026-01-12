"use client";

import { useState } from "react";
import styles from "./AboutFile.module.scss";

interface AboutFileProps {
  description: string;
}

const MAX_LINES = 3;

export default function AboutFile({ description }: AboutFileProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const lines = description.split("\n");
  const needsTruncation = lines.length > MAX_LINES;
  const displayText = isExpanded
    ? description
    : lines.slice(0, MAX_LINES).join("\n");

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
        </button>
      )}
    </div>
  );
}
