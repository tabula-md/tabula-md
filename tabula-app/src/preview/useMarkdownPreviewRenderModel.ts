import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  EDITOR_SEARCH_MATCH_LIMIT,
  getEditorSearchResultWithLimit,
  type SearchOptions,
} from "../editor/editorSearchModel";
import type { WorkspaceSurfaceCopy } from "../workspace/workspaceSurfaceLocale";
import type {
  MarkdownPreviewCommentAnchor,
  MarkdownPreviewProps,
} from "./markdownPreviewTypes";
import {
  createPreviewCommentAnchorPlugin,
  createPreviewRehypePlugins,
  createPreviewSearchPlugin,
} from "./markdownRehypePlugins";
import { createMarkdownPreviewComponents } from "./markdownPreviewComponents";
import type { GetVirtualPreviewBlockRehypePlugins } from "./VirtualMarkdownPreview";

type UseMarkdownPreviewRenderModelOptions = {
  activeCommentId: MarkdownPreviewProps["activeCommentId"];
  activeSearchMatchIndex: number;
  commentsEnabled: boolean;
  normalizedSourceLineOffset: number;
  onOpenComment?: MarkdownPreviewProps["onOpenComment"];
  onOpenWorkspaceLink?: MarkdownPreviewProps["onOpenWorkspaceLink"];
  onToggleTaskLine?: MarkdownPreviewProps["onToggleTaskLine"];
  previewSearchActive: boolean;
  renderableBody: string;
  resolveWorkspaceDocument?: MarkdownPreviewProps["resolveWorkspaceDocument"];
  resolveWorkspaceLink?: MarkdownPreviewProps["resolveWorkspaceLink"];
  searchOptions: SearchOptions;
  searchQuery: string;
  shouldVirtualizePreview: boolean;
  sourceDocumentId?: string;
  stableCommentAnchors: MarkdownPreviewCommentAnchor[];
  uiCopy: WorkspaceSurfaceCopy;
};

export const useMarkdownPreviewRenderModel = ({
  activeCommentId,
  activeSearchMatchIndex,
  commentsEnabled,
  normalizedSourceLineOffset,
  onOpenComment,
  onOpenWorkspaceLink,
  onToggleTaskLine,
  previewSearchActive,
  renderableBody,
  resolveWorkspaceDocument,
  resolveWorkspaceLink,
  searchOptions,
  searchQuery,
  shouldVirtualizePreview,
  sourceDocumentId,
  stableCommentAnchors,
  uiCopy,
}: UseMarkdownPreviewRenderModelOptions) => {
  const onOpenCommentRef = useRef(onOpenComment);
  const onToggleTaskLineRef = useRef(onToggleTaskLine);

  useEffect(() => {
    onOpenCommentRef.current = onOpenComment;
    onToggleTaskLineRef.current = onToggleTaskLine;
  }, [onOpenComment, onToggleTaskLine]);

  const markdownPreviewComponents = useMemo(
    () =>
      createMarkdownPreviewComponents(
        (commentId) => onOpenCommentRef.current?.(commentId),
        (sourceLineIndex) => onToggleTaskLineRef.current?.(sourceLineIndex),
        onOpenWorkspaceLink,
        resolveWorkspaceLink,
        resolveWorkspaceDocument,
        {
          ancestorDocumentIds: sourceDocumentId ? [sourceDocumentId] : [],
          depth: 0,
          sourceDocumentId,
        },
        previewSearchActive,
        uiCopy,
      ),
    [
      onOpenWorkspaceLink,
      previewSearchActive,
      resolveWorkspaceDocument,
      resolveWorkspaceLink,
      sourceDocumentId,
      uiCopy,
    ],
  );
  const commentAnchorPlugins = useMemo(
    () => (
      commentsEnabled
        ? [createPreviewCommentAnchorPlugin(stableCommentAnchors, activeCommentId, uiCopy)]
        : []
    ),
    [activeCommentId, commentsEnabled, stableCommentAnchors, uiCopy],
  );
  const virtualPreviewSearchResult = useMemo(
    () =>
      shouldVirtualizePreview && previewSearchActive
        ? getEditorSearchResultWithLimit(
            renderableBody,
            searchQuery,
            searchOptions,
            EDITOR_SEARCH_MATCH_LIMIT,
          )
        : { error: null, matches: [], truncated: false },
    [previewSearchActive, renderableBody, searchOptions, searchQuery, shouldVirtualizePreview],
  );
  const virtualPreviewSearchMatches = virtualPreviewSearchResult.matches;
  const previewSearchPlugin = useMemo(
    () =>
      previewSearchActive && !shouldVirtualizePreview
        ? createPreviewSearchPlugin(searchQuery, searchOptions, activeSearchMatchIndex)
        : null,
    [activeSearchMatchIndex, previewSearchActive, searchOptions, searchQuery, shouldVirtualizePreview],
  );
  const rehypePlugins = useMemo(
    () => createPreviewRehypePlugins(commentAnchorPlugins, normalizedSourceLineOffset, { previewSearchPlugin }),
    [commentAnchorPlugins, normalizedSourceLineOffset, previewSearchPlugin],
  );
  const getVirtualBlockRehypePlugins = useCallback<GetVirtualPreviewBlockRehypePlugins>(
    (block, blockCommentAnchors) => {
      const blockCommentPlugins = commentsEnabled
        ? [createPreviewCommentAnchorPlugin(blockCommentAnchors, activeCommentId, uiCopy)]
        : [];
      const blockPreviewSearchPlugin =
        previewSearchActive && shouldVirtualizePreview
          ? createPreviewSearchPlugin(searchQuery, searchOptions, activeSearchMatchIndex, {
              sourceBackedMatches: virtualPreviewSearchMatches,
              sourceOffsetBase: block.startOffset,
            })
          : previewSearchPlugin;
      return createPreviewRehypePlugins(
        blockCommentPlugins,
        normalizedSourceLineOffset + block.startLine - 1,
        { previewSearchPlugin: blockPreviewSearchPlugin, stripFootnoteSection: true },
      );
    },
    [
      activeCommentId,
      activeSearchMatchIndex,
      commentsEnabled,
      normalizedSourceLineOffset,
      previewSearchActive,
      previewSearchPlugin,
      searchOptions,
      searchQuery,
      shouldVirtualizePreview,
      uiCopy,
      virtualPreviewSearchMatches,
    ],
  );
  const getVirtualFootnoteRehypePlugins = useCallback(
    () => createPreviewRehypePlugins([], normalizedSourceLineOffset, {
      stripGeneratedFootnoteReferences: true,
    }),
    [normalizedSourceLineOffset],
  );

  return {
    getVirtualBlockRehypePlugins,
    getVirtualFootnoteRehypePlugins,
    markdownPreviewComponents,
    rehypePlugins,
    virtualPreviewSearchMatches,
    virtualPreviewSearchResult,
  };
};
