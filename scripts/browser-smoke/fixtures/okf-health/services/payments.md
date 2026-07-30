---
type: Service
title: Payments service
description: Authorizes card payments and records settlement state.
tags: [payments, checkout]
status: stable
stale_after: 2099-12-31
resource: https://example.com/services/payments
generated:
  by: catalog-agent/v2
  at: 2026-07-20T02:00:00Z
verified:
  - by: human:taeha
    at: 2026-07-24T09:30:00Z
sources:
  - id: payments-api
    resource: https://example.com/apis/payments
    title: Payments API contract
    author: team:payments
    last_modified: 2026-07-18
  - id: settlement-slo
    resource: https://example.com/slo/settlement
    title: Settlement SLO
    author: team:reliability
    last_modified: 2026-07-21
---

# Responsibilities

The service authorizes card payments according to the Payments API
contract.[^payments-api]

It replaces the [legacy payment gateway](../architecture/legacy-gateway.md) and
must preserve the published settlement objective.[^settlement-slo]

[^payments-api]: Payments API contract
[^settlement-slo]: Settlement SLO
