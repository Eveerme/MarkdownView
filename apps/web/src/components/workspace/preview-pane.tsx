import { FeatherIcon } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";
import type { ComponentProps } from "react";
import Markdown from "react-markdown";
import type { Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

interface PreviewScrollTarget {
  id: string;
  nonce: number;
}

interface PreviewPaneProps {
  content: string;
  onOpenLink?: (href: string) => void;
  onScrollHandled?: () => void;
  scrollTarget: PreviewScrollTarget | null;
}

const externalPattern = /^(?:https?|mailto):/iu;
const LinkHandlerContext = createContext<((href: string) => void) | null>(null);

const MarkdownLink = ({ children, href }: ComponentProps<"a">) => {
  const onOpenLink = useContext(LinkHandlerContext);

  if (href === undefined || href.trim() === "") {
    return <span>{children}</span>;
  }

  if (href.startsWith("#")) {
    return <a href={href}>{children}</a>;
  }

  if (href.startsWith("//") || externalPattern.test(href)) {
    return (
      <a href={href} rel="noreferrer" target="_blank">
        {children}
      </a>
    );
  }

  return (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onOpenLink?.(href);
      }}
    >
      {children}
    </a>
  );
};

const components: Components = { a: MarkdownLink };

export const PreviewPane = ({
  content,
  onOpenLink,
  onScrollHandled,
  scrollTarget,
}: PreviewPaneProps) => {
  const container = useRef<HTMLDivElement>(null);
  const linkHandler = useRef(onOpenLink);
  const scrollHandled = useRef(onScrollHandled);

  useEffect(() => {
    linkHandler.current = onOpenLink;
  }, [onOpenLink]);

  useEffect(() => {
    scrollHandled.current = onScrollHandled;
  }, [onScrollHandled]);

  const dispatchOpenLink = useCallback((href: string) => {
    linkHandler.current?.(href);
  }, []);

  useEffect(() => {
    if (scrollTarget === null) {
      return;
    }

    const target = container.current?.querySelector(
      `#${CSS.escape(scrollTarget.id)}`
    );

    if (target instanceof HTMLElement) {
      target.scrollIntoView({ block: "start" });
    }

    scrollHandled.current?.();
  }, [scrollTarget]);

  return (
    <LinkHandlerContext.Provider value={dispatchOpenLink}>
      <div className="h-full min-h-0 overflow-y-auto" ref={container}>
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
              rehypePlugins={[rehypeSlug, rehypeHighlight]}
              remarkPlugins={[remarkGfm]}
            >
              {content}
            </Markdown>
          </article>
        )}
      </div>
    </LinkHandlerContext.Provider>
  );
};
