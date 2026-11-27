import { FolderPlusIcon } from "lucide-react";
import type { ReactNode } from "react";

import type {
  MarkdownFolder,
  RecentFile,
} from "@markdownview/desktop-contract";
import { Button } from "@markdownview/ui/components/button";

import { FileTree } from "#src/components/workspace/file-tree.tsx";
import { OutlineList } from "#src/components/workspace/outline-list.tsx";
import { RecentList } from "#src/components/workspace/recent-list.tsx";
import type { OutlineItem } from "#src/lib/outline.ts";
import type { SidebarView } from "#src/lib/use-workspace.ts";

interface FileSidebarProps {
  activeOutlineId: string | null;
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
  onRevealFile: (path: string) => void;
  onRevealFolder: (path: string) => void;
  onToggleFolder: (key: string) => void;
}

const viewLabels = {
  files: "文件",
  outline: "大纲",
  recent: "最近",
} as const;

const emptyLibrary = (onOpenFolder: () => void) => (
  <div className="px-3 py-3">
    <p className="text-muted-foreground text-xs leading-relaxed">
      打开一个文件夹，所有 Markdown 笔记都会列在这里。可以同时打开多个文件夹。
    </p>
    <Button
      className="mt-2 w-full"
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
  activeOutlineId,
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
  onRevealFile,
  onRevealFolder,
  onToggleFolder,
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
        onReveal={onRevealFile}
      />
    );
  } else if (view === "outline") {
    body = (
      <OutlineList
        activeId={activeOutlineId}
        items={outline}
        onReveal={onReveal}
      />
    );
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
        onRevealFile={onRevealFile}
        onRevealFolder={onRevealFolder}
        onToggle={onToggleFolder}
      />
    );
  }

  return (
    <aside className="workspace-sidebar bg-sidebar flex w-full min-w-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 px-2">
        <span className="text-foreground/80 truncate text-xs font-medium">
          {viewLabels[view]}
        </span>
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

      {body}
    </aside>
  );
};
