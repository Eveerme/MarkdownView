import type { EditorView } from "@codemirror/view";

import { lineForTop, topForLine } from "#src/lib/scroll-sync.ts";
import type { ScrollAnchor } from "#src/lib/scroll-sync.ts";

/**
 * The blocks the preview rendered, each tagged with the source line it starts
 * on and the scroll offset that shows it. Walking the article costs a layout
 * read per block, so a caller that follows scrolling keeps the result until the
 * text or the layout changes.
 */
export const readAnchors = (preview: HTMLElement): ScrollAnchor[] => {
  const anchors: ScrollAnchor[] = [];

  // Offsets are read in the pane's own scroll space, so they compare directly
  // with scrollTop and can be assigned back to it.
  const origin = preview.getBoundingClientRect().top - preview.scrollTop;

  for (const element of preview.querySelectorAll<HTMLElement>("[data-line]")) {
    const line = Number(element.dataset.line);

    if (Number.isFinite(line)) {
      anchors.push({
        line,
        top: element.getBoundingClientRect().top - origin,
      });
    }
  }

  return anchors.toSorted((left, right) => left.line - right.line);
};

export const maxScrollOf = (element: Element) =>
  Math.max(0, element.scrollHeight - element.clientHeight);

/**
 * The line count of the text the preview rendered. It pins the last source line
 * to the bottom of the article, which the line maps need.
 */
const previewDocLines = (preview: HTMLElement) => {
  const lines = Number(preview.dataset.docLines);

  return Number.isFinite(lines) && lines > 0 ? lines : 1;
};

/** The source line at the top of the editor viewport. */
export const lineAtEditorTop = (view: EditorView, margin = 0): number => {
  const edge = view.scrollDOM.getBoundingClientRect().top + margin;

  return view.state.doc.lineAt(
    view.lineBlockAtHeight(edge - view.documentTop).from
  ).number;
};

/** The source line at the top of the preview pane. Fractional between blocks. */
const lineAtPreviewTop = (
  preview: HTMLElement,
  anchors: readonly ScrollAnchor[]
): number | null =>
  lineForTop(
    anchors,
    preview.scrollTop,
    previewDocLines(preview),
    maxScrollOf(preview)
  );

/** The preview offset that puts a source line at the top of the pane. */
export const previewTopForLine = (
  preview: HTMLElement,
  anchors: readonly ScrollAnchor[],
  line: number
): number | null =>
  topForLine(anchors, line, previewDocLines(preview), maxScrollOf(preview));

/**
 * The source line at the top of the pane being read, measured as the panes
 * stand now. A switch asks for it just before the other pane unmounts, so the
 * line it carries over is the one on screen rather than a frame-old report.
 */
export const readingLineOf = (
  editorView: EditorView | null,
  preview: HTMLElement | null
): number | null => {
  if (preview !== null) {
    const line = lineAtPreviewTop(preview, readAnchors(preview));

    return line === null ? null : Math.round(line);
  }

  return editorView === null ? null : lineAtEditorTop(editorView);
};
