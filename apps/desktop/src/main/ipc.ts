import path from "node:path";

import { app, BrowserWindow, dialog, ipcMain } from "electron";
import type { IpcMainInvokeEvent, OpenDialogOptions } from "electron";

import {
  desktopChannels,
  filePathSchema,
  saveFileAsRequestSchema,
  saveFileRequestSchema,
} from "@markdownview/electron";
import type {
  DesktopVersions,
  SaveFileAsRequest,
  SaveFileRequest,
} from "@markdownview/electron";

import {
  isMarkdownPath,
  listMarkdownFiles,
  readMarkdownDocument,
  writeMarkdownDocument,
} from "#src/main/files.ts";
import { isTrustedUrl } from "#src/main/renderer-route.ts";

const versions = (): DesktopVersions => ({
  app: app.getVersion(),
  chrome: process.versions.chrome,
  electron: process.versions.electron,
  node: process.versions.node,
});

const markdownFilters = [{ name: "Markdown", extensions: ["md", "markdown"] }];

const owner = (event: IpcMainInvokeEvent) =>
  BrowserWindow.fromWebContents(event.sender);

const showOpen = async (
  event: IpcMainInvokeEvent,
  options: OpenDialogOptions
) => {
  const window = owner(event);

  const result = await (window
    ? dialog.showOpenDialog(window, options)
    : dialog.showOpenDialog(options));

  return result;
};

/** Every channel goes through here: a handler answers only frames the app itself loaded. */
export const setupIpc = (devOrigin: string | null) => {
  // The renderer may only touch files the user picked in a dialog.
  const openedFiles = new Set<string>();
  const openedFolders = new Set<string>();

  const assertTrusted = (event: IpcMainInvokeEvent) => {
    if (!isTrustedUrl(event.senderFrame?.url ?? "", devOrigin)) {
      throw new Error("Untrusted IPC sender");
    }
  };

  const allow = (filePath: string) => {
    const absolute = path.resolve(filePath);
    openedFiles.add(absolute);

    return absolute;
  };

  const assertAllowed = (filePath: string) => {
    const absolute = path.resolve(filePath);

    if (!openedFiles.has(absolute)) {
      throw new Error("The file was not opened through the app");
    }

    return absolute;
  };

  ipcMain.handle(desktopChannels.versions, (event) => {
    assertTrusted(event);

    return versions();
  });

  ipcMain.handle(desktopChannels.openFile, async (event) => {
    assertTrusted(event);

    const result = await showOpen(event, {
      filters: markdownFilters,
      properties: ["openFile"],
      title: "打开 Markdown 文件",
    });

    const [filePath] = result.filePaths;

    if (result.canceled || filePath === undefined) {
      return null;
    }

    return await readMarkdownDocument(allow(filePath));
  });

  ipcMain.handle(desktopChannels.openFolder, async (event) => {
    assertTrusted(event);

    const result = await showOpen(event, {
      properties: ["openDirectory"],
      title: "打开文件夹",
    });

    const [folderPath] = result.filePaths;

    if (result.canceled || folderPath === undefined) {
      return null;
    }

    const files = await listMarkdownFiles(folderPath);

    openedFolders.add(path.resolve(folderPath));

    for (const file of files) {
      allow(file.path);
    }

    return { files, name: path.basename(folderPath), path: folderPath };
  });

  ipcMain.handle(
    desktopChannels.refreshFolder,
    async (event, payload: string) => {
      assertTrusted(event);

      const folderPath = path.resolve(filePathSchema.parse(payload));

      if (!openedFolders.has(folderPath)) {
        throw new Error("The folder was not opened through the app");
      }

      const files = await listMarkdownFiles(folderPath);

      for (const file of files) {
        allow(file.path);
      }

      return {
        files,
        name: path.basename(folderPath),
        path: folderPath,
      };
    }
  );

  ipcMain.handle(desktopChannels.readFile, async (event, payload: string) => {
    assertTrusted(event);

    const document = await readMarkdownDocument(
      assertAllowed(filePathSchema.parse(payload))
    );

    return document;
  });

  ipcMain.handle(
    desktopChannels.saveFile,
    async (event, payload: SaveFileRequest) => {
      assertTrusted(event);

      const request = saveFileRequestSchema.parse(payload);

      const saved = await writeMarkdownDocument(
        assertAllowed(request.path),
        request.content
      );

      return saved;
    }
  );

  ipcMain.handle(
    desktopChannels.saveFileAs,
    async (event, payload: SaveFileAsRequest) => {
      assertTrusted(event);

      const request = saveFileAsRequestSchema.parse(payload);
      const window = owner(event);

      const options = {
        defaultPath: path.join(app.getPath("documents"), request.suggestedName),
        filters: markdownFilters,
        title: "另存为",
      };

      const result = window
        ? await dialog.showSaveDialog(window, options)
        : await dialog.showSaveDialog(options);

      if (result.canceled || result.filePath === undefined) {
        return null;
      }

      const filePath = isMarkdownPath(result.filePath)
        ? result.filePath
        : `${result.filePath}.md`;

      return await writeMarkdownDocument(allow(filePath), request.content);
    }
  );
};
