import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

const storedFoldersSchema = z.array(z.string().min(1));

const normalize = (folders: readonly string[]) => [
  ...new Set(folders.map((folder) => path.resolve(folder))),
];

export const readStoredFolders = async (
  foldersFile: string
): Promise<string[]> => {
  try {
    const value: unknown = JSON.parse(await readFile(foldersFile, "utf-8"));
    const parsed = storedFoldersSchema.safeParse(value);

    return parsed.success ? normalize(parsed.data) : [];
  } catch {
    return [];
  }
};

export const writeStoredFolders = async (
  foldersFile: string,
  folders: readonly string[]
) => {
  await mkdir(path.dirname(foldersFile), { recursive: true });
  await writeFile(
    foldersFile,
    `${JSON.stringify(normalize(folders), null, 2)}\n`,
    "utf-8"
  );
};
