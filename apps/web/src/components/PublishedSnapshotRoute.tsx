import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, File as FileIcon, Folder as FolderIcon } from "lucide-react";
import { getPreviewBody, parseFrontmatter } from "../markdown";
import { PRODUCT_NAME } from "../product";
import {
  getConfiguredPublishServiceUrl,
  readPublishedSnapshot,
  readServerPublishedSnapshot,
  type PublishedSnapshot,
  type PublishRoute,
} from "../publish";
import { MarkdownPreview } from "./MarkdownPreview";
import { TabulaLogo } from "./TabulaLogo";

const getPublishedFilePageUrl = (pageUrl: string, fileId: string) => {
  const url = new URL(pageUrl, window.location.origin);
  url.searchParams.set("file", fileId);
  return url.toString();
};

const getFileDisplayTitle = (title: string) => title.replace(/\.(?:md|markdown)$/i, "");

const getPublishedProjectLabel = (ownerName?: string) => {
  const name = ownerName?.trim();
  if (!name) {
    return "Published Project";
  }

  return name.endsWith("s") ? `${name}' Project` : `${name}'s Project`;
};

const getPublishedDocumentTitle = (body: string, metadataTitle?: string) => {
  const frontmatterTitle = metadataTitle?.trim();
  if (frontmatterTitle) {
    return frontmatterTitle;
  }

  const heading = body.match(/^#{1,2}\s+(.+?)\s*#*\s*$/m)?.[1]?.trim();
  return heading || "Published page";
};

function PublishedSnapshotView({
  route,
  snapshot,
  status = snapshot ? "ready" : "missing",
  errorMessage,
}: {
  route: PublishRoute;
  snapshot: PublishedSnapshot | null;
  status?: "loading" | "ready" | "missing" | "error";
  errorMessage?: string;
}) {
  const activeFile =
    snapshot?.files.find((file) => file.id === route.fileId) ??
    snapshot?.files.find((file) => file.id === snapshot.activeFileId) ??
    snapshot?.files[0];
  const parsedMarkdown = parseFrontmatter(activeFile?.text ?? "");
  const metadataTitle = parsedMarkdown.attributes.find((attribute) => attribute.key.toLowerCase() === "title")?.value;
  const pageTitle = getPublishedDocumentTitle(parsedMarkdown.body, metadataTitle);
  const [publishedFilesCollapsed, setPublishedFilesCollapsed] = useState(false);

  useEffect(() => {
    document.title = snapshot
      ? `${pageTitle} - ${PRODUCT_NAME}`
      : status === "loading"
        ? "Loading published page"
        : "Published page not found";
  }, [pageTitle, snapshot, status]);

  if (!snapshot) {
    const headline =
      status === "loading"
        ? "Loading published page."
        : status === "error"
          ? "Unable to load published page."
          : "Published page not found.";
    return (
      <main className="published-page published-missing">
        <section className="published-shell">
          <p>{PRODUCT_NAME}</p>
          <h1>{headline}</h1>
          {errorMessage && <p>{errorMessage}</p>}
          <a href="/">Return to project</a>
        </section>
      </main>
    );
  }

  const textOutput =
    route.output === "llms.txt" ? snapshot.llmsTxt : route.output === "llms-full.txt" ? snapshot.llmsFullTxt : "";

  if (route.output !== "page") {
    return (
      <main className="published-text-page">
        <pre>{textOutput}</pre>
      </main>
    );
  }

  const renderedPreview = getPreviewBody(parsedMarkdown.body);
  const hasMultipleFiles = snapshot.fileCount > 1;
  const publishedProjectLabel = getPublishedProjectLabel(snapshot.ownerName);
  const renderPublishedFileLinks = (keyPrefix: string) =>
    snapshot.files.map((file) => (
      <a
        aria-current={file.id === activeFile?.id ? "page" : undefined}
        className={file.id === activeFile?.id ? "active" : ""}
        href={getPublishedFilePageUrl(snapshot.urls.page, file.id)}
        key={`${keyPrefix}-${file.id}`}
        title={file.title}
      >
        <FileIcon size={16} />
        <span>{getFileDisplayTitle(file.title)}</span>
      </a>
    ));

  return (
    <main className="published-page">
      <section className={`published-shell ${hasMultipleFiles ? "published-project-shell" : ""}`}>
        <div className="published-reader-shell">
          {hasMultipleFiles && (
            <aside className="published-file-list published-contents-sidebar" aria-label="Project contents">
              <button
                className="published-file-tree-root"
                type="button"
                aria-expanded={!publishedFilesCollapsed}
                onClick={() => setPublishedFilesCollapsed((nextCollapsed) => !nextCollapsed)}
              >
                {publishedFilesCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                <FolderIcon size={15} />
                <span>{publishedProjectLabel}</span>
              </button>
              {!publishedFilesCollapsed && (
                <nav aria-label="Published project files">{renderPublishedFileLinks("sidebar")}</nav>
              )}
            </aside>
          )}

          <div className="published-article-shell">
            {hasMultipleFiles && (
              <details className="published-contents-menu">
                <summary>
                  <FolderIcon size={15} />
                  <span>{publishedProjectLabel}</span>
                </summary>
                <nav aria-label="Published project files">{renderPublishedFileLinks("menu")}</nav>
              </details>
            )}

            <article className="preview-surface published-document">
              <MarkdownPreview metadata={parsedMarkdown.attributes} body={renderedPreview.body} />
            </article>

            <footer className={`published-footer ${hasMultipleFiles ? "project" : ""}`}>
              <span>Powered by</span>
              <TabulaLogo className="published-footer-logo" size={16} />
              <span>Tabula</span>
            </footer>
          </div>
        </div>
      </section>
    </main>
  );
}

export function PublishedSnapshotRoute({ route }: { route: PublishRoute }) {
  const [snapshot, setSnapshot] = useState<PublishedSnapshot | null>(() => readPublishedSnapshot(route.snapshotId));
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">(() =>
    snapshot ? "ready" : "loading",
  );
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    const localSnapshot = readPublishedSnapshot(route.snapshotId);
    setSnapshot(localSnapshot);
    setErrorMessage(undefined);

    if (localSnapshot) {
      setStatus("ready");
      return;
    }

    const publishServiceUrl = getConfiguredPublishServiceUrl();
    if (!publishServiceUrl) {
      setStatus("missing");
      return;
    }

    let cancelled = false;
    setStatus("loading");
    void readServerPublishedSnapshot({
      serviceUrl: publishServiceUrl,
      origin: window.location.origin,
      snapshotId: route.snapshotId,
    })
      .then((serverSnapshot) => {
        if (cancelled) {
          return;
        }
        setSnapshot(serverSnapshot);
        setStatus(serverSnapshot ? "ready" : "missing");
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "Publish failed.");
      });

    return () => {
      cancelled = true;
    };
  }, [route.snapshotId]);

  return <PublishedSnapshotView route={route} snapshot={snapshot} status={status} errorMessage={errorMessage} />;
}
