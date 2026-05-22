# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
