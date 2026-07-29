import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ComponentType,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { Components } from "react-markdown";
import { classifyMarkdownHref } from "./markdownHref";
import { PreviewImage } from "./PreviewAsyncBlocks";

type PreviewDocsComponentProps = {
  children?: ReactNode;
  caption?: string;
  cols?: number | string;
  hint?: string;
  horizontal?: boolean | string;
  href?: string;
  icon?: string;
  img?: string;
  open?: boolean | string;
  title?: string;
  type?: string;
};

export type PreviewDocsRawComponentProps = PreviewDocsComponentProps & HTMLAttributes<HTMLElement> & {
  "data-component-name"?: string;
  "data-preview-line-end"?: number | string;
  "data-preview-line-start"?: number | string;
  node?: unknown;
};

export type PreviewWorkspaceEmbedRawProps = PreviewDocsRawComponentProps & {
  "data-workspace-embed-target"?: unknown;
};

export type MarkdownPreviewComponents = Components & {
  "tabula-workspace-embed": ComponentType<PreviewWorkspaceEmbedRawProps>;
};

const normalizeDocsAttribute = (value: boolean | number | string | undefined) =>
  typeof value === "string" ? value.replace(/^\{(.+)\}$/, "$1").trim() : value;

const getPreviewColumnCount = (cols: number | string | undefined) => {
  const parsedColumns = Number(normalizeDocsAttribute(cols));
  if (!Number.isFinite(parsedColumns)) {
    return 1;
  }

  return Math.max(1, Math.min(4, Math.round(parsedColumns)));
};

function PreviewFrame({ children, caption, hint, ...sourceProps }: PreviewDocsComponentProps & HTMLAttributes<HTMLElement>) {
  return (
    <figure {...sourceProps} className={`preview-docs-frame ${sourceProps.className ?? ""}`.trim()}>
      {hint && <div className="preview-docs-frame-hint">{hint}</div>}
      <div className="preview-docs-frame-body">{children}</div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

function PreviewUnsupportedComponent({
  children,
  "data-component-name": componentName = "Component",
  ...sourceProps
}: PreviewDocsRawComponentProps & HTMLAttributes<HTMLElement>) {
  return (
    <aside
      {...sourceProps}
      className={`preview-unsupported-component ${sourceProps.className ?? ""}`.trim()}
      data-component-name={componentName}
    >
      <code className="preview-unsupported-component-label">{`<${componentName}>`}</code>
      {children && <div className="preview-unsupported-component-body">{children}</div>}
    </aside>
  );
}

function PreviewTabs({ children, ...sourceProps }: PreviewDocsComponentProps & HTMLAttributes<HTMLElement>) {
  const tabsId = useId();
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const tabButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tabs = Children.toArray(children).flatMap((child, index) => {
    if (!isValidElement<PreviewDocsComponentProps>(child)) return [];

    const rawTitle = normalizeDocsAttribute(child.props.title);
    if (typeof rawTitle !== "string" || rawTitle.length === 0) return [];

    return [{
      content: child.props.children,
      key: child.key ?? index,
      title: rawTitle,
    }];
  });
  const safeActiveTabIndex = Math.min(activeTabIndex, Math.max(0, tabs.length - 1));
  const activeTab = tabs[safeActiveTabIndex];

  useEffect(() => {
    if (activeTabIndex !== safeActiveTabIndex) setActiveTabIndex(safeActiveTabIndex);
  }, [activeTabIndex, safeActiveTabIndex]);

  const focusTab = (index: number) => {
    setActiveTabIndex(index);
    window.requestAnimationFrame(() => tabButtonRefs.current[index]?.focus());
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    focusTab(nextIndex);
  };

  if (!activeTab) {
    return <div {...sourceProps} className={`preview-docs-tabs ${sourceProps.className ?? ""}`.trim()}>{children}</div>;
  }

  return (
    <section {...sourceProps} className={`preview-docs-tabs ${sourceProps.className ?? ""}`.trim()}>
      <div className="preview-docs-tab-list" role="tablist" aria-label="Tabs">
        {tabs.map((tab, index) => {
          const selected = index === safeActiveTabIndex;
          return (
            <button
              key={tab.key}
              ref={(element) => {
                tabButtonRefs.current[index] = element;
              }}
              type="button"
              className="preview-docs-tab-trigger"
              id={`${tabsId}-tab-${index}`}
              role="tab"
              aria-controls={`${tabsId}-panel-${index}`}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveTabIndex(index)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              {tab.title}
            </button>
          );
        })}
      </div>
      <div
        className="preview-docs-tab-panel"
        id={`${tabsId}-panel-${safeActiveTabIndex}`}
        role="tabpanel"
        aria-labelledby={`${tabsId}-tab-${safeActiveTabIndex}`}
      >
        {activeTab.content}
      </div>
    </section>
  );
}

function PreviewTab({ children, title, ...sourceProps }: PreviewDocsComponentProps & HTMLAttributes<HTMLElement>) {
  return (
    <section {...sourceProps} className={`preview-docs-tab ${sourceProps.className ?? ""}`.trim()}>
      {title && <div className="preview-docs-tab-title">{title}</div>}
      <div className="preview-docs-tab-body">{children}</div>
    </section>
  );
}

function PreviewAccordion({
  children,
  open,
  title,
  ...sourceProps
}: PreviewDocsComponentProps & HTMLAttributes<HTMLElement>) {
  const isOpen = normalizeDocsAttribute(open) === true || normalizeDocsAttribute(open) === "true";
  return (
    <details {...sourceProps} className={`preview-docs-accordion ${sourceProps.className ?? ""}`.trim()} open={isOpen}>
      <summary>
        <span className="preview-docs-accordion-chevron" aria-hidden="true" />
        <span>{title || "Accordion"}</span>
      </summary>
      <div className="preview-docs-accordion-body">{children}</div>
    </details>
  );
}

function PreviewSteps({
  children,
  ...sourceProps
}: Omit<PreviewDocsComponentProps, "type"> & HTMLAttributes<HTMLOListElement>) {
  return <ol {...sourceProps} className={`preview-docs-steps ${sourceProps.className ?? ""}`.trim()}>{children}</ol>;
}

function PreviewStep({ children, title, ...sourceProps }: PreviewDocsComponentProps & HTMLAttributes<HTMLElement>) {
  return (
    <li {...sourceProps} className={`preview-docs-step ${sourceProps.className ?? ""}`.trim()}>
      {title && <strong className="preview-docs-step-title">{title}</strong>}
      <div className="preview-docs-step-body">{children}</div>
    </li>
  );
}

function PreviewCodeGroup({ children, title, ...sourceProps }: PreviewDocsComponentProps & HTMLAttributes<HTMLElement>) {
  return (
    <section {...sourceProps} className={`preview-docs-code-group ${sourceProps.className ?? ""}`.trim()}>
      {title && <div className="preview-docs-code-group-title">{title}</div>}
      <div className="preview-docs-code-group-body">{children}</div>
    </section>
  );
}

function PreviewCallout({
  children,
  icon,
  title,
  type,
  ...sourceProps
}: PreviewDocsComponentProps & HTMLAttributes<HTMLElement>) {
  return (
    <aside
      {...sourceProps}
      className={`preview-docs-callout ${sourceProps.className ?? ""}`.trim()}
      data-callout-type={type || "note"}
    >
      {(icon || title) && (
        <div className="preview-docs-callout-title">
          {icon && <span aria-hidden="true">{icon}</span>}
          {title && <strong>{title}</strong>}
        </div>
      )}
      <div className="preview-docs-callout-body">{children}</div>
    </aside>
  );
}

function PreviewBadge({ children, title, type, ...sourceProps }: PreviewDocsComponentProps & HTMLAttributes<HTMLElement>) {
  return (
    <span
      {...sourceProps}
      className={`preview-docs-badge ${sourceProps.className ?? ""}`.trim()}
      data-badge-type={type || "default"}
    >
      {children || title}
    </span>
  );
}

function PreviewCardGroup({ children, cols, ...sourceProps }: PreviewDocsComponentProps & HTMLAttributes<HTMLElement>) {
  const columnCount = getPreviewColumnCount(cols);

  return (
    <div
      {...sourceProps}
      className={`preview-docs-card-group ${sourceProps.className ?? ""}`.trim()}
      style={{ "--preview-card-columns": columnCount } as CSSProperties}
    >
      {children}
    </div>
  );
}

function PreviewCard({
  children,
  horizontal,
  href,
  icon,
  img,
  title,
  ...sourceProps
}: PreviewDocsComponentProps & HTMLAttributes<HTMLElement>) {
  const resolvedHref = typeof href === "string" ? classifyMarkdownHref(href) : null;
  const isHorizontal = normalizeDocsAttribute(horizontal) === true || normalizeDocsAttribute(horizontal) === "true";
  const cardBody = (
    <>
      {img && <PreviewImage alt={title ?? ""} src={img} />}
      <span className="preview-docs-card-content">
        {(icon || title) && (
          <span className="preview-docs-card-heading">
            {icon && <span className="preview-docs-card-icon">{icon}</span>}
            {title && <strong>{title}</strong>}
          </span>
        )}
        <span className="preview-docs-card-description">{children}</span>
      </span>
    </>
  );
  const className = `preview-docs-card ${isHorizontal ? "horizontal" : ""} ${sourceProps.className ?? ""}`.trim();

  if (!href || resolvedHref?.kind !== "external") {
    return <div {...sourceProps} className={className}>{cardBody}</div>;
  }

  return (
    <a
      {...sourceProps}
      className={className}
      href={resolvedHref?.href}
      target={resolvedHref?.openInNewTab ? "_blank" : undefined}
      rel={resolvedHref?.openInNewTab ? "noreferrer" : undefined}
    >
      {cardBody}
    </a>
  );
}

export const PREVIEW_DOCS_COMPONENTS = {
  "tabula-accordion": ({ children, open, title, node: _node, ...sourceProps }: PreviewDocsRawComponentProps) => (
    <PreviewAccordion
      {...sourceProps}
      open={typeof open === "string" || typeof open === "boolean" ? open : undefined}
      title={typeof title === "string" ? title : undefined}
    >
      {children}
    </PreviewAccordion>
  ),
  "tabula-accordion-group": ({ children, node: _node, ...sourceProps }: PreviewDocsRawComponentProps) => (
    <div {...sourceProps} className={`preview-docs-accordion-group ${sourceProps.className ?? ""}`.trim()}>{children}</div>
  ),
  "tabula-badge": ({ children, title, type, node: _node, ...sourceProps }: PreviewDocsRawComponentProps) => (
    <PreviewBadge
      {...sourceProps}
      title={typeof title === "string" ? title : undefined}
      type={typeof type === "string" ? type : undefined}
    >
      {children}
    </PreviewBadge>
  ),
  card: ({ children, href, icon, img, title, horizontal, node: _node, ...sourceProps }: PreviewDocsRawComponentProps) => (
    <PreviewCard
      {...sourceProps}
      href={typeof href === "string" ? href : undefined}
      icon={typeof icon === "string" ? icon : undefined}
      img={typeof img === "string" ? img : undefined}
      title={typeof title === "string" ? title : undefined}
      horizontal={typeof horizontal === "string" || typeof horizontal === "boolean" ? horizontal : undefined}
    >
      {children}
    </PreviewCard>
  ),
  "tabula-card": ({ children, href, icon, img, title, horizontal, node: _node, ...sourceProps }: PreviewDocsRawComponentProps) => (
    <PreviewCard
      {...sourceProps}
      href={typeof href === "string" ? href : undefined}
      icon={typeof icon === "string" ? icon : undefined}
      img={typeof img === "string" ? img : undefined}
      title={typeof title === "string" ? title : undefined}
      horizontal={typeof horizontal === "string" || typeof horizontal === "boolean" ? horizontal : undefined}
    >
      {children}
    </PreviewCard>
  ),
  cardgroup: ({ children, cols, node: _node, ...sourceProps }: PreviewDocsRawComponentProps) => (
    <PreviewCardGroup {...sourceProps} cols={typeof cols === "string" || typeof cols === "number" ? cols : undefined}>
      {children}
    </PreviewCardGroup>
  ),
  "tabula-card-group": ({ children, cols, node: _node, ...sourceProps }: PreviewDocsRawComponentProps) => (
    <PreviewCardGroup {...sourceProps} cols={typeof cols === "string" || typeof cols === "number" ? cols : undefined}>
      {children}
    </PreviewCardGroup>
  ),
  "tabula-callout": ({ children, icon, title, type, node: _node, ...sourceProps }: PreviewDocsRawComponentProps) => (
    <PreviewCallout
      {...sourceProps}
      icon={typeof icon === "string" ? icon : undefined}
      title={typeof title === "string" ? title : undefined}
      type={typeof type === "string" ? type : undefined}
    >
      {children}
    </PreviewCallout>
  ),
  "tabula-code-group": ({ children, title, node: _node, ...sourceProps }: PreviewDocsRawComponentProps) => (
    <PreviewCodeGroup {...sourceProps} title={typeof title === "string" ? title : undefined}>
      {children}
    </PreviewCodeGroup>
  ),
  frame: ({ children, caption, hint, node: _node, ...sourceProps }: PreviewDocsRawComponentProps) => (
    <PreviewFrame
      {...sourceProps}
      caption={typeof caption === "string" ? caption : undefined}
      hint={typeof hint === "string" ? hint : undefined}
    >
      {children}
    </PreviewFrame>
  ),
  "tabula-frame": ({ children, caption, hint, node: _node, ...sourceProps }: PreviewDocsRawComponentProps) => (
    <PreviewFrame
      {...sourceProps}
      caption={typeof caption === "string" ? caption : undefined}
      hint={typeof hint === "string" ? hint : undefined}
    >
      {children}
    </PreviewFrame>
  ),
  "tabula-step": ({ children, title, node: _node, ...sourceProps }: PreviewDocsRawComponentProps) => (
    <PreviewStep {...sourceProps} title={typeof title === "string" ? title : undefined}>{children}</PreviewStep>
  ),
  "tabula-steps": ({ children, node: _node, type: _type, ...sourceProps }: PreviewDocsRawComponentProps) => (
    <PreviewSteps {...sourceProps}>{children}</PreviewSteps>
  ),
  "tabula-tab": ({ children, title, node: _node, ...sourceProps }: PreviewDocsRawComponentProps) => (
    <PreviewTab {...sourceProps} title={typeof title === "string" ? title : undefined}>{children}</PreviewTab>
  ),
  "tabula-tabs": ({ children, node: _node, ...sourceProps }: PreviewDocsRawComponentProps) => (
    <PreviewTabs {...sourceProps}>{children}</PreviewTabs>
  ),
  "tabula-unsupported-component": ({ node: _node, ...props }: PreviewDocsRawComponentProps) => (
    <PreviewUnsupportedComponent {...props} />
  ),
} as unknown as Components;
