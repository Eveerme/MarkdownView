import { statSync } from "node:fs";
import path from "node:path";

import { isMarkdownPath } from "#src/main/files.ts";

/**
 * The first Markdown file the operating system passed to the app. Electron
 * mixes executable, app and flag arguments into argv, so only an existing
 * Markdown file counts.
 */
export const findMarkdownPath = (
  args: readonly string[],
  workingDirectory: string
): string | null => {
  for (const arg of args) {
    if (arg.startsWith("-") || arg.includes("://")) {
      continue;
    }

    const candidate = path.resolve(workingDirectory, arg);

    if (!isMarkdownPath(candidate)) {
      continue;
    }

    try {
      if (statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      // A path the shell mentioned but that no longer exists is not a file to open.
    }
  }

  return null;
};
