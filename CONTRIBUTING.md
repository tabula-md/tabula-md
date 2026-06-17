# Contributing

Thanks for your interest in Tabula.md.

This guide is for public issues and pull requests.

## Before Opening Work

- Use GitHub Issues for public bug reports and feature requests.
- Search existing issues and pull requests before opening a new one.
- For security reports, do not open a public issue. Follow `SECURITY.md`.
- For larger changes, open an issue first so maintainers can discuss scope
  before you spend time on an implementation.

## Pull Requests

Small fixes can be opened as a regular GitHub pull request from a fork or
branch. Keep the change focused and include:

- What changed and why.
- How it was validated.
- Screenshots or video for visual UI changes.
- Any risks or follow-up work.

Maintainers may ask you to narrow scope, add tests, or split unrelated changes.
That feedback is about keeping review focused, not about ceremony.

## Development Setup

Install dependencies:

```sh
npm install
```

Run the web app:

```sh
npm run dev
```

Run the collaboration server:

```sh
npm run server
```

Run both locally:

```sh
npm run dev:all
```

Useful validation:

```sh
npm test
npm run build
npm run test:browser
```

## Release Notes

User-facing changes should be reflected in `CHANGELOG.md`. PR bodies are review
artifacts and should not be copied directly into the changelog.
