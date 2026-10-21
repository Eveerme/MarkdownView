import { z } from "zod";

export const desktopBridgeGlobal = "desktop";

// https, because clients such as Better Auth accept only http and https origins.
export const rendererHost = "app.localhost";
export const rendererOrigin = `https://${rendererHost}`;

export const desktopChannels = {
  versions: "desktop:versions",
  openFile: "desktop:file:open",
  openFolder: "desktop:folder:open",
  refreshFolder: "desktop:folder:refresh",
  readFile: "desktop:file:read",
  saveFile: "desktop:file:save",
  saveFileAs: "desktop:file:save-as",
} as const;

export const versionsSchema = z.object({
  app: z.string(),
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

export const markdownFolderSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
  files: z.array(markdownFileSchema),
});

export type MarkdownFolder = z.infer<typeof markdownFolderSchema>;

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

export const filePathSchema = z.string().min(1);

export interface DesktopApi {
  versions: () => Promise<DesktopVersions>;
  openFile: () => Promise<MarkdownDocument | null>;
  openFolder: () => Promise<MarkdownFolder | null>;
  refreshFolder: (path: string) => Promise<MarkdownFolder>;
  readFile: (path: string) => Promise<MarkdownDocument>;
  saveFile: (request: SaveFileRequest) => Promise<MarkdownSavedFile>;
  saveFileAs: (request: SaveFileAsRequest) => Promise<MarkdownSavedFile | null>;
}

declare global {
  interface Window {
    desktop?: DesktopApi;
  }
}
