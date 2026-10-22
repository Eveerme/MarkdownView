import { describe, expect, it } from "vite-plus/test";

import { lineForTop, topForLine } from "#src/lib/scroll-sync.ts";
import type { ScrollAnchor } from "#src/lib/scroll-sync.ts";

const anchors: ScrollAnchor[] = [
  { line: 1, top: 48 },
  { line: 11, top: 548 },
  { line: 21, top: 1048 },
];

const docLines = 31;
const maxScroll = 2000;

describe("preview scroll sync", () => {
  it("has no position before the preview renders blocks", () => {
    expect(topForLine([], 5, docLines, maxScroll)).toBeNull();
    expect(lineForTop([], 100, docLines, maxScroll)).toBeNull();
  });

  it("pins the first line to the top and the last line to the bottom", () => {
    expect(topForLine(anchors, 1, docLines, maxScroll)).toBe(0);
    expect(topForLine(anchors, docLines, docLines, maxScroll)).toBe(maxScroll);
    expect(lineForTop(anchors, 0, docLines, maxScroll)).toBe(1);
    expect(lineForTop(anchors, maxScroll, docLines, maxScroll)).toBe(docLines);
  });

  it("interpolates lines between two blocks", () => {
    expect(topForLine(anchors, 6, docLines, maxScroll)).toBe(274);
    expect(lineForTop(anchors, 274, docLines, maxScroll)).toBe(6);
  });

  it("reads a line inside a long block proportionally", () => {
    const line = lineForTop(anchors, 300, docLines, maxScroll);

    expect(line).toBeGreaterThan(1);
    expect(line).toBeLessThan(11);
  });

  it("round-trips a scroll offset within a line", () => {
    for (const top of [0, 120, 548, 900, 1048, 1600, maxScroll]) {
      const line = lineForTop(anchors, top, docLines, maxScroll);
      const back = topForLine(anchors, line ?? 1, docLines, maxScroll);

      expect(back).toBeCloseTo(top, 6);
    }
  });

  it("ignores anchors that do not advance", () => {
    const duplicated: ScrollAnchor[] = [
      { line: 4, top: 100 },
      { line: 4, top: 180 },
      { line: 9, top: 400 },
    ];

    expect(topForLine(duplicated, 4, docLines, maxScroll)).toBe(100);
    expect(topForLine(duplicated, 5, docLines, maxScroll)).toBeGreaterThan(100);
  });

  it("keeps a short document at the top", () => {
    expect(topForLine(anchors, docLines, docLines, 0)).toBe(0);
  });
});
