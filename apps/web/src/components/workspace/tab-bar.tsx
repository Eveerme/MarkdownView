import { PlusIcon, XIcon } from "lucide-react";

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
  <div aria-label="打开的文档" className="document-tabs" role="tablist">
    {tabs.map((item) => {
      const active = item.id === activeId;
      const dirty = item.content !== item.savedContent;

      return (
        <div
          className={`document-tab ${active ? "document-tab-active" : ""}`}
          key={item.id}
        >
          <button
            aria-selected={active}
            className="document-tab-label"
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
            className="document-tab-close"
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
      className="document-tab-new"
      onClick={onNew}
      title="新建文档 (Ctrl+N)"
      type="button"
    >
      <PlusIcon className="size-3.5" />
    </button>
  </div>
);
