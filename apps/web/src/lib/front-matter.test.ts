import { describe, expect, it } from "vite-plus/test";

import { frontMatterEntries, parseFrontMatter } from "./front-matter.ts";

describe("front matter", () => {
  it("strips a leading YAML block from the body", () => {
    const result = parseFrontMatter(
      ["---", "title: 你好", "tags: [a, b]", "---", "# 正文"].join("\n")
    );

    expect(result.data).toStrictEqual({ tags: ["a", "b"], title: "你好" });
    expect(result.body).toBe("# 正文");
    expect(result.lineOffset).toBe(4);
  });

  it("leaves a document without front matter unchanged", () => {
    const result = parseFrontMatter("# 标题\n\n正文");

    expect(result.data).toStrictEqual({});
    expect(result.body).toBe("# 标题\n\n正文");
    expect(result.lineOffset).toBe(0);
    expect(result.raw).toBeNull();
  });

  it("ignores an unterminated or malformed block", () => {
    expect(parseFrontMatter("---\ntitle: x\n\n正文").body).toBe(
      "---\ntitle: x\n\n正文"
    );

    const broken = parseFrontMatter("---\ntitle: [unclosed\n---\n正文");

    expect(broken.data).toStrictEqual({});
    expect(broken.body).toBe("正文");
  });

  it("renders scalar and list values for the metadata panel", () => {
    const entries = frontMatterEntries({
      count: 3,
      tags: ["one", "two"],
      title: "标题",
    });

    expect(entries).toStrictEqual([
      { key: "count", value: "3" },
      { key: "tags", value: "one, two" },
      { key: "title", value: "标题" },
    ]);
  });
});
