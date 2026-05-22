import * as vscode from "vscode";
import { SqliteEditorProvider } from "./editor/sqliteEditor";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(SqliteEditorProvider.register(context));
}

export function deactivate(): void {
  // no-op
}
