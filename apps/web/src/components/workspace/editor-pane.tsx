import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import CodeMirror from "@uiw/react-codemirror";
import type { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { useEffect, useRef } from "react";

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
  EditorView.lineWrapping,
  EditorView.contentAttributes.of({ "aria-label": "Markdown 源码" }),
  syntaxHighlighting(markdownHighlight),
];

interface EditorReveal {
  line: number;
  nonce: number;
}

interface EditorPaneProps {
  value: string;
  onChange: (value: string) => void;
  reveal: EditorReveal | null;
}

export const EditorPane = ({ value, onChange, reveal }: EditorPaneProps) => {
  const editor = useRef<ReactCodeMirrorRef>(null);

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
    <div className="editor-pane h-full min-h-0 overflow-hidden">
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
        extensions={extensions}
        height="100%"
        onChange={onChange}
        placeholder="开始写作…"
        ref={editor}
        theme="none"
        value={value}
      />
    </div>
  );
};
