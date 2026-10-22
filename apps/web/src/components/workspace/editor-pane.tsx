import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView, lineNumbers } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import CodeMirror from "@uiw/react-codemirror";
import type { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { useEffect, useMemo, useRef } from "react";
import type { ClipboardEvent, DragEvent } from "react";

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
  EditorView.contentAttributes.of({ "aria-label": "Markdown 源码" }),
  syntaxHighlighting(markdownHighlight),
];

type ImageHandler = (file: File) => Promise<string | null>;

export interface EditorCursor {
  column: number;
  line: number;
}

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
  line: number;
  nonce: number;
}

interface EditorPaneProps {
  lineNumbers: boolean;
  onChange: (value: string) => void;
  onCursorChange?: (cursor: EditorCursor) => void;
  onImagePaste?: ImageHandler;
  onViewChange?: (view: EditorView | null) => void;
  reveal: EditorReveal | null;
  value: string;
  wordWrap: boolean;
}

export const EditorPane = ({
  lineNumbers: showLineNumbers,
  onChange,
  onCursorChange,
  onImagePaste,
  onViewChange,
  reveal,
  value,
  wordWrap,
}: EditorPaneProps) => {
  const editor = useRef<ReactCodeMirrorRef>(null);

  useEffect(
    () => () => {
      onViewChange?.(null);
    },
    [onViewChange]
  );

  const cursorListener = useMemo(
    () =>
      EditorView.updateListener.of((update) => {
        if (!(update.selectionSet || update.docChanged)) {
          return;
        }

        const { head } = update.state.selection.main;
        const line = update.state.doc.lineAt(head);

        onCursorChange?.({
          column: head - line.from + 1,
          line: line.number,
        });
      }),
    [onCursorChange]
  );

  const editorExtensions = useMemo(
    () => [
      ...extensions,
      ...(wordWrap ? [EditorView.lineWrapping] : []),
      ...(showLineNumbers ? [lineNumbers()] : []),
      cursorListener,
    ],
    [cursorListener, showLineNumbers, wordWrap]
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

  useEffect(() => {
    if (reveal === null) {
      return;
    }

    const view = editor.current?.view;

    if (view === undefined) {
      return;
    }

    const lineNumber = Math.min(Math.max(reveal.line, 1), view.state.doc.lines);
    const line = view.state.doc.line(lineNumber);

    view.dispatch({
      effects: EditorView.scrollIntoView(line.from, { y: "start" }),
      selection: { anchor: line.from },
    });
    view.focus();
  }, [reveal]);

  return (
    <div
      className="editor-pane h-full min-h-0 overflow-hidden"
      onDropCapture={dropImage}
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
        }}
        className="h-full"
        extensions={editorExtensions}
        height="100%"
        onChange={onChange}
        onCreateEditor={(view) => {
          onViewChange?.(view);
        }}
        placeholder="开始写作…"
        ref={editor}
        theme="none"
        value={value}
      />
    </div>
  );
};
