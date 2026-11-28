import {
  Columns2Icon,
  EyeIcon,
  FileCodeIcon,
  FilePlusIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  LoaderCircleIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PencilIcon,
  PlusIcon,
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

import { AboutDialog } from "#src/components/about-dialog.tsx";
import { SettingsDialog } from "#src/components/workspace/settings-dialog.tsx";
import type { ViewMode } from "#src/lib/use-workspace.ts";

const modes = [
  { icon: PencilIcon, label: "编辑", value: "edit" },
  { icon: Columns2Icon, label: "分屏", value: "split" },
  { icon: EyeIcon, label: "预览", value: "preview" },
] as const;

interface TopbarProps {
  dirty: boolean;
  fileName: string;
  isDesktop: boolean;
  mode: ViewMode;
  onExport: (format: ExportFormat) => void;
  onModeChange: (mode: ViewMode) => void;
  onNew: () => void;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onToggleSidebar: () => void;
  saving: boolean;
  sidebarOpen: boolean;
}

export const Topbar = ({
  dirty,
  fileName,
  isDesktop,
  mode,
  onExport,
  onModeChange,
  onNew,
  onOpenFile,
  onOpenFolder,
  onSave,
  onSaveAs,
  onToggleSidebar,
  saving,
  sidebarOpen,
}: TopbarProps) => (
  <header className="app-topbar">
    <div className="topbar-context">
      {isDesktop ? (
        <Button
          aria-label={sidebarOpen ? "收起侧边栏" : "展开侧边栏"}
          onClick={onToggleSidebar}
          size="icon-sm"
          title="侧边栏"
          variant="ghost"
        >
          {sidebarOpen ? <PanelLeftCloseIcon /> : <PanelLeftOpenIcon />}
        </Button>
      ) : null}
      <span className="topbar-document-name">{fileName}</span>
      {dirty ? (
        <span aria-label="未保存" className="titlebar-dirty" title="未保存" />
      ) : (
        <span className="topbar-saved">已保存</span>
      )}
    </div>

    <div className="topbar-actions">
      <fieldset className="view-switch">
        <legend className="sr-only">视图模式</legend>
        {modes.map(({ icon: Icon, label, value }) => (
          <button
            aria-pressed={mode === value}
            className="view-switch-button"
            key={value}
            onClick={() => {
              onModeChange(value);
            }}
            title={label}
            type="button"
          >
            <Icon className="size-3.5" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sr-only sm:hidden">{label}</span>
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
            size="sm"
            title="保存 (Ctrl+S)"
            variant="default"
          >
            {saving ? (
              <LoaderCircleIcon className="animate-spin" />
            ) : (
              <SaveIcon />
            )}
            <span className="hidden sm:inline">保存</span>
          </Button>
        </>
      ) : (
        <>
          <Button
            aria-label="新建文档"
            onClick={onNew}
            size="icon-sm"
            title="新建文档"
            variant="ghost"
          >
            <PlusIcon />
          </Button>
          <SettingsDialog />
          <AboutDialog />
        </>
      )}
    </div>
  </header>
);
