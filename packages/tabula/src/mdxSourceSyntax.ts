export const REGISTERED_MDX_COMPONENTS = Object.freeze([
  "Accordion",
  "Callout",
  "Tab",
  "Tabs",
] as const);

export type MdxSourceRangeKind =
  | "esm-import"
  | "esm-export"
  | "expression"
  | "jsx-component"
  | "jsx-fragment";

export type MdxSourceRange = {
  kind: MdxSourceRangeKind;
  from: number;
  to: number;
  name?: string;
  registered?: boolean;
};

const createFenceMask = (source: string) => {
  const masked = new Uint8Array(source.length);
  let offset = 0;
  let fence: { marker: "`" | "~"; length: number } | null = null;
  for (const line of source.split(/(?<=\n)/)) {
    const lineWithoutEnding = line.replace(/\r?\n$/, "");
    const marker = lineWithoutEnding.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (!fence && marker) {
      fence = {
        marker: marker[1]?.[0] as "`" | "~",
        length: marker[1]?.length ?? 3,
      };
      masked.fill(1, offset, offset + line.length);
    } else if (fence) {
      masked.fill(1, offset, offset + line.length);
      const closing = lineWithoutEnding.match(/^\s{0,3}(`{3,}|~{3,})\s*$/);
      if (
        closing &&
        closing[1]?.[0] === fence.marker &&
        closing[1].length >= fence.length
      ) {
        fence = null;
      }
    }
    offset += line.length;
  }
  return masked;
};

const scanEsmRanges = (source: string, fenceMask: Uint8Array) => {
  const ranges: MdxSourceRange[] = [];
  const linePattern = /^(?:[ \t]*)(import|export)\b[^\r\n]*(?:\r?\n|$)/gm;
  for (const match of source.matchAll(linePattern)) {
    const from = match.index ?? 0;
    if (fenceMask[from]) continue;
    ranges.push({
      kind: match[1] === "import" ? "esm-import" : "esm-export",
      from,
      to: from + match[0].length,
    });
  }
  return ranges;
};

const scanExpressionRanges = (source: string, fenceMask: Uint8Array) => {
  const ranges: MdxSourceRange[] = [];
  for (let cursor = 0; cursor < source.length; cursor += 1) {
    if (source[cursor] !== "{" || fenceMask[cursor]) continue;
    const from = cursor;
    let depth = 1;
    let quote: "'" | '"' | "`" | null = null;
    let escaped = false;
    for (cursor += 1; cursor < source.length; cursor += 1) {
      if (fenceMask[cursor]) continue;
      const character = source[cursor];
      if (quote) {
        if (escaped) {
          escaped = false;
        } else if (character === "\\") {
          escaped = true;
        } else if (character === quote) {
          quote = null;
        }
        continue;
      }
      if (character === "'" || character === '"' || character === "`") {
        quote = character;
      } else if (character === "{") {
        depth += 1;
      } else if (character === "}") {
        depth -= 1;
        if (depth === 0) {
          ranges.push({ kind: "expression", from, to: cursor + 1 });
          break;
        }
      }
    }
  }
  return ranges;
};

const scanJsxRanges = (
  source: string,
  fenceMask: Uint8Array,
  registeredComponents: ReadonlySet<string>,
) => {
  const ranges: MdxSourceRange[] = [];
  for (let cursor = 0; cursor < source.length; cursor += 1) {
    if (source[cursor] !== "<" || fenceMask[cursor]) continue;
    const fragmentMatch = source.slice(cursor).match(/^<\/?>/);
    if (fragmentMatch) {
      ranges.push({
        kind: "jsx-fragment",
        from: cursor,
        to: cursor + fragmentMatch[0].length,
      });
      cursor += fragmentMatch[0].length - 1;
      continue;
    }
    const nameMatch = source.slice(cursor).match(/^<\/?([A-Z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)*)\b/);
    if (!nameMatch?.[1]) continue;
    let quote: "'" | '"' | null = null;
    let escaped = false;
    let end = cursor + nameMatch[0].length;
    for (; end < source.length; end += 1) {
      const character = source[end];
      if (quote) {
        if (escaped) {
          escaped = false;
        } else if (character === "\\") {
          escaped = true;
        } else if (character === quote) {
          quote = null;
        }
      } else if (character === "'" || character === '"') {
        quote = character;
      } else if (character === ">") {
        end += 1;
        break;
      }
    }
    const rootName = nameMatch[1].split(".")[0] ?? nameMatch[1];
    ranges.push({
      kind: "jsx-component",
      from: cursor,
      to: Math.min(source.length, end),
      name: nameMatch[1],
      registered: registeredComponents.has(rootName),
    });
    cursor = Math.max(cursor, end - 1);
  }
  return ranges;
};

export const scanMdxSourceRanges = (
  source: string,
  registeredComponentNames: readonly string[] = REGISTERED_MDX_COMPONENTS,
): MdxSourceRange[] => {
  const fenceMask = createFenceMask(source);
  const registeredComponents = new Set(registeredComponentNames);
  return [
    ...scanEsmRanges(source, fenceMask),
    ...scanExpressionRanges(source, fenceMask),
    ...scanJsxRanges(source, fenceMask, registeredComponents),
  ].sort((first, second) => first.from - second.from || first.to - second.to);
};

export const maskMdxSyntax = (
  source: string,
  ranges: readonly MdxSourceRange[] = scanMdxSourceRanges(source),
) => {
  const characters = source.split("");
  for (const range of ranges) {
    for (let offset = range.from; offset < range.to; offset += 1) {
      if (characters[offset] !== "\n" && characters[offset] !== "\r") {
        characters[offset] = " ";
      }
    }
  }
  return characters.join("");
};
