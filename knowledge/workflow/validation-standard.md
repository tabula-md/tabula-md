---
type: Workflow Concept
title: Validation standard
description: Validation should be focused on likely regressions and scale with the touched files, risk, and handoff mode.
tags: [workflow, validation, testing]
---

# Principle

Run the smallest validation set that can catch likely regressions in the chosen
work mode. Escalate when the changed files, risk, or public surface justify it.

# Mapping

- `knowledge/**`: `npm run knowledge:check`.
- `.codex/hooks/**`, workflow policy scripts, or agent automation checks:
  `npm run test:hooks`.
- TypeScript, imports, package files, or app wiring: `npm run build`.
- Pure Markdown, comment, storage, or view-model logic: `npm test` or the
  focused unit test.
- Browser UI, editor, preview, panel, file tree, share, or collaboration UI:
  focused browser smoke when available, otherwise `npm run test:browser`.
- Before PR handoff: `git diff --check`.

# Focused Browser Suites

```sh
npm run test:browser:workspace
npm run test:browser:editor
npm run test:browser:layout
npm run test:browser:panels
npm run test:browser:collab
```

# Skips

Do not run `npm test` plus `npm run build` plus browser smoke by default for
docs-only, comment-only, or narrow tooling changes. If validation is skipped,
say what was skipped and why in the final response or PR body.

# Related

- [PR review artifacts](pr-review-artifacts.md)
- [Codex hooks](codex-hooks.md)
