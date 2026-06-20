---
type: Workflow Concept
title: Linear tracking
description: Accepted maintainer work uses Linear for durable issue context, state, priority, and acceptance criteria.
tags: [workflow, linear, planning]
---

# Purpose

Linear is the maintainer planning layer. It captures accepted work after public
or private intake has become something the project intends to do.

# Current Project

- Team: `Members of Technical Staff`
- Issue key: `MTS`
- Project: `tabula-md`

# When To Create An Issue

Create a Linear issue when maintainer work has durable product, architecture,
security, or implementation context. Do not create issues for every tiny local
edit unless the owner asks for tracking.

# States

- `Backlog`
- `Todo`
- `In Progress`
- `In Review`
- `Done`

Move to `In Progress` when implementation starts. Move to `In Review` after
the Graphite PR or stack is submitted. Move to `Done` after the closing PR lands
and no required follow-up remains.

# Type Labels

Use exactly one type label by default:

- `Bug`: intended behavior is broken or regressed.
- `Feature`: new user-facing capability.
- `Improvement`: better version of an existing capability.
- `Refactor`: internal code improvement without behavior change.
- `Infra`: build, CI, deploy, tooling, or environment work.
- `Docs`: documentation, specs, ADRs, or written process.
- `Chore`: maintenance that does not fit another type.
- `Spike`: research or investigation before implementation.

Avoid domain labels such as `Design` or `Security`; capture those concerns in
the title, description, project, priority, or linked ADR instead.

# Template

Use `.linear/ISSUE_TEMPLATE.md` when creating Linear issues. Repo-local
templates are the source of truth for agents; Linear UI templates are optional
helpers for humans.

# Related

- [Operating model](operating-model.md)
- [PR review artifacts](pr-review-artifacts.md)
