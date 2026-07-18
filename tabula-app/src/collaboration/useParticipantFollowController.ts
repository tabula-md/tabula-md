import { useEffect, useRef, type RefObject } from "react";
import type { Collaborator } from "./liveCollaboration";
import {
  canFollowActor,
  type FollowState,
  type FollowStopReason,
} from "./followModel";
import type { MarkdownEditorHandle } from "../document/markdownEditorTypes";
import type { WorkspaceFile } from "../workspace/workspaceStorage";
import { useEventCallback } from "../shared/useEventCallback";

type ParticipantFollowControllerArgs = {
  activeDocumentId: string;
  collaborators: readonly Collaborator[];
  editorRef: RefObject<MarkdownEditorHandle | null>;
  files: readonly WorkspaceFile[];
  followState: FollowState;
  identityId: string;
  isLive: boolean;
  roomId?: string;
  selectDocument: (documentId: string) => unknown;
  startFollowState: (actorId: string) => void;
  stopFollowState: () => void;
  setFollowingActor: (actorId: string | null) => void;
  showError: (message: string) => void;
  showNotice: (message: string) => void;
};

export const useParticipantFollowController = ({
  activeDocumentId,
  collaborators,
  editorRef,
  files,
  followState,
  identityId,
  isLive,
  roomId,
  selectDocument,
  startFollowState,
  stopFollowState,
  setFollowingActor,
  showError,
  showNotice,
}: ParticipantFollowControllerArgs) => {
  const navigationGenerationRef = useRef(0);
  const navigationInProgressRef = useRef(false);

  const stopFollowing = useEventCallback((reason: FollowStopReason = "manual") => {
    if (followState.status === "idle") return;
    stopFollowState();
    setFollowingActor(null);
    if (reason === "target-left") showNotice("The participant you were following left the room.");
    if (reason === "target-document-deleted") showNotice("The followed document is no longer available.");
  });

  const runFollowNavigation = useEventCallback((navigate: () => void) => {
    const generation = navigationGenerationRef.current + 1;
    navigationGenerationRef.current = generation;
    navigationInProgressRef.current = true;
    navigate();
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (navigationGenerationRef.current === generation) {
          navigationInProgressRef.current = false;
        }
      });
    });
  });

  const stopFollowingForLocalNavigation = useEventCallback(() => {
    if (navigationInProgressRef.current) return;
    stopFollowing("local-navigation");
  });

  const revealFollowTarget = useEventCallback((target: Collaborator) => {
    const documentId = target.activeDocumentId ?? target.selection?.documentId;
    if (!documentId || !roomId || !files.some((file) => file.id === documentId)) return false;
    const selection = target.selection;
    runFollowNavigation(() => {
      if (activeDocumentId !== documentId) selectDocument(documentId);
      const viewport = target.viewport;
      if (viewport?.documentId === documentId) {
        window.requestAnimationFrame(() =>
          editorRef.current?.revealViewport(viewport.position, viewport.offset));
      } else if (selection && (selection.documentId ?? documentId) === documentId) {
        window.requestAnimationFrame(() => editorRef.current?.revealRange(selection.from, selection.to));
      }
    });
    return true;
  });

  const toggleFollowing = useEventCallback((actorId: string) => {
    if (followState.status === "following" && followState.actorId === actorId) {
      stopFollowing("manual");
      return;
    }
    if (!canFollowActor({ actorId, collaborators, selfId: identityId })) {
      showError("This participant can’t be followed right now.");
      return;
    }
    const target = collaborators.find((collaborator) => collaborator.id === actorId);
    if (!target || !revealFollowTarget(target)) {
      showError("This participant’s location isn’t available yet.");
      return;
    }
    startFollowState(actorId);
    setFollowingActor(actorId);
  });

  useEffect(() => {
    if (followState.status !== "following") return;
    if (!isLive) {
      stopFollowing("manual");
      return;
    }
    const target = collaborators.find((collaborator) => collaborator.id === followState.actorId);
    if (!target) {
      stopFollowing("target-left");
      return;
    }
    if (!canFollowActor({ actorId: target.id, collaborators, selfId: identityId })) {
      stopFollowing("cycle");
      return;
    }
    if (!revealFollowTarget(target)) stopFollowing("target-document-deleted");
  }, [collaborators, files, followState, identityId, isLive, revealFollowTarget, stopFollowing]);

  useEffect(() => {
    if (followState.status !== "following") return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      stopFollowing("manual");
    };
    window.addEventListener("keydown", handleEscape, true);
    return () => window.removeEventListener("keydown", handleEscape, true);
  }, [followState, stopFollowing]);

  return {
    stopFollowing,
    stopFollowingForLocalNavigation,
    toggleFollowing,
  };
};
