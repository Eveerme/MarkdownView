import type { MarkdownFile } from "@markdownview/electron";

const collator = new Intl.Collator("zh-CN", {
  numeric: true,
  sensitivity: "base",
});

export interface FileTreeDirectory {
  directories: FileTreeDirectory[];
  files: MarkdownFile[];
  name: string;
  relativePath: string;
}

interface MutableDirectory {
  directories: Map<string, MutableDirectory>;
  files: MarkdownFile[];
  name: string;
  relativePath: string;
}

const createDirectory = (
  name: string,
  relativePath: string
): MutableDirectory => ({
  directories: new Map(),
  files: [],
  name,
  relativePath,
});

const finish = (directory: MutableDirectory): FileTreeDirectory => ({
  directories: [...directory.directories.values()]
    .toSorted((left, right) => collator.compare(left.name, right.name))
    .map(finish),
  files: directory.files.toSorted((left, right) =>
    collator.compare(left.name, right.name)
  ),
  name: directory.name,
  relativePath: directory.relativePath,
});

export const buildFileTree = (
  files: readonly MarkdownFile[]
): FileTreeDirectory => {
  const root = createDirectory("", "");

  for (const file of files) {
    const parts = file.relativePath.split("/");

    parts.pop();

    let current = root;
    let pathSoFar = "";

    for (const part of parts) {
      pathSoFar = pathSoFar === "" ? part : `${pathSoFar}/${part}`;

      let child = current.directories.get(part);

      if (child === undefined) {
        child = createDirectory(part, pathSoFar);
        current.directories.set(part, child);
      }

      current = child;
    }

    current.files.push(file);
  }

  return finish(root);
};

export const rootKey = (folderPath: string) => `${folderPath}\0`;

export const directoryKey = (folderPath: string, relativePath: string) =>
  `${rootKey(folderPath)}${relativePath}`;

/** The root and every folder that has to be open to reveal the file. */
export const expandedKeysForFile = (
  folderPath: string,
  relativePath: string
): string[] => {
  const parts = relativePath.split("/");

  parts.pop();

  const keys = [rootKey(folderPath)];
  let pathSoFar = "";

  for (const part of parts) {
    pathSoFar = pathSoFar === "" ? part : `${pathSoFar}/${part}`;
    keys.push(directoryKey(folderPath, pathSoFar));
  }

  return keys;
};
