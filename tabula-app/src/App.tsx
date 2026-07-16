import { WorkspaceApp } from "./components/WorkspaceApp";
import { WorkspaceErrorBoundary } from "./components/WorkspaceErrorBoundary";

function App() {
  return (
    <WorkspaceErrorBoundary>
      <WorkspaceApp />
    </WorkspaceErrorBoundary>
  );
}

export default App;
