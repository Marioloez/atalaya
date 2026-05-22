# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
