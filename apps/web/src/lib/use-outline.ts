import { useEffect, useMemo, useRef, useState } from "react";

import { buildOutline } from "#src/lib/outline.ts";

const delay = 250;

/**
 * Parsing every keystroke would compete with typing, so the outline follows
 * the text after a short pause. Switching documents updates it immediately.
 */
export const useDocumentOutline = (
  content: string,
  documentKey: string | null
) => {
  const [source, setSource] = useState(content);
  const lastKey = useRef(documentKey);

  useEffect(() => {
    const switched = lastKey.current !== documentKey;

    lastKey.current = documentKey;

    const timer = setTimeout(
      () => {
        setSource(content);
      },
      switched ? 0 : delay
    );

    return () => {
      clearTimeout(timer);
    };
  }, [content, documentKey]);

  return useMemo(() => buildOutline(source), [source]);
};
