<h1 align="center">Tabula.md</h1>

<p align="center">
  A local-first Markdown workspace where people and AI agents can edit the same files.
  <br />
  No account or platform workspace required.
</p>

<p align="center"><a href="https://tabula.md">Open Tabula.md</a></p>

<p align="center">
  <a href="https://tabula.md" target="_blank" rel="noopener">
    <img
      src=".github/assets/tabula-product-demo.gif"
      alt="Tabula.md showing Markdown editing, split preview, files, and outline"
      width="960"
    />
  </a>
</p>

## Why Tabula.md

- Open a Markdown workspace without signing up.
- Keep Markdown files as the source of truth.
- Share the whole workspace with one encrypted room link.
- Let people and AI agents edit through the same collaboration model.

Tabula.md is in public preview. The hosted app at
[tabula.md](https://tabula.md) is the reference deployment.

## Features

- GitHub Flavored Markdown editing and preview.
- Files, outline, and comments beside the editor.
- Browser autosave and local restore.
- Dark, light, and system themes.
- Encrypted live collaboration by room link.
- Encrypted Export links for point-in-time handoff.

## Run Locally

```sh
npm install
npm run dev
```

Open `http://localhost:5173`. Local editing works without any hosted service.
Live collaboration and Export links require their respective optional services.

See [Development](DEVELOPMENT.md) for commands and architecture.

## Related Repositories

- [`tabula-room`](https://github.com/tabula-md/tabula-room): encrypted live
  collaboration relay.
- [`tabula-json`](https://github.com/tabula-md/tabula-json): encrypted Export
  link blob store.

## Project

- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)
- [Privacy](PRIVACY.md)

## Backed By

Tabula.md is backed by
[Marker Inc Korea](https://github.com/Marker-Inc-Korea).

## License

MIT. See `LICENSE`.
