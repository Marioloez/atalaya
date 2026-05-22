# Sqlitex

[![Version](https://img.shields.io/visual-studio-marketplace/v/Marioloez.sqlitex.svg)](https://marketplace.visualstudio.com/items?itemName=Marioloez.sqlitex)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/Marioloez.sqlitex.svg)](https://marketplace.visualstudio.com/items?itemName=Marioloez.sqlitex)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An **audit-friendly** SQLite viewer for VSCode. One runtime dependency, no native code, no telemetry.

Open `.db`, `.sqlite`, `.sqlite3` files like any other file in your editor. Browse tables, write SQL, edit rows in place, export to CSV / JSON. That's it.

## Why this exists

Most VSCode SQLite extensions bundle dozens of npm dependencies, native modules, or both. That's a real supply-chain surface for something that just needs to read a file. Sqlitex ships with **one runtime dependency** — [sql.js](https://github.com/sql-js/sql.js), the official SQLite compiled to WebAssembly — and zero native code. Auditing the source is straightforward.

## Features

- Open `.db`, `.sqlite`, `.sqlite3` files as a custom editor
- Sidebar lists tables; click any to browse rows with pagination
- **SQL query editor** tab — `Ctrl/Cmd+Enter` to run
- **Double-click** any data cell to edit in place
- Mutating statements (SQL or inline edits) mark the document as modified; explicit `Cmd+S` writes to disk
- Native **undo / redo** for executed queries and inline edits
- **Sort** by clicking column headers (▲ / ▼)
- **Filter** any column with `LIKE '%text%'` from a filter row beneath the headers
- **Export** tables or query results to CSV / JSON (BLOBs as base64)
- Read-only fallback for views, tables without primary key, and BLOB columns
- Webview locked down with strict CSP and per-load nonce — no remote resources

## Installation

### From the Marketplace

Search for **Sqlitex** in the VSCode Extensions view, or install via the command line:

```bash
code --install-extension Marioloez.sqlitex
```

### From a `.vsix` file

Download a release from the [Releases](https://github.com/Marioloez/sqlitex/releases) page and install:

```bash
code --install-extension sqlitex-<version>.vsix
```

## Usage

1. Open any `.db`, `.sqlite`, or `.sqlite3` file in VSCode.
2. The Sqlitex editor opens automatically.
3. Click a table on the left to browse rows.
4. Switch to the **Query** tab to run arbitrary SQL.
5. **Double-click** any cell in the Data tab to edit it. `Enter` saves, `Esc` cancels.
6. Use the **Export CSV / JSON** buttons to dump the current table or query result.
7. `Cmd+S` writes pending changes back to the file. Close without saving to discard.

## Security posture

- **One runtime dependency**: `sql.js` (WASM build of official SQLite)
- **No native modules**: no `node-gyp`, no platform-specific compilation
- **Strict CSP** in the webview: `default-src 'none'` + per-load script nonce
- **No network calls**, no telemetry, no remote resource loading
- **MIT licensed**, open source — audit every line

## Known limitations

- Undo history holds full snapshots of the database in memory; for very large databases (>100 MB) consider saving and reopening to free memory after many edits
- Filter only supports `LIKE '%value%'` (contains). For range or equality operators use the SQL editor
- Tables without a primary key or `rowid` cannot be inline-edited; use the SQL editor

## Development

```bash
git clone https://github.com/Marioloez/sqlitex.git
cd sqlitex
npm install
npm run compile
# Open the folder in VSCode and press F5 to launch an Extension Development Host
```

## Roadmap

- Schema viewer (columns, types, indexes, foreign keys)
- Add / delete rows from the Data tab
- Undo history memory cap for large databases

## License

[MIT](LICENSE)
