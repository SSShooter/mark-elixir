import * as vscode from 'vscode';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';
import { unified } from 'unified';
import { MindElixirPanel } from './panel';
import type { Heading, List, Paragraph, RootContent, Yaml } from 'mdast';
import type { Root } from 'hast';
import { NodeObj } from 'mind-elixir';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

interface TreeItem {
  children: TreeItem[];
  object: any;
  parent: any;
  type: any;
}

const parseFrontmatter = (frontmatter: string) => {
  const data = frontmatter
    .split('\n')
    .map((line) => line.split(':').map((item) => item.trim()));
  return Object.fromEntries(data);
};

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

const processList = (list: List): any => {
  return list.children.map((child) => {
    const item = child.children[0] as Paragraph;
    const nest = child.children[1] as List;
    if (nest) {
      if (nest.type === 'list') {
        return {
          object: item,
          children: processList(nest),
        };
      } else {
        return {
          object: item,
          children: [
            {
              object: nest,
            },
          ],
        };
      }
    } else {
      return {
        object: item,
      };
    }
  });
};

const addWidthAndHeight: Plugin<[], Root> = () =>
  function transformer(tree) {
    visit(tree, 'element', function visitor(node) {
      if (node.tagName === 'img') {
        node.properties.width = 200;
        node.properties.height = 100;
      }
    });
  };

const treeToMindElixir = async (med: TreeItem & NodeObj) => {
  if (med.type === 'list') {
    med.topic = 'List';
    med.children = processList(med.object);
  } else if (med.type !== 'root') {
    const htmlAst = await unified()
      .use(remarkRehype)
      .use(rehypeHighlight)
      .use(addWidthAndHeight)
      .run(med.object);
    const html = unified().use(rehypeStringify).stringify(htmlAst);
    med.dangerouslySetInnerHTML = html;
  }
  med.id = med.object.position?.start?.offset?.toString() || '';
  Reflect.deleteProperty(med, 'parent');
  Reflect.deleteProperty(med, 'type');
  Reflect.deleteProperty(med, 'object');

  if (!med?.children || med?.children?.length === 0) {
    return;
  }

  // If the current node is a list with only one child, spread the child into the current node
  if (med.children.length === 1 && med.children[0].type === 'list') {
    med.children = processList(med.children[0].object);
  }

  for (let i = 0; i < med.children.length; i++) {
    let child = med.children[i];
    const next = med.children[i + 1];
    // Check if the next node is a list, if so, merge it into the current node
    if (next?.type === 'list') {
      child.children = processList(next.object);
      med.children.splice(i + 1, 1);
    }

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
    const document = editor.document;
    const documentContent = document.getText();
    const ast = unified()
      .use(remarkParse)
      .use(remarkFrontmatter)
      .use(remarkGfm)
      .parse(documentContent);

    const frontmatter = ast.children.find((child) => child.type === 'yaml');
    let title = document.fileName;
    if (frontmatter) {
      const obj = parseFrontmatter((frontmatter as Yaml).value);
      if (obj.title) {
        title = obj.title;
      }
    }
    const tree = markdownAstToTree(
      ast.children.filter(
        (child) => child.type !== 'yaml' && child.type !== 'html'
      )
    );
    await treeToMindElixir(tree as any);
    
    const mindElixirPanel = new MindElixirPanel(
      context.extensionUri,
      title + ' - Mark Elixir'
    );
    mindElixirPanel.panel.webview.postMessage({
      command: 'init',
      payload: { name: title, children: tree.children },
    });
    mindElixirPanel.panel.webview.onDidReceiveMessage(
      (message: any) => {}
    );
    context.subscriptions.push(mindElixirPanel.panel);
  };
};
