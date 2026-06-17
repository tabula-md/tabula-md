#!/usr/bin/env node
import { collectWorkflowStatus, formatWorkflowStatus } from "../.codex/hooks/lib/workflow-status.mjs";

console.log(formatWorkflowStatus(collectWorkflowStatus(process.cwd())));
