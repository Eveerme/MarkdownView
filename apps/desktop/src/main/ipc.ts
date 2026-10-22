import path from "node:path";

import { app, BrowserWindow, dialog, ipcMain } from "electron";
import type { IpcMainInvokeEvent, OpenDialogOptions } from "electron";

import {
  desktopChannels,
  filePathSchema,
  resolveLinkRequestSchema,
  saveFileAsRequestSchema,
  saveFileRequestSchema,
} from "@markdownview/electron";
import type {
  DesktopVersions,
  MarkdownFolder,
  MarkdownOpenRequest,
  ResolveLinkRequest,
  SaveFileAsRequest,
  SaveFileRequest,
} from "@markdownview/electron";

import {
  isMarkdownPath,
  listMarkdownFiles,
  readMarkdownDocument,
  writeMarkdownDocument,
} from "#src/main/files.ts";
import type { MarkdownListing } from "#src/main/files.ts";
import {
  readStoredFolders,
  writeStoredFolders,
} from "#src/main/folder-store.ts";
import { resolveMarkdownLink } from "#src/main/links.ts";
import { createRecentFilesStore } from "#src/main/recent-files.ts";
import { isTrustedUrl } from "#src/main/renderer-route.ts";

export interface DesktopIpc {
  /** Hand the renderer a Markdown file the operating system asked to open. */
  requestOpen: (filePath: string) => void;
}

const versions = (): DesktopVersions => ({
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

const folderFor = (
  folderPath: string,
  listing: MarkdownListing
): MarkdownFolder => ({
  files: listing.files,
  name: path.basename(folderPath),
  path: folderPath,
  truncated: listing.truncated,
});

/** Every channel goes through here: a handler answers only frames the app itself loaded. */
export const setupIpc = (devOrigin: string | null): DesktopIpc => {
  // The renderer may only touch files the user picked in a dialog or opened before.
  const openedFiles = new Set<string>();
  const openedFolders = new Set<string>();
  const pendingOpenRequests: MarkdownOpenRequest[] = [];
  const foldersFile = path.join(app.getPath("userData"), "folders.json");

  const recentFiles = createRecentFilesStore(
    path.join(app.getPath("userData"), "recent-files.json")
  );

  let storedFolderPaths: Promise<string[]> | null = null;

  const folderPaths = async () => {
    storedFolderPaths ??= readStoredFolders(foldersFile);

    return await storedFolderPaths;
  };

  const persistFolders = async (paths: readonly string[]) => {
    const unique = [...new Set(paths.map((folder) => path.resolve(folder)))];

    storedFolderPaths = Promise.resolve(unique);

    try {
      await writeStoredFolders(foldersFile, unique);
    } catch {
      // Remembering folders is a convenience; the current session still works.
    }
  };

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

  const assertAllowed = async (filePath: string) => {
    const absolute = path.resolve(filePath);

    if (!isMarkdownPath(absolute)) {
      throw new Error("Only Markdown files can be opened");
    }

    if (!openedFiles.has(absolute) && !(await recentFiles.contains(absolute))) {
      throw new Error("The file was not opened through the app");
    }

    openedFiles.add(absolute);

    return absolute;
  };

  const remember = async (filePath: string) => {
    try {
      await recentFiles.remember(filePath);
    } catch {
      // The list is a convenience; failing to write it must not fail the open.
    }
  };

  const openFolderRoot = async (
    folderPath: string
  ): Promise<MarkdownFolder> => {
    const absolute = path.resolve(folderPath);
    const listing = await listMarkdownFiles(absolute);

    openedFolders.add(absolute);

    for (const file of listing.files) {
      allow(file.path);
    }

    return folderFor(absolute, listing);
  };

  const requestOpen = (filePath: string) => {
    const absolute = path.resolve(filePath);

    if (!isMarkdownPath(absolute)) {
      return;
    }

    allow(absolute);

    const request = { name: path.basename(absolute), path: absolute };

    if (!pendingOpenRequests.some((pending) => pending.path === absolute)) {
      pendingOpenRequests.push(request);
    }

    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(desktopChannels.openRequest, request);

      if (window.isMinimized()) {
        window.restore();
      }

      if (window.isVisible()) {
        window.focus();
      }
    }
  };

  ipcMain.handle(desktopChannels.versions, (event) => {
    assertTrusted(event);

    return versions();
  });

  ipcMain.handle(desktopChannels.takeOpenRequest, (event) => {
    assertTrusted(event);

    return pendingOpenRequests.shift() ?? null;
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

    const document = await readMarkdownDocument(allow(filePath));
    await remember(document.path);

    return document;
  });

  ipcMain.handle(desktopChannels.openFolder, async (event) => {
    assertTrusted(event);

    const result = await showOpen(event, {
      properties: ["openDirectory", "multiSelections"],
      title: "打开文件夹",
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const folders = await Promise.all(result.filePaths.map(openFolderRoot));
    const paths = await folderPaths();

    await persistFolders([...paths, ...folders.map((folder) => folder.path)]);

    return folders;
  });

  ipcMain.handle(desktopChannels.listFolders, async (event) => {
    assertTrusted(event);

    const paths = await folderPaths();

    const opened = await Promise.all(
      paths.map(async (folderPath) => {
        try {
          return await openFolderRoot(folderPath);
        } catch {
          return null;
        }
      })
    );

    return opened.filter((folder): folder is MarkdownFolder => folder !== null);
  });

  ipcMain.handle(
    desktopChannels.closeFolder,
    async (event, payload: string) => {
      assertTrusted(event);

      const folderPath = path.resolve(filePathSchema.parse(payload));
      const paths = await folderPaths();

      openedFolders.delete(folderPath);

      await persistFolders(paths.filter((stored) => stored !== folderPath));

      return null;
    }
  );

  ipcMain.handle(
    desktopChannels.refreshFolder,
    async (event, payload: string) => {
      assertTrusted(event);

      const folderPath = path.resolve(filePathSchema.parse(payload));

      if (!openedFolders.has(folderPath)) {
        throw new Error("The folder was not opened through the app");
      }

      const listing = await listMarkdownFiles(folderPath);

      for (const file of listing.files) {
        allow(file.path);
      }

      return folderFor(folderPath, listing);
    }
  );

  ipcMain.handle(desktopChannels.readFile, async (event, payload: string) => {
    assertTrusted(event);

    const document = await readMarkdownDocument(
      await assertAllowed(filePathSchema.parse(payload))
    );

    await remember(document.path);

    return document;
  });

  ipcMain.handle(
    desktopChannels.resolveLink,
    async (event, payload: ResolveLinkRequest) => {
      assertTrusted(event);

      const request = resolveLinkRequestSchema.parse(payload);
      const currentPath = await assertAllowed(request.from);

      const roots = new Set([
        path.dirname(currentPath),
        ...openedFolders,
        ...(await folderPaths()),
      ]);

      const target = await resolveMarkdownLink({
        currentPath,
        href: request.href,
        roots: [...roots],
      });

      if (target === null) {
        return null;
      }

      allow(target.path);

      return target;
    }
  );

  ipcMain.handle(
    desktopChannels.saveFile,
    async (event, payload: SaveFileRequest) => {
      assertTrusted(event);

      const request = saveFileRequestSchema.parse(payload);
      const filePath = await assertAllowed(request.path);

      return await writeMarkdownDocument(filePath, request.content);
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

      const saved = await writeMarkdownDocument(
        allow(filePath),
        request.content
      );

      await remember(saved.path);

      return saved;
    }
  );

  ipcMain.handle(desktopChannels.recentFiles, async (event) => {
    assertTrusted(event);

    return await recentFiles.list();
  });

  ipcMain.handle(desktopChannels.clearRecentFiles, async (event) => {
    assertTrusted(event);
    await recentFiles.clear();

    return null;
  });

  return { requestOpen };
};
