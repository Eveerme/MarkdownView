import {
  Columns2Icon,
  EyeIcon,
  FileCodeIcon,
  FilePlusIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  LoaderCircleIcon,
  PencilIcon,
  SaveAllIcon,
  SaveIcon,
} from "lucide-react";

import type { ExportFormat } from "@markdownview/desktop-contract";
import { Button } from "@markdownview/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@markdownview/ui/components/dropdown-menu";

import { TabBar } from "#src/components/workspace/tab-bar.tsx";
import type { DocumentTab, ViewMode } from "#src/lib/use-workspace.ts";

const modes = [
  { icon: PencilIcon, label: "编辑", value: "edit" },
  { icon: Columns2Icon, label: "分屏", value: "split" },
  { icon: EyeIcon, label: "预览", value: "preview" },
] as const;

interface ToolbarProps {
  activeId: string;
  isDesktop: boolean;
  mode: ViewMode;
  onCloseTab: (id: string) => void;
  onExport: (format: ExportFormat) => void;
  onModeChange: (mode: ViewMode) => void;
  onNew: () => void;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onSelectTab: (id: string) => void;
  saving: boolean;
  tabs: DocumentTab[];
}

export const Toolbar = ({
  activeId,
  isDesktop,
  mode,
  onCloseTab,
  onExport,
  onModeChange,
  onNew,
  onOpenFile,
  onOpenFolder,
  onSave,
  onSaveAs,
  onSelectTab,
  saving,
  tabs,
}: ToolbarProps) => (
  <header className="workspace-toolbar flex h-full min-w-0 items-center gap-2 px-2">
    <TabBar
      activeId={activeId}
      onClose={onCloseTab}
      onNew={onNew}
      onSelect={onSelectTab}
      tabs={tabs}
    />

    <div className="flex shrink-0 items-center gap-1">
      <fieldset className="bg-muted/75 m-0 flex items-center gap-0 rounded-lg border-0 p-0.5">
        <legend className="sr-only">视图模式</legend>
        {modes.map(({ icon: Icon, label, value }) => (
          <button
            aria-pressed={mode === value}
            className="text-muted-foreground hover:text-foreground aria-pressed:bg-card aria-pressed:text-foreground flex h-6 items-center justify-center gap-1 rounded-md px-1.5 text-xs transition-colors aria-pressed:shadow-xs sm:px-2"
            key={value}
            onClick={() => {
              onModeChange(value);
            }}
            title={label}
            type="button"
          >
            <Icon className="size-3.5" />
            <span className="hidden md:inline">{label}</span>
            <span className="sr-only md:hidden">{label}</span>
          </button>
        ))}
      </fieldset>

      {isDesktop ? (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button size="sm" title="文件" variant="ghost" />}
            >
              <FolderOpenIcon />
              <span className="hidden md:inline">文件</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={onNew}>
                <FilePlusIcon />
                新建
                <DropdownMenuShortcut>Ctrl+N</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenFile}>
                <FolderOpenIcon />
                打开文件…
                <DropdownMenuShortcut>Ctrl+O</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenFolder}>
                <FolderPlusIcon />
                打开文件夹…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSave}>
                <SaveIcon />
                保存
                <DropdownMenuShortcut>Ctrl+S</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onSaveAs}>
                <SaveAllIcon />
                另存为…
                <DropdownMenuShortcut>Ctrl+Shift+S</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  onExport("html");
                }}
              >
                <FileCodeIcon />
                导出 HTML…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            aria-label="保存"
            onClick={onSave}
            size="icon-sm"
            title="保存 (Ctrl+S)"
            variant="ghost"
          >
            {saving ? (
              <LoaderCircleIcon className="animate-spin" />
            ) : (
              <SaveIcon />
            )}
          </Button>
          <span aria-hidden="true" className="bg-border mx-1 h-4 w-px" />
        </>
      ) : null}
    </div>
  </header>
);
