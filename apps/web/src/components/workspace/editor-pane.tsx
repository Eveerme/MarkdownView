import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import CodeMirror from "@uiw/react-codemirror";

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

interface EditorPaneProps {
  value: string;
  onChange: (value: string) => void;
}

export const EditorPane = ({ value, onChange }: EditorPaneProps) => (
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
      theme="none"
      value={value}
    />
  </div>
);
