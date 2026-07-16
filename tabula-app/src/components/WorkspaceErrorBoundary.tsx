import { Component, type ErrorInfo, type ReactNode } from "react";
import { clientErrorReporter } from "../observability/clientErrorReporting";

type WorkspaceErrorBoundaryProps = {
  children: ReactNode;
};

type WorkspaceErrorBoundaryState = {
  failed: boolean;
};

export class WorkspaceErrorBoundary extends Component<
  WorkspaceErrorBoundaryProps,
  WorkspaceErrorBoundaryState
> {
  state: WorkspaceErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): WorkspaceErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    clientErrorReporter.report({
      feature: "workspace",
      operation: "render",
      error: new Error(`${error.message}\n${errorInfo.componentStack ?? ""}`),
    });
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="app-shell workspace-fatal-error" role="alert">
        <section className="workspace empty-workspace">
          <div className="empty-file-center">
            <h1>Tabula couldn’t open this workspace.</h1>
            <p>Your browser data has not been deleted. Reload to try again.</p>
            <button type="button" className="empty-file-action" onClick={() => window.location.reload()}>
              <span>Reload Tabula</span>
            </button>
          </div>
        </section>
      </main>
    );
  }
}
