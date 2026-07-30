---
type: Service
title: Catalog service
description: Publishes product availability to checkout clients.
tags: [catalog, checkout]
status: stable
stale_after: next-quarter
generated:
  by: catalog-sync/v1
  at: 2026-07-18T01:00:00Z
verified:
  - by: process:catalog-nightly
    at: 2026-07-27T01:15:00Z
sources:
  - id: catalog-api
    resource: https://example.com/apis/catalog
    title: Catalog API
    author: team:catalog
    last_modified: 2026-07-17
---

# Responsibilities

The service publishes sellable inventory and product availability to checkout.

# Review metadata

The knowledge is machine-confirmed, but `stale_after` must be replaced with a
valid calendar date.
