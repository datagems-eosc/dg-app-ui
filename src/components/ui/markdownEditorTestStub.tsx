/**
 * Test stand-in for `@uiw/react-md-editor`.
 *
 * The real editor is a large package that MarkdownEditor loads through
 * next/dynamic, which is slow under a full-suite run. This plain textarea
 * receives the same props from MarkdownEditor, so tests still exercise the
 * real wiring (value, onChange, textareaProps such as maxLength).
 *
 * Use: vi.mock("@uiw/react-md-editor", () => import("@ui/markdownEditorTestStub"));
 * Test use only; nothing here reaches the application bundle.
 */
import type { TextareaHTMLAttributes } from "react";

export default function MarkdownEditorTestStub({
  value,
  onChange,
  textareaProps,
}: {
  value?: string;
  onChange?: (value?: string) => void;
  textareaProps?: TextareaHTMLAttributes<HTMLTextAreaElement>;
}) {
  return (
    <textarea
      {...textareaProps}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  );
}
