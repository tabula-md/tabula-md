import { PublishedSnapshotRoute } from "./components/PublishedSnapshotRoute";
import { WorkspaceApp } from "./components/WorkspaceApp";
import { getPublishRoute } from "./publish";

function App() {
  const publishRoute = getPublishRoute(
    window.location.pathname,
    window.location.search,
  );

  if (publishRoute) {
    return <PublishedSnapshotRoute route={publishRoute} />;
  }

  return <WorkspaceApp />;
}

export default App;
