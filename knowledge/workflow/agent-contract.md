---
type: Workflow Concept
title: Agent contract
description: Coding agents should either execute, ask for necessary clarification, or explain a concrete objection with a better path.
tags: [workflow, agents, collaboration]
---

# Purpose

The repository should be usable with Codex, Claude Code, Cursor-compatible
agents, and future tools. The expected collaboration behavior is the same even
when the tool-specific entry file differs.

# Valid Responses

When the repository owner gives a concrete instruction, a coding agent has
three valid responses:

- Execute the instruction.
- Ask for clarification if the request is ambiguous enough that execution would
  likely produce the wrong result.
- Explain why the instruction is technically wrong, product-inconsistent, or
  likely to break the project, with a concrete reason and a better alternative.

# Invalid Responses

- Do not ignore the instruction.
- Do not silently substitute a different workflow.
- Do not stop at a proposal when implementation is feasible.
- Do not add compatibility paths, legacy behavior, defensive fallbacks, or
  alternate implementations unless the owner asks for them or the existing
  product contract already requires them.
- Do not make hooks or scripts replace implementation, stack-shape, validation,
  or product judgment.

# Related

- [Operating model](operating-model.md)
- [Codex hooks](codex-hooks.md)
