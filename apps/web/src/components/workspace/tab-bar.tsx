import { FileTextIcon, PlusIcon, XIcon } from "lucide-react";

import type { DocumentTab } from "#src/lib/use-workspace.ts";

interface TabBarProps {
  activeId: string;
  onClose: (id: string) => void;
  onNew: () => void;
  onSelect: (id: string) => void;
  tabs: DocumentTab[];
}

export const TabBar = ({
  activeId,
  onClose,
  onNew,
  onSelect,
  tabs,
}: TabBarProps) => (
  <div
    aria-label="打开的文档"
    className="document-tabs subtle-scrollbar flex min-h-0 flex-1 items-center gap-1 overflow-x-auto px-1"
    role="tablist"
  >
    {tabs.map((item) => {
      const active = item.id === activeId;
      const dirty = item.content !== item.savedContent;

      return (
        <div
          className={`group flex h-8 min-w-0 shrink-0 items-center gap-1 rounded-lg border px-2 text-xs transition-colors ${
            active
              ? "border-border bg-muted text-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground border-transparent"
          }`}
          key={item.id}
        >
          <FileTextIcon className="size-3 shrink-0 opacity-55" />
          <button
            aria-selected={active}
            className="max-w-40 truncate py-1 text-left"
            onClick={() => {
              onSelect(item.id);
            }}
            role="tab"
            title={item.path ?? item.name}
            type="button"
          >
            {item.name}
          </button>
          {dirty ? (
            <span
              aria-label="未保存"
              className="bg-primary size-1.5 shrink-0 rounded-full"
              title="未保存"
            />
          ) : null}
          <button
            aria-label={`关闭 ${item.name}`}
            className="text-muted-foreground hover:text-foreground hover:bg-muted grid size-5 shrink-0 place-items-center rounded-md opacity-60 transition-opacity group-hover:opacity-100"
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
    <button
      aria-label="新建标签页"
      className="text-muted-foreground hover:bg-muted hover:text-foreground ml-1 grid size-7 shrink-0 place-items-center rounded-lg transition-colors"
      onClick={onNew}
      title="新建文档 (Ctrl+N)"
      type="button"
    >
      <PlusIcon className="size-3.5" />
    </button>
  </div>
);
