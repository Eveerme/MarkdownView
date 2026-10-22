import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  MarkdownDocument,
  MarkdownFile,
  MarkdownSavedFile,
} from "@markdownview/electron";

const markdownExtensions = new Set([".md", ".markdown"]);

// Generated or tool-owned folders that never hold the user's notes.
const ignoredDirectories = new Set(["node_modules", "dist", "release"]);

const maxDepth = 16;
const maxFiles = 5000;

export const isMarkdownPath = (filePath: string) =>
  markdownExtensions.has(path.extname(filePath).toLowerCase());

interface WalkState {
  files: MarkdownFile[];
  truncated: boolean;
}

const walk = async (
  root: string,
  directory: string,
  depth: number,
  state: WalkState
) => {
  if (depth > maxDepth) {
    state.truncated = true;

    return;
  }

  if (state.truncated) {
    return;
  }

  const entries = await readdir(directory, { withFileTypes: true });
  const subdirectories: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const absolute = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        subdirectories.push(absolute);
      }

      continue;
    }

    if (entry.isFile() && isMarkdownPath(entry.name)) {
      if (state.files.length >= maxFiles) {
        state.truncated = true;

        return;
      }

      state.files.push({
        name: entry.name,
        path: absolute,
        relativePath: path.relative(root, absolute).split(path.sep).join("/"),
      });
    }
  }

  const pending: Promise<void>[] = [];

  for (const subdirectory of subdirectories) {
    pending.push(walk(root, subdirectory, depth + 1, state));
  }

  await Promise.all(pending);
};

export interface MarkdownListing {
  files: MarkdownFile[];
  truncated: boolean;
}

export const listMarkdownFiles = async (
  root: string
): Promise<MarkdownListing> => {
  const state: WalkState = { files: [], truncated: false };

  await walk(root, root, 0, state);

  return {
    files: state.files.toSorted((left, right) =>
      left.relativePath < right.relativePath ? -1 : 1
    ),
    truncated: state.truncated,
  };
};

export const readMarkdownDocument = async (
  filePath: string
): Promise<MarkdownDocument> => ({
  content: await readFile(filePath, "utf-8"),
  name: path.basename(filePath),
  path: filePath,
});

export const writeMarkdownDocument = async (
  filePath: string,
  content: string
): Promise<MarkdownSavedFile> => {
  await writeFile(filePath, content, "utf-8");

  return { name: path.basename(filePath), path: filePath };
};
