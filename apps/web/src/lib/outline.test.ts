import { describe, expect, it } from "vite-plus/test";

import { buildOutline } from "#src/lib/outline.ts";

describe("the document outline", () => {
  it("lists headings with stable anchors and source lines", () => {
    expect(buildOutline("# 一级\n\n## 二级\n\n### 三级\n")).toStrictEqual([
      { depth: 1, id: "一级", line: 1, text: "一级" },
      { depth: 2, id: "二级", line: 3, text: "二级" },
      { depth: 3, id: "三级", line: 5, text: "三级" },
    ]);
  });

  it("ignores headings inside fenced code blocks", () => {
    expect(
      buildOutline("# A\n\n```md\n# not a heading\n```\n\n## B\n")
    ).toStrictEqual([
      { depth: 1, id: "a", line: 1, text: "A" },
      { depth: 2, id: "b", line: 7, text: "B" },
    ]);
  });

  it("supports setext headings", () => {
    expect(buildOutline("标题\n===\n\n二级\n---\n")).toStrictEqual([
      { depth: 1, id: "标题", line: 1, text: "标题" },
      { depth: 2, id: "二级", line: 4, text: "二级" },
    ]);
  });

  it("extracts inline formatting and disambiguates duplicate headings", () => {
    expect(
      buildOutline("## **粗体** 与 `代码`\n\n## **粗体** 与 `代码`\n")
    ).toStrictEqual([
      { depth: 2, id: "粗体-与-代码", line: 1, text: "粗体 与 代码" },
      { depth: 2, id: "粗体-与-代码-1", line: 3, text: "粗体 与 代码" },
    ]);
  });

  it("keeps Chinese headings and drops empty ones", () => {
    expect(buildOutline("## 产品：定位\n\n#\n")).toStrictEqual([
      { depth: 2, id: "产品定位", line: 1, text: "产品：定位" },
    ]);
  });
});
