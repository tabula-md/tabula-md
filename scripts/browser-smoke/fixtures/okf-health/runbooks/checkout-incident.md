---
type: Runbook
title: Checkout incident
description: Draft response procedure for elevated checkout failures.
tags: [checkout, incident]
status: draft
generated:
  by: incident-agent/v3
  at: 2026-07-27T11:00:00Z
sources:
  - id: checkout-alert
    resource: https://example.com/alerts/checkout
    title: Checkout failure alert
    author: team:reliability
    last_modified: 2026-07-26
---

# Trigger

Use this runbook when the checkout failure alert exceeds the paging
threshold.[^checkout-alert]

# Response

1. Check the [payments service](../services/payments.md).
2. Confirm whether failures are isolated to the deprecated gateway.

[^checkout-alert]: Checkout failure alert
