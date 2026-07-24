export type MarkdownImageSource =
  | { kind: "embedded" | "remote"; src: string }
  | { kind: "local" }
  | { kind: "placeholder" }
  | { kind: "unsupported" };

const supportedEmbeddedImagePattern =
  /^data:image\/(?:avif|gif|jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i;

export const classifyMarkdownImageSource = (
  value: string | undefined,
): MarkdownImageSource => {
  const src = value?.trim();
  if (!src) return { kind: "unsupported" };
  if (src === "image-url") return { kind: "placeholder" };
  if (supportedEmbeddedImagePattern.test(src)) {
    return { kind: "embedded", src };
  }
  try {
    const url = new URL(src);
    return url.protocol === "http:" || url.protocol === "https:"
      ? { kind: "remote", src: url.href }
      : { kind: "unsupported" };
  } catch {
    return { kind: "local" };
  }
};
