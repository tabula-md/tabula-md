import { useMemo } from "react";
import { getFrontmatterProperties } from "@tabula-md/tabula";
import {
  frontmatterPropertySuggestions,
  getWorkspaceFrontmatterPropertySuggestions,
} from "./frontmatterPropertySuggestions";

export function useDocumentMetadataModel(
  markdown: string,
  workspaceMarkdownDocuments: readonly string[],
) {
  const model = useMemo(() => getFrontmatterProperties(markdown), [markdown]);
  const propertySuggestions = useMemo(() => {
    const workspaceSuggestions = getWorkspaceFrontmatterPropertySuggestions(
      workspaceMarkdownDocuments,
    );
    const workspaceKeys = new Set(
      workspaceSuggestions.map(({ key }) => key.toLowerCase()),
    );
    return [
      ...workspaceSuggestions,
      ...frontmatterPropertySuggestions.filter(
        ({ key }) => !workspaceKeys.has(key.toLowerCase()),
      ),
    ];
  }, [workspaceMarkdownDocuments]);

  return { model, propertySuggestions };
}
