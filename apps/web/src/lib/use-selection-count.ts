import { useEffect, useState } from "react";

import { countCharacters } from "#src/lib/markdown-stats.ts";

/** The panes whose text a reader can select and count. */
const surfaces = ".preview-scroll, .cm-editor";

const selectedText = (): string => {
  const selection = document.getSelection();

  if (selection === null || selection.isCollapsed) {
    return "";
  }

  const text = selection.toString();

  if (text === "") {
    return "";
  }

  const range = selection.getRangeAt(0);
  const node = range.commonAncestorContainer;
  const element = node instanceof Element ? node : node.parentElement;

  if (element === null || element.closest(surfaces) === null) {
    return "";
  }

  return text;
};

/** The character count of the selected text in the source or the preview. */
export const useSelectionCount = (): number => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setCount(countCharacters(selectedText()));
      });
    };

    document.addEventListener("selectionchange", update);
    update();

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("selectionchange", update);
    };
  }, []);

  return count;
};
