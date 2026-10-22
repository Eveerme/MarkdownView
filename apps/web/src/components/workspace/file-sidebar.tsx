import {
  ClockIcon,
  FolderPlusIcon,
  FolderTreeIcon,
  ListTreeIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import type { MarkdownFolder, RecentFile } from "@markdownview/electron";
import { Button } from "@markdownview/ui/components/button";

import { FileTree } from "#src/components/workspace/file-tree.tsx";
import { OutlineList } from "#src/components/workspace/outline-list.tsx";
import { RecentList } from "#src/components/workspace/recent-list.tsx";
import type { OutlineItem } from "#src/lib/outline.ts";
import type { SidebarView } from "#src/lib/use-workspace.ts";

interface FileSidebarProps {
  activePath: string | null;
  expanded: ReadonlySet<string>;
  folders: MarkdownFolder[];
  outline: OutlineItem[];
  recentFiles: RecentFile[];
  view: SidebarView;
  onClearRecent: () => void;
  onOpen: (path: string) => void;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onRefresh: (folderPath: string) => void;
  onRemove: (folderPath: string) => void;
  onReveal: (item: OutlineItem) => void;
  onToggleFolder: (key: string) => void;
  onViewChange: (view: SidebarView) => void;
}

const viewButton = (active: boolean) =>
  `flex h-6 items-center gap-1 rounded-md px-1.5 text-xs transition-colors ${
    active
      ? "bg-background text-foreground shadow-sm"
      : "text-muted-foreground hover:text-foreground"
  }`;

const emptyLibrary = (onOpenFolder: () => void) => (
  <div className="px-4 py-5">
    <p className="text-muted-foreground text-xs leading-relaxed">
      打开一个文件夹，所有 Markdown 笔记都会列在这里。可以同时打开多个文件夹。
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
  expanded,
  folders,
  outline,
  recentFiles,
  view,
  onClearRecent,
  onOpen,
  onOpenFile,
  onOpenFolder,
  onRefresh,
  onRemove,
  onReveal,
  onToggleFolder,
  onViewChange,
}: FileSidebarProps) => {
  let body: ReactNode;

  if (view === "recent") {
    body = (
      <RecentList
        activePath={activePath}
        files={recentFiles}
        onClear={onClearRecent}
        onOpen={onOpen}
        onOpenFile={onOpenFile}
      />
    );
  } else if (view === "outline") {
    body = <OutlineList items={outline} onReveal={onReveal} />;
  } else if (folders.length === 0) {
    body = emptyLibrary(onOpenFolder);
  } else {
    body = (
      <FileTree
        activePath={activePath}
        expanded={expanded}
        folders={folders}
        onOpen={onOpen}
        onRefresh={onRefresh}
        onRemove={onRemove}
        onToggle={onToggleFolder}
      />
    );
  }

  return (
    <aside className="bg-sidebar flex w-60 shrink-0 flex-col border-r">
      <div className="flex h-10 items-center gap-1 px-2">
        <div className="bg-muted/80 flex items-center gap-0 rounded-lg p-0.5">
          <button
            aria-pressed={view === "recent"}
            className={viewButton(view === "recent")}
            onClick={() => {
              onViewChange("recent");
            }}
            title="最近打开"
            type="button"
          >
            <ClockIcon className="size-3" />
            最近
          </button>
          <button
            aria-pressed={view === "files"}
            className={viewButton(view === "files")}
            onClick={() => {
              onViewChange("files");
            }}
            title="文件树"
            type="button"
          >
            <FolderTreeIcon className="size-3" />
            文件
          </button>
          <button
            aria-pressed={view === "outline"}
            className={viewButton(view === "outline")}
            onClick={() => {
              onViewChange("outline");
            }}
            title="目录大纲"
            type="button"
          >
            <ListTreeIcon className="size-3" />
            大纲
          </button>
        </div>

        <Button
          aria-label="打开文件夹"
          className="ml-auto"
          onClick={onOpenFolder}
          size="icon-xs"
          title="打开文件夹"
          variant="ghost"
        >
          <FolderPlusIcon />
        </Button>
      </div>

      {body}
    </aside>
  );
};
