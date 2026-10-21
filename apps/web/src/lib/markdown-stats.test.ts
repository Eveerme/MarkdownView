import { describe, expect, it } from "vite-plus/test";

import { countLines, countWords } from "#src/lib/markdown-stats.ts";

describe("word count", () => {
  it("counts an empty document as zero", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("—— …。！")).toBe(0);
  });

  it("counts alphabetic words once", () => {
    expect(countWords("Hello world")).toBe(2);
    expect(countWords("a well-known state-of-the-art editor")).toBe(6);
  });

  it("counts each CJK character as a word and skips punctuation", () => {
    expect(countWords("你好，世界")).toBe(4);
    expect(countWords("日本語のテキスト")).toBe(8);
  });

  it("counts a mixed document", () => {
    expect(countWords("React 19 桌面版 markdown-view")).toBe(7);
  });
});

describe("line count", () => {
  it("counts the lines an editor shows", () => {
    expect(countLines("")).toBe(0);
    expect(countLines("a")).toBe(1);
    expect(countLines("a\nb")).toBe(2);
    expect(countLines("a\r\nb")).toBe(2);
    expect(countLines("a\n")).toBe(2);
  });
});
