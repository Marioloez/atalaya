# Sqlitex

A minimal, audit-friendly SQLite viewer for VSCode.

Built because supply-chain risks in third-party VSCode extensions are real. This one keeps the dependency surface tiny: a single runtime dependency (`sql.js` — the official SQLite compiled to WebAssembly), no native code, no telemetry, no network access.

## Features

- Opens `.db`, `.sqlite`, `.sqlite3` files as a custom editor
- Sidebar lists tables; click any to browse rows with pagination (100 per page)
- SQL query editor tab — write arbitrary SQL, `Ctrl/Cmd+Enter` to run
- **Double-click any cell** in the Data tab to edit it in place
- Mutating statements (SQL or inline edits) mark the document as modified; explicit `Cmd+S` writes to disk
- Native undo/redo for executed queries and inline edits
- Revert support reloads from disk
- Read-only fallback for views, tables without primary key, and BLOB columns
- Export tables and query results to CSV or JSON (BLOBs as base64)
- Webview locked down with strict CSP and per-load nonce

## Roadmap

- [ ] Schema viewer (columns, types, indexes, foreign keys)
- [ ] Filter and sort by column
- [ ] Add / delete rows from the Data tab

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
