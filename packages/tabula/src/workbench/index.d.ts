/** Public type contract for @tabula-md/tabula/workbench. */
import type { ComponentType } from "react";

export type TabulaWorkbenchLanguage = "en" | "ko" | "ja" | "zh" | "es" | "fr" | "de";

export type TabulaWorkbenchViewMode = "edit" | "split" | "preview";

export type TabulaEmbeddedDocumentWorkbenchProps = {
  documentId: string;
  markdown: string;
  title: string;
  language?: TabulaWorkbenchLanguage;
  initialViewMode?: TabulaWorkbenchViewMode;
  onMarkdownChange: (markdown: string) => void;
  onSelectedTextChange?: (selectedText: string) => void;
  onViewModeChange?: (viewMode: TabulaWorkbenchViewMode) => void;
};

export const TabulaEmbeddedDocumentWorkbench: ComponentType<TabulaEmbeddedDocumentWorkbenchProps>;
