import {
  defaultUrlTransform,
  type Options as ReactMarkdownOptions,
} from "react-markdown";
import { classifyMarkdownImageSource } from "./markdownImageSource";

export const transformMarkdownPreviewUrl: NonNullable<ReactMarkdownOptions["urlTransform"]> = (
  value,
  key,
  node,
) => {
  if (key === "src" && node.tagName === "img") {
    const imageSource = classifyMarkdownImageSource(value);
    if (imageSource.kind === "embedded") return imageSource.src;
  }

  return defaultUrlTransform(value);
};
