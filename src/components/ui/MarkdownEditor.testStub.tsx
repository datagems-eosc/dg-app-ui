/**
 * Test stand-in for `@uiw/react-md-editor`, the editor MarkdownEditor loads.
 *
 * The real editor is a large package loaded through next/dynamic, which is
 * slow under a full-suite run. This plain textarea receives the same props
 * from MarkdownEditor, so tests still exercise the real wiring (value,
 * onChange, and the placeholder and maxLength that MarkdownEditor passes in
 * textareaProps). MarkdownEditor.test.tsx keeps
 * one test on the real editor.
 *
 * Test use only; nothing here reaches the application bundle.
 */
import type { MDEditorProps } from "@uiw/react-md-editor";

export default function MarkdownEditorTestStub({
  value,
  onChange,
  textareaProps,
}: Pick<MDEditorProps, "value" | "onChange" | "textareaProps">) {
  return (
    <textarea
      placeholder={textareaProps?.placeholder}
      maxLength={textareaProps?.maxLength}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  );
}
