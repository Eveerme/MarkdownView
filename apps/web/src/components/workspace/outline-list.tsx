import { HashIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import type { OutlineItem } from "#src/lib/outline.ts";

interface OutlineListProps {
  activeId: string | null;
  items: OutlineItem[];
  onReveal: (item: OutlineItem) => void;
}

const indentation = ["pl-2", "pl-4", "pl-6", "pl-8", "pl-10", "pl-12"] as const;

export const OutlineList = ({
  activeId,
  items,
  onReveal,
}: OutlineListProps) => {
  const nav = useRef<HTMLElement>(null);
  const current = useRef<HTMLButtonElement | null>(null);

  // The reader moves through the document, so the outline keeps the current
  // section in view without pulling the rest of the app around.
  useEffect(() => {
    if (activeId === null) {
      return;
    }

    const container = nav.current;
    const button = current.current;

    if (container === null || button === null) {
      return;
    }

    const bounds = container.getBoundingClientRect();
    const rect = button.getBoundingClientRect();
    const inset = 8;

    if (rect.top < bounds.top + inset) {
      container.scrollTop -= bounds.top + inset - rect.top;
    } else if (rect.bottom > bounds.bottom - inset) {
      container.scrollTop += rect.bottom - bounds.bottom + inset;
    }
  }, [activeId]);

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground px-4 py-5 text-xs leading-relaxed">
        当前文档还没有标题。写下 `# 标题` 后，大纲会出现在这里。
      </p>
    );
  }

  return (
    <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4" ref={nav}>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const isActive = item.id === activeId;

          return (
            <li key={`${item.line}-${item.id}`}>
              <button
                aria-current={isActive ? "location" : undefined}
                className={`flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-xs transition-colors ${
                  indentation[item.depth - 1] ?? "pl-2"
                } ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                }`}
                onClick={() => {
                  onReveal(item);
                }}
                ref={isActive ? current : undefined}
                title={item.text}
                type="button"
              >
                <HashIcon
                  className={`size-3 shrink-0 ${isActive ? "opacity-70" : "opacity-40"}`}
                />
                <span className="truncate">{item.text}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
