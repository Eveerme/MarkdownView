import {
  FileTextIcon,
  FolderPlusIcon,
  FolderTreeIcon,
  RefreshCwIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import type { MarkdownFolder } from "@markdownview/electron";
import { Button } from "@markdownview/ui/components/button";

interface FileSidebarProps {
  activePath: string | null;
  folder: MarkdownFolder | null;
  onOpen: (path: string) => void;
  onOpenFolder: () => void;
  onRefresh: () => void;
}

const directoryOf = (relativePath: string) => {
  const index = relativePath.lastIndexOf("/");

  return index === -1 ? null : relativePath.slice(0, index);
};

const emptyLibrary = (onOpenFolder: () => void) => (
  <div className="px-4 py-5">
    <p className="text-muted-foreground text-xs leading-relaxed">
      打开一个文件夹，所有 Markdown 笔记都会列在这里。
    </p>
    <Button
      className="mt-3 w-full"
      onClick={onOpenFolder}
      size="sm"
      variant="outline"
    >
      <FolderPlusIcon />
      打开文件夹
    </Button>
  </div>
);

export const FileSidebar = ({
  activePath,
  folder,
  onOpen,
  onOpenFolder,
  onRefresh,
}: FileSidebarProps) => {
  let body: ReactNode;

  if (folder === null) {
    body = emptyLibrary(onOpenFolder);
  } else if (folder.files.length === 0) {
    body = (
      <p className="text-muted-foreground px-4 py-5 text-xs leading-relaxed">
        这个文件夹里还没有 Markdown 文件。
      </p>
    );
  } else {
    body = (
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        <ul className="space-y-0.5">
          {folder.files.map((file) => {
            const directory = directoryOf(file.relativePath);
            const active = file.path === activePath;

            return (
              <li key={file.path}>
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
                  {directory === null ? null : (
                    <span className="ml-auto max-w-[45%] truncate text-xs opacity-60">
                      {directory}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <aside className="bg-sidebar flex w-60 shrink-0 flex-col border-r">
      <div className="flex h-10 items-center gap-1.5 px-3">
        <FolderTreeIcon className="text-muted-foreground size-3.5" />
        <span className="text-muted-foreground truncate text-xs font-semibold tracking-wide">
          {folder?.name ?? "笔记库"}
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          {folder === null ? null : (
            <Button
              aria-label="刷新文件列表"
              onClick={onRefresh}
              size="icon-xs"
              title="刷新"
              variant="ghost"
            >
              <RefreshCwIcon />
            </Button>
          )}
          <Button
            aria-label="打开文件夹"
            onClick={onOpenFolder}
            size="icon-xs"
            title="打开文件夹"
            variant="ghost"
          >
            <FolderPlusIcon />
          </Button>
        </div>
      </div>

      {body}
    </aside>
  );
};
