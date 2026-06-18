# Development

This is the maintainer entry point for Tabula.md development.

Use these sources in order:

- `WORKFLOW.md` for execution rules, commands, PR metadata, validation, merge,
  and cleanup.
- `knowledge/index.md` for durable product, architecture, workflow, repository,
  release, and launch context.
- `AGENTS.md` or `CLAUDE.md` for agent-specific repo entry context.

## Daily Start

```sh
gt sync --delete-all
gt checkout --trunk
npm run workflow:status
```

## Before Handoff

```sh
npm run knowledge:check
npm run pr:ready
```

Run the focused validation required by the files you changed. `pr:ready` checks
PR shape and metadata, but it does not replace tests, builds, or browser smoke.

## Public Contribution Docs

Use `CONTRIBUTING.md` for public contributors and `SECURITY.md` for private
vulnerability reporting.
