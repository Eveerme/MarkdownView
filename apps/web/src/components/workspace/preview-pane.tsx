import { FeatherIcon } from "lucide-react";
import Markdown from "react-markdown";
import type { Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

interface PreviewPaneProps {
  content: string;
}

// Links leave the app through the system browser; the window handler does the opening.
const components: Components = {
  a: ({ children, href }) => (
    <a href={href} rel="noreferrer" target="_blank">
      {children}
    </a>
  ),
};

export const PreviewPane = ({ content }: PreviewPaneProps) => (
  <div className="h-full min-h-0 overflow-y-auto">
    {content.trim() === "" ? (
      <div className="blank-page grid h-full place-items-center px-8 py-16 text-center">
        <div className="max-w-xs">
          <FeatherIcon className="text-muted-foreground/50 mx-auto size-5" />
          <p className="mt-4 font-serif text-xl">空白页</p>
          <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
            在左侧写下第一行，或者打开一个已有的 Markdown 文件。
          </p>
        </div>
      </div>
    ) : (
      <article className="markdown-body mx-auto w-full max-w-[76ch] px-8 pt-12 pb-24 sm:px-10">
        <Markdown
          components={components}
          rehypePlugins={[rehypeHighlight]}
          remarkPlugins={[remarkGfm]}
        >
          {content}
        </Markdown>
      </article>
    )}
  </div>
);
