# Contributing

Thanks for helping improve Tabula.md.

## Before You Start

- Use GitHub Issues for bugs and focused feature proposals.
- Keep pull requests small and limited to one reviewable concern.
- Do not include document content, room links, keys, or other private data in
  issues, logs, screenshots, or fixtures.
- Report vulnerabilities privately through [Security](SECURITY.md).

## Development

```sh
npm install
npm run dev
```

Before opening a pull request, run the checks relevant to your change:

```sh
npm run lint:fast
npm test
npm run build
```

Use a focused browser suite for UI or collaboration changes. Available commands
are listed in [Development](DEVELOPMENT.md).

## Pull Requests

Explain the problem, the change, how you validated it, and any remaining risk.
Include screenshots or recordings only when the change is visual.
