import type { EditorView } from "@codemirror/view";
import { useEffect, useRef } from "react";

import { lineForTop, topForLine } from "#src/lib/scroll-sync.ts";
import type { ScrollAnchor } from "#src/lib/scroll-sync.ts";

interface ScrollSyncOptions {
  content: string;
  editorView: EditorView | null;
  enabled: boolean;
  preview: HTMLDivElement | null;
}

interface AnchorCache {
  key: string;
  anchors: ScrollAnchor[];
}

type Source = "editor" | "preview";

const readingMargin = 8;
const echoWindow = 120;

const maxScrollOf = (element: Element) =>
  Math.max(0, element.scrollHeight - element.clientHeight);

const readAnchors = (preview: HTMLElement): ScrollAnchor[] => {
  const anchors: ScrollAnchor[] = [];

  for (const element of preview.querySelectorAll<HTMLElement>("[data-line]")) {
    const line = Number(element.dataset.line);

    if (Number.isFinite(line)) {
      anchors.push({ line, top: element.offsetTop });
    }
  }

  return anchors.toSorted((left, right) => left.line - right.line);
};

/**
 * Keeps the source pane and the preview at the same place in the document.
 * The preview is the map: every top-level block it renders carries its source
 * line, so a scroll offset can be translated to a line and back. Only the pane
 * the user is scrolling drives the other one; the echo is ignored.
 */
export const useScrollSync = ({
  content,
  editorView,
  enabled,
  preview,
}: ScrollSyncOptions) => {
  const cache = useRef<AnchorCache | null>(null);
  const revision = useRef(content);
  const frame = useRef<number | null>(null);
  const pending = useRef<Source | null>(null);
  const ignore = useRef<Source | null>(null);
  const release = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    revision.current = content;
  }, [content]);

  useEffect(() => {
    if (!enabled || editorView === null || preview === null) {
      return () => {
        // No panes to keep in step, so there are no listeners to detach.
      };
    }

    const scroller = editorView.scrollDOM;
    const target = preview;

    const anchorsFor = () => {
      if (cache.current !== null && cache.current.key === revision.current) {
        return cache.current.anchors;
      }

      cache.current = {
        anchors: readAnchors(target),
        key: revision.current,
      };

      return cache.current.anchors;
    };

    const echo = (source: Source) => {
      ignore.current = source;

      if (release.current !== null) {
        clearTimeout(release.current);
      }

      release.current = setTimeout(() => {
        ignore.current = null;
      }, echoWindow);
    };

    const applyEditorScroll = (top: number) => {
      const next = Math.min(Math.max(top, 0), maxScrollOf(scroller));

      if (Math.abs(scroller.scrollTop - next) < 1) {
        return;
      }

      echo("editor");
      scroller.scrollTop = next;
    };

    const scrollPreviewTo = (top: number) => {
      const next = Math.min(Math.max(top, 0), maxScrollOf(target));

      if (Math.abs(target.scrollTop - next) < 1) {
        return;
      }

      echo("preview");
      target.scrollTop = next;
    };

    const scrollEditorTo = (line: number) => {
      const { doc } = editorView.state;
      const number = Math.min(Math.max(Math.round(line), 1), doc.lines);

      if (number === 1) {
        // The preview at its top maps to the document top, padding included.
        applyEditorScroll(0);

        return;
      }

      const block = editorView.lineBlockAt(doc.line(number).from);
      const edge = scroller.getBoundingClientRect().top + readingMargin;

      applyEditorScroll(
        scroller.scrollTop + editorView.documentTop + block.top - edge
      );
    };

    const syncFromEditor = () => {
      const edge = scroller.getBoundingClientRect().top + readingMargin;

      const line = editorView.state.doc.lineAt(
        editorView.lineBlockAtHeight(edge - editorView.documentTop).from
      ).number;

      const top = topForLine(
        anchorsFor(),
        line,
        editorView.state.doc.lines,
        maxScrollOf(target)
      );

      if (top !== null) {
        scrollPreviewTo(top);
      }
    };

    const syncFromPreview = () => {
      const line = lineForTop(
        anchorsFor(),
        target.scrollTop,
        editorView.state.doc.lines,
        maxScrollOf(target)
      );

      if (line !== null) {
        scrollEditorTo(line);
      }
    };

    const run = () => {
      frame.current = null;

      const source = pending.current;

      pending.current = null;

      if (source === "editor") {
        syncFromEditor();
      } else if (source === "preview") {
        syncFromPreview();
      }
    };

    const schedule = (source: Source) => {
      pending.current = source;

      if (frame.current !== null) {
        return;
      }

      frame.current = requestAnimationFrame(run);
    };

    const onEditorScroll = () => {
      if (ignore.current !== "editor") {
        schedule("editor");
      }
    };

    const onPreviewScroll = () => {
      if (ignore.current !== "preview") {
        schedule("preview");
      }
    };

    // Images load after the first render, so block positions move without the
    // content changing. Re-read the anchors when the article's height does.
    const observer = new ResizeObserver(() => {
      cache.current = null;
    });

    const page = target.querySelector(".markdown-page") ?? target;

    observer.observe(page);
    scroller.addEventListener("scroll", onEditorScroll, { passive: true });
    target.addEventListener("scroll", onPreviewScroll, { passive: true });

    return () => {
      observer.disconnect();
      scroller.removeEventListener("scroll", onEditorScroll);
      target.removeEventListener("scroll", onPreviewScroll);

      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
      }

      if (release.current !== null) {
        clearTimeout(release.current);
      }

      frame.current = null;
      pending.current = null;
      ignore.current = null;
      cache.current = null;
    };
  }, [editorView, enabled, preview]);
};
