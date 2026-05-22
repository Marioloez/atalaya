import * as path from "path";
import * as vscode from "vscode";
import initSqlJs, { Database, SqlJsStatic } from "sql.js";

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
}

export interface TableDataResult extends QueryResult {
  total: number;
}

export interface RunQueryResult {
  results: QueryResult[];
  rowsModified: number;
  mutated: boolean;
  durationMs: number;
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
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
       ORDER BY name`,
    );
    if (res.length === 0) return [];
    return res[0].values.map((row) => String(row[0]));
  }

  getTableData(
    table: string,
    limit: number,
    offset: number,
  ): TableDataResult {
    const quoted = `"${table.replace(/"/g, '""')}"`;
    const countRes = this.db.exec(`SELECT COUNT(*) FROM ${quoted}`);
    const total = Number(countRes[0]?.values[0]?.[0] ?? 0);

    const safeLimit = Math.max(0, Math.min(1000, Math.floor(limit)));
    const safeOffset = Math.max(0, Math.floor(offset));
    const dataRes = this.db.exec(
      `SELECT * FROM ${quoted} LIMIT ${safeLimit} OFFSET ${safeOffset}`,
    );
    if (dataRes.length === 0) {
      return { columns: [], rows: [], total };
    }
    return {
      columns: dataRes[0].columns,
      rows: dataRes[0].values as unknown[][],
      total,
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

function stripComments(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}
