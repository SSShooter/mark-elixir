import * as vscode from 'vscode';
import { markdownToMindElixir } from './core';

export function activate(context: vscode.ExtensionContext) {
  const md = vscode.commands.registerCommand(
    'mind-elixir.markdown',
    markdownToMindElixir(context)
  ); 
  context.subscriptions.push(md);
}

// This method is called when your extension is deactivated
export function deactivate() {}
