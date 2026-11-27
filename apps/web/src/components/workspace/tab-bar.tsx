import { XIcon } from "lucide-react";

import type { DocumentTab } from "#src/lib/use-workspace.ts";

interface TabBarProps {
  activeId: string;
  onClose: (id: string) => void;
  onSelect: (id: string) => void;
  tabs: DocumentTab[];
}

export const TabBar = ({ activeId, onClose, onSelect, tabs }: TabBarProps) => {
  if (tabs.length < 2) {
    // Keep the grid row occupied so the panes and status bar stay in place.
    return <div aria-hidden="true" className="h-0" />;
  }

  return (
    <div
      aria-label="打开的文档"
      className="bg-muted/30 flex min-h-9 items-stretch overflow-x-auto border-b px-1"
      role="tablist"
    >
      {tabs.map((item) => {
        const active = item.id === activeId;
        const dirty = item.content !== item.savedContent;

        return (
          <div
            className={`group flex min-w-0 shrink-0 items-center gap-1 rounded-t-md px-2 text-xs ${
              active
                ? "bg-background text-foreground"
                : "text-muted-foreground hover:bg-background/60"
            }`}
            key={item.id}
          >
            <button
              aria-selected={active}
              className="max-w-40 truncate py-1.5 pr-0.5 text-left"
              onClick={() => {
                onSelect(item.id);
              }}
              role="tab"
              title={item.path ?? item.name}
              type="button"
            >
              {dirty ? "• " : ""}
              {item.name}
            </button>
            <button
              aria-label={`关闭 ${item.name}`}
              className="text-muted-foreground hover:text-foreground rounded p-0.5 opacity-60 group-hover:opacity-100"
              onClick={() => {
                onClose(item.id);
              }}
              type="button"
            >
              <XIcon className="size-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
