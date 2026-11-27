import {
  ClockIcon,
  FolderTreeIcon,
  ListTreeIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlusIcon,
} from "lucide-react";

import { Button } from "@markdownview/ui/components/button";

import { AboutDialog } from "#src/components/about-dialog.tsx";
import { LogoMark } from "#src/components/logo-mark.tsx";
import { SettingsDialog } from "#src/components/workspace/settings-dialog.tsx";
import type { SidebarView } from "#src/lib/use-workspace.ts";

const sidebarViews = [
  { icon: ClockIcon, label: "最近", value: "recent" },
  { icon: FolderTreeIcon, label: "文件", value: "files" },
  { icon: ListTreeIcon, label: "大纲", value: "outline" },
] as const;

interface NavigationRailProps {
  isDesktop: boolean;
  onNew: () => void;
  onSidebarViewChange: (view: SidebarView) => void;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  sidebarView: SidebarView;
}

export const NavigationRail = ({
  isDesktop,
  onNew,
  onSidebarViewChange,
  onToggleSidebar,
  sidebarOpen,
  sidebarView,
}: NavigationRailProps) => (
  <nav aria-label="主导航" className="workspace-rail">
    <div
      className="grid size-8 shrink-0 place-items-center"
      title="MarkdownView"
    >
      <LogoMark className="text-primary size-7" />
    </div>

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

    <span aria-hidden="true" className="bg-border mx-auto h-px w-6" />

    <button
      aria-label="新建文档"
      className="bg-primary text-primary-foreground grid size-9 shrink-0 place-items-center rounded-lg shadow-sm transition-opacity hover:opacity-85"
      onClick={onNew}
      title="新建文档 (Ctrl+N)"
      type="button"
    >
      <PlusIcon className="size-4" />
    </button>

    {isDesktop ? (
      <div className="flex w-full flex-col items-center gap-1">
        {sidebarViews.map(({ icon: Icon, label, value }) => (
          <button
            aria-label={label}
            aria-pressed={sidebarView === value}
            className={`grid size-9 place-items-center rounded-lg transition-colors ${
              sidebarView === value
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            key={value}
            onClick={() => {
              onSidebarViewChange(value);
            }}
            title={label}
            type="button"
          >
            <Icon className="size-4" />
          </button>
        ))}
      </div>
    ) : null}

    <div className="mt-auto flex w-full flex-col items-center gap-1">
      <SettingsDialog />
      <AboutDialog />
    </div>
  </nav>
);
