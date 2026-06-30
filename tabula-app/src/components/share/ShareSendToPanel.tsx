import { Bot, Check, Clipboard } from "lucide-react";
import type {
  AgentHandoffScope,
} from "../../shareAgentHandoff";
import type { WorkspaceShareCopy } from "../../workspaceLocale";

type ShareSendToPanelProps = {
  activeFileDisplayTitle: string;
  agentInstruction: string;
  agentPromptCopied: boolean;
  agentScope: AgentHandoffScope;
  copy: WorkspaceShareCopy;
  onChangeAgentInstruction: (instruction: string) => void;
  onChangeAgentScope: (scope: AgentHandoffScope) => void;
  onCopyLocalAgentPrompt: () => void;
};

export function ShareSendToPanel({
  activeFileDisplayTitle,
  agentInstruction,
  agentPromptCopied,
  agentScope,
  copy,
  onChangeAgentInstruction,
  onChangeAgentScope,
  onCopyLocalAgentPrompt,
}: ShareSendToPanelProps) {
  return (
    <>
      <div className="share-panel-heading">
        <span className="share-modal-option-icon">
          <Bot size={17} />
        </span>
        <div>
          <h3>{copy.sendTo.title}</h3>
          <p>{copy.sendTo.description}</p>
        </div>
      </div>

      <div className="send-destination-row">
        <div className="send-destination-mark" aria-hidden="true">
          <Bot size={20} />
        </div>
        <div>
          <strong>{copy.sendTo.destinationTitle}</strong>
          <p>{copy.sendTo.destinationDescription}</p>
        </div>
        <button
          className="share-modal-primary"
          type="button"
          onClick={onCopyLocalAgentPrompt}
        >
          {agentPromptCopied ? <Check size={16} /> : <Clipboard size={16} />}
          <span>
            {agentPromptCopied ? copy.live.copied : copy.sendTo.copyPrompt}
          </span>
        </button>
      </div>

      <div
        className="send-scope-control"
        role="group"
        aria-label="Agent handoff scope"
      >
        <button
          className={agentScope === "file" ? "active" : ""}
          type="button"
          onClick={() => onChangeAgentScope("file")}
        >
          {copy.sendTo.currentFile}
        </button>
        <button
          className={agentScope === "project" ? "active" : ""}
          type="button"
          onClick={() => onChangeAgentScope("project")}
        >
          {copy.sendTo.project}
        </button>
      </div>

      <label className="send-instruction-field">
        <span>{copy.sendTo.instructionLabel}</span>
        <textarea
          value={agentInstruction}
          placeholder={copy.sendTo.instructionPlaceholder(
            activeFileDisplayTitle,
          )}
          rows={3}
          onChange={(event) => onChangeAgentInstruction(event.target.value)}
        />
      </label>
    </>
  );
}
