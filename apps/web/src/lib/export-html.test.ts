import { describe, expect, it } from "vite-plus/test";

import {
  buildExportDocument,
  exportFileName,
  renderMarkdownHtml,
} from "#src/lib/export-html.ts";

describe("exported Markdown", () => {
  it("renders headings, emphasis, tables, and task lists", async () => {
    const html = await renderMarkdownHtml(
      [
        "# 标题",
        "",
        "**粗体** 与 *斜体*",
        "",
        "| 列 | 值 |",
        "| --- | --- |",
        "| a | 1 |",
        "",
        "- [x] 已完成",
      ].join("\n")
    );

    expect(html).toContain('<h1 id="标题">标题</h1>');
    expect(html).toContain("<strong>粗体</strong>");
    expect(html).toContain("<table>");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("checked");
  });

  it("keeps syntax highlighting classes and heading anchors", async () => {
    const html = await renderMarkdownHtml(
      ["# 示例", "", "```js", "const value = 1;", "```"].join("\n")
    );

    expect(html).toContain('id="示例"');
    expect(html).toContain("hljs-keyword");
  });

  it("drops script URLs but keeps image data URLs", async () => {
    const scriptScheme = ["java", "script"].join("");

    const html = await renderMarkdownHtml(
      [
        `[危险](${scriptScheme}:alert(1))`,
        "",
        "[数据](data:text/html;base64,PHNjcmlwdD4=)",
        "",
        "![像素](data:image/png;base64,AAAA)",
      ].join("\n")
    );

    expect(html).not.toContain(`${scriptScheme}:`);
    expect(html).not.toContain("data:text/html");
    expect(html).toContain('src="data:image/png;base64,AAAA"');
  });
});

describe("exported document", () => {
  it("wraps the body in a self-contained HTML document", () => {
    const document = buildExportDocument({
      bodyHtml: "<h1>标题</h1>",
      title: 'A & B "notes" <draft>',
      variables: "--foreground: #111;",
    });

    expect(document).toContain("<!doctype html>");
    expect(document).toContain(
      "<title>A &amp; B &quot;notes&quot; &lt;draft&gt;</title>"
    );
    expect(document).toContain("--foreground: #111;");
    expect(document).toContain('<main class="markdown-body">');
    expect(document).toContain("@media print");
  });

  it("derives a safe file name from the document name", () => {
    expect(exportFileName("note.md")).toBe("note");
    expect(exportFileName("readme.markdown")).toBe("readme");
    expect(exportFileName("计划: 第一阶段?.md")).toBe("计划- 第一阶段-");
    expect(exportFileName("trailing. . .md")).toBe("trailing");
    expect(exportFileName(".md")).toBe("未命名");
  });
});
