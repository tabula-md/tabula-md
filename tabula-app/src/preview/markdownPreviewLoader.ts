const importMarkdownPreview = () => import("../document/MarkdownPreview");

export type MarkdownPreviewComponent = Awaited<
  ReturnType<typeof importMarkdownPreview>
>["MarkdownPreview"];

let markdownPreviewModulePromise: ReturnType<typeof importMarkdownPreview> | null = null;
let loadedMarkdownPreview: MarkdownPreviewComponent | null = null;

export const getLoadedMarkdownPreview = () => loadedMarkdownPreview;

export const loadMarkdownPreview = () => {
  markdownPreviewModulePromise ??= importMarkdownPreview();
  return markdownPreviewModulePromise.then((module) => {
    loadedMarkdownPreview = module.MarkdownPreview;
    return loadedMarkdownPreview;
  });
};

export const prepareMarkdownPreview = () => {
  void loadMarkdownPreview().catch(() => undefined);
};
