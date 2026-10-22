import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

import { rehypeHtmlBlocks } from "#src/lib/html-blocks.ts";

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeHtmlBlocks)
  .use(rehypeSlug)
  .use(rehypeHighlight)
  .use(rehypeStringify);

export const renderMarkdownHtml = async (content: string) =>
  String(await processor.process(content));

const escapeHtml = (value: string) =>
  value.replaceAll(/[&<>"']/gu, (character) => {
    switch (character) {
      case "&": {
        return "&amp;";
      }

      case "<": {
        return "&lt;";
      }

      case ">": {
        return "&gt;";
      }

      case '"': {
        return "&quot;";
      }

      default: {
        return "&#39;";
      }
    }
  });

export const exportFileName = (fileName: string) => {
  const base = fileName.replace(/\.(?:md|markdown)$/iu, "").trim();

  const safe = base
    // Windows file names cannot contain control characters.
    // oxlint-disable-next-line eslint/no-control-regex
    .replaceAll(/[<>:"/\\|?*\u0000-\u001F]/gu, "-")
    .replaceAll(/\s+/gu, " ")
    .replaceAll(/[. ]+$/gu, "")
    .trim();

  return safe === "" ? "未命名" : safe;
};

const exportStyles = `
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--background);
  color: var(--foreground);
  -webkit-font-smoothing: antialiased;
}
.markdown-body {
  font-family: "Newsreader Variable", "Songti SC", "Noto Serif CJK SC", Georgia, serif;
  font-size: 17px;
  font-weight: 400;
  line-height: 1.78;
  margin: 0 auto;
  max-width: 76ch;
  overflow-wrap: anywhere;
  padding: 56px 32px 96px;
}
.markdown-body > :first-child { margin-top: 0; }
.markdown-body > :last-child { margin-bottom: 0; }
.markdown-body p,
.markdown-body ul,
.markdown-body ol,
.markdown-body dl { margin: 1.05em 0; }
.markdown-body h1,
.markdown-body h2,
.markdown-body h3,
.markdown-body h4,
.markdown-body h5,
.markdown-body h6 {
  color: var(--foreground);
  font-family: inherit;
  font-weight: 600;
  letter-spacing: -0.018em;
  line-height: 1.28;
  margin: 1.9em 0 0.7em;
}
.markdown-body h1 { font-size: 2.15rem; letter-spacing: -0.028em; margin-top: 0; }
.markdown-body h2 {
  border-bottom: 1px solid var(--paper-line);
  font-size: 1.55rem;
  padding-bottom: 0.28em;
}
.markdown-body h3 { font-size: 1.28rem; }
.markdown-body h4 { font-size: 1.12rem; }
.markdown-body h5,
.markdown-body h6 { color: var(--muted-foreground); font-size: 1rem; letter-spacing: 0.01em; }
.markdown-body strong { font-weight: 650; }
.markdown-body em { font-style: italic; }
.markdown-body a {
  color: var(--primary);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}
.markdown-body ul,
.markdown-body ol { list-style: revert; padding-left: 1.4em; }
.markdown-body li { margin: 0.28em 0; }
.markdown-body li::marker { color: var(--muted-foreground); }
.markdown-body ul.contains-task-list { list-style: none; padding-left: 0.15em; }
.markdown-body .task-list-item {
  align-items: flex-start;
  display: flex;
  gap: 0.55em;
  margin: 0.35em 0;
}
.markdown-body .task-list-item > input { accent-color: var(--primary); margin-top: 0.5em; }
.markdown-body blockquote {
  border-left: 2px solid var(--primary);
  color: var(--muted-foreground);
  font-style: italic;
  margin: 1.4em 0;
  padding: 0.1em 0 0.1em 1.1em;
}
.markdown-body blockquote p { margin: 0.45em 0; }
.markdown-body hr { border: 0; border-top: 1px solid var(--border); margin: 2.4em 0; }
.markdown-body img,
.markdown-body video {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  height: auto;
  max-width: 100%;
}
.markdown-body code {
  background: var(--code-background);
  border-radius: 0.35em;
  color: var(--code-foreground);
  font-family: "JetBrains Mono Variable", ui-monospace, Consolas, monospace;
  font-size: 0.84em;
  padding: 0.16em 0.4em;
}
.markdown-body pre {
  background: var(--code-background);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 0.82rem;
  line-height: 1.7;
  margin: 1.4em 0;
  overflow-x: auto;
  padding: 1rem 1.15rem;
}
.markdown-body pre code {
  background: transparent;
  color: var(--code-foreground);
  font-size: inherit;
  padding: 0;
}
.markdown-body kbd {
  background: var(--muted);
  border: 1px solid var(--border);
  border-bottom-width: 2px;
  border-radius: 0.35em;
  font-family: "JetBrains Mono Variable", ui-monospace, Consolas, monospace;
  font-size: 0.76em;
  padding: 0.12em 0.4em;
}
.markdown-body table {
  border-collapse: collapse;
  display: block;
  font-family: "Geist Variable", system-ui, sans-serif;
  font-size: 0.86rem;
  margin: 1.4em 0;
  max-width: 100%;
  overflow-x: auto;
  width: max-content;
}
.markdown-body th,
.markdown-body td { border: 1px solid var(--border); padding: 0.45em 0.75em; text-align: left; }
.markdown-body th { background: var(--muted); font-weight: 600; }
.markdown-body tr:nth-child(even) td {
  background: color-mix(in oklch, var(--muted) 45%, transparent);
}
.markdown-body .hljs-comment,
.markdown-body .hljs-quote { color: var(--muted-foreground); font-style: italic; }
.markdown-body .hljs-keyword,
.markdown-body .hljs-selector-tag,
.markdown-body .hljs-literal,
.markdown-body .hljs-type,
.markdown-body .hljs-built_in { color: var(--syntax-keyword); }
.markdown-body .hljs-string,
.markdown-body .hljs-attr,
.markdown-body .hljs-template-string,
.markdown-body .hljs-regexp { color: var(--syntax-string); }
.markdown-body .hljs-number,
.markdown-body .hljs-variable,
.markdown-body .hljs-params { color: var(--syntax-number); }
.markdown-body .hljs-title,
.markdown-body .hljs-title.function_,
.markdown-body .hljs-section { color: var(--syntax-function); font-weight: 600; }
.markdown-body .hljs-emphasis { font-style: italic; }
.markdown-body .hljs-strong { font-weight: 700; }
@media print {
  :root {
    --background: #fff;
    --foreground: #1c1a17;
    --muted: #f2efe8;
    --muted-foreground: #5c574f;
    --border: #d9d3c8;
    --primary: #8a4a24;
    --code-background: #f6f3ec;
    --code-foreground: #282420;
    --syntax-keyword: #8a3b1f;
    --syntax-string: #3f6b45;
    --syntax-number: #3c5a8a;
    --syntax-function: #7a5a1f;
    --paper-line: #d9d3c8;
  }
  body { background: #fff; }
  .markdown-body { font-size: 11pt; line-height: 1.7; max-width: none; padding: 0; }
  .markdown-body a { color: inherit; }
  .markdown-body h1,
  .markdown-body h2,
  .markdown-body h3,
  .markdown-body h4 { break-after: avoid; }
  .markdown-body pre,
  .markdown-body blockquote,
  .markdown-body table,
  .markdown-body figure,
  .markdown-body img,
  .markdown-body video { break-inside: avoid; }
  @page { margin: 18mm 16mm; size: A4; }
}
`;

export const buildExportDocument = ({
  bodyHtml,
  title,
  variables,
}: {
  bodyHtml: string;
  title: string;
  variables: string;
}) => `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="generator" content="MarkdownView" />
<title>${escapeHtml(title)}</title>
<style>
:root { ${variables} }
${exportStyles}
</style>
</head>
<body>
<main class="markdown-body">
${bodyHtml}
</main>
</body>
</html>
`;
