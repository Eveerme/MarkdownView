import { contextBridge, ipcRenderer } from "electron";
import type { IpcRendererEvent } from "electron";
import type { ZodType } from "zod";
import { z } from "zod";

import type {
  DesktopApi,
  DesktopVersions,
  ExportDocumentRequest,
  MarkdownDocument,
  MarkdownFolder,
  MarkdownOpenRequest,
  MarkdownSavedFile,
  RecentFile,
  ResolvedLink,
  ResolveLinkRequest,
  SaveFileAsRequest,
  SaveFileRequest,
  SaveImageRequest,
  SavedImage,
} from "@markdownview/electron";
import {
  desktopBridgeGlobal,
  desktopChannels,
  markdownDocumentSchema,
  markdownFolderSchema,
  markdownOpenRequestSchema,
  markdownSavedFileSchema,
  recentFileSchema,
  resolvedLinkSchema,
  resolveLinkRequestSchema,
  savedImageSchema,
  versionsSchema,
} from "@markdownview/electron";

type InvokePayload =
  | string
  | SaveFileRequest
  | SaveFileAsRequest
  | SaveImageRequest
  | ExportDocumentRequest
  | ResolveLinkRequest;

const invoke = async <T>(
  channel: string,
  schema: ZodType<T>,
  payload?: InvokePayload
): Promise<T> => {
  const result: unknown = await ipcRenderer.invoke(channel, payload);

  return schema.parse(result);
};

const desktop = {
  versions: async (): Promise<DesktopVersions> => {
    const value = await invoke(desktopChannels.versions, versionsSchema);

    return value;
  },

  openFile: async (): Promise<MarkdownDocument | null> => {
    const document = await invoke(
      desktopChannels.openFile,
      markdownDocumentSchema.nullable()
    );

    return document;
  },

  takeOpenRequest: async (): Promise<MarkdownOpenRequest | null> => {
    const request = await invoke(
      desktopChannels.takeOpenRequest,
      markdownOpenRequestSchema.nullable()
    );

    return request;
  },

  onOpenRequest: (
    listener: (request: MarkdownOpenRequest) => void
  ): (() => void) => {
    const handler = (
      _event: IpcRendererEvent,
      payload: MarkdownOpenRequest
    ) => {
      listener(markdownOpenRequestSchema.parse(payload));
    };

    ipcRenderer.on(desktopChannels.openRequest, handler);

    return () => {
      ipcRenderer.removeListener(desktopChannels.openRequest, handler);
    };
  },

  openFolder: async (): Promise<MarkdownFolder[] | null> => {
    const folders = await invoke(
      desktopChannels.openFolder,
      z.array(markdownFolderSchema).nullable()
    );

    return folders;
  },

  listFolders: async (): Promise<MarkdownFolder[]> => {
    const folders = await invoke(
      desktopChannels.listFolders,
      z.array(markdownFolderSchema)
    );

    return folders;
  },

  closeFolder: async (path: string): Promise<void> => {
    await invoke(desktopChannels.closeFolder, z.null(), path);
  },

  refreshFolder: async (path: string): Promise<MarkdownFolder> => {
    const folder = await invoke(
      desktopChannels.refreshFolder,
      markdownFolderSchema,
      path
    );

    return folder;
  },

  readFile: async (path: string): Promise<MarkdownDocument> => {
    const document = await invoke(
      desktopChannels.readFile,
      markdownDocumentSchema,
      path
    );

    return document;
  },

  resolveLink: async (
    request: ResolveLinkRequest
  ): Promise<ResolvedLink | null> => {
    const target = await invoke(
      desktopChannels.resolveLink,
      resolvedLinkSchema.nullable(),
      resolveLinkRequestSchema.parse(request)
    );

    return target;
  },

  saveFile: async (request: SaveFileRequest): Promise<MarkdownSavedFile> => {
    const saved = await invoke(
      desktopChannels.saveFile,
      markdownSavedFileSchema,
      request
    );

    return saved;
  },

  saveFileAs: async (
    request: SaveFileAsRequest
  ): Promise<MarkdownSavedFile | null> => {
    const saved = await invoke(
      desktopChannels.saveFileAs,
      markdownSavedFileSchema.nullable(),
      request
    );

    return saved;
  },

  recentFiles: async (): Promise<RecentFile[]> => {
    const files = await invoke(
      desktopChannels.recentFiles,
      z.array(recentFileSchema)
    );

    return files;
  },

  clearRecentFiles: async (): Promise<void> => {
    await invoke(desktopChannels.clearRecentFiles, z.null());
  },

  saveImage: async (request: SaveImageRequest): Promise<SavedImage> => {
    const saved = await invoke(
      desktopChannels.saveImage,
      savedImageSchema,
      request
    );

    return saved;
  },

  exportDocument: async (
    request: ExportDocumentRequest
  ): Promise<MarkdownSavedFile | null> => {
    const saved = await invoke(
      desktopChannels.exportDocument,
      markdownSavedFileSchema.nullable(),
      request
    );

    return saved;
  },
} satisfies DesktopApi;

contextBridge.exposeInMainWorld(desktopBridgeGlobal, desktop);
