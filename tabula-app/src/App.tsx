import { WorkspaceApp } from "./workspace/components/WorkspaceApp";
import { WorkspaceErrorBoundary } from "./workspace/components/WorkspaceErrorBoundary";

function App() {
  return (
    <WorkspaceErrorBoundary>
      <WorkspaceApp />
    </WorkspaceErrorBoundary>
  );
}

export default App;
