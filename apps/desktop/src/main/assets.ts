import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { SaveImageRequest, SavedImage } from "@markdownview/electron";

const extensionsByMime = new Map([
  ["image/avif", "avif"],
  ["image/bmp", "bmp"],
  ["image/gif", "gif"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/svg+xml", "svg"],
  ["image/webp", "webp"],
]);

export const maxImageBytes = 25 * 1024 * 1024;

/** The extension a pasted image is stored with, or null for a format we do not accept. */
export const imageExtensionFor = (mimeType: string) =>
  extensionsByMime.get(mimeType.split(";")[0]?.trim().toLowerCase() ?? "") ??
  null;

const timestamp = (date: Date) =>
  date.toISOString().replaceAll(/\D/gu, "").slice(0, 14);

export const imageFileName = (date: Date, id: string, extension: string) =>
  `image-${timestamp(date)}-${id}.${extension}`;

/**
 * Writes a pasted or dropped image beside its note and returns the path to
 * link from the Markdown source. The document path was already checked by the
 * caller; this only owns naming and storage.
 */
export const saveImageAsset = async ({
  data,
  from,
  mimeType,
}: SaveImageRequest): Promise<SavedImage> => {
  const extension = imageExtensionFor(mimeType);

  if (extension === null) {
    throw new Error("不支持的图片格式");
  }

  if (data.byteLength === 0) {
    throw new Error("图片内容为空");
  }

  if (data.byteLength > maxImageBytes) {
    throw new Error("图片超过 25 MB");
  }

  const directory = path.join(path.dirname(from), "assets");

  await mkdir(directory, { recursive: true });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const name = imageFileName(new Date(), randomUUID().slice(0, 8), extension);

    try {
      // A name collision is retried only after the previous write settles.
      // oxlint-disable-next-line eslint/no-await-in-loop
      await writeFile(path.join(directory, name), data, { flag: "wx" });

      return { relativePath: `assets/${name}` };
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !("code" in error) ||
        error.code !== "EEXIST"
      ) {
        throw error;
      }
    }
  }

  throw new Error("无法生成唯一的图片文件名");
};
