# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.8] - 2026-05-21

### Added

- Subtle zebra striping on data rows for easier reading
- Type-aware coloring of data cells: integers and reals in blue with
  right-aligned tabular numerals, dates in green, BLOBs muted italic
- Header markers in the Data tab: amber square before primary-key
  columns, muted asterisk after NOT NULL columns
- Sorted column is highlighted across the entire column (not just the
  header) so the active sort is visible while scrolling
- Filter input gains an amber tint and border when it has an active
  value, making active filters scannable at a glance

### Notes

- All visuals use existing `vscode-*` CSS variables, so themes (dark,
  light, high-contrast) keep working without any extra CSS
- No new dependencies — the project still ships with exactly one runtime
  dependency (sql.js)

## [0.0.7] - 2026-05-21

### Changed

- New extension icon: data grid illuminated by a light beam, with a
  single highlighted cell as the focal point. Replaces the earlier
  placeholder grid icon. Square 256x256, navy background.

## [0.0.6] - 2026-05-21

### Fixed

- README badges: `shields.io` retired the `visual-studio-marketplace/*`
  endpoints and they now render as "retired badge" placeholders. Replaced
  the two dynamic badges with a single static "VS Code Marketplace" link
  badge so the listing renders cleanly.

## [0.0.5] - 2026-05-21

### Added

- Click any column header in the Data tab to sort ascending (▲), click
  again for descending (▼), and a third time to clear the sort
- Filter row beneath the headers — one input per column, `LIKE '%text%'`
  applied as you type with a 250 ms debounce; `Esc` clears one filter,
  `Enter` flushes the debounce immediately
- Filtered total row count reflects the active filters
- Schema-stable refresh: when only data changes, only the table body is
  re-rendered, so filter inputs keep focus and content

### Changed

- `getTableData` accepts optional `sortColumn`, `sortDirection`, and
  `filters[]`; all filter values are bound via prepared statements

## [0.0.4] - 2026-05-21

### Added

- Export table contents to CSV or JSON via buttons in the Data tab header
- Export query results to CSV or JSON via buttons in the Query tab
- BLOB values are base64-encoded in both formats; NULLs become empty CSV
  fields and JSON `null`
- Native `Save As...` dialog with sensible default file name

## [0.0.3] - 2026-05-21

### Added

- Inline cell editing in the Data tab — **double-click** any cell to edit
- `Enter` saves, `Esc` cancels, blur saves
- Empty input + nullable column = `NULL`; numeric columns reject non-numbers
- Read-only badge for views and tables without primary key or rowid
- BLOB cells displayed as `<BLOB N bytes>` and are not editable

### Changed

- `getTableData` now returns table metadata (columns, types, PK info) and
  per-row key values for safe `UPDATE WHERE` targeting
- `SqliteEditorProvider` extracted shared dirty-tracking helper used by both
  the SQL query editor and the inline cell editor

## [0.0.2] - 2026-05-21

### Added

- SQL query editor tab with `Ctrl/Cmd+Enter` to execute
- Document dirty tracking for mutating statements (INSERT/UPDATE/DELETE/DDL)
- Native undo/redo via VSCode (snapshot-based; per-mutation memory cost)
- Explicit save (`Cmd+S`) writes the in-memory DB to disk
- Revert (`File → Revert File`) reloads the file from disk
- Hot-exit backup support

### Changed

- Migrated from `CustomReadonlyEditorProvider` to `CustomEditorProvider`
- Topbar reorganized into tabbed UI (Data / Query)

## [0.0.1] - 2026-05-21

### Added

- Custom editor provider for `.db`, `.sqlite`, `.sqlite3` files
- Sidebar listing tables in the opened database
- Paginated data view (100 rows per page) with prev / next controls
- Strict CSP with per-load nonce on the webview
