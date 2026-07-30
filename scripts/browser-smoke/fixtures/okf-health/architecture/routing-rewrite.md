---
type: Proposal
title: Routing rewrite
description: Proposes consolidating checkout routing behind the payments service.
tags: [payments, routing, proposal]
status: draft
stale_after: 2099-12-15
generated:
  by: human:taeha
  at: 2026-07-25T04:00:00Z
verified:
  - by: human:mina
    at: 2026-07-26T02:30:00Z
sources:
  - id: routing-review
    resource: https://example.com/reviews/routing
    title: Checkout routing review
    author: team:platform
    last_modified: 2026-07-24
---

# Proposal

Route checkout authorization through the [payments service](../services/payments.md)
and remove service-specific gateway selection.

# Decision needed

The proposal is reviewed but remains a draft until the platform team approves
the migration sequence.
