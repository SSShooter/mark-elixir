import * as vscode from 'vscode';

export class MindElixirPanel {
  panel: vscode.WebviewPanel;
  constructor(private readonly _extensionUri: vscode.Uri, name: string) {
    const panel = vscode.window.createWebviewPanel(
      'mindElixir',
      name,
      vscode.ViewColumn.Two,
      {
        // Enable scripts in the webview
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );
    panel.webview.html = this.getWebviewContent(panel.webview);
    this.panel = panel;
  }
  getWebviewContent = (webview: vscode.Webview) => {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.js')
    );
    return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Cat Coding</title>
            <style>
              /* test tailwind compatibility */
              *,
              ::before,
              ::after {
                box-sizing: border-box;
                border-width: 0;
                border-style: solid;
                border-color: #e5e7eb;
              }
              body {
                padding: 0;
              }
              #map{
                height: 100vh;
                width: 100vw;
              }
              me-main>me-wrapper{
                margin:10px !important;
              }
            </style>
        </head>
        <body>
            <div id="map"></div>
            <script type="module" src="${scriptUri}"></script>
        </body>
        </html>`;
  };
}
