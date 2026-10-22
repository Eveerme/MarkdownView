import GithubSlugger from "github-slugger";
import { toString } from "mdast-util-to-string";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";

const processor = unified().use(remarkParse).use(remarkGfm);

export interface OutlineItem {
  depth: number;
  id: string;
  line: number;
  text: string;
}

export const buildOutline = (markdown: string): OutlineItem[] => {
  const slugger = new GithubSlugger();
  const items: OutlineItem[] = [];
  const tree = processor.parse(markdown);

  visit(tree, "heading", (node) => {
    const text = toString(node).trim();

    if (text === "") {
      return;
    }

    items.push({
      depth: node.depth,
      id: slugger.slug(text),
      line: node.position?.start.line ?? 1,
      text,
    });
  });

  return items;
};

/**
 * The section a reader is inside at the given source line: the last heading
 * that starts at or above it. An empty outline has no active section.
 */
export const activeOutlineId = (
  items: readonly OutlineItem[],
  line: number
): string | null => {
  let active: string | null = null;

  for (const item of items) {
    if (item.line > line) {
      break;
    }

    active = item.id;
  }

  return active ?? items[0]?.id ?? null;
};
