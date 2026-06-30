import type { EncryptedEnvelope } from "./roomProtocol";
import type { CollaboratorRegistry } from "./collabCollaborators";
import { decodePresence, isEncryptedEnvelope } from "./collabConnectionModel";
import { applyRemoteUpdateToYText, type CollabTextDocument } from "./collabTextModel";
import type { TextChange } from "../textPatches";

type EnvelopeRecoveryType = "invalid-message";

type CollabEnvelopeRouterOptions = {
  roomId: string;
  textDocument: CollabTextDocument;
  collaborators: CollaboratorRegistry;
  canDecrypt: () => boolean;
  getSelfId: () => string;
  decryptEnvelope: (envelope: EncryptedEnvelope) => Promise<Uint8Array>;
  onTextChange: (text: string, change?: TextChange) => void;
  publishCollaborators: () => void;
  emitRecoveryEvent: (type: EnvelopeRecoveryType, message: string) => void;
};

export type CollabEnvelopeRouter = {
  route(envelope: unknown): Promise<void>;
};

export const createCollabEnvelopeRouter = ({
  roomId,
  textDocument,
  collaborators,
  canDecrypt,
  getSelfId,
  decryptEnvelope,
  onTextChange,
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
      if (envelope.kind === "yjs-update") {
        const result = applyRemoteUpdateToYText({ ...textDocument, update: plaintext });
        if (result) {
          onTextChange(result.text, result.change);
        }
        return;
      }

      if (envelope.kind === "presence") {
        const collaborator = decodePresence(plaintext);
        if (collaborator && collaborators.upsert(collaborator, getSelfId())) {
          publishCollaborators();
        }
      }
    } catch {
      emitRecoveryEvent("invalid-message", "An encrypted collaboration message could not be decrypted.");
    }
  },
});
