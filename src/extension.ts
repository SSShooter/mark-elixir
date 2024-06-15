import * as vscode from 'vscode';
import { markdownToMindElixir } from './core';

export function activate(context: vscode.ExtensionContext) {
  const o = vscode.commands.registerCommand(
    'mind-elixir.markdown',
    markdownToMindElixir(context)
  );
  context.subscriptions.push(  o);
}

// This method is called when your extension is deactivated
export function deactivate() {}
