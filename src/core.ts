import * as vscode from 'vscode';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import remarkHtml from 'remark-html';
import rehypeImgSize from 'rehype-img-size';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';
import { unified } from 'unified';
import { MindElixirPanel } from './panel';
import type { Heading, List, Paragraph, RootContent } from 'mdast';
import { NodeObj } from 'mind-elixir';

interface TreeItem {
  children: TreeItem[]
  object: any
  parent: any
  type: any
}

const markdownAstToTree = (children: RootContent[]) => {
  const treeItem: TreeItem = {
    type: 'root',
    children: [],
    object: { depth: 0 },
    parent: null,
  };
  let current = treeItem;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child.type === 'heading') {
      const heading = child as Heading;
      const data = {
        type: heading.type,
        object: heading,
        parent: current,
        children: [],
      };
      if (heading.depth > current.object.depth) {
        current.children.push(data);
        current = data;
      } else {
        while (heading.depth <= current.object.depth) {
          current = current.parent;
        }
        current.children.push(data);
        current = data;
      }
    } else {
      const data = {
        type: child.type,
        object: child,
        parent: current,
        children: [],
      };
      current.children.push(data);
    }
  }
  return treeItem;
};

const processList = (list: List):any => {
  return list.children.map((child) => {
    const item = child.children[0] as Paragraph;
    const nest = child.children[1] as List;
    if (nest) {
      return {
        object: item,
        children: processList(nest),
      };
    } else {
      return {
        object: item,
        children: [],
      };
    }
  });
};

const treeToMindElixir = async (med: TreeItem & NodeObj) => {
  if (med.type === 'list') {
    med.topic = 'list';
    med.children = processList(med.object);
  } else if (med.type !== 'root') {
    const htmlAst = await unified()
      .use(remarkRehype)
      .use(rehypeHighlight)
      .use(rehypeImgSize)
      .run(med.object);
    const html = await unified().use(rehypeStringify).stringify(htmlAst);
    med.dangerouslySetInnerHTML = html;
  }
  med.id = med.object.position?.start?.offset?.toString() || '';
  Reflect.deleteProperty(med, 'parent');
  Reflect.deleteProperty(med, 'type');
  Reflect.deleteProperty(med, 'object');

  if (!med?.children || med?.children?.length === 0) {
    return;
  }
  for (let i = 0; i < med.children.length; i++) {
    const child = med.children[i];
    await treeToMindElixir(child);
  }
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
    const ast = await unified()
      .use(remarkParse)
      // .use(rehypeSanitize)
      // .use(rehypeStringify)
      .parse(documentContent);
    // 输出文档内容到控制台
    const children = ast.children;
    console.log(children);

    // 将 unified 的 markdown ast 转换为树状数据结构
    const tree = markdownAstToTree(
      ast.children.filter((child) => child.type !== 'html')
    );
    await treeToMindElixir(tree as any);
    vscode.window.showInformationMessage('Document content printed to console');
    const mindElixirPanel = new MindElixirPanel(
      context.extensionUri,
      document.fileName
    );
    mindElixirPanel.panel.webview.postMessage({
      command: 'init',
      payload: { name: document.fileName, children: tree.children },
    });
    mindElixirPanel.panel.webview.onDidReceiveMessage(
      (message: MessageFromWebview) => {}
    );
    context.subscriptions.push(mindElixirPanel.panel);
  };
};
