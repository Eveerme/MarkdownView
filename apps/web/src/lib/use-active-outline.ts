import type { EditorView } from "@codemirror/view";
import { useEffect, useState } from "react";

import { activeOutlineId } from "#src/lib/outline.ts";
import type { OutlineItem } from "#src/lib/outline.ts";

interface ActiveOutlineOptions {
  editorView: EditorView | null;
  enabled: boolean;
  outline: readonly OutlineItem[];
  preview: HTMLDivElement | null;
}

// The preview lands a jumped-to heading 24px below its top edge (scroll-margin
// in the stylesheet); reading a little lower keeps that heading the active one.
const readingMargin = 32;
const headingSelector = ":is(h1, h2, h3, h4, h5, h6)[data-line]";

/**
 * The outline item for the section at the top of the reading pane, so the
 * outline follows the reader instead of waiting to be clicked. The preview is
 * the map whenever it is open; the source pane answers in edit-only mode.
 */
export const useActiveOutline = ({
  editorView,
  enabled,
  outline,
  preview,
}: ActiveOutlineOptions) => {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || outline.length === 0) {
      return () => {
        // Nothing to follow, so there are no listeners to detach.
      };
    }

    let frame = 0;

    const lineAtReadingEdge = () => {
      if (preview !== null) {
        const edge = preview.getBoundingClientRect().top + readingMargin;
        let line = 1;

        for (const heading of preview.querySelectorAll<HTMLElement>(
          headingSelector
        )) {
          if (heading.getBoundingClientRect().top > edge) {
            break;
          }

          line = Number(heading.dataset.line) || line;
        }

        return line;
      }

      if (editorView !== null) {
        const edge =
          editorView.scrollDOM.getBoundingClientRect().top + readingMargin;

        const block = editorView.lineBlockAtHeight(
          edge - editorView.documentTop
        );

        return editorView.state.doc.lineAt(block.from).number;
      }

      return 1;
    };

    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setActiveId(activeOutlineId(outline, lineAtReadingEdge()));
      });
    };

    update();

    const scroller = editorView?.scrollDOM;
    const page = preview?.querySelector(".markdown-page") ?? preview;

    preview?.addEventListener("scroll", update, { passive: true });
    scroller?.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    // Images and fonts move the headings without a scroll event.
    const observer = new ResizeObserver(update);

    if (page !== null && page !== undefined) {
      observer.observe(page);
    }

    return () => {
      cancelAnimationFrame(frame);
      preview?.removeEventListener("scroll", update);
      scroller?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, [editorView, enabled, outline, preview]);

  return enabled && outline.length > 0 ? activeId : null;
};
