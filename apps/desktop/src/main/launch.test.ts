import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vite-plus/test";

import { findMarkdownPath } from "#src/main/launch.ts";

describe("the file the operating system opens", () => {
  const root = mkdtempSync(path.join(tmpdir(), "markdownview-launch-"));

  mkdirSync(path.join(root, "folder.md"));
  writeFileSync(path.join(root, "note.md"), "# note");
  writeFileSync(path.join(root, "other.markdown"), "# other");
  writeFileSync(path.join(root, "picture.png"), "png");

  const note = path.join(root, "note.md");
  const other = path.join(root, "other.markdown");

  afterAll(() => {
    rmSync(root, { force: true, recursive: true });
  });

  it("skips the executable, app path, and flags", () => {
    expect(
      findMarkdownPath(["/app/electron", ".", "--inspect", note], root)
    ).toBe(note);
  });

  it("resolves a relative path against the working directory", () => {
    expect(findMarkdownPath(["note.md"], root)).toBe(note);
  });

  it("accepts the .markdown extension", () => {
    expect(findMarkdownPath(["other.markdown"], root)).toBe(other);
  });

  it("ignores directories and files that are not Markdown", () => {
    expect(findMarkdownPath(["folder.md", "picture.png"], root)).toBeNull();
  });

  it("returns null when there is no file to open", () => {
    expect(findMarkdownPath(["/app/electron", "."], root)).toBeNull();
  });
});
