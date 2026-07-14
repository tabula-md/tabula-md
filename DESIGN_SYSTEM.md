# Tabula.md Interface Design System

## Principle

Tabula.md is a quiet Markdown workspace. The document is the primary visual
object; application chrome stays compact, predictable, and subordinate.

## Borderless Chrome

- Toolbars, popovers, menus, panel headers, segmented controls, and compact
  inputs do not use static outline borders.
- Separate layers with spacing, `--surface-*` backgrounds, and
  `--shadow-popover` where elevation is necessary.
- Use `--surface-hover` for hover and `--surface-active` for selected state.
- Dividers inside command chrome are spacing, not painted lines.
- Resize guides may appear while hovering, focusing, or dragging, but stay
  hidden at rest.

## Icon-First Commands

- Familiar, repeated workspace commands use icons without persistent labels.
- Every icon-only command keeps an accessible name and a concise tooltip.
- Visible text remains appropriate inside menus, forms, confirmations,
  destructive actions, and unfamiliar one-off workflows.
- Right-panel Files, Outline, and Comments tabs are icon-only. Aggregate counts
  do not appear on navigation icons, status bars, or file rows. A count is only
  shown when its nearby label gives it a specific action and scope, such as a
  collapsed `Resolved` section. Live state may appear as a compact dot.

## Allowed Lines

Static lines are reserved for meaning that cannot be expressed as chrome
state:

- keyboard focus rings;
- Markdown content such as tables, quotes, horizontal rules, and task controls;
- editor selections, comment anchors, and collaboration carets;
- overlap separation for participant avatars;
- transient resize and drag feedback.

These exceptions must not be reused as decoration for containers or cards.

## Density And Shape

- The spacing scale is `4 / 8 / 12 / 16 / 24px`. Two-pixel gaps are reserved
  for controls grouped inside one shared surface.
- Desktop icon controls are `28px`. Fields and menu rows are `34px`. Touch
  controls and touch rows are `44px`.
- Desktop top and document-command bands are `50px` (`34px` content with
  `8px` outer spacing). The desktop status band is `42px` (`34px` content with
  `4px` outer spacing).
- At the tablet breakpoint, the two-row document-command band is `88px`
  (`34 + 34 + 4px gap + 8px` outer spacing on both sides). At the mobile
  breakpoint, a single command/status band is `52px` and a two-row command
  band is `100px`.
- UI icons use `14 / 16 / 18px` sizes.
- Controls use a `7px` radius, popovers and grouped surfaces use `8px`, modal
  surfaces use `10px`, and pills use a full radius.
- Avoid cards inside panels. Use one panel surface and row-level hover states.
- Do not introduce a visible label only to explain a familiar icon; improve the
  tooltip or accessible name instead.

## UI Typography

- UI captions use `11px`; secondary UI uses `12px`; controls and body copy use
  `13px`; surface headings use `15px`.
- UI font weights are `400 / 500 / 600`. Document content and participant
  initials may define their own semantic typography.
- Markdown preview typography is a separate content system and does not inherit
  compact chrome sizing.

## Interaction States

- Hover uses `--surface-hover`.
- A selected row on the workbench uses `--surface-muted`.
- A selected control inside a muted group uses `--surface-active`.
- Formatting toggles use `--accent-soft` with `--accent` foreground.
- Live state uses a status dot. It does not recolor unrelated controls.
- Destructive color is reserved for available destructive commands.
- Keyboard focus always uses the shared two-pixel focus ring. Components may
  not remove it without providing an equally visible semantic replacement.
- The shared focus ring is neutral rather than brand-colored. Inline rename
  keeps the existing tab or row surface and relies on its selected text and
  caret instead of outlining the parent or drawing a separate field.

## Document Commands

- Formatting keeps one stable order: history, block style, inline formatting,
  lists, insert, then overflow.
- The formatting surface responds to the width of its document lane, not the
  browser viewport. Commands moved out of a narrow surface remain available in
  overflow, and the toolbar never depends on horizontal scrolling.
- Write, Split, and Preview form one segmented view-mode control. Search and
  contextual view options form a separate utility group.
- View options only expose settings that affect the current mode. Search aligns
  with the source or preview lane it operates on.
- Preview headings keep internal IDs for Outline and Markdown links but do not
  expose permalink controls or mutate the app URL fragment.

## Surfaces And Layers

- `--surface-workbench` is the document canvas and desktop project context.
- `--surface-overlay` is reserved for menus, popovers, dialogs, and elevated
  content surfaces.
- Layer tokens are `base / chrome / panel / popover / modal / toast`. Components
  do not invent numeric z-index values.
- Menus use `34px` rows, `6px` padding, an `8px` radius, and the shared popover
  shadow. Popovers use `8-12px` padding. Modals use `24px` padding, a `10px`
  radius, and a scrim.
- Escape, outside-pointer dismissal, keyboard traversal, and trigger focus
  restoration are shared interaction behavior rather than component-specific
  conventions.
- A menu trigger is hidden when it has no available commands.

## Responsive Contract

- At `820px` and below, the Project Context becomes an overlay and the document
  toolbar may use two rows.
- At `560px` and below, touch controls and rows use `44px` targets and Project
  Context fills the viewport.
- Touch layouts rely on horizontal tab scrolling and do not spend two `44px`
  targets on redundant previous/next tab arrows.
- Larger document-layout breakpoints may exist for split-view reflow, but they
  do not redefine chrome control sizing.

## Motion And Copy

- Hover feedback uses `100ms`, popover transitions use `140ms`, and layout
  transitions use `180ms`.
- All non-essential motion is disabled when `prefers-reduced-motion` is set.
- Icon-only commands use the shared tooltip behavior and keep an accessible
  name. User-facing text and accessible names come from locale copy.
- `--text-muted` is for supplementary or decorative information, not required
  instructions or primary actions.
- A painted divider is allowed in a workflow only when it carries a semantic
  label such as `Or`; it may not outline a container.

## Document Rails

- Editor and preview rails reserve interaction space but do not look like
  containers. They use the workbench surface and no persistent separator line.
- The left rail is reserved for line numbers and bookmarks. Comments do not
  create a right gutter; selection creates anchored comments and clicking an
  anchored passage opens its thread.
- Bookmark actions appear on hover or when data exists.
- Active-line emphasis is one quiet content fill while the editor is focused;
  gutters may change text color but do not add borders or a second fill.
- A split divider has an invisible full-height hit area. Its full-height line is
  shown only on hover, keyboard focus, or drag.

## Review Contract

UI changes must be checked in light and dark themes and at desktop and mobile
breakpoints. Reviews should reject new static borders in application chrome
unless the change fits one of the explicit exceptions above.
