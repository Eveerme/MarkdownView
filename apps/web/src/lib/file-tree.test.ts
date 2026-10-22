import { describe, expect, it } from "vite-plus/test";

import type { MarkdownFile } from "@markdownview/electron";

import { buildFileTree, expandedKeysForFile } from "#src/lib/file-tree.ts";

const file = (relativePath: string): MarkdownFile => ({
  name: relativePath.split("/").at(-1) ?? relativePath,
  path: `C:/notes/${relativePath}`,
  relativePath,
});

describe("the file tree", () => {
  it("groups nested files and sorts folders before files", () => {
    const tree = buildFileTree([
      file("zebra.md"),
      file("notes/deep/nested.md"),
      file("notes/alpha.md"),
      file("projects/plan.md"),
      file("alpha.md"),
    ]);

    expect(tree.directories.map((directory) => directory.name)).toStrictEqual([
      "notes",
      "projects",
    ]);
    expect(tree.files.map((entry) => entry.name)).toStrictEqual([
      "alpha.md",
      "zebra.md",
    ]);
    expect(
      tree.directories[0]?.directories.map((directory) => directory.name)
    ).toStrictEqual(["deep"]);
    expect(tree.directories[0]?.files.map((entry) => entry.name)).toStrictEqual(
      ["alpha.md"]
    );
  });

  it("expands the root and every parent folder of a file", () => {
    expect(
      expandedKeysForFile("C:/notes", "notes/deep/nested.md")
    ).toStrictEqual(["C:/notes\0", "C:/notes\0notes", "C:/notes\0notes/deep"]);
  });
});
