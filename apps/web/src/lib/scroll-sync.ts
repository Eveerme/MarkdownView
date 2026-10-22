export interface ScrollAnchor {
  line: number;
  top: number;
}

/**
 * A source line and the preview offset it should sit at, with the document ends
 * pinned so the first line maps to the top and the last line to the bottom.
 */
const buildPoints = (
  anchors: readonly ScrollAnchor[],
  docLines: number,
  maxScroll: number
): ScrollAnchor[] => {
  const points: ScrollAnchor[] = [{ line: 1, top: 0 }];

  for (const anchor of anchors) {
    const last = points.at(-1);

    if (last === undefined || anchor.line <= last.line) {
      continue;
    }

    points.push({ line: anchor.line, top: Math.max(anchor.top, last.top) });
  }

  const last = points.at(-1);

  if (last !== undefined && docLines > last.line && maxScroll > last.top) {
    points.push({ line: docLines, top: maxScroll });
  }

  return points;
};

/**
 * Where the preview should scroll to show the given source line, interpolating
 * between the nearest blocks. Null when the preview has no anchors yet.
 */
export const topForLine = (
  anchors: readonly ScrollAnchor[],
  line: number,
  docLines: number,
  maxScroll: number
): number | null => {
  if (anchors.length === 0) {
    return null;
  }

  if (maxScroll <= 0) {
    return 0;
  }

  const points = buildPoints(anchors, docLines, maxScroll);
  const index = points.findIndex((point) => point.line >= line);

  if (index === -1) {
    return points.at(-1)?.top ?? 0;
  }

  if (index === 0) {
    return points[0]?.top ?? 0;
  }

  const from = points[index - 1];
  const to = points[index];

  if (from === undefined) {
    return 0;
  }

  if (to === undefined) {
    return from.top;
  }

  const span = to.line - from.line;
  const ratio = span === 0 ? 1 : (line - from.line) / span;

  return from.top + (to.top - from.top) * ratio;
};

/**
 * The source line at a preview scroll offset, the inverse of `topForLine`.
 * Fractional so the editor can land between lines.
 */
export const lineForTop = (
  anchors: readonly ScrollAnchor[],
  top: number,
  docLines: number,
  maxScroll: number
): number | null => {
  if (anchors.length === 0) {
    return null;
  }

  if (maxScroll <= 0) {
    return 1;
  }

  const points = buildPoints(anchors, docLines, maxScroll);
  const index = points.findIndex((point) => point.top >= top);

  if (index === -1) {
    return points.at(-1)?.line ?? docLines;
  }

  if (index === 0) {
    return points[0]?.line ?? 1;
  }

  const from = points[index - 1];
  const to = points[index];

  if (from === undefined) {
    return 1;
  }

  if (to === undefined) {
    return from.line;
  }

  const span = to.top - from.top;
  const ratio = span === 0 ? 1 : (top - from.top) / span;

  return from.line + (to.line - from.line) * ratio;
};
