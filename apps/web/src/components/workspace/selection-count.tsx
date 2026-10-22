import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

import { countWords } from "#src/lib/markdown-stats.ts";
import { placeSelectionBadge } from "#src/lib/selection-badge.ts";

interface SelectionCountState {
  count: number;
  left: number;
  top: number;
}

type CustomProperties = CSSProperties & Record<`--${string}`, string>;

/** The panes whose text a reader can select and count. */
const surfaces = ".preview-scroll, .cm-editor";

const readSelection = (): SelectionCountState | null => {
  const selection = document.getSelection();

  if (selection === null || selection.isCollapsed) {
    return null;
  }

  const count = countWords(selection.toString());

  if (count === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const node = range.commonAncestorContainer;
  const element = node instanceof Element ? node : node.parentElement;

  if (element === null || element.closest(surfaces) === null) {
    return null;
  }

  const rect =
    [...range.getClientRects()].at(-1) ?? range.getBoundingClientRect();

  if (rect.width === 0 && rect.height === 0) {
    return null;
  }

  const { left, top } = placeSelectionBadge(rect, {
    height: window.innerHeight,
    width: window.innerWidth,
  });

  return { count, left, top };
};

/**
 * The count of the selected text, next to the end of the selection. The status
 * bar keeps the document-wide numbers; this badge follows the pointer, in the
 * source pane and the preview alike.
 */
export const SelectionCount = () => {
  const [badge, setBadge] = useState<SelectionCountState | null>(null);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setBadge(readSelection());
      });
    };

    // A scroll moves the selection under the pointer without changing it.
    document.addEventListener("selectionchange", update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("selectionchange", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, []);

  if (badge === null) {
    return null;
  }

  const position: CustomProperties = {
    "--selection-count-left": `${badge.left}px`,
    "--selection-count-top": `${badge.top}px`,
  };

  return (
    <div
      aria-hidden="true"
      className="bg-popover/95 text-muted-foreground ring-foreground/10 pointer-events-none fixed top-(--selection-count-top) left-(--selection-count-left) z-50 rounded-md px-2 py-0.5 font-mono text-xs tabular-nums shadow-sm ring-1 select-none"
      data-selection-count=""
      style={position}
    >
      {badge.count} 字
    </div>
  );
};
