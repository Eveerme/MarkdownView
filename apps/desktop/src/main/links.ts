import { stat } from "node:fs/promises";
import path from "node:path";

import type { ResolvedLink } from "@markdownview/electron";

import { isMarkdownPath } from "#src/main/files.ts";

const schemePattern = /^[a-z][a-z0-9+.-]*:/iu;

interface ParsedMarkdownHref {
  anchor: string | null;
  relativePath: string;
}

/** A relative Markdown link, split into its path and optional heading anchor. */
export const parseMarkdownHref = (href: string): ParsedMarkdownHref | null => {
  const value = href.trim();

  if (value === "" || value.startsWith("#")) {
    return null;
  }

  if (value.startsWith("//") || schemePattern.test(value)) {
    return null;
  }

  const hashIndex = value.indexOf("#");
  const fragment = hashIndex === -1 ? null : value.slice(hashIndex + 1);
  const beforeHash = hashIndex === -1 ? value : value.slice(0, hashIndex);
  const queryIndex = beforeHash.indexOf("?");

  const pathname =
    queryIndex === -1 ? beforeHash : beforeHash.slice(0, queryIndex);

  if (
    pathname === "" ||
    pathname.startsWith("/") ||
    pathname.startsWith("\\")
  ) {
    return null;
  }

  try {
    const relativePath = decodeURIComponent(pathname).replaceAll("\\", "/");

    if (relativePath === "" || relativePath.includes("\0")) {
      return null;
    }

    const anchor =
      fragment === null || fragment === ""
        ? null
        : decodeURIComponent(fragment);

    return { anchor, relativePath };
  } catch {
    return null;
  }
};

export const isPathInside = (root: string, target: string) => {
  const relative = path.relative(root, target);

  return (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
};

export const resolveMarkdownLink = async ({
  currentPath,
  href,
  roots,
}: {
  currentPath: string;
  href: string;
  roots: readonly string[];
}): Promise<ResolvedLink | null> => {
  const parsed = parseMarkdownHref(href);

  if (parsed === null) {
    return null;
  }

  const target = path.resolve(path.dirname(currentPath), parsed.relativePath);

  if (!isMarkdownPath(target)) {
    return null;
  }

  if (!roots.some((root) => isPathInside(root, target))) {
    throw new Error("这个链接指向的文件夹还没有打开");
  }

  let info;

  try {
    info = await stat(target);
  } catch {
    throw new Error(`找不到链接的文件：${parsed.relativePath}`);
  }

  if (!info.isFile()) {
    throw new Error(`链接目标不是文件：${parsed.relativePath}`);
  }

  return { anchor: parsed.anchor, name: path.basename(target), path: target };
};
