import * as vscode from 'vscode';
import * as path from 'path';
import rehypeHighlight from 'rehype-highlight';
import { MindElixirPanel } from './panel';
import { NodeObj } from 'mind-elixir';
import { plaintextToMindElixir, mindElixirToPlaintext } from 'mind-elixir/plaintextConverter';
import { parseMarkdown as parseMarkdownDoc, readFrontmatterTitle } from '@mind-elixir/import-markdown';

/**
 * Get mind-elixir locale from VS Code language setting.
 * Maps VS Code language IDs to mind-elixir locale strings.
 */
function getMindElixirLocale(): string {
  const lang = vscode.env.language; // e.g. 'zh-cn', 'en', 'ja'
  if (lang.startsWith('zh-tw') || lang.startsWith('zh-hant')) return 'zh_TW';
  if (lang.startsWith('zh')) return 'zh_CN';
  if (lang.startsWith('ja')) return 'ja';
  if (lang.startsWith('pt')) return 'pt';
  if (lang.startsWith('ru')) return 'ru';
  if (lang.startsWith('de')) return 'de';
  if (lang.startsWith('fr')) return 'fr';
  if (lang.startsWith('es')) return 'es';
  if (lang.startsWith('it')) return 'it';
  if (lang.startsWith('ko')) return 'ko';
  return 'en';
}

export const markdownToMindElixir = (context: vscode.ExtensionContext) => {
  return async () => {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      vscode.window.showInformationMessage('No active editor');
      return;
    }
    const document = editor.document;
    const documentContent = document.getText();
    const locale = getMindElixirLocale();

    // Detect Mind Elixir Plaintext format (starts with "- ")
    const isPlaintext = documentContent.trimStart().startsWith('- ');

    const getParsedData = (text: string) => {
      let data: NodeObj;
      const basename = path.basename(document.fileName, path.extname(document.fileName));
      let title = basename;

      if (isPlaintext) {
        // Use plaintextToMindElixir converter for Plaintext format
        const mindElixirData = plaintextToMindElixir(text, title);
        data = mindElixirData.nodeData;
      } else {
        // Parse as Markdown
        //
        // The markdown -> MindElixir conversion itself lives in
        // `@mind-elixir/import-markdown`, shared with the Obsidian plugin
        // (`obsidian-mindmap`). Everything specific to this extension arrives
        // through that package's options:
        //
        //   - `rehypePlugins`  syntax-highlight fenced code blocks. The
        //     webview injects `public/hljs.css` to colour the `hljs-*` spans,
        //     so this is load-bearing, not decoration.
        //   - `imageSize`       every image is forced into a 200x100 box.
        //   - `frontmatter`     a `title:` key in the YAML block replaces the
        //     file name as the root topic.
        //   - `h1AsRoot`        the `mindElixirMarkdown.h1AsRoot` setting.
        const config = vscode.workspace.getConfiguration('mindElixirMarkdown');
        const useH1AsRoot = config.get('h1AsRoot');

        // A frontmatter `title:` is the document's real title. It seeds the
        // root topic (inside the package, via `frontmatter: 'title'`) AND
        // names the panel -- but the panel name must survive `h1AsRoot`, which
        // replaces the root topic with the H1 text. Hence the separate read.
        title = readFrontmatterTitle(text) || basename;

        const parsed = parseMarkdownDoc(text, {
          filename: basename,
          // `getConfiguration().get()` is typed `unknown`. The pre-migration
          // code only used the value in a truthiness test, so the looseness
          // never surfaced; passing it into a typed option does, hence the
          // explicit narrowing. A non-boolean setting is treated as "off",
          // which is what the old truthiness test did for every falsy value.
          h1AsRoot: useH1AsRoot === true,
          frontmatter: 'title',
          rehypePlugins: [rehypeHighlight],
          imageSize: { width: 200, height: 100 },
        });

        data = parsed.nodeData;

        // The pre-migration implementation hard-coded the root id as 'root';
        // the package generates a random one. Pin it back, so the debounced
        // re-parse below hands the webview a tree whose root keeps its
        // identity instead of appearing to be a different document.
        data.id = 'root';
      }
      return { data, title };
    };

    const parsed = getParsedData(documentContent);
    const data = parsed.data;
    const title = parsed.title;

    const mindElixirPanel = new MindElixirPanel(
      context.extensionUri,
      title + ' - Mark Elixir',
      isPlaintext,
      locale
    );

    await mindElixirPanel.init(data);

    let isUpdatingFromWebview = false;

    // Handle messages from webview
    mindElixirPanel.panel.webview.onDidReceiveMessage(async (message: any) => {
      switch (message.command) {
        case 'save': {
          // Plaintext bidirectional editing: write mind map data back to file
          if (!isPlaintext) return;
          try {
            isUpdatingFromWebview = true;
            const plaintext = mindElixirToPlaintext(message.data);
            const encoder = new TextEncoder();
            await vscode.workspace.fs.writeFile(
              document.uri,
              encoder.encode(plaintext)
            );
            setTimeout(() => {
              isUpdatingFromWebview = false;
            }, 500);
          } catch (e) {
            vscode.window.showErrorMessage(`Mark Elixir: failed to save file: ${e}`);
            isUpdatingFromWebview = false;
          }
          return;
        }
        default:
          break;
      }
    });

    let updateTimer: NodeJS.Timeout | null = null;

    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        if (isUpdatingFromWebview) return;
        
        if (updateTimer) {
          clearTimeout(updateTimer);
        }
        updateTimer = setTimeout(() => {
          try {
            const updatedText = e.document.getText();
            const { data: updatedData } = getParsedData(updatedText);
            mindElixirPanel.panel.webview.postMessage({
              command: 'updateData',
              data: updatedData,
            });
          } catch (err) {
            console.error('Error updating mind map data:', err);
          }
        }, 300); // debounce 300ms
      }
    });

    mindElixirPanel.panel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
      if (updateTimer) {
        clearTimeout(updateTimer);
      }
    });

    context.subscriptions.push(mindElixirPanel.panel, changeDocumentSubscription);
  };
};
