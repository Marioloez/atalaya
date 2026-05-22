import * as vscode from "vscode";
import { SqliteService } from "../sqlite/service";

interface SqlitexDocument extends vscode.CustomDocument {
  readonly service: SqliteService;
}

interface IncomingMessage {
  type: "listTables" | "getTableData";
  payload?: unknown;
}

interface GetTableDataPayload {
  table: string;
  limit: number;
  offset: number;
}

export class SqliteEditorProvider
  implements vscode.CustomReadonlyEditorProvider<SqlitexDocument>
{
  public static readonly viewType = "sqlitex.viewer";

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

  constructor(private readonly context: vscode.ExtensionContext) {}

  async openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken,
  ): Promise<SqlitexDocument> {
    const buffer = await vscode.workspace.fs.readFile(uri);
    const service = await SqliteService.create(this.context, buffer);
    return {
      uri,
      service,
      dispose() {
        service.close();
      },
    };
  }

  async resolveCustomEditor(
    document: SqlitexDocument,
    panel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "media"),
      ],
    };
    panel.webview.html = this.renderHtml(panel.webview);

    panel.webview.onDidReceiveMessage((msg: IncomingMessage) => {
      try {
        this.handleMessage(document, panel, msg);
      } catch (err) {
        panel.webview.postMessage({
          type: "error",
          payload: { message: err instanceof Error ? err.message : String(err) },
        });
      }
    });
  }

  private handleMessage(
    document: SqlitexDocument,
    panel: vscode.WebviewPanel,
    msg: IncomingMessage,
  ): void {
    switch (msg.type) {
      case "listTables": {
        const tables = document.service.listTables();
        panel.webview.postMessage({ type: "tables", payload: tables });
        return;
      }
      case "getTableData": {
        const { table, limit, offset } = msg.payload as GetTableDataPayload;
        const data = document.service.getTableData(table, limit, offset);
        panel.webview.postMessage({
          type: "tableData",
          payload: { table, ...data },
        });
        return;
      }
    }
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
    ].join("; ");

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <link rel="stylesheet" href="${mediaUri("viewer.css")}" />
    <title>Sqlitex</title>
  </head>
  <body>
    <aside id="sidebar">
      <h2>Tables</h2>
      <ul id="tables"></ul>
    </aside>
    <main id="main">
      <header id="topbar">
        <span id="table-title">Select a table</span>
        <span id="pager"></span>
      </header>
      <div id="table-wrap">
        <table id="data"></table>
      </div>
    </main>
    <script nonce="${nonce}" src="${mediaUri("viewer.js")}"></script>
  </body>
</html>`;
  }
}

function randomNonce(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 32; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}
