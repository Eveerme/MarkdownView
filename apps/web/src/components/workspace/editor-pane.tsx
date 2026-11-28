import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { search } from "@codemirror/search";
import { EditorView, lineNumbers } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import CodeMirror from "@uiw/react-codemirror";
import type { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ClipboardEvent, DragEvent, KeyboardEvent } from "react";

import { SearchPanel } from "#src/components/workspace/search-panel.tsx";
import { publishCursor } from "#src/lib/editor-cursor.ts";

const markdownHighlight = HighlightStyle.define([
  {
    tag: [tags.heading1, tags.heading2],
    class: "cm-heading",
  },
  {
    tag: [tags.heading3, tags.heading4, tags.heading5, tags.heading6],
    class: "cm-subheading",
  },
  { tag: tags.strong, class: "cm-strong" },
  { tag: tags.emphasis, class: "cm-emphasis" },
  { tag: [tags.link, tags.url], class: "cm-link" },
  { tag: tags.monospace, class: "cm-monospace" },
  { tag: tags.quote, class: "cm-quote" },
  { tag: [tags.meta, tags.processingInstruction], class: "cm-mark" },
  { tag: tags.contentSeparator, class: "cm-separator" },
  { tag: tags.list, class: "cm-list" },
]);

const extensions = [
  markdown(),
  search(),
  EditorView.contentAttributes.of({ "aria-label": "Markdown 源码" }),
  syntaxHighlighting(markdownHighlight),
  // The caret lives in a store, so moving it repaints the footer, not the app.
  EditorView.updateListener.of((update) => {
    if (!(update.selectionSet || update.docChanged)) {
      return;
    }

    const selection = update.state.selection.main;
    const line = update.state.doc.lineAt(selection.head);

    publishCursor({
      column: selection.head - line.from + 1,
      line: line.number,
    });
  }),
];

type ImageHandler = (file: File) => Promise<string | null>;

const imageFrom = (data: DataTransfer | null): File | null => {
  if (data === null) {
    return null;
  }

  const image = [...data.files].find((file) => file.type.startsWith("image/"));

  if (image === undefined || data.getData("text/plain") !== "") {
    return null;
  }

  return image;
};

const insertImage = async (
  view: EditorView | undefined,
  file: File,
  handler: ImageHandler | undefined
) => {
  const snippet = await handler?.(file);

  if (view === undefined || snippet === null || snippet === undefined) {
    return;
  }

  view.dispatch(view.state.replaceSelection(snippet));
  view.focus();
};

interface EditorReveal {
  /** False leaves the focus where it was, such as on the tab that was clicked. */
  focus?: boolean;
  line: number;
  nonce: number;
}

interface EditorPaneProps {
  focusMode: boolean;
  lineNumbers: boolean;
  onChange: (value: string) => void;
  onImagePaste?: ImageHandler;
  onViewChange?: (view: EditorView | null) => void;
  reveal: EditorReveal | null;
  typewriterMode: boolean;
  value: string;
  wordWrap: boolean;
}

/** Put the view and the caret at a source line, focusing unless told not to. */
const applyReveal = (view: EditorView, reveal: EditorReveal) => {
  const lineNumber = Math.min(Math.max(reveal.line, 1), view.state.doc.lines);
  const line = view.state.doc.line(lineNumber);

  view.dispatch({
    effects: EditorView.scrollIntoView(line.from, { y: "start" }),
    selection: { anchor: line.from },
  });

  if (reveal.focus !== false) {
    view.focus();
  }
};

export const EditorPane = ({
  focusMode,
  lineNumbers: showLineNumbers,
  onChange,
  onImagePaste,
  onViewChange,
  reveal,
  typewriterMode,
  value,
  wordWrap,
}: EditorPaneProps) => {
  const editor = useRef<ReactCodeMirrorRef>(null);
  const [view, setView] = useState<EditorView | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [searchSignal, setSearchSignal] = useState(0);

  useEffect(
    () => () => {
      onViewChange?.(null);
    },
    [onViewChange]
  );

  const typewriter = useMemo(
    () =>
      typewriterMode
        ? EditorView.updateListener.of((update) => {
            if (!(update.selectionSet || update.docChanged)) {
              return;
            }

            update.view.dispatch({
              effects: EditorView.scrollIntoView(
                update.state.selection.main.head,
                { y: "center" }
              ),
            });
          })
        : [],
    [typewriterMode]
  );

  const editorExtensions = useMemo(
    () => [
      ...extensions,
      typewriter,
      ...(wordWrap ? [EditorView.lineWrapping] : []),
      ...(showLineNumbers ? [lineNumbers()] : []),
    ],
    [showLineNumbers, typewriter, wordWrap]
  );

  const pasteImage = (event: ClipboardEvent<HTMLDivElement>) => {
    const file = imageFrom(event.clipboardData);

    if (file === null) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    void insertImage(editor.current?.view, file, onImagePaste);
  };

  const dropImage = (event: DragEvent<HTMLDivElement>) => {
    const file = imageFrom(event.dataTransfer);

    if (file === null) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    void insertImage(editor.current?.view, file, onImagePaste);
  };

  // The editor is created inside CodeMirror after this pane's first render, so
  // the reveal waits for it: a target set while the pane mounts would otherwise
  // be dropped before there is a view to move.
  useEffect(() => {
    if (reveal === null || view === null) {
      return;
    }

    applyReveal(view, reveal);
  }, [reveal, view]);

  const openSearch = (withReplace: boolean) => {
    setReplaceOpen(withReplace);
    setSearchOpen(true);
    setSearchSignal((current) => current + 1);
  };

  const handleKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    const modifier = event.ctrlKey || event.metaKey;

    if (modifier && !event.altKey && event.key.toLowerCase() === "f") {
      event.preventDefault();
      event.stopPropagation();
      openSearch(false);

      return;
    }

    if (modifier && !event.altKey && event.key.toLowerCase() === "h") {
      event.preventDefault();
      event.stopPropagation();
      openSearch(true);

      return;
    }

    if (event.key === "Escape" && searchOpen) {
      event.preventDefault();
      event.stopPropagation();
      setSearchOpen(false);
      setReplaceOpen(false);
    }
  };

  return (
    <div
      className={`editor-pane relative h-full min-h-0 overflow-hidden${focusMode ? " focus-mode" : ""}`}
      onDropCapture={dropImage}
      onKeyDownCapture={handleKeyDownCapture}
      onPasteCapture={pasteImage}
    >
      <CodeMirror
        basicSetup={{
          autocompletion: false,
          bracketMatching: false,
          foldGutter: false,
          highlightActiveLine: true,
          highlightActiveLineGutter: false,
          lineNumbers: false,
          searchKeymap: false,
        }}
        className="h-full"
        extensions={editorExtensions}
        height="100%"
        onChange={onChange}
        onCreateEditor={(created) => {
          setView(created);
          onViewChange?.(created);
        }}
        placeholder="开始写作…"
        ref={editor}
        theme="none"
        value={value}
      />
      <SearchPanel
        focusSignal={searchSignal}
        onClose={() => {
          setSearchOpen(false);
          setReplaceOpen(false);
        }}
        open={searchOpen}
        replaceOpen={replaceOpen}
        view={view}
      />
    </div>
  );
};
