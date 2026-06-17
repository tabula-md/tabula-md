# Browser Smoke Tests

`npm run test:browser` runs the full browser smoke suite. The entrypoint is intentionally tiny:

- `../browser-smoke.mjs`: starts the suite runner.
- `support/runtime.mjs`: owns Playwright launch, local server lifecycle, shared assertions, and page helpers.
- `suites/*.mjs`: product-area smoke contracts.

Run a focused suite while developing:

```sh
npm run test:browser -- --suite=editor-preview
TABULA_BROWSER_SMOKE_SUITE=panels npm run test:browser
```

Suite map:

- `workspace`: first screen, tabs, empty state, share, templates, and view-mode chrome.
- `editor-preview`: editor commands, Markdown preview rendering, toolbar behavior, and comments.
- `layout`: tab persistence, import collision, document chrome, split layout, and side-panel alignment.
- `panels`: project menu, files, outline, comments, switcher, and right-panel file actions.
- `collaboration`: local live-room sync.

When adding coverage, prefer the smallest suite that owns the product surface. Add shared browser helpers to
`support/runtime.mjs` only when more than one suite needs them.
