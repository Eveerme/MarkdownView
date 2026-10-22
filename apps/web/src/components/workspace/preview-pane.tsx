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

import { assetUrl } from "#src/lib/asset-url.ts";
import { rehypeSourceLines } from "#src/lib/source-lines.ts";

interface PreviewScrollTarget {
  id: string;
  nonce: number;
}

interface PreviewPaneProps {
  content: string;
  filePath: string | null;
  onOpenLink?: (href: string) => void;
  onScrollContainerChange?: (element: HTMLDivElement | null) => void;
  onScrollHandled?: () => void;
  scrollTarget: PreviewScrollTarget | null;
}

const externalPattern = /^(?:https?|mailto):/iu;
const LinkHandlerContext = createContext<((href: string) => void) | null>(null);

const AssetUrlContext = createContext<
  (src: string | undefined) => string | null
>(() => null);

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

const MarkdownImage = ({ alt, src, ...rest }: ComponentProps<"img">) => {
  const resolveAsset = useContext(AssetUrlContext);

  return (
    <img
      {...rest}
      alt={alt ?? ""}
      loading="lazy"
      src={resolveAsset(src) ?? src}
    />
  );
};

const components: Components = { a: MarkdownLink, img: MarkdownImage };

export const PreviewPane = ({
  content,
  filePath,
  onOpenLink,
  onScrollContainerChange,
  onScrollHandled,
  scrollTarget,
}: PreviewPaneProps) => {
  const container = useRef<HTMLDivElement>(null);
  const linkHandler = useRef(onOpenLink);
  const scrollHandled = useRef(onScrollHandled);

  const attachContainer = useCallback(
    (element: HTMLDivElement | null) => {
      container.current = element;
      onScrollContainerChange?.(element);
    },
    [onScrollContainerChange]
  );

  const resolveAsset = useCallback(
    (src: string | undefined) => assetUrl({ from: filePath, src }),
    [filePath]
  );

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
      <AssetUrlContext.Provider value={resolveAsset}>
        <div className="preview-scroll h-full min-h-0" ref={attachContainer}>
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
            <article className="markdown-body markdown-page mx-auto w-full px-8 pt-12 pb-24 sm:px-10">
              <Markdown
                components={components}
                rehypePlugins={[rehypeSlug, rehypeHighlight, rehypeSourceLines]}
                remarkPlugins={[remarkGfm]}
              >
                {content}
              </Markdown>
            </article>
          )}
        </div>
      </AssetUrlContext.Provider>
    </LinkHandlerContext.Provider>
  );
};
