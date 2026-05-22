import * as crypto from "crypto";
import * as vscode from "vscode";
import {
  ColumnFilter,
  QueryResult,
  SqliteService,
} from "../sqlite/service";
import { ExportFormat, toCsv, toJson } from "../export/format";

class AtalayaDocument implements vscode.CustomDocument {
  constructor(
    public readonly uri: vscode.Uri,
    public readonly service: SqliteService,
  ) {}

  dispose(): void {
    this.service.close();
  }
}

interface IncomingMessage {
  type:
    | "listTables"
    | "getSchema"
    | "getTableData"
    | "runQuery"
    | "updateCell"
    | "exportTable"
    | "exportQuery";
  payload?: unknown;
}

interface GetTableDataPayload {
  table: string;
  limit: number;
  offset: number;
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  filters?: ColumnFilter[];
}

interface RunQueryPayload {
  sql: string;
}

interface UpdateCellPayload {
  table: string;
  column: string;
  newValue: unknown;
  keyColumns: string[];
  keyValues: unknown[];
}

interface ExportTablePayload {
  table: string;
  format: ExportFormat;
}

interface ExportQueryPayload {
  columns: string[];
  rows: unknown[][];
  format: ExportFormat;
  defaultName?: string;
}

export class SqliteEditorProvider
  implements vscode.CustomEditorProvider<AtalayaDocument>
{
  public static readonly viewType = "atalaya.viewer";

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      SqliteEditorProvider.viewType,
      new SqliteEditorProvider(context),
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      },
    );
  }

  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<
    vscode.CustomDocumentEditEvent<AtalayaDocument>
  >();
  public readonly onDidChangeCustomDocument =
    this._onDidChangeCustomDocument.event;

  private readonly panels = new WeakMap<AtalayaDocument, vscode.WebviewPanel>();

  constructor(private readonly context: vscode.ExtensionContext) {}

  async openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken,
  ): Promise<AtalayaDocument> {
    const buffer = await vscode.workspace.fs.readFile(uri);
    const service = await SqliteService.create(this.context, buffer);
    return new AtalayaDocument(uri, service);
  }

  async resolveCustomEditor(
    document: AtalayaDocument,
    panel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    this.panels.set(document, panel);
    panel.onDidDispose(() => this.panels.delete(document));

    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "media"),
      ],
    };
    panel.webview.html = this.renderHtml(panel.webview);

    panel.webview.onDidReceiveMessage(async (msg: IncomingMessage) => {
      try {
        await this.handleMessage(document, panel, msg);
      } catch (err) {
        panel.webview.postMessage({
          type: "error",
          payload: {
            message: err instanceof Error ? err.message : String(err),
          },
        });
      }
    });
  }

  private async handleMessage(
    document: AtalayaDocument,
    panel: vscode.WebviewPanel,
    msg: IncomingMessage,
  ): Promise<void> {
    switch (msg.type) {
      case "listTables": {
        panel.webview.postMessage({
          type: "tables",
          payload: document.service.listTables(),
        });
        return;
      }
      case "getSchema": {
        panel.webview.postMessage({
          type: "schema",
          payload: document.service.getSchema(),
        });
        return;
      }
      case "getTableData": {
        const { table, limit, offset, sortColumn, sortDirection, filters } =
          msg.payload as GetTableDataPayload;
        const data = document.service.getTableData(table, limit, offset, {
          sortColumn,
          sortDirection,
          filters,
        });
        panel.webview.postMessage({
          type: "tableData",
          payload: { table, ...data },
        });
        return;
      }
      case "runQuery": {
        const { sql } = msg.payload as RunQueryPayload;
        const result = this.executeWithDirtyTracking(document, "Run SQL", () =>
          document.service.runQuery(sql),
        );
        panel.webview.postMessage({ type: "queryResult", payload: result });
        return;
      }
      case "updateCell": {
        const payload = msg.payload as UpdateCellPayload;
        const result = this.executeWithDirtyTracking(
          document,
          `Edit ${payload.table}.${payload.column}`,
          () =>
            document.service.updateCell(
              payload.table,
              payload.column,
              payload.newValue,
              payload.keyColumns,
              payload.keyValues,
            ),
        );
        panel.webview.postMessage({
          type: "updateCellResult",
          payload: {
            ...payload,
            rowsModified: result.rowsModified,
            mutated: result.mutated,
          },
        });
        return;
      }
      case "exportTable": {
        const { table, format } = msg.payload as ExportTablePayload;
        const data = document.service.getAllRows(table);
        await this.exportToFile(`${table}.${format}`, data, format);
        return;
      }
      case "exportQuery": {
        const { columns, rows, format, defaultName } =
          msg.payload as ExportQueryPayload;
        await this.exportToFile(
          defaultName ?? `query.${format}`,
          { columns, rows },
          format,
        );
        return;
      }
    }
  }

  private async exportToFile(
    defaultName: string,
    data: QueryResult,
    format: ExportFormat,
  ): Promise<void> {
    const content =
      format === "csv"
        ? toCsv(data.columns, data.rows)
        : toJson(data.columns, data.rows);

    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(defaultName),
      filters:
        format === "csv" ? { "CSV": ["csv"] } : { "JSON": ["json"] },
    });
    if (!uri) return;

    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf-8"));
    vscode.window.showInformationMessage(
      `Exported ${data.rows.length} row(s) to ${uri.fsPath}`,
    );
  }

  private executeWithDirtyTracking<T extends { mutated: boolean }>(
    document: AtalayaDocument,
    label: string,
    run: () => T,
  ): T {
    const before = document.service.snapshot();
    const result = run();
    if (result.mutated) {
      const after = document.service.snapshot();
      this._onDidChangeCustomDocument.fire({
        document,
        label,
        undo: () => {
          document.service.restore(before);
          this.notifySchemaChanged(document);
        },
        redo: () => {
          document.service.restore(after);
          this.notifySchemaChanged(document);
        },
      });
      this.notifySchemaChanged(document);
    }
    return result;
  }

  private notifySchemaChanged(document: AtalayaDocument): void {
    const panel = this.panels.get(document);
    panel?.webview.postMessage({ type: "schemaChanged" });
  }

  saveCustomDocument(
    document: AtalayaDocument,
    _token: vscode.CancellationToken,
  ): Thenable<void> {
    const buffer = document.service.export();
    return Promise.resolve(vscode.workspace.fs.writeFile(document.uri, buffer));
  }

  async saveCustomDocumentAs(
    document: AtalayaDocument,
    destination: vscode.Uri,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    const buffer = document.service.export();
    await vscode.workspace.fs.writeFile(destination, buffer);
  }

  async revertCustomDocument(
    document: AtalayaDocument,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    const buffer = await vscode.workspace.fs.readFile(document.uri);
    document.service.restore(buffer);
    this.notifySchemaChanged(document);
  }

  async backupCustomDocument(
    document: AtalayaDocument,
    context: vscode.CustomDocumentBackupContext,
    _token: vscode.CancellationToken,
  ): Promise<vscode.CustomDocumentBackup> {
    const buffer = document.service.export();
    await vscode.workspace.fs.writeFile(context.destination, buffer);
    return {
      id: context.destination.toString(),
      delete: async () => {
        try {
          await vscode.workspace.fs.delete(context.destination);
        } catch {
          // backup may already be gone
        }
      },
    };
  }

  private renderHtml(webview: vscode.Webview): string {
    const mediaUri = (name: string): vscode.Uri =>
      webview.asWebviewUri(
        vscode.Uri.joinPath(this.context.extensionUri, "media", name),
      );
    const nonce = randomNonce();
    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource}`,
      `script-src 'nonce-${nonce}'`,
      `img-src ${webview.cspSource} data:`,
      `font-src ${webview.cspSource}`,
      // default-src is NOT a fallback for form-action or base-uri,
      // so we lock them down explicitly.
      "form-action 'none'",
      "base-uri 'none'",
    ].join("; ");

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <link rel="stylesheet" href="${mediaUri("viewer.css")}" />
    <title>Atalaya</title>
  </head>
  <body>
    <aside id="sidebar">
      <h2>Tables</h2>
      <ul id="tables"></ul>
    </aside>
    <main id="main">
      <header id="topbar">
        <nav id="tabs">
          <button class="tab active" data-tab="data" type="button">Data</button>
          <button class="tab" data-tab="query" type="button">Query</button>
        </nav>
        <span id="pager"></span>
      </header>

      <section id="tab-data" class="tab-panel active">
        <div id="data-header">
          <span id="table-title">Select a table</span>
          <span id="data-badge"></span>
          <div class="spacer"></div>
          <div class="export-actions" id="data-export" hidden>
            <button class="export-btn" data-format="csv" type="button">Export CSV</button>
            <button class="export-btn" data-format="json" type="button">Export JSON</button>
          </div>
        </div>
        <div id="table-wrap">
          <table id="data"></table>
        </div>
      </section>

      <section id="tab-query" class="tab-panel">
        <div id="query-controls">
          <div id="sql-input-wrap">
            <textarea
              id="sql-input"
              spellcheck="false"
              autocomplete="off"
              placeholder="SELECT * FROM ..."
            ></textarea>
            <ul id="sql-suggest" hidden></ul>
          </div>
          <div id="query-actions">
            <button id="run-btn" type="button">Run · Ctrl/Cmd+Enter</button>
            <span id="query-status"></span>
            <div class="spacer"></div>
            <div class="export-actions" id="query-export" hidden>
              <button class="export-btn" data-format="csv" data-target="query" type="button">Export CSV</button>
              <button class="export-btn" data-format="json" data-target="query" type="button">Export JSON</button>
            </div>
          </div>
        </div>
        <div id="query-results"></div>
      </section>
    </main>
    <script nonce="${nonce}" src="${mediaUri("viewer.js")}"></script>
  </body>
</html>`;
  }
}

function randomNonce(): string {
  // 16 bytes of CSPRNG → 22 base64 chars after stripping padding.
  // CSP spec requires nonces to be unguessable; Math.random() is not
  // cryptographically secure, so use crypto.randomBytes instead.
  return crypto.randomBytes(16).toString("base64").replace(/=+$/, "");
}
