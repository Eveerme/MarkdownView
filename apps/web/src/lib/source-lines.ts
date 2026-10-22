import type { Root } from "hast";

/**
 * Tags every top-level block with the source line it starts on, so the preview
 * can keep its scroll position in step with the editor. Only top-level blocks
 * are tagged: nested elements share or overlap their parent's lines, which would
 * break the monotonic guide the scroll sync interpolates along.
 */
export const rehypeSourceLines = () => (tree: Root) => {
  for (const node of tree.children) {
    if (node.type === "element" && node.position !== undefined) {
      node.properties = {
        ...node.properties,
        dataLine: node.position.start.line,
      };
    }
  }
};
