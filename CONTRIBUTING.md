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

Run the Tabula app:

```sh
npm run dev
```

Live collaboration uses the separate `tabula-room` server. For local
collaboration testing, run it in a sibling checkout:

```sh
git clone https://github.com/tabula-md/tabula-room.git ../tabula-room
cd ../tabula-room
npm install
npm run dev
```

Then run the app with the room URL:

```sh
VITE_TABULA_ROOM_URL=http://localhost:3002 npm run dev
```

Useful validation:

```sh
npm test
npm run build
npm run test:browser
```

## Release Notes

User-facing changes should be described in the pull request. Maintainers may
summarize them in GitHub Releases when a release is cut.
