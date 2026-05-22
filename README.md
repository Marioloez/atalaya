# Sqlitex

A minimal, audit-friendly SQLite viewer for VSCode.

Built because supply-chain risks in third-party VSCode extensions are real. This one keeps the dependency surface tiny: a single runtime dependency (`sql.js` — the official SQLite compiled to WebAssembly), no native code, no telemetry, no network access.

## Features (MVP)

- Opens `.db`, `.sqlite`, `.sqlite3` files as a custom editor
- Lists tables in a sidebar
- Shows rows with pagination (100 per page)
- Webview locked down with strict CSP and per-load nonce

## Roadmap

- [ ] SQL query editor (SELECT first, writes behind an explicit toggle)
- [ ] In-place cell editing
- [ ] Schema viewer (columns, types, indexes, foreign keys)
- [ ] Export table or query result to CSV / JSON
- [ ] Filter and sort by column

## Development

```bash
npm install
npm run compile
# Open this folder in VSCode and press F5 to launch an Extension Development Host
```

In the Extension Development Host window, open any `.db` / `.sqlite` / `.sqlite3` file.

## Package as `.vsix`

```bash
npm run package
code --install-extension sqlitex-0.0.1.vsix
```

## Security posture

- **One runtime dependency**: `sql.js` (WASM build of official SQLite)
- **No native modules**: no `node-gyp`, no platform-specific compilation
- **Strict CSP** in the webview: `default-src 'none'` with per-load script nonce
- **No network calls**, no telemetry, no remote resource loading
- **Open source**, MIT — audit every line

## License

MIT
