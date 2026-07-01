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

Run the deployed collaboration path after `tabula.md` and `rooms.tabula.md` are live:

```sh
npm run test:browser:production:collab
```

This opens the deployed app, starts a session, joins the invite link in a second browser context, verifies live
Enter/backspace/line-merge sync, checks presence UI, checks peer `state-init`, and confirms hosted Firebase
recovery after every live-room tab closes.

Run the deployed encrypted snapshot path after `tabula.md` and `json.tabula.md` are live:

```sh
npm run test:browser:production:json-share
```

This opens the deployed app, exports a `#json` snapshot link, opens that link in a separate browser context, confirms
the replace prompt, and verifies the imported Markdown content.

Suite map:

- `workspace`: first screen, tabs, empty state, share, templates, and view-mode chrome.
- `editor-preview`: editor commands, Markdown preview rendering, toolbar behavior, and comments.
- `layout`: tab persistence, import collision, document chrome, split layout, and side-panel alignment.
- `panels`: project menu, files, outline, comments, switcher, and right-panel file actions.
- `collaboration`: local and deployed live-room sync.
- `json-share`: encrypted snapshot export and replace/import.
- `performance`: long-document split resize hot-path regression checks.

When adding coverage, prefer the smallest suite that owns the product surface. Add shared browser helpers to
`support/runtime.mjs` only when more than one suite needs them.
