import * as vscode from 'vscode';

export async function getFileContentAsString(uri: vscode.Uri): Promise<string> {
  try {
    const fileData = await vscode.workspace.fs.readFile(uri);
    return fileData.toString();
  } catch (error) {
    vscode.window.showErrorMessage(`Error reading file: ${error}`);
    throw error;
  }
}

export async function saveFile(content: string) {
  const saveUri = await vscode.window.showSaveDialog({
    saveLabel: 'Save File',
    filters: {
      'Text Files': ['html'],
      'All Files': ['*'],
    },
  });

  if (saveUri) {
    const encoder = new TextEncoder();
    const encodedContent = encoder.encode(content);

    try {
      await vscode.workspace.fs.writeFile(saveUri, encodedContent);
      vscode.window.showInformationMessage('文件保存成功！');
    } catch (error) {
      vscode.window.showErrorMessage(`文件保存失败: ${error}`);
    }
  } else {
    vscode.window.showInformationMessage('保存操作已取消');
  }
}
