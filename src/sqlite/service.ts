import * as path from "path";
import * as vscode from "vscode";
import initSqlJs, { Database, SqlJsStatic } from "sql.js";

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
}

export interface ColumnInfo {
  name: string;
  type: string;
  notnull: boolean;
  pk: number;
}

export interface TableMetadata {
  isView: boolean;
  hasRowid: boolean;
  columns: ColumnInfo[];
  keyColumns: string[];
  editable: boolean;
}

export interface TableDataResult extends QueryResult {
  total: number;
  metadata: TableMetadata;
  keyValues: unknown[][];
}

export interface RunQueryResult {
  results: QueryResult[];
  rowsModified: number;
  mutated: boolean;
  durationMs: number;
}

export interface UpdateCellResult {
  rowsModified: number;
  mutated: boolean;
}

const NON_READ_TOKEN =
  /\b(insert|update|delete|replace|create|drop|alter|truncate|reindex|vacuum|attach|detach)\b/i;

export class SqliteService {
  private sql: SqlJsStatic;
  private db: Database;

  private constructor(sql: SqlJsStatic, db: Database) {
    this.sql = sql;
    this.db = db;
  }

  static async create(
    context: vscode.ExtensionContext,
    data: Uint8Array,
  ): Promise<SqliteService> {
    const wasmDir = path.join(
      context.extensionPath,
      "node_modules",
      "sql.js",
      "dist",
    );
    const sql = await initSqlJs({
      locateFile: (file: string) => path.join(wasmDir, file),
    });
    const db = new sql.Database(data);
    return new SqliteService(sql, db);
  }

  listTables(): string[] {
    const res = this.db.exec(
      `SELECT name FROM sqlite_master
       WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
       ORDER BY name`,
    );
    if (res.length === 0) return [];
    return res[0].values.map((row) => String(row[0]));
  }

  getTableMetadata(table: string): TableMetadata {
    const quoted = quoteIdent(table);

    const typeRes = this.db.exec(
      `SELECT type FROM sqlite_master WHERE name = '${table.replace(/'/g, "''")}' LIMIT 1`,
    );
    const isView =
      typeRes.length > 0 && String(typeRes[0].values[0]?.[0]) === "view";

    let hasRowid = false;
    if (!isView) {
      try {
        this.db.exec(`SELECT rowid FROM ${quoted} LIMIT 0`);
        hasRowid = true;
      } catch {
        hasRowid = false;
      }
    }

    const infoRes = this.db.exec(`PRAGMA table_info(${quoted})`);
    const columns: ColumnInfo[] =
      infoRes.length === 0
        ? []
        : infoRes[0].values.map((row) => ({
            name: String(row[1]),
            type: String(row[2] ?? ""),
            notnull: Number(row[3]) === 1,
            pk: Number(row[5] ?? 0),
          }));

    const pkColumns = columns
      .filter((c) => c.pk > 0)
      .sort((a, b) => a.pk - b.pk)
      .map((c) => c.name);

    let keyColumns: string[] = [];
    if (!isView) {
      if (hasRowid) {
        keyColumns = ["rowid"];
      } else if (pkColumns.length > 0) {
        keyColumns = pkColumns;
      }
    }

    return {
      isView,
      hasRowid,
      columns,
      keyColumns,
      editable: keyColumns.length > 0,
    };
  }

  getTableData(
    table: string,
    limit: number,
    offset: number,
  ): TableDataResult {
    const metadata = this.getTableMetadata(table);
    const quoted = quoteIdent(table);

    const countRes = this.db.exec(`SELECT COUNT(*) FROM ${quoted}`);
    const total = Number(countRes[0]?.values[0]?.[0] ?? 0);

    const safeLimit = Math.max(0, Math.min(1000, Math.floor(limit)));
    const safeOffset = Math.max(0, Math.floor(offset));

    const keySelect =
      metadata.keyColumns.length > 0
        ? metadata.keyColumns.map(quoteIdent).join(", ") + ", "
        : "";
    const dataRes = this.db.exec(
      `SELECT ${keySelect}* FROM ${quoted} LIMIT ${safeLimit} OFFSET ${safeOffset}`,
    );

    if (dataRes.length === 0) {
      return {
        columns: [],
        rows: [],
        total,
        metadata,
        keyValues: [],
      };
    }

    const keyCount = metadata.keyColumns.length;
    const allColumns = dataRes[0].columns;
    const allRows = dataRes[0].values as unknown[][];

    const keyValues: unknown[][] = [];
    const rows: unknown[][] = [];
    for (const row of allRows) {
      keyValues.push(row.slice(0, keyCount));
      rows.push(row.slice(keyCount));
    }

    return {
      columns: allColumns.slice(keyCount),
      rows,
      total,
      metadata,
      keyValues,
    };
  }

  getAllRows(table: string): QueryResult {
    const quoted = quoteIdent(table);
    const res = this.db.exec(`SELECT * FROM ${quoted}`);
    if (res.length === 0) {
      return { columns: [], rows: [] };
    }
    return {
      columns: res[0].columns,
      rows: res[0].values as unknown[][],
    };
  }

  runQuery(sql: string): RunQueryResult {
    const started = Date.now();
    const execResult = this.db.exec(sql);
    const rowsModified = this.db.getRowsModified();
    const mutated = rowsModified > 0 || NON_READ_TOKEN.test(stripComments(sql));
    return {
      results: execResult.map((r) => ({
        columns: r.columns,
        rows: r.values as unknown[][],
      })),
      rowsModified,
      mutated,
      durationMs: Date.now() - started,
    };
  }

  updateCell(
    table: string,
    column: string,
    newValue: unknown,
    keyColumns: string[],
    keyValues: unknown[],
  ): UpdateCellResult {
    if (keyColumns.length === 0) {
      throw new Error("Cannot update: table has no rowid and no primary key");
    }
    if (keyColumns.length !== keyValues.length) {
      throw new Error("keyColumns and keyValues length mismatch");
    }
    const setClause = `${quoteIdent(column)} = ?`;
    const whereClause = keyColumns
      .map((c) => `${quoteIdent(c)} = ?`)
      .join(" AND ");
    const sql = `UPDATE ${quoteIdent(table)} SET ${setClause} WHERE ${whereClause}`;

    const stmt = this.db.prepare(sql);
    try {
      stmt.run([newValue as never, ...(keyValues as never[])]);
    } finally {
      stmt.free();
    }
    const rowsModified = this.db.getRowsModified();
    return { rowsModified, mutated: rowsModified > 0 };
  }

  snapshot(): Uint8Array {
    return this.db.export();
  }

  restore(buffer: Uint8Array): void {
    this.db.close();
    this.db = new this.sql.Database(buffer);
  }

  export(): Uint8Array {
    return this.db.export();
  }

  close(): void {
    this.db.close();
  }
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function stripComments(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}
