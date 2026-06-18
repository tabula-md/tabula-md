---
type: Workflow Concept
title: Codex hooks
description: Repo-local Codex hooks provide cheap guardrails around command policy, validation reminders, secrets, and Graphite workflow handoff.
tags: [workflow, codex, hooks, agents]
---

# Purpose

The repo-local Codex hooks in `.codex/` reduce repeated workflow mistakes during
Codex sessions. They are implementation guardrails, not the workflow source of
truth.

# What They Do

- Block obvious secret material in prompts.
- Block raw Git/GitHub lifecycle commands that bypass Graphite.
- Block destructive Git commands that discard user work, such as
  `git reset --hard`, `git checkout --`, `git restore`, and `git clean -fd`,
  unless explicitly requested.
- Block shell-based source writes where `apply_patch` should be used.
- Record likely validation needs after file changes.
- Continue a turn when Graphite submit was observed in that turn without later
  PR title, body, or metadata.
- Remind, without blocking, when older workflow state is still pending during a
  later explanation or investigation turn.
- Continue a turn when an explicit post-merge signal needs `workflow:sync`.

# What They Do Not Do

- Create Linear issues.
- Choose stack shape.
- Implement code.
- Block `rm -rf`; shell cleanup is left to agent judgment.
- Submit or merge PRs by themselves.
- Run expensive validation automatically.
- Replace code review.

# Hook Files

- `.codex/hooks/pre-tool-use-bash.mjs`: Bash command policy.
- `.codex/hooks/post-tool-use-record.mjs`: file-change and validation state.
- `.codex/hooks/stop-validation-check.mjs`: validation and workflow reminders.
- `.codex/hooks/user-prompt-submit-context.mjs`: secret blocking, turn-boundary
  recording, and narrow post-merge prompt signals.
- `.codex/hooks/permission-request-bash.mjs`: approval request policy.
- `.codex/hooks/session-start-context.mjs`: startup workflow context.

# Related

- [Graphite PR lifecycle](graphite-pr-lifecycle.md)
- [Agent session provenance](agent-session-provenance.md)
