import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vite-plus/test";

import { createRecentFilesStore } from "#src/main/recent-files.ts";

describe("the recent files store", () => {
  const roots: string[] = [];

  const makeStore = () => {
    const root = mkdtempSync(path.join(tmpdir(), "markdownview-recent-"));
    roots.push(root);

    let clock = 1000;

    return {
      fileFor: (name: string) => {
        const filePath = path.join(root, name);
        writeFileSync(filePath, "# note");

        return filePath;
      },
      root,
      store: createRecentFilesStore(
        path.join(root, "recent-files.json"),
        () => clock
      ),
      tick: (milliseconds = 1000) => {
        clock += milliseconds;
      },
    };
  };

  afterAll(() => {
    for (const root of roots) {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("returns the most recently opened file first", async () => {
    const { fileFor, store, tick } = makeStore();
    const first = fileFor("first.md");
    const second = fileFor("second.md");

    await store.remember(first);
    tick();
    await store.remember(second);
    tick();
    await store.remember(first);

    await expect(store.list()).resolves.toStrictEqual([
      {
        directory: path.dirname(first),
        name: "first.md",
        openedAt: 3000,
        path: first,
      },
      {
        directory: path.dirname(second),
        name: "second.md",
        openedAt: 2000,
        path: second,
      },
    ]);
  });

  it("keeps at most ten files", async () => {
    const { fileFor, store } = makeStore();

    const files = Array.from({ length: 12 }, (_, index) =>
      fileFor(`note-${index}.md`)
    );

    await Promise.all(
      files.map(async (file) => {
        await store.remember(file);
      })
    );

    const listed = await store.list();

    expect(listed).toHaveLength(10);
    expect(listed[0]?.path).toBe(files[11]);
    expect(listed.at(-1)?.path).toBe(files[2]);
  });

  it("drops files that are no longer on disk", async () => {
    const { fileFor, store } = makeStore();
    const kept = fileFor("kept.md");
    const removed = fileFor("removed.md");

    await store.remember(kept);
    await store.remember(removed);
    rmSync(removed);

    await expect(store.list()).resolves.toStrictEqual([
      {
        directory: path.dirname(kept),
        name: "kept.md",
        openedAt: 1000,
        path: kept,
      },
    ]);
  });

  it("reads entries saved before timestamps existed", async () => {
    const { fileFor, root, store } = makeStore();
    const legacy = fileFor("legacy.md");

    writeFileSync(
      path.join(root, "recent-files.json"),
      JSON.stringify([{ name: "legacy.md", path: legacy }])
    );

    await expect(store.list()).resolves.toStrictEqual([
      {
        directory: path.dirname(legacy),
        name: "legacy.md",
        openedAt: 0,
        path: legacy,
      },
    ]);
  });

  it("recognizes a remembered file and can clear the list", async () => {
    const { fileFor, store } = makeStore();
    const file = fileFor("known.md");

    await store.remember(file);

    await expect(store.contains(file)).resolves.toBeTruthy();
    await expect(store.contains(fileFor("unknown.md"))).resolves.toBeFalsy();

    await store.clear();

    await expect(store.list()).resolves.toStrictEqual([]);
  });

  it("starts empty when the stored history is not valid JSON", async () => {
    const { root, store } = makeStore();

    writeFileSync(path.join(root, "recent-files.json"), "{ broken");

    await expect(store.list()).resolves.toStrictEqual([]);
  });
});
