/**
 * A Gateway `like` value that matches the user's text literally, anywhere in
 * the field: `\`, `%` and `_` are escaped, then the text is wrapped in `%…%`.
 */
export const toLikePattern = (text: string) =>
  `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
