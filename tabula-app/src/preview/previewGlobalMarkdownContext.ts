export type PreviewMarkdownDefinition = {
  label: string;
  markdown: string;
};

export type PreviewGlobalMarkdownContext = {
  embeddedImageSources: Readonly<Record<string, string>>;
  footnoteDefinitions: PreviewMarkdownDefinition[];
  footnoteReferences: string;
  referenceDefinitions: PreviewMarkdownDefinition[];
};

const referenceDefinitionLinePattern = /^ {0,3}\[(?!\^)([^\]\n]+)\]:\s+\S/;
const footnoteDefinitionLinePattern = /^ {0,3}\[\^([^\]\n]+)\]:/;
const footnoteContinuationLinePattern = /^(?: {4,}|\t)\S/;
const bracketLabelPattern = /\[([^\]\n]*)\]/g;
const footnoteReferencePattern = /\[\^([^\]\n]+)\]/g;
const embeddedImageDataPattern = /data:image\/(?:avif|gif|jpeg|png|webp);base64,[a-z0-9+/=]+/i;
const embeddedImageTokenPrefix = "/__tabula_embedded_image__/";

const normalizeDefinitionLabel = (label: string) =>
  label.trim().replace(/\s+/g, " ").toLowerCase();

const collectBracketLabels = (markdown: string) => {
  const labels = new Set<string>();
  bracketLabelPattern.lastIndex = 0;
  for (const match of markdown.matchAll(bracketLabelPattern)) {
    const label = match[1];
    if (!label || label.startsWith("^")) {
      continue;
    }
    labels.add(normalizeDefinitionLabel(label));
  }
  return labels;
};

const collectFootnoteLabels = (markdown: string) => {
  const labels = new Set<string>();
  footnoteReferencePattern.lastIndex = 0;
  for (const match of markdown.matchAll(footnoteReferencePattern)) {
    labels.add(normalizeDefinitionLabel(match[1]));
  }
  return labels;
};

export const getPreviewGlobalMarkdownContext = (
  markdown: string,
): PreviewGlobalMarkdownContext => {
  const lines = markdown.split(/\r?\n/);
  let isInFence = false;
  let activeFenceMarker = "";
  const referenceDefinitions: PreviewMarkdownDefinition[] = [];
  const footnoteDefinitions: PreviewMarkdownDefinition[] = [];
  const embeddedImageSources: Record<string, string> = {};
  const referenceLabels = new Set<string>();
  const footnoteLabels = new Set<string>();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!isInFence) {
        isInFence = true;
        activeFenceMarker = marker;
      } else if (marker[0] === activeFenceMarker[0] && marker.length >= activeFenceMarker.length) {
        isInFence = false;
        activeFenceMarker = "";
      }
      continue;
    }

    if (isInFence) {
      continue;
    }

    const footnoteDefinitionMatch = line.match(footnoteDefinitionLinePattern);
    if (footnoteDefinitionMatch) {
      const footnoteLines = [line];
      const pendingBlankLines: string[] = [];
      while (index + 1 < lines.length) {
        const nextLine = lines[index + 1];
        if (nextLine.trim().length === 0) {
          pendingBlankLines.push(nextLine);
          index += 1;
          continue;
        }

        if (footnoteContinuationLinePattern.test(nextLine)) {
          footnoteLines.push(...pendingBlankLines, nextLine);
          pendingBlankLines.length = 0;
          index += 1;
          continue;
        }

        break;
      }

      const label = normalizeDefinitionLabel(footnoteDefinitionMatch[1]);
      if (!footnoteLabels.has(label)) {
        footnoteLabels.add(label);
        footnoteDefinitions.push({ label, markdown: footnoteLines.join("\n") });
      }
      continue;
    }

    const referenceDefinitionMatch = line.match(referenceDefinitionLinePattern);
    if (referenceDefinitionMatch) {
      const label = normalizeDefinitionLabel(referenceDefinitionMatch[1]);
      if (!referenceLabels.has(label)) {
        referenceLabels.add(label);
        const embeddedImageMatch = line.match(embeddedImageDataPattern);
        if (embeddedImageMatch) {
          const token = `${embeddedImageTokenPrefix}${encodeURIComponent(label)}`;
          embeddedImageSources[token] = embeddedImageMatch[0];
          referenceDefinitions.push({
            label,
            markdown: line.replace(embeddedImageMatch[0], token),
          });
        } else {
          referenceDefinitions.push({ label, markdown: line });
        }
      }
    }
  }

  return {
    embeddedImageSources,
    footnoteDefinitions,
    footnoteReferences: footnoteDefinitions.map(({ label }) => `[^${label}]`).join(" "),
    referenceDefinitions,
  };
};

export const getPreviewBlockGlobalDefinitions = (
  blockMarkdown: string,
  context: PreviewGlobalMarkdownContext,
) => {
  const footnoteLabels = collectFootnoteLabels(blockMarkdown);
  const selectedFootnotes = context.footnoteDefinitions.filter(({ label }) =>
    footnoteLabels.has(label),
  );
  const referenceLabels = collectBracketLabels(
    [blockMarkdown, ...selectedFootnotes.map(({ markdown }) => markdown)].join("\n"),
  );
  const selectedReferences = context.referenceDefinitions.filter(({ label }) =>
    referenceLabels.has(label),
  );

  return [...selectedReferences, ...selectedFootnotes]
    .map(({ markdown }) => markdown)
    .join("\n\n");
};

export const getPreviewFootnoteDefinitions = (
  context: PreviewGlobalMarkdownContext,
) => context.footnoteDefinitions.map(({ markdown }) => markdown).join("\n");
