import { Bookmark } from "lucide-react";
import type { LineSurfaceRow } from "@tabula-md/tabula";
import type { WorkspaceSurfaceCopy } from "../workspaceSurfaceLocale";
import type {
  MarkdownPreviewLineActionRequest,
  MarkdownPreviewLineAnnotation,
} from "./markdownPreviewTypes";

export type PreviewLineRailRow = LineSurfaceRow<MarkdownPreviewLineAnnotation>;

const PREVIEW_LINE_MEASUREMENT_WIDTH_BUCKET = 8;
const PREVIEW_LINE_MEASUREMENT_CACHE_LIMIT = 12;

export const getPreviewBodyHash = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return `${value.length}:${hash.toString(36)}`;
};

export const getPreviewWidthBucket = (width: number) =>
  Math.max(
    0,
    Math.round(width / PREVIEW_LINE_MEASUREMENT_WIDTH_BUCKET) * PREVIEW_LINE_MEASUREMENT_WIDTH_BUCKET,
  );

export const writePreviewLineMeasurementCache = (
  cache: Map<string, PreviewLineRailRow[]>,
  key: string,
  rows: PreviewLineRailRow[],
) => {
  cache.delete(key);
  cache.set(key, rows);
  while (cache.size > PREVIEW_LINE_MEASUREMENT_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    if (typeof oldestKey !== "string") return;
    cache.delete(oldestKey);
  }
};

const getPreviewLineButtonLabel = (
  row: MarkdownPreviewLineAnnotation,
  copy: Pick<WorkspaceSurfaceCopy, "bookmarkLine" | "removeLineBookmark">,
) => row.hasBookmark ? copy.removeLineBookmark : copy.bookmarkLine;

export function PreviewLineGutter({
  rows,
  onLineAction,
  copy,
}: {
  rows: PreviewLineRailRow[];
  onLineAction: (request: MarkdownPreviewLineActionRequest) => void;
  copy: WorkspaceSurfaceCopy;
}) {
  return (
    <div className="preview-line-gutter bookmark" aria-label={copy.previewBookmarks}>
      {rows.map((row) => {
        const isActive = row.hasBookmark;
        const className = [
          "preview-line-action",
          "bookmark",
          isActive ? "has-bookmark" : "",
        ].filter(Boolean).join(" ");
        const label = getPreviewLineButtonLabel(row, copy);
        const children = (
          <Bookmark
            className="preview-line-action-icon"
            size={14}
            strokeWidth={2}
            aria-hidden="true"
          />
        );

        if (!isActive) {
          return (
            <span
              key={`bookmark-${row.lineNumber}`}
              className={className}
              style={{ top: row.top, height: row.height }}
              aria-hidden="true"
              data-tooltip={label}
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onLineAction({ ...row, action: "bookmark" });
              }}
            >
              {children}
            </span>
          );
        }

        return (
          <button
            key={`bookmark-${row.lineNumber}`}
            className={className}
            type="button"
            style={{ top: row.top, height: row.height }}
            tabIndex={0}
            aria-label={label}
            data-tooltip={label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onLineAction({ ...row, action: "bookmark" });
            }}
          >
            {children}
          </button>
        );
      })}
    </div>
  );
}
