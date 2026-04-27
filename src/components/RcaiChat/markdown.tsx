"use client";

import type React from "react";
import { memo } from "react";
import ReactMarkdown, { type Components, type Options } from "react-markdown";

type CustomOptions = Omit<Options, "components"> & {
  components?: Partial<Components>;
};

export const MemoizedReactMarkdown = memo(
  ReactMarkdown as React.FC<CustomOptions>,
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    prevProps.className === nextProps.className,
);
