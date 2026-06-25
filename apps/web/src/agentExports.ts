import { parseFrontmatter } from "./markdown";
import { PRODUCT_NAME } from "./product";
import type { FileComment, MarkdownFile } from "./workspaceStorage";

type AgentCheck = {
  status: "pass" | "warn";
  label: string;
  detail: string;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const findFileByTitle = (files: MarkdownFile[], title: string) =>
  files.find((file) => file.title.trim().toLowerCase() === title.toLowerCase());

const hasFrontmatterKey = (file: MarkdownFile | undefined, key: string) =>
  Boolean(file && parseFrontmatter(file.text).attributes.some((attribute) => attribute.key.toLowerCase() === key));

const hasHeading = (file: MarkdownFile | undefined, heading: string) =>
  Boolean(file && new RegExp(`^#{1,4}\\s+${escapeRegExp(heading)}\\s*$`, "im").test(file.text));

const hasNonEmptyCommand = (file: MarkdownFile | undefined, command: string) =>
  Boolean(file && new RegExp(`^-\\s*${escapeRegExp(command)}:\\s*\\S`, "im").test(file.text));

const getFileWordCount = (file: MarkdownFile) => (file.text.trim() ? file.text.trim().split(/\s+/).length : 0);

const getFrontmatterValue = (file: MarkdownFile, key: string) =>
  parseFrontmatter(file.text).attributes.find((attribute) => attribute.key.toLowerCase() === key.toLowerCase())?.value;

const getFileDescription = (file: MarkdownFile) => getFrontmatterValue(file, "description") ?? "";

const getOpenComments = (commentsByFileId: Record<string, FileComment[]>, fileId: string) =>
  (commentsByFileId[fileId] ?? []).filter((comment) => !comment.resolved);

const formatCommentForExport = (comment: FileComment) => {
  const author = comment.authorName ? `${comment.authorName}: ` : "";
  const quote = comment.quote ? `\n  - Quote: ${comment.quote}` : "";
  const replies =
    comment.replies && comment.replies.length > 0
      ? `\n  - Replies:\n${comment.replies
          .map((reply) => `    - ${reply.authorName ? `${reply.authorName}: ` : ""}${reply.body}`)
          .join("\n")}`
      : "";

  return `- ${author}${comment.body}${quote}${replies}`;
};

const formatOpenComments = (files: MarkdownFile[], commentsByFileId: Record<string, FileComment[]>) => {
  const commentBlocks = files
    .map((file) => {
      const openComments = getOpenComments(commentsByFileId, file.id);
      if (openComments.length === 0) {
        return "";
      }

      return `### ${file.title}

${openComments
  .map(formatCommentForExport)
  .join("\n")}
`;
    })
    .filter(Boolean)
    .join("\n");

  return commentBlocks ? `## Open Comments\n\n${commentBlocks}` : "";
};

const formatAgentChecks = (title: string, checks: AgentCheck[]) => {
  const passCount = checks.filter((check) => check.status === "pass").length;
  const warnCount = checks.length - passCount;

  return `---
title: ${title}
description: Generated ${PRODUCT_NAME} agent report.
---

# ${title}

${passCount} passed. ${warnCount} need attention.

${checks
  .map((check) => `- ${check.status === "pass" ? "[x]" : "[ ]"} **${check.label}** - ${check.detail}`)
  .join("\n")}
`;
};

export const buildAgentsLintReport = (files: MarkdownFile[]) => {
  const agentsFile = findFileByTitle(files, "AGENTS.md");
  const checks: AgentCheck[] = [
    {
      status: agentsFile ? "pass" : "warn",
      label: "AGENTS.md exists",
      detail: agentsFile ? "Agent instructions are present." : "Create AGENTS.md in the project.",
    },
    {
      status: hasFrontmatterKey(agentsFile, "title") ? "pass" : "warn",
      label: "Frontmatter title",
      detail: "AGENTS.md should expose a title for agent indexing.",
    },
    {
      status: hasFrontmatterKey(agentsFile, "description") ? "pass" : "warn",
      label: "Frontmatter description",
      detail: "AGENTS.md should summarize its instruction scope.",
    },
    {
      status: hasHeading(agentsFile, "Project context") ? "pass" : "warn",
      label: "Project context",
      detail: "Agents need a short project overview before commands.",
    },
    {
      status: hasHeading(agentsFile, "Commands") ? "pass" : "warn",
      label: "Commands section",
      detail: "List Build, Test, and Dev commands.",
    },
    {
      status: hasNonEmptyCommand(agentsFile, "Build") ? "pass" : "warn",
      label: "Build command",
      detail: "Add a runnable build command.",
    },
    {
      status: hasNonEmptyCommand(agentsFile, "Test") ? "pass" : "warn",
      label: "Test command",
      detail: "Add the fastest useful test command.",
    },
    {
      status: hasNonEmptyCommand(agentsFile, "Dev") ? "pass" : "warn",
      label: "Dev command",
      detail: "Add the local development command.",
    },
    {
      status: hasHeading(agentsFile, "Conventions") ? "pass" : "warn",
      label: "Conventions",
      detail: "Capture style, naming, and workflow expectations.",
    },
    {
      status: /do not overwrite user work/i.test(agentsFile?.text ?? "") ? "pass" : "warn",
      label: "User work safety",
      detail: "Explicitly tell agents not to overwrite user work.",
    },
  ];

  return formatAgentChecks("AGENTS.md Lint", checks);
};

export const buildDocsConsistencyReport = (files: MarkdownFile[]) => {
  const readmeFile = findFileByTitle(files, "README.md");
  const prdFile = findFileByTitle(files, "PRD.md");
  const designFile = findFileByTitle(files, "DESIGN.md");
  const checks: AgentCheck[] = [
    {
      status: readmeFile ? "pass" : "warn",
      label: "README.md exists",
      detail: "README.md is the default entry point.",
    },
    {
      status: prdFile ? "pass" : "warn",
      label: "PRD.md exists",
      detail: "PRD.md should define problem, goals, and success criteria.",
    },
    {
      status: designFile ? "pass" : "warn",
      label: "DESIGN.md exists",
      detail: "DESIGN.md should describe interface principles and key states.",
    },
    {
      status: readmeFile && /PRD\.md/i.test(readmeFile.text) ? "pass" : "warn",
      label: "README links PRD",
      detail: "README.md should point readers and agents to PRD.md.",
    },
    {
      status: readmeFile && /DESIGN\.md/i.test(readmeFile.text) ? "pass" : "warn",
      label: "README links design",
      detail: "README.md should point readers and agents to DESIGN.md.",
    },
    {
      status: hasFrontmatterKey(prdFile, "description") ? "pass" : "warn",
      label: "PRD description",
      detail: "PRD.md should include frontmatter description.",
    },
    {
      status: hasHeading(prdFile, "Goals") && hasHeading(prdFile, "Success criteria") ? "pass" : "warn",
      label: "PRD decision shape",
      detail: "PRD.md should include Goals and Success criteria.",
    },
    {
      status: hasFrontmatterKey(designFile, "description") ? "pass" : "warn",
      label: "Design description",
      detail: "DESIGN.md should include frontmatter description.",
    },
    {
      status: hasHeading(designFile, "Principles") && hasHeading(designFile, "Key states") ? "pass" : "warn",
      label: "Design decision shape",
      detail: "DESIGN.md should include Principles and Key states.",
    },
    {
      status: readmeFile && prdFile && designFile ? "pass" : "warn",
      label: "Agent handoff set",
      detail: "README.md, PRD.md, and DESIGN.md should exist together.",
    },
  ];

  return formatAgentChecks("Markdown Docs Consistency", checks);
};

export const createCodeFence = (content: string, language = "md") => {
  let fence = "```";
  while (content.includes(fence)) {
    fence += "`";
  }

  return `${fence}${language}\n${content}\n${fence}`;
};

export const buildLlmsTxt = (files: MarkdownFile[], activeFileId: string) => {
  const activeFile = files.find((file) => file.id === activeFileId) ?? files[0];
  const fileIndex = files
    .map((file) => {
      const description = getFileDescription(file);
      return `- ${file.title}${description ? ` - ${description}` : ""}`;
    })
    .join("\n");

  return `# ${PRODUCT_NAME}

Markdown files prepared for people and AI agents.

## Project

- Active file: ${activeFile?.title ?? "None"}
- Files: ${files.length}

## Files

${fileIndex}

## Full Context

Use llms-full.txt for the complete Markdown bundle.
`;
};

export const buildAgentContextExport = (
  files: MarkdownFile[],
  activeFileId: string,
  commentsByFileId: Record<string, FileComment[]>,
) => {
  const activeFile = files.find((file) => file.id === activeFileId) ?? files[0];
  const fileIndex = files
    .map((file) => {
      const description = getFileDescription(file);
      const liveState = file.roomId ? `live:${file.roomId}` : "local";
      return `| ${file.title} | ${file.viewMode} | ${liveState} | ${getFileWordCount(file)} | ${description} |`;
    })
    .join("\n");
  const fileBodies = files
    .map((file) => {
      const comments = getOpenComments(commentsByFileId, file.id);
      const commentsBlock =
        comments.length > 0
          ? `\n\n#### Open Comments\n${comments
              .map(formatCommentForExport)
              .join("\n")}`
          : "";

      return `## ${file.title}

- Mode: ${file.viewMode}
- Text width: ${file.readingWidth}
- Line wrapping: ${file.lineWrapping ? "on" : "off"}
- State: ${file.roomId ? `live ${file.roomId}` : "local"}
${commentsBlock}

${createCodeFence(file.text)}
`;
    })
    .join("\n");

  return `# ${PRODUCT_NAME} Agent Context

- Generated: ${new Date().toISOString()}
- Active file: ${activeFile?.title ?? "None"}
- Files: ${files.length}

## File Index

| File | Mode | State | Words | Description |
| --- | --- | --- | ---: | --- |
${fileIndex}

${formatOpenComments(files, commentsByFileId)}

${fileBodies}`;
};

export const buildLlmsFullTxt = (
  files: MarkdownFile[],
  activeFileId: string,
  commentsByFileId: Record<string, FileComment[]>,
) => buildAgentContextExport(files, activeFileId, commentsByFileId);

export const buildMarkdownBundle = (files: MarkdownFile[]) =>
  files
    .map(
      (file) => `<!-- BEGIN ${file.title} -->

${file.text}

<!-- END ${file.title} -->`,
    )
    .join("\n\n");

export const buildPublishBundle = (
  files: MarkdownFile[],
  activeFileId: string,
  commentsByFileId: Record<string, FileComment[]>,
) => `# ${PRODUCT_NAME} Project Publish Bundle

## llms.txt

${createCodeFence(buildLlmsTxt(files, activeFileId), "txt")}

## llms-full.txt

${createCodeFence(buildLlmsFullTxt(files, activeFileId, commentsByFileId), "txt")}

## Markdown Bundle

${createCodeFence(buildMarkdownBundle(files))}
`;

export const buildGitHubPrExport = (files: MarkdownFile[], activeFileId: string) => {
  const activeFile = files.find((file) => file.id === activeFileId) ?? files[0];
  const fileList = files.map((file) => `- ${file.title}`).join("\n");
  const activeSummary = activeFile ? `Update ${activeFile.title}` : "Update Markdown project";

  return `# GitHub PR Export

## PR title

Docs: ${activeSummary}

## PR body

### Summary

- Updated Markdown project files.
- Active file: ${activeFile?.title ?? "None"}.

### Files

${fileList}

### Test plan

- [ ] Review Markdown preview.
- [ ] Run AGENTS.md lint.
- [ ] Run PRD/DESIGN/README consistency check.

## Markdown Bundle

${files.map((file) => `### ${file.title}\n\n${createCodeFence(file.text)}`).join("\n\n")}
`;
};
