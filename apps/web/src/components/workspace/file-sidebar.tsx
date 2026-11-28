import {
  ClockIcon,
  FolderPlusIcon,
  FolderTreeIcon,
  ListTreeIcon,
  PlusIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import type {
  MarkdownFolder,
  RecentFile,
} from "@markdownview/desktop-contract";
import { Button } from "@markdownview/ui/components/button";

import { AboutDialog } from "#src/components/about-dialog.tsx";
import { FileTree } from "#src/components/workspace/file-tree.tsx";
import { OutlineList } from "#src/components/workspace/outline-list.tsx";
import { RecentList } from "#src/components/workspace/recent-list.tsx";
import { SettingsDialog } from "#src/components/workspace/settings-dialog.tsx";
import type { OutlineItem } from "#src/lib/outline.ts";
import type { SidebarView } from "#src/lib/use-workspace.ts";

const views = [
  { icon: ClockIcon, label: "最近", value: "recent" },
  { icon: FolderTreeIcon, label: "文件", value: "files" },
  { icon: ListTreeIcon, label: "大纲", value: "outline" },
] as const;

interface FileSidebarProps {
  activeOutlineId: string | null;
  activePath: string | null;
  expanded: ReadonlySet<string>;
  folders: MarkdownFolder[];
  outline: OutlineItem[];
  recentFiles: RecentFile[];
  view: SidebarView;
  onClearRecent: () => void;
  onNew: () => void;
  onOpen: (path: string) => void;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onRefresh: (folderPath: string) => void;
  onRemove: (folderPath: string) => void;
  onReveal: (item: OutlineItem) => void;
  onRevealFile: (path: string) => void;
  onRevealFolder: (path: string) => void;
  onToggleFolder: (key: string) => void;
  onViewChange: (view: SidebarView) => void;
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
  onNew,
  onOpen,
  onOpenFile,
  onOpenFolder,
  onRefresh,
  onRemove,
  onReveal,
  onRevealFile,
  onRevealFolder,
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
    <aside className="workspace-sidebar flex w-full min-w-0 flex-1 flex-col">
      <div className="sidebar-create">
        <Button className="w-full" onClick={onNew} size="sm" variant="default">
          <PlusIcon />
          新建文档
        </Button>
      </div>

      <div className="sidebar-views">
        {views.map(({ icon: Icon, label, value }) => (
          <button
            aria-label={label}
            aria-pressed={view === value}
            className={`sidebar-view-button ${
              view === value ? "sidebar-view-active" : ""
            }`}
            key={value}
            onClick={() => {
              onViewChange(value);
            }}
            title={label}
            type="button"
          >
            <Icon className="size-4" />
          </button>
        ))}
      </div>

      <div className="sidebar-section-head">
        <span>{viewLabels[view]}</span>
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

      <div className="sidebar-footer">
        <SettingsDialog />
        <AboutDialog />
      </div>
    </aside>
  );
};
