import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { app, BrowserWindow, dialog } from "electron";
import type { BrowserWindow as ElectronWindow } from "electron";

import type {
  ExportDocumentRequest,
  MarkdownSavedFile,
} from "@markdownview/electron";

const titles = {
  html: "导出 HTML",
  pdf: "导出 PDF",
} as const;

const filters = {
  html: [{ name: "HTML", extensions: ["html"] }],
  pdf: [{ name: "PDF", extensions: ["pdf"] }],
};

const withExtension = (
  filePath: string,
  format: ExportDocumentRequest["format"]
) =>
  filePath.toLowerCase().endsWith(`.${format}`)
    ? filePath
    : `${filePath}.${format}`;

/** Prints the standalone export through a hidden window, so the app UI never changes. */
const writePdf = async (html: string, target: string) => {
  const directory = await mkdtemp(path.join(tmpdir(), "markdownview-export-"));
  const source = path.join(directory, "document.html");

  try {
    await writeFile(source, html, "utf-8");

    const window = new BrowserWindow({
      show: false,
      webPreferences: {
        contextIsolation: true,
        javascript: false,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    try {
      await window.loadFile(source);

      const pdf = await window.webContents.printToPDF({
        preferCSSPageSize: true,
        printBackground: true,
      });

      await writeFile(target, pdf);
    } finally {
      window.destroy();
    }
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
};

export const exportMarkdownDocument = async (
  { format, html, suggestedName }: ExportDocumentRequest,
  window: ElectronWindow | null
): Promise<MarkdownSavedFile | null> => {
  const options = {
    defaultPath: path.join(
      app.getPath("documents"),
      `${suggestedName}.${format}`
    ),
    filters: [...filters[format]],
    title: titles[format],
  };

  const result =
    window === null
      ? await dialog.showSaveDialog(options)
      : await dialog.showSaveDialog(window, options);

  if (result.canceled || result.filePath === undefined) {
    return null;
  }

  const target = withExtension(result.filePath, format);

  await (format === "html"
    ? writeFile(target, html, "utf-8")
    : writePdf(html, target));

  return { name: path.basename(target), path: target };
};
