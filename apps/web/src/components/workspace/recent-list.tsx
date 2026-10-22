import { FilePlusIcon, FileTextIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";

import type { RecentFile } from "@markdownview/electron";
import { Button } from "@markdownview/ui/components/button";

import {
  formatRecentTime,
  formatRecentTimestamp,
} from "#src/lib/recent-time.ts";

interface RecentListProps {
  activePath: string | null;
  files: RecentFile[];
  onClear: () => void;
  onOpen: (path: string) => void;
  onOpenFile: () => void;
}

const emptyRecent = (onOpenFile: () => void) => (
  <div className="px-4 py-5">
    <p className="text-muted-foreground text-xs leading-relaxed">
      打开过的 Markdown 文件会出现在这里，方便下次快速回到它们。
    </p>
    <Button
      className="mt-3 w-full"
      onClick={onOpenFile}
      size="sm"
      variant="outline"
    >
      <FilePlusIcon />
      打开文件
    </Button>
  </div>
);

export const RecentList = ({
  activePath,
  files,
  onClear,
  onOpen,
  onOpenFile,
}: RecentListProps) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 60_000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  if (files.length === 0) {
    return emptyRecent(onOpenFile);
  }

  return (
    <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
      <ul className="space-y-0.5">
        {files.map((file) => {
          const active = file.path === activePath;
          const time = formatRecentTime(file.openedAt, now);
          const timestamp = formatRecentTimestamp(file.openedAt);

          return (
            <li key={file.path}>
              <button
                className={`group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                }`}
                onClick={() => {
                  onOpen(file.path);
                }}
                title={file.path}
                type="button"
              >
                <FileTextIcon
                  className={`size-3.5 shrink-0 ${
                    active ? "text-primary" : "opacity-50"
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs">{file.name}</span>
                  <span className="flex items-baseline gap-2 text-xs opacity-60">
                    <span className="min-w-0 flex-1 truncate">
                      {file.directory}
                    </span>
                    {time === null ? null : (
                      <span
                        className="shrink-0 tabular-nums"
                        title={timestamp ?? undefined}
                      >
                        {time}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <Button
        className="mt-1 w-full"
        onClick={onClear}
        size="sm"
        variant="ghost"
      >
        <Trash2Icon />
        清空历史
      </Button>
    </nav>
  );
};
