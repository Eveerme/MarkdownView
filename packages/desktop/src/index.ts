import { z } from "zod";

export const desktopBridgeGlobal = "desktop";

/** How many entries the recent store keeps; the settings range stops here. */
export const recentFilesCapacity = 50;

/** Tauri command names. They double as the contract's method identifiers. */
export const desktopCommands = {
  versions: "versions",
  openFile: "open_file",
  takeOpenRequest: "take_open_request",
  openFolder: "open_folder",
  listFolders: "list_folders",
  closeFolder: "close_folder",
  refreshFolder: "refresh_folder",
  readFile: "read_file",
  revealFile: "reveal_file",
  revealFolder: "reveal_folder",
  resolveLink: "resolve_link",
  saveFile: "save_file",
  saveFileAs: "save_file_as",
  recentFiles: "recent_files",
  clearRecentFiles: "clear_recent_files",
  saveImage: "save_image",
  checkUpdate: "check_update",
  downloadUpdate: "download_update",
  installUpdate: "install_update",
  exportDocument: "export_document",
  openRequestEvent: "open-request",
  downloadProgressEvent: "download-progress",
  appSaveEvent: "app-save",
} as const;

/** The custom scheme the renderer loads local note images from. */
export const imageAssetScheme = "mdview";
export const imageAssetHost = "asset";

export const versionsSchema = z.object({
  platform: z.string(),
  tauri: z.string(),
  webview: z.string(),
});

export type DesktopVersions = z.infer<typeof versionsSchema>;

export const markdownDocumentSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
  content: z.string(),
});

export type MarkdownDocument = z.infer<typeof markdownDocumentSchema>;

export const markdownFileSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
  relativePath: z.string().min(1),
});

export type MarkdownFile = z.infer<typeof markdownFileSchema>;

/** A file the operating system asked the app to open, before its content is read. */
export const markdownOpenRequestSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
});

export type MarkdownOpenRequest = z.infer<typeof markdownOpenRequestSchema>;

export const recentFileSchema = z.object({
  directory: z.string().min(1),
  openedAt: z.number().int().nonnegative(),
  path: z.string().min(1),
  name: z.string().min(1),
});

export type RecentFile = z.infer<typeof recentFileSchema>;

export const markdownFolderSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
  files: z.array(markdownFileSchema),
  truncated: z.boolean(),
});

export type MarkdownFolder = z.infer<typeof markdownFolderSchema>;

export const resolvedLinkSchema = z.object({
  anchor: z.string().nullable(),
  name: z.string().min(1),
  path: z.string().min(1),
});

export type ResolvedLink = z.infer<typeof resolvedLinkSchema>;

export const resolveLinkRequestSchema = z.object({
  from: z.string().min(1),
  href: z.string().min(1),
});

export type ResolveLinkRequest = z.infer<typeof resolveLinkRequestSchema>;

export const markdownSavedFileSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
});

export type MarkdownSavedFile = z.infer<typeof markdownSavedFileSchema>;

export const saveFileRequestSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});

export type SaveFileRequest = z.infer<typeof saveFileRequestSchema>;

export const saveFileAsRequestSchema = z.object({
  content: z.string(),
  suggestedName: z.string().min(1),
});

export type SaveFileAsRequest = z.infer<typeof saveFileAsRequestSchema>;

export const saveImageRequestSchema = z.object({
  data: z.array(z.number().int().min(0).max(255)),
  from: z.string().min(1),
  mimeType: z.string().min(1),
});

export type SaveImageRequest = z.infer<typeof saveImageRequestSchema>;

export const savedImageSchema = z.object({
  relativePath: z.string().min(1),
});

export type SavedImage = z.infer<typeof savedImageSchema>;

export const updateInfoSchema = z.object({
  date: z.string(),
  notes: z.string(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/u),
  size: z.number().int().nonnegative(),
  url: z.url(),
  version: z.string().min(1),
});

export type UpdateInfo = z.infer<typeof updateInfoSchema>;

export type DownloadUpdateRequest = UpdateInfo;

export const downloadedUpdateSchema = z.object({
  path: z.string().min(1),
});

export type DownloadedUpdate = z.infer<typeof downloadedUpdateSchema>;

export const downloadProgressSchema = z.object({
  downloaded: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

export type DownloadProgress = z.infer<typeof downloadProgressSchema>;

export const exportDocumentRequestSchema = z.object({
  format: z.literal("html"),
  html: z.string().min(1),
  suggestedName: z.string().min(1),
});

export type ExportDocumentRequest = z.infer<typeof exportDocumentRequestSchema>;

export type ExportFormat = ExportDocumentRequest["format"];

export const filePathSchema = z.string().min(1);

export interface DesktopApi {
  versions: () => Promise<DesktopVersions>;
  openFile: () => Promise<MarkdownDocument | null>;
  takeOpenRequest: () => Promise<MarkdownOpenRequest | null>;
  onOpenRequest: (
    listener: (request: MarkdownOpenRequest) => void
  ) => () => void;
  /** Fired before an update closes the app, so pending edits can be flushed. */
  onAppSave: (listener: () => void) => () => void;
  openFolder: () => Promise<MarkdownFolder[] | null>;
  listFolders: () => Promise<MarkdownFolder[]>;
  closeFolder: (path: string) => Promise<void>;
  refreshFolder: (path: string) => Promise<MarkdownFolder>;
  readFile: (path: string) => Promise<MarkdownDocument>;
  revealFile: (path: string) => Promise<void>;
  revealFolder: (path: string) => Promise<void>;
  resolveLink: (request: ResolveLinkRequest) => Promise<ResolvedLink | null>;
  saveFile: (request: SaveFileRequest) => Promise<MarkdownSavedFile>;
  saveFileAs: (request: SaveFileAsRequest) => Promise<MarkdownSavedFile | null>;
  recentFiles: () => Promise<RecentFile[]>;
  clearRecentFiles: () => Promise<void>;
  saveImage: (request: SaveImageRequest) => Promise<SavedImage>;
  checkUpdate: () => Promise<UpdateInfo | null>;
  downloadUpdate: (
    request: DownloadUpdateRequest,
    onProgress?: (progress: DownloadProgress) => void
  ) => Promise<DownloadedUpdate>;
  installUpdate: (path: string) => Promise<void>;
  exportDocument: (
    request: ExportDocumentRequest
  ) => Promise<MarkdownSavedFile | null>;
  minimizeWindow: () => Promise<void>;
  toggleMaximizeWindow: () => Promise<boolean>;
  closeWindow: () => Promise<void>;
  isWindowMaximized: () => Promise<boolean>;
}

declare global {
  interface Window {
    desktop?: DesktopApi;
  }
}
