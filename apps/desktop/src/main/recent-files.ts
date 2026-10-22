import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import type { RecentFile } from "@markdownview/electron";

const limit = 10;

const storedEntrySchema = z.object({
  name: z.string().min(1),
  openedAt: z.number().int().nonnegative().optional(),
  path: z.string().min(1),
});

const storedHistorySchema = z.array(storedEntrySchema);

type StoredEntry = z.infer<typeof storedEntrySchema>;

const readStored = async (historyFile: string): Promise<StoredEntry[]> => {
  try {
    const value: unknown = JSON.parse(await readFile(historyFile, "utf-8"));
    const parsed = storedHistorySchema.safeParse(value);

    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
};

const writeStored = async (historyFile: string, entries: StoredEntry[]) => {
  await mkdir(path.dirname(historyFile), { recursive: true });
  await writeFile(
    historyFile,
    `${JSON.stringify(entries, null, 2)}\n`,
    "utf-8"
  );
};

interface RecentFilesStore {
  list: () => Promise<RecentFile[]>;
  remember: (filePath: string) => Promise<void>;
  contains: (filePath: string) => Promise<boolean>;
  clear: () => Promise<void>;
}

/**
 * The list is a convenience, so reads are best effort; a corrupted or missing
 * history file starts empty instead of failing the app.
 */
export const createRecentFilesStore = (
  historyFile: string,
  now: () => number = Date.now
): RecentFilesStore => {
  let locked = false;
  const waiters: (() => void)[] = [];

  // Reads and writes touch the same file; one at a time keeps them consistent.
  const withLock = async <T>(task: () => Promise<T>): Promise<T> => {
    if (locked) {
      await new Promise<void>((resolve) => {
        waiters.push(resolve);
      });

      // A caller that arrived after the lock was released may have taken it.
      return await withLock(task);
    }

    locked = true;

    try {
      return await task();
    } finally {
      locked = false;
      waiters.shift()?.();
    }
  };

  return {
    list: async () =>
      await withLock(async () => {
        const entries = await readStored(historyFile);

        const checked = await Promise.all(
          entries.map(async (entry) => {
            try {
              const info = await stat(entry.path);

              return info.isFile() ? entry : null;
            } catch {
              return null;
            }
          })
        );

        const existing = checked.filter(
          (entry): entry is StoredEntry => entry !== null
        );

        if (existing.length !== entries.length) {
          try {
            await writeStored(historyFile, existing);
          } catch {
            // Pruning is best effort; the in-memory list is still useful.
          }
        }

        return existing.map((entry) => ({
          directory: path.dirname(entry.path),
          name: entry.name,
          openedAt: entry.openedAt ?? 0,
          path: entry.path,
        }));
      }),

    remember: async (filePath) => {
      await withLock(async () => {
        const absolute = path.resolve(filePath);
        const entries = await readStored(historyFile);

        const next = [
          { name: path.basename(absolute), openedAt: now(), path: absolute },
          ...entries.filter((entry) => entry.path !== absolute),
        ].slice(0, limit);

        await writeStored(historyFile, next);
      });
    },

    contains: async (filePath) =>
      await withLock(async () => {
        const absolute = path.resolve(filePath);
        const entries = await readStored(historyFile);

        return entries.some((entry) => entry.path === absolute);
      }),

    clear: async () => {
      await withLock(async () => {
        await writeStored(historyFile, []);
      });
    },
  };
};
