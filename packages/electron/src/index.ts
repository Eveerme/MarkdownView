import { z } from "zod";

export const desktopBridgeGlobal = "desktop";

// https, because clients such as Better Auth accept only http and https origins.
export const rendererHost = "app.localhost";
export const rendererOrigin = `https://${rendererHost}`;

export const desktopChannels = {
  versions: "desktop:versions",
  openFile: "desktop:file:open",
  openRequest: "desktop:file:open-request",
  takeOpenRequest: "desktop:file:take-open-request",
  openFolder: "desktop:folder:open",
  listFolders: "desktop:folder:list",
  closeFolder: "desktop:folder:close",
  refreshFolder: "desktop:folder:refresh",
  readFile: "desktop:file:read",
  resolveLink: "desktop:file:resolve-link",
  saveFile: "desktop:file:save",
  saveFileAs: "desktop:file:save-as",
  recentFiles: "desktop:recent-files:list",
  clearRecentFiles: "desktop:recent-files:clear",
  saveImage: "desktop:image:save",
  exportDocument: "desktop:document:export",
} as const;

/** The schemes the renderer loads local note images from. */
export const imageAssetScheme = "mdview";
export const imageAssetHost = "asset";

export const versionsSchema = z.object({
  chrome: z.string(),
  electron: z.string(),
  node: z.string(),
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
  data: z.instanceof(Uint8Array),
  from: z.string().min(1),
  mimeType: z.string().min(1),
});

export type SaveImageRequest = z.infer<typeof saveImageRequestSchema>;

export const savedImageSchema = z.object({
  relativePath: z.string().min(1),
});

export type SavedImage = z.infer<typeof savedImageSchema>;

export const exportDocumentRequestSchema = z.object({
  format: z.enum(["html", "pdf"]),
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
  openFolder: () => Promise<MarkdownFolder[] | null>;
  listFolders: () => Promise<MarkdownFolder[]>;
  closeFolder: (path: string) => Promise<void>;
  refreshFolder: (path: string) => Promise<MarkdownFolder>;
  readFile: (path: string) => Promise<MarkdownDocument>;
  resolveLink: (request: ResolveLinkRequest) => Promise<ResolvedLink | null>;
  saveFile: (request: SaveFileRequest) => Promise<MarkdownSavedFile>;
  saveFileAs: (request: SaveFileAsRequest) => Promise<MarkdownSavedFile | null>;
  recentFiles: () => Promise<RecentFile[]>;
  clearRecentFiles: () => Promise<void>;
  saveImage: (request: SaveImageRequest) => Promise<SavedImage>;
  exportDocument: (
    request: ExportDocumentRequest
  ) => Promise<MarkdownSavedFile | null>;
}

declare global {
  interface Window {
    desktop?: DesktopApi;
  }
}
