# Contributing

Thanks for helping improve Tabula.md.

## Before You Start

- Use GitHub Issues for bugs and focused feature proposals.
- Documentation fixes and small, well-understood bug fixes are welcome as pull
  requests.
- Discuss product behavior, new features, and architecture changes in an issue
  before writing code. Large unsolicited changes may be closed without review.
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

Explain why the change is needed, what changed, and how you verified it. Include
screenshots or recordings only when the change is visual.
