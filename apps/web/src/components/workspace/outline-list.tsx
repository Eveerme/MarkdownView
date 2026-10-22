import { HashIcon } from "lucide-react";

import type { OutlineItem } from "#src/lib/outline.ts";

interface OutlineListProps {
  items: OutlineItem[];
  onReveal: (item: OutlineItem) => void;
}

const indentation = ["pl-2", "pl-4", "pl-6", "pl-8", "pl-10", "pl-12"] as const;

export const OutlineList = ({ items, onReveal }: OutlineListProps) => {
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground px-4 py-5 text-xs leading-relaxed">
        当前文档还没有标题。写下 `# 标题` 后，大纲会出现在这里。
      </p>
    );
  }

  return (
    <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={`${item.line}-${item.id}`}>
            <button
              className={`text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-xs transition-colors ${
                indentation[item.depth - 1] ?? "pl-2"
              }`}
              onClick={() => {
                onReveal(item);
              }}
              title={item.text}
              type="button"
            >
              <HashIcon className="size-3 shrink-0 opacity-40" />
              <span className="truncate">{item.text}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
};
