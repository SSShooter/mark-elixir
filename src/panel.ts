import * as vscode from 'vscode';
import { getFileContentAsString, saveFile } from './utils';
import { NodeObj } from 'mind-elixir';

export class MindElixirPanel {
  panel: vscode.WebviewPanel;
  html?: string;
  constructor(private readonly _extensionUri: vscode.Uri, name: string) {
    const panel = vscode.window.createWebviewPanel(
      'mindElixir',
      name,
      vscode.ViewColumn.One,
      {
        // Enable scripts in the webview
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );
    this.panel = panel;
  }
  async init(nodeData: NodeObj) {
    this.html = await this.getWebviewContent(nodeData);
    this.panel.webview.html = this.html;

    this.panel.webview.onDidReceiveMessage((message: any) => {
      switch (message.command) {
        case 'download':
          this.download();
          return;
      }
    });
  }
  async download() {
    saveFile(this.html!);
  }
  getWebviewContent = async (nodeData: NodeObj) => {
    const js = await getFileContentAsString(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.js')
    );
    const index = await getFileContentAsString(
      vscode.Uri.joinPath(this._extensionUri, 'public', 'index.css')
    );
    const hljs = await getFileContentAsString(
      vscode.Uri.joinPath(this._extensionUri, 'public', 'hljs.css')
    );
    return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Mark Elixir</title>
            <style>${hljs}</style>
            <style>${index}</style>
        </head>
        <body>
            <div id="map"></div>
            <script>
              window.injectedData = ${JSON.stringify({ nodeData })};
              ${js}
            </script>
        </body>
        </html>`;
  };
}
