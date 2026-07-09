import type { EncryptedEnvelope } from "./roomProtocol";
import type { CollaboratorRegistry } from "./collabCollaborators";
import { isEncryptedEnvelope } from "./collabConnectionModel";
import type { CollabTextAdapter, CollabTextDocumentHandle } from "./collabRuntimeAdapters";
import {
  decodeBase64Url,
  decodeRoomEvent,
  hasRoomCapability,
  type RoomActor,
  type RoomEvent,
  type TextChange,
} from "@tabula-md/tabula";

type EnvelopeRecoveryType = "invalid-message";

type CollabEnvelopeRouterOptions = {
  roomId: string;
  textAdapter: Pick<CollabTextAdapter, "applyRemoteUpdate">;
  collaborators: CollaboratorRegistry;
  canDecrypt: () => boolean;
  getTextDocumentForDocumentId: (documentId: string) => CollabTextDocumentHandle | null | undefined;
  getSelfId: () => string;
  decryptEnvelope: (envelope: EncryptedEnvelope) => Promise<Uint8Array>;
  onTextChange: (text: string, change?: TextChange, documentId?: string) => void;
  onRoomEvent?: (event: RoomEvent) => void;
  publishCollaborators: () => void;
  emitRecoveryEvent: (type: EnvelopeRecoveryType, message: string) => void;
};

export type CollabEnvelopeRouter = {
  route(envelope: unknown): Promise<void>;
};

export const createCollabEnvelopeRouter = ({
  roomId,
  textAdapter,
  collaborators,
  canDecrypt,
  getTextDocumentForDocumentId,
  getSelfId,
  decryptEnvelope,
  onTextChange,
  onRoomEvent,
  publishCollaborators,
  emitRecoveryEvent,
}: CollabEnvelopeRouterOptions): CollabEnvelopeRouter => ({
  async route(envelope) {
    if (!canDecrypt()) {
      return;
    }

    if (!isEncryptedEnvelope(envelope) || envelope.roomId !== roomId) {
      emitRecoveryEvent("invalid-message", "A collaboration server message was ignored.");
      return;
    }

    try {
      const plaintext = await decryptEnvelope(envelope);
      if (envelope.kind !== "room-event") {
        emitRecoveryEvent("invalid-message", "A non-event collaboration message was ignored.");
        return;
      }

      const result = decodeRoomEvent(plaintext);
      if (!result.ok) {
        if (result.reason === "invalid") {
          emitRecoveryEvent("invalid-message", "A collaboration room event was ignored.");
        }
        return;
      }

      const event = result.event;
      if (event.roomId !== roomId || event.actorId === getSelfId()) {
        return;
      }

        if (event.type === "actor.joined") {
          if (
            collaborators.upsert(
              actorToCollaborator(event.actor),
              getSelfId(),
            )
          ) {
            publishCollaborators();
          }
          onRoomEvent?.(event);
          return;
        }

        if (event.type === "actor.left") {
          const remainingIds = collaborators
            .list()
            .map((collaborator) => collaborator.id)
            .filter((collaboratorId) => collaboratorId !== event.actorId);
          if (collaborators.prune(remainingIds)) {
            publishCollaborators();
          }
          onRoomEvent?.(event);
          return;
        }

        if (event.type === "presence.updated") {
          const actor = event.actor;
          if (!hasRoomCapability(actor, "presence")) {
            return;
          }
          if (
            collaborators.upsert(
              {
                ...actorToCollaborator(actor),
                activeDocumentId: event.presence.activeDocumentId,
                roomId: event.roomId,
                fileTitle: event.fileTitle,
                selection: event.selection ?? event.presence.selection,
              },
              getSelfId(),
            )
          ) {
            publishCollaborators();
          }
          onRoomEvent?.(event);
          return;
        }

        if (event.type === "text.updated") {
          if (!hasRoomCapability(event.actor, "write")) {
            return;
          }
          const eventTextDocument = getTextDocumentForDocumentId(event.documentId);
          if (!eventTextDocument) {
            onRoomEvent?.(event);
            return;
          }
          const update = decodeBase64Url(event.update);
          const result = textAdapter.applyRemoteUpdate(eventTextDocument, update);
          if (result) {
            onTextChange(result.text, result.change, event.documentId);
          }
          onRoomEvent?.(event);
          return;
        }

        if (event.type === "workspace.updated") {
          if (!hasRoomCapability(event.actor, "write")) {
            return;
          }
          onRoomEvent?.(event);
          return;
        }

        onRoomEvent?.(event);
    } catch {
      emitRecoveryEvent("invalid-message", "An encrypted collaboration message could not be decrypted.");
    }
  },
});

const actorToCollaborator = (actor: RoomActor) => ({
  id: actor.id,
  name: actor.name,
  color: actor.color ?? "#64748b",
  lastSeen: Date.now(),
  kind: actor.kind,
  client: actor.client,
  capabilities: actor.capabilities,
  joinedAt: actor.joinedAt,
});
