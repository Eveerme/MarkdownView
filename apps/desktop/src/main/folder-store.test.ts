import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vite-plus/test";

import {
  readStoredFolders,
  writeStoredFolders,
} from "#src/main/folder-store.ts";

describe("the folder store", () => {
  const roots: string[] = [];

  const makeFile = () => {
    const root = mkdtempSync(path.join(tmpdir(), "markdownview-folders-"));
    roots.push(root);

    return path.join(root, "folders.json");
  };

  afterAll(() => {
    for (const root of roots) {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("round-trips absolute paths without duplicates", async () => {
    const file = makeFile();
    const first = path.join(path.dirname(file), "notes");
    const second = path.join(path.dirname(file), "journal");

    await writeStoredFolders(file, [first, second, first]);

    await expect(readStoredFolders(file)).resolves.toStrictEqual([
      first,
      second,
    ]);
  });

  it("starts empty when the stored file is invalid", async () => {
    const file = makeFile();

    writeFileSync(file, "{ broken");

    await expect(readStoredFolders(file)).resolves.toStrictEqual([]);
  });
});
