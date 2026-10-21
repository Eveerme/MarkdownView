import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vite-plus/test";

import {
  isMarkdownPath,
  listMarkdownFiles,
  readMarkdownDocument,
  writeMarkdownDocument,
} from "#src/main/files.ts";

describe("the desktop file layer", () => {
  const root = mkdtempSync(path.join(tmpdir(), "markdownview-files-"));

  mkdirSync(path.join(root, "notes", "deep"), { recursive: true });
  mkdirSync(path.join(root, "node_modules", "pkg"), { recursive: true });
  mkdirSync(path.join(root, ".obsidian"), { recursive: true });

  for (const file of [
    "zebra.md",
    "alpha.md",
    "draft.markdown",
    "notes/deep/nested.md",
    "notes/picture.png",
    "node_modules/pkg/readme.md",
    ".obsidian/config.md",
  ]) {
    writeFileSync(path.join(root, file), `# ${file}`);
  }

  afterAll(() => {
    rmSync(root, { force: true, recursive: true });
  });

  describe("extensions", () => {
    it("accepts markdown files regardless of case", () => {
      expect(isMarkdownPath("note.md")).toBeTruthy();
      expect(isMarkdownPath("NOTE.MD")).toBeTruthy();
      expect(isMarkdownPath("note.markdown")).toBeTruthy();
    });

    it("leaves other files out", () => {
      expect(isMarkdownPath("note.txt")).toBeFalsy();
      expect(isMarkdownPath("note.mdx")).toBeFalsy();
      expect(isMarkdownPath("note.md.backup")).toBeFalsy();
    });
  });

  describe("listing a folder", () => {
    it("returns nested markdown, sorted, skipping tool folders", async () => {
      await expect(listMarkdownFiles(root)).resolves.toStrictEqual([
        {
          name: "alpha.md",
          path: path.join(root, "alpha.md"),
          relativePath: "alpha.md",
        },
        {
          name: "draft.markdown",
          path: path.join(root, "draft.markdown"),
          relativePath: "draft.markdown",
        },
        {
          name: "nested.md",
          path: path.join(root, "notes", "deep", "nested.md"),
          relativePath: "notes/deep/nested.md",
        },
        {
          name: "zebra.md",
          path: path.join(root, "zebra.md"),
          relativePath: "zebra.md",
        },
      ]);
    });
  });

  describe("reading and writing", () => {
    it("round-trips content and name", async () => {
      const filePath = path.join(root, "roundtrip.md");
      const saved = await writeMarkdownDocument(filePath, "# 标题\n\n正文");

      expect(saved).toStrictEqual({ name: "roundtrip.md", path: filePath });
      await expect(readMarkdownDocument(filePath)).resolves.toStrictEqual({
        content: "# 标题\n\n正文",
        name: "roundtrip.md",
        path: filePath,
      });
    });
  });
});
