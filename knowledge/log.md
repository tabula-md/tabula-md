# Knowledge Update Log

## 2026-06-18

- **Creation**: Added workflow concept documents for operating model, agent
  contract, start-of-work, command ownership, Linear tracking, PR review
  artifacts, validation, and merge cleanup so the compact `WORKFLOW.md` does
  not lose durable context.
- **Update**: Slimmed workflow execution guidance and clarified that Codex hooks
  do not block `rm -rf`; shell cleanup is handled by agent judgment while
  destructive Git commands remain guarded.
- **Update**: Removed placeholder concept timestamps, clarified `repo:/...`
  resource identifiers, and documented that `knowledge:check` is a repo quality
  gate rather than a general OKF conformance test.
- **Update**: Re-scoped `docs/` to public project docs and moved Codex hook
  reference into `knowledge/workflow/codex-hooks.md`.
- **Update**: Moved durable product, workflow, release, infrastructure, launch,
  and E2EE collaboration context into the knowledge bundle so `WORKFLOW.md`
  can stay focused on execution rules.
- **Creation**: Added the initial OKF-inspired repository knowledge bundle for
  product, workflow, architecture, repository, and release context.
