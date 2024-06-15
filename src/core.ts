import * as vscode from 'vscode';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { MindElixirPanel } from './panel';

const markdownAstToMindElixirTree = (children:any[])=>{
  
};

export const markdownToMindElixir = (context: vscode.ExtensionContext) => {
  return async () => {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      vscode.window.showInformationMessage('No active editor');
      return;
    }
    // 获取文档对象
    const document = editor.document;

    // 获取文档的内容
    const documentContent = document.getText();
    const file = await unified()
      .use(remarkParse)
      .use(remarkRehype)
      // .use(rehypeSanitize)
      // .use(rehypeStringify)
      .parse(documentContent);
    // 输出文档内容到控制台
    console.log(file.children);
    // 将 unified 的 markdown ast 转换为树状数据结构
    const tree = markdownAstToMindElixirTree(file.children);
    // 也可以在VSCode中显示内容，例如显示在信息窗口中
    vscode.window.showInformationMessage('Document content printed to console');
    const mindElixirPanel = new MindElixirPanel(
      context.extensionUri,
      document.fileName
    );
    mindElixirPanel.panel.webview.postMessage({
      command: 'init',
      payload: { name: document.fileName, children: [] },
    });
    mindElixirPanel.panel.webview.onDidReceiveMessage(
      (message: MessageFromWebview) => {}
    );
    context.subscriptions.push(mindElixirPanel.panel);
  };
};
