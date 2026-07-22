export const getMarkdownWordCount = (text: string) =>
  text.trim() ? text.trim().split(/\s+/).length : 0;

export const getApproximateTokenCount = (text: string) =>
  Math.ceil(new TextEncoder().encode(text).length / 4);
