import {
  ChevronRightIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  RefreshCwIcon,
  XIcon,
} from "lucide-react";
import { useMemo } from "react";
import type { ReactNode } from "react";

import type { MarkdownFile, MarkdownFolder } from "@markdownview/electron";
import { Button } from "@markdownview/ui/components/button";

import {
  buildFileTree,
  directoryKey,
  expandedKeysForFile,
  rootKey,
} from "#src/lib/file-tree.ts";
import type { FileTreeDirectory } from "#src/lib/file-tree.ts";

interface FileTreeProps {
  activePath: string | null;
  expanded: ReadonlySet<string>;
  folders: MarkdownFolder[];
  onOpen: (path: string) => void;
  onRefresh: (folderPath: string) => void;
  onRemove: (folderPath: string) => void;
  onToggle: (key: string) => void;
}

interface FileRowProps {
  active: boolean;
  file: MarkdownFile;
  onOpen: (path: string) => void;
}

const FileRow = ({ active, file, onOpen }: FileRowProps) => (
  <li>
    <button
      className={`group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
      }`}
      onClick={() => {
        onOpen(file.path);
      }}
      title={file.relativePath}
      type="button"
    >
      <FileTextIcon
        className={`size-3.5 shrink-0 ${
          active ? "text-primary" : "opacity-50"
        }`}
      />
      <span className="truncate">{file.name}</span>
    </button>
  </li>
);

interface DirectoryNodeProps {
  activeKeys: ReadonlySet<string>;
  activePath: string | null;
  directory: FileTreeDirectory;
  expanded: ReadonlySet<string>;
  folderPath: string;
  onOpen: (path: string) => void;
  onToggle: (key: string) => void;
}

const DirectoryNode = ({
  activeKeys,
  activePath,
  directory,
  expanded,
  folderPath,
  onOpen,
  onToggle,
}: DirectoryNodeProps) => {
  const key = directoryKey(folderPath, directory.relativePath);
  const open = expanded.has(key) || activeKeys.has(key);

  return (
    <li>
      <button
        aria-expanded={open}
        className="text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs transition-colors"
        onClick={() => {
          onToggle(key);
        }}
        type="button"
      >
        <ChevronRightIcon
          className={`size-3 shrink-0 transition-transform ${
            open ? "rotate-90" : ""
          }`}
        />
        {open ? (
          <FolderOpenIcon className="size-3.5 shrink-0 opacity-60" />
        ) : (
          <FolderIcon className="size-3.5 shrink-0 opacity-60" />
        )}
        <span className="truncate">{directory.name}</span>
      </button>
      {open ? (
        <ul className="border-border/60 ml-3 space-y-0.5 border-l pl-1">
          {directory.directories.map((child) => (
            <DirectoryNode
              activeKeys={activeKeys}
              activePath={activePath}
              directory={child}
              expanded={expanded}
              folderPath={folderPath}
              key={child.relativePath}
              onOpen={onOpen}
              onToggle={onToggle}
            />
          ))}
          {directory.files.map((file) => (
            <FileRow
              active={file.path === activePath}
              file={file}
              key={file.path}
              onOpen={onOpen}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
};

interface FolderRootProps {
  activeKeys: ReadonlySet<string>;
  activePath: string | null;
  expanded: ReadonlySet<string>;
  folder: MarkdownFolder;
  onOpen: (path: string) => void;
  onRefresh: (folderPath: string) => void;
  onRemove: (folderPath: string) => void;
  onToggle: (key: string) => void;
}

const FolderRoot = ({
  activeKeys,
  activePath,
  expanded,
  folder,
  onOpen,
  onRefresh,
  onRemove,
  onToggle,
}: FolderRootProps) => {
  const key = rootKey(folder.path);
  const open = expanded.has(key) || activeKeys.has(key);
  const tree = useMemo(() => buildFileTree(folder.files), [folder.files]);
  let contents: ReactNode = null;

  if (open) {
    contents =
      folder.files.length === 0 ? (
        <p className="text-muted-foreground px-4 py-2 text-xs leading-relaxed">
          这个文件夹里还没有 Markdown 文件。
        </p>
      ) : (
        <ul className="space-y-0.5 px-1">
          {tree.directories.map((directory) => (
            <DirectoryNode
              activeKeys={activeKeys}
              activePath={activePath}
              directory={directory}
              expanded={expanded}
              folderPath={folder.path}
              key={directory.relativePath}
              onOpen={onOpen}
              onToggle={onToggle}
            />
          ))}
          {tree.files.map((file) => (
            <FileRow
              active={file.path === activePath}
              file={file}
              key={file.path}
              onOpen={onOpen}
            />
          ))}
        </ul>
      );
  }

  return (
    <section className="space-y-0.5">
      <div className="hover:bg-sidebar-accent/40 flex items-center gap-0.5 rounded-md pr-0.5">
        <button
          aria-expanded={open}
          className="text-sidebar-foreground flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors"
          onClick={() => {
            onToggle(key);
          }}
          title={folder.path}
          type="button"
        >
          <ChevronRightIcon
            className={`size-3 shrink-0 transition-transform ${
              open ? "rotate-90" : ""
            }`}
          />
          {open ? (
            <FolderOpenIcon className="text-primary size-3.5 shrink-0" />
          ) : (
            <FolderIcon className="text-primary size-3.5 shrink-0" />
          )}
          <span className="truncate">{folder.name}</span>
        </button>
        <Button
          aria-label={`刷新 ${folder.name}`}
          onClick={() => {
            onRefresh(folder.path);
          }}
          size="icon-xs"
          title="刷新文件夹"
          variant="ghost"
        >
          <RefreshCwIcon />
        </Button>
        <Button
          aria-label={`移出 ${folder.name}`}
          onClick={() => {
            onRemove(folder.path);
          }}
          size="icon-xs"
          title="从工作区移出"
          variant="ghost"
        >
          <XIcon />
        </Button>
      </div>

      {folder.truncated ? (
        <p className="text-muted-foreground px-2 text-xs leading-relaxed">
          文件较多，列表可能不完整。
        </p>
      ) : null}

      {contents}
    </section>
  );
};

export const FileTree = ({
  activePath,
  expanded,
  folders,
  onOpen,
  onRefresh,
  onRemove,
  onToggle,
}: FileTreeProps) => {
  const activeKeys = useMemo(() => {
    const keys = new Set<string>();

    for (const folder of folders) {
      const file = folder.files.find((entry) => entry.path === activePath);

      if (file !== undefined) {
        for (const key of expandedKeysForFile(folder.path, file.relativePath)) {
          keys.add(key);
        }
      }
    }

    return keys;
  }, [activePath, folders]);

  return (
    <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
      <div className="space-y-2">
        {folders.map((folder) => (
          <FolderRoot
            activeKeys={activeKeys}
            activePath={activePath}
            expanded={expanded}
            folder={folder}
            key={folder.path}
            onOpen={onOpen}
            onRefresh={onRefresh}
            onRemove={onRemove}
            onToggle={onToggle}
          />
        ))}
      </div>
    </nav>
  );
};
