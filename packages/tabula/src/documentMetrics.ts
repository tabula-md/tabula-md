export const getMarkdownWordCount = (text: string) =>
  text.trim() ? text.trim().split(/\s+/).length : 0;
