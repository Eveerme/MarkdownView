import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vite-plus/test";

import {
  isPathInside,
  parseMarkdownHref,
  resolveMarkdownLink,
} from "#src/main/links.ts";

describe("Markdown links", () => {
  const root = mkdtempSync(path.join(tmpdir(), "markdownview-links-"));

  mkdirSync(path.join(root, "notes", "deep"), { recursive: true });
  mkdirSync(path.join(root, "other"), { recursive: true });

  for (const file of [
    "a.md",
    "b.md",
    "notes/c.md",
    "notes/deep/d.md",
    "other/e.md",
    "image.png",
  ]) {
    writeFileSync(path.join(root, file), "# note");
  }

  const notesRoot = path.join(root, "notes");
  const current = path.join(notesRoot, "c.md");

  afterAll(() => {
    rmSync(root, { force: true, recursive: true });
  });

  describe("parsing", () => {
    it("keeps a relative path and heading anchor", () => {
      expect(parseMarkdownHref("../b.md#章节")).toStrictEqual({
        anchor: "章节",
        relativePath: "../b.md",
      });
    });

    it("decodes Chinese file names and spaces", () => {
      expect(
        parseMarkdownHref("0010-%E4%BA%A7%E5%93%81%E5%AE%9A%E4%BD%8D.md")
      ).toStrictEqual({
        anchor: null,
        relativePath: "0010-产品定位.md",
      });
      expect(parseMarkdownHref("my%20note.md")?.relativePath).toBe(
        "my note.md"
      );
    });

    it("removes a query string", () => {
      expect(parseMarkdownHref("note.md?raw=1#top")).toStrictEqual({
        anchor: "top",
        relativePath: "note.md",
      });
    });

    it("rejects external, absolute, and anchor-only links", () => {
      for (const href of [
        "https://example.com/note.md",
        "mailto:someone@example.com",
        "file:///C:/note.md",
        "/absolute.md",
        "\\absolute.md",
        "//example.com/note.md",
        "C:\\note.md",
        "#local",
      ]) {
        expect(parseMarkdownHref(href)).toBeNull();
      }
    });
  });

  describe("resolving", () => {
    it("opens a file beside the current document", async () => {
      await expect(
        resolveMarkdownLink({
          currentPath: path.join(root, "a.md"),
          href: "b.md",
          roots: [root],
        })
      ).resolves.toStrictEqual({
        anchor: null,
        name: "b.md",
        path: path.join(root, "b.md"),
      });
    });

    it("opens a file in a subfolder of the current folder", async () => {
      await expect(
        resolveMarkdownLink({
          currentPath: current,
          href: "deep/d.md",
          roots: [notesRoot],
        })
      ).resolves.toStrictEqual({
        anchor: null,
        name: "d.md",
        path: path.join(notesRoot, "deep", "d.md"),
      });
    });

    it("allows a parent folder only when it is an opened root", async () => {
      await expect(
        resolveMarkdownLink({
          currentPath: current,
          href: "../b.md",
          roots: [notesRoot],
        })
      ).rejects.toThrow("文件夹还没有打开");

      await expect(
        resolveMarkdownLink({
          currentPath: current,
          href: "../b.md",
          roots: [root],
        })
      ).resolves.toMatchObject({ path: path.join(root, "b.md") });
    });

    it("rejects missing files and non-Markdown targets", async () => {
      await expect(
        resolveMarkdownLink({
          currentPath: current,
          href: "missing.md",
          roots: [root],
        })
      ).rejects.toThrow("找不到链接的文件");

      await expect(
        resolveMarkdownLink({
          currentPath: current,
          href: "../image.png",
          roots: [root],
        })
      ).resolves.toBeNull();
    });
  });

  describe("containment", () => {
    it("does not confuse a ..file name with a parent directory", () => {
      expect(isPathInside(root, path.join(root, "..note.md"))).toBeTruthy();
      expect(isPathInside(root, path.join(root, "..", "note.md"))).toBeFalsy();
    });
  });
});
