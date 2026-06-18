#!/usr/bin/env node
import { collectWorkflowStatus, formatWorkflowStatus } from "./lib/workflow-status.mjs";

console.log(formatWorkflowStatus(collectWorkflowStatus(process.cwd())));
