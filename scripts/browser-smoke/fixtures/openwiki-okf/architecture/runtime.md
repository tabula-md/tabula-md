---
type: Architecture
title: Runtime architecture
description: How application services fit together at runtime.
tags: [runtime, platform]
resource: https://github.com/acme/example/tree/main/src
timestamp: 2026-07-24T00:00:00Z
---

# Runtime architecture

The API [depends on the authentication boundary](authentication.md) before it
dispatches work to the application services.
