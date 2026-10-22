import {
  Columns2Icon,
  EyeIcon,
  FileCodeIcon,
  FilePlusIcon,
  FileTextIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  LoaderCircleIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PencilIcon,
  SaveAllIcon,
  SaveIcon,
} from "lucide-react";

import type { ExportFormat } from "@markdownview/electron";
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
import { ModeToggle } from "#src/components/mode-toggle.tsx";
import type { ViewMode } from "#src/lib/use-workspace.ts";

const modes = [
  { icon: PencilIcon, label: "编辑", value: "edit" },
  { icon: Columns2Icon, label: "分屏", value: "split" },
  { icon: EyeIcon, label: "预览", value: "preview" },
] as const;

interface ToolbarProps {
  dirty: boolean;
  fileName: string;
  isDesktop: boolean;
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  onNew: () => void;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onExport: (format: ExportFormat) => void;
  onSave: () => void;
  onSaveAs: () => void;
  onToggleSidebar: () => void;
  saving: boolean;
  sidebarOpen: boolean;
}

export const Toolbar = ({
  dirty,
  fileName,
  isDesktop,
  mode,
  onModeChange,
  onNew,
  onOpenFile,
  onOpenFolder,
  onExport,
  onSave,
  onSaveAs,
  onToggleSidebar,
  saving,
  sidebarOpen,
}: ToolbarProps) => (
  <header className="bg-background/85 flex h-11 shrink-0 items-center gap-1 border-b px-2 backdrop-blur-md">
    <div className="flex items-center gap-0.5">
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
    </div>

    <div className="flex min-w-0 flex-1 items-center justify-center gap-2 px-2">
      <span className="text-foreground/85 truncate text-sm">{fileName}</span>
      {dirty ? (
        <span
          aria-label="未保存"
          className="bg-primary size-1.5 shrink-0 rounded-full"
          title="未保存"
        />
      ) : null}
    </div>

    <div className="flex items-center gap-1">
      <fieldset className="bg-muted/80 m-0 flex items-center gap-0 rounded-lg border-0 p-0.5">
        <legend className="sr-only">视图模式</legend>
        {modes.map(({ icon: Icon, label, value }) => (
          <button
            aria-pressed={mode === value}
            className="text-muted-foreground hover:text-foreground aria-pressed:bg-background aria-pressed:text-foreground flex size-6 items-center justify-center rounded-md transition-colors aria-pressed:shadow-sm"
            key={value}
            onClick={() => {
              onModeChange(value);
            }}
            title={label}
            type="button"
          >
            <Icon className="size-3.5" />
            <span className="sr-only">{label}</span>
          </button>
        ))}
      </fieldset>

      {isDesktop ? (
        <>
          <span
            aria-hidden="true"
            className="bg-border mx-1 hidden h-4 w-px sm:block"
          />
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
              <DropdownMenuItem
                onClick={() => {
                  onExport("pdf");
                }}
              >
                <FileTextIcon />
                导出 PDF…
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
        </>
      ) : null}

      <AboutDialog />
      <ModeToggle />
    </div>
  </header>
);
