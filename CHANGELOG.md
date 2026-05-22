# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
