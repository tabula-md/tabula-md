import { LibraryBig } from "lucide-react";
import type { WorkspaceInterfaceCopy } from "../workspace/workspaceInterfaceLocale";

export function WorkspaceLibrariesPanel({
  copy,
}: {
  copy: WorkspaceInterfaceCopy["sidePanel"]["libraries"];
}) {
  return (
    <section className="left-panel-libraries" aria-label={copy.label}>
      <LibraryBig size={20} aria-hidden="true" />
      <p>{copy.empty}</p>
      <small>{copy.description}</small>
    </section>
  );
}
