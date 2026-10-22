import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

import { imageAssetHost } from "@markdownview/electron";

import { maxImageBytes } from "#src/main/assets.ts";
import { isPathInside } from "#src/main/links.ts";

const imageExtensions = new Set([
  ".avif",
  ".bmp",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp",
]);

const contentTypes = new Map([
  [".avif", "image/avif"],
  [".bmp", "image/bmp"],
  [".gif", "image/gif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

const schemePattern = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu;
const maxSourceLength = 4096;

export const isImagePath = (filePath: string) =>
  imageExtensions.has(path.extname(filePath).toLowerCase());

export interface ImageRequestContext {
  /** A Markdown file the user opened through the app. */
  isAllowedDocument: (filePath: string) => boolean;
  /** Folders the user opened, which bound where images may come from. */
  roots: readonly string[];
}

/** The file an image URL points at, or null when it is outside the allowed workspace. */
export const resolveImageRequest = async ({
  from,
  src,
  isAllowedDocument,
  roots,
}: ImageRequestContext & {
  from: string;
  src: string;
}): Promise<string | null> => {
  const documentPath = path.resolve(from);

  if (!isAllowedDocument(documentPath)) {
    return null;
  }

  const value = src.trim();

  if (
    value === "" ||
    value.length > maxSourceLength ||
    value.includes("\0") ||
    schemePattern.test(value)
  ) {
    return null;
  }

  const withoutFragment = value.split("#")[0]?.split("?")[0] ?? "";
  const candidate = path.resolve(path.dirname(documentPath), withoutFragment);

  if (withoutFragment === "" || !isImagePath(candidate)) {
    return null;
  }

  let target: string;

  try {
    target = await realpath(candidate);
  } catch {
    return null;
  }

  const allowedRoots = await Promise.all(
    [...new Set([...roots, path.dirname(documentPath)])].map(async (root) => {
      try {
        return await realpath(root);
      } catch {
        return null;
      }
    })
  );

  if (
    !allowedRoots.some((root) => root !== null && isPathInside(root, target))
  ) {
    return null;
  }

  try {
    const info = await stat(target);

    if (!info.isFile() || info.size > maxImageBytes) {
      return null;
    }
  } catch {
    return null;
  }

  return target;
};

const notFound = () => new Response(null, { status: 404 });

/** Serves `mdview://asset/?from=…&src=…`; only the app's opened notes can reach local files. */
export const createImageProtocolHandler =
  (context: () => ImageRequestContext | Promise<ImageRequestContext>) =>
  async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const src = url.searchParams.get("src");

    if (url.host !== imageAssetHost || from === null || src === null) {
      return notFound();
    }

    const target = await resolveImageRequest({
      ...(await context()),
      from,
      src,
    });

    if (target === null) {
      return notFound();
    }

    try {
      const data = await readFile(target);

      const contentType =
        contentTypes.get(path.extname(target).toLowerCase()) ??
        "application/octet-stream";

      return new Response(data, {
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": contentType,
        },
      });
    } catch {
      return notFound();
    }
  };
