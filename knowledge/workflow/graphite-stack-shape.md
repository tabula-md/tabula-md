---
type: Workflow Concept
title: Graphite stack shape
description: Graphite stacks should be split into reviewable, testable, revertible layers.
tags: [workflow, graphite, review]
---

# Principle

Shape the stack around the chosen slice strategy. A branch can be a vertical
slice or a horizontal layer, but it still needs one clear review purpose.

# Keep A Layer Split When

- It has one clear purpose that a reviewer can explain in one sentence.
- It can build and test independently.
- It can be reverted independently.
- It has a different product surface, risk profile, reviewer, or architecture
  boundary from nearby layers.
- It establishes a foundation that later layers depend on.

# Use `gt modify` When

- You are answering review feedback on the current PR.
- The fix is required for the current PR to be correct.
- The change is a test, documentation, title, body, or metadata adjustment for
  the same review layer.
- The PR title and review focus still describe the final diff without becoming
  vague.

# Create An Upstack PR When

- The new work would force a different PR title.
- The review focus splits into unrelated concerns.
- A new command, hook policy, doc structure, runtime behavior, migration, or UI
  surface can be reviewed independently.
- The change is useful but not necessary for the current PR's acceptance
  criteria.
- Reverting the current PR would now remove more than one coherent change.

# Scope Drift During Review

Title changes are a checkpoint, not permission to keep expanding a PR. If a
title must change because the work changed, first decide whether that work should
be a new upstack branch. Keeping the new work in the same PR is reserved for
tightly-coupled foundation cleanup or explicit owner direction, and the reason
should be stated in the PR `Implementation Notes`.

# Fold A Layer When

- It only makes sense with the branch directly below or above it.
- The review cost of a separate PR is higher than the clarity it adds.
- It is a tiny copy, CSS, fixture, or test adjustment for one implementation
  layer.
- It cannot pass meaningful verification on its own.

# Split A Branch Further When

- Refactor, behavior, UI, tests, docs, or migration work are mixed together and
  can be reviewed separately.
- A supposed foundation branch delays the first meaningful end-to-end proof of a
  risky integration.
- Failure would be hard to localize to one kind of change.
- Reverting the branch would remove more product behavior than necessary.

# Related

- [Graphite PR lifecycle](graphite-pr-lifecycle.md)
- [Vertical slice strategy](vertical-slice-strategy.md)
