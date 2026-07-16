import { ArrowLeft, Bot, Check, Copy, LockKeyhole } from "lucide-react";
import { useId } from "react";
import { getAgentHandoffCopy } from "../../agentHandoffLocale";
import type { AgentHandoffRuntime } from "../../hooks/useAgentHandoffRuntime";
import type { WorkspaceLanguage } from "../../hooks/useWorkspacePreferences";
import type { AgentHandoffClient } from "../../shareAgentHandoff";

type ShareAgentHandoffProps = {
  language: WorkspaceLanguage;
  runtime: AgentHandoffRuntime;
  onBack: () => void;
};

const clientOptions: Array<{ value: AgentHandoffClient; label: string }> = [
  { value: "claude", label: "Claude (web / Desktop)" },
  { value: "claude-code", label: "Claude Code" },
  { value: "codex", label: "Codex" },
  { value: "chatgpt", label: "ChatGPT" },
  { value: "other", label: "Other MCP client" },
];

export function ShareAgentHandoff({
  language,
  runtime,
  onBack,
}: ShareAgentHandoffProps) {
  const copy = getAgentHandoffCopy(language);
  const clientId = useId();
  const taskId = useId();
  const scopeLegendId = useId();
  const trustCopy = runtime.setup.trust === "hosted"
    ? copy.trustHosted
    : runtime.setup.trust === "local"
      ? copy.trustLocal
      : copy.trustCustom;

  return (
    <section className="share-agent-handoff" aria-labelledby="share-agent-handoff-title">
      <button className="share-agent-back" type="button" onClick={onBack}>
        <ArrowLeft size={16} />
        <span>{copy.back}</span>
      </button>

      <header className="share-modal-header compact">
        <span className="share-modal-option-icon" aria-hidden="true">
          <Bot size={18} />
        </span>
        <div>
          <h2 id="share-agent-handoff-title">{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
      </header>

      <div className="share-modal-field">
        <label htmlFor={clientId}>{copy.clientLabel}</label>
        <select
          id={clientId}
          value={runtime.client}
          onChange={(event) => runtime.setClient(event.target.value as AgentHandoffClient)}
        >
          {clientOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <section className="share-agent-setup" aria-labelledby="share-agent-setup-title">
        <div>
          <strong id="share-agent-setup-title">{copy.setupTitle}</strong>
          <p>{copy.setupByClient[runtime.client]}</p>
        </div>
        <pre><code>{runtime.setup.value}</code></pre>
        <button className="share-modal-secondary" type="button" onClick={runtime.copySetup}>
          {runtime.copied === "setup" ? <Check size={16} /> : <Copy size={16} />}
          <span>{runtime.copied === "setup" ? copy.copied : copy.copySetup}</span>
        </button>
      </section>

      <div className="share-modal-note share-agent-trust-note">
        <LockKeyhole size={15} aria-hidden="true" />
        <p>{trustCopy}</p>
      </div>

      <div className="share-modal-field share-agent-task-field">
        <label htmlFor={taskId}>{copy.taskLabel}</label>
        <textarea
          id={taskId}
          data-modal-initial-focus
          value={runtime.task}
          placeholder={copy.taskPlaceholder}
          rows={3}
          onChange={(event) => runtime.setTask(event.target.value)}
        />
      </div>

      <fieldset className="share-agent-scope" aria-labelledby={scopeLegendId}>
        <legend id={scopeLegendId}>{copy.scopeLabel}</legend>
        <label>
          <input
            type="radio"
            name="agent-handoff-scope"
            value="file"
            checked={runtime.scope === "file"}
            onChange={() => runtime.setScope("file")}
          />
          <span>{copy.currentDocument}</span>
        </label>
        <label>
          <input
            type="radio"
            name="agent-handoff-scope"
            value="project"
            checked={runtime.scope === "project"}
            onChange={() => runtime.setScope("project")}
          />
          <span>{copy.workspace}</span>
        </label>
      </fieldset>

      <div className="share-agent-request">
        <p>{copy.requestDescription}</p>
        <button
          className="share-modal-primary"
          type="button"
          disabled={!runtime.canCopyRoomRequest}
          onClick={runtime.copyRoomRequest}
        >
          {runtime.copied === "request" ? <Check size={16} /> : <Bot size={16} />}
          <span>{runtime.copied === "request" ? copy.copied : copy.copyRequest}</span>
        </button>
      </div>

      <div className="share-modal-divider" aria-hidden="true" />

      <div className="share-agent-context-fallback">
        <div>
          <strong>{copy.contextTitle}</strong>
          <p>{copy.contextDescription}</p>
        </div>
        <button
          className="share-modal-secondary"
          type="button"
          disabled={!runtime.canCopyContext}
          onClick={runtime.copyContext}
        >
          {runtime.copied === "context" ? <Check size={16} /> : <Copy size={16} />}
          <span>{runtime.copied === "context" ? copy.copied : copy.copyContext}</span>
        </button>
      </div>

      <p className="share-agent-room-warning">{copy.roomAccessWarning}</p>
    </section>
  );
}
