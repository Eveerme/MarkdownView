import { FeatherIcon } from "lucide-react";
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ComponentProps } from "react";
import Markdown from "react-markdown";
import type { Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import { ImageLightbox } from "#src/components/workspace/image-lightbox.tsx";
import { assetUrl } from "#src/lib/asset-url.ts";
import { rehypeHtmlBlocks } from "#src/lib/html-blocks.ts";
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
  onSelectLine?: (line: number) => void;
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

  // Eager on purpose: note images come from the local disk, and loading them
  // before a heading jump keeps the heading from moving once it is in view.
  return (
    <img
      {...rest}
      alt={alt ?? ""}
      decoding="async"
      src={resolveAsset(src) ?? src}
    />
  );
};

const MarkdownVideo = ({ src, ...rest }: ComponentProps<"video">) => {
  const resolveAsset = useContext(AssetUrlContext);

  // The video element mirrors the document author's markup, including the
  // absence of caption tracks; there is no caption source to synthesize here.
  // oxlint-disable-next-line jsx-a11y/media-has-caption
  return <video {...rest} src={resolveAsset(src) ?? src} />;
};

const components: Components = {
  a: MarkdownLink,
  img: MarkdownImage,
  video: MarkdownVideo,
};

const PreviewPaneView = ({
  content,
  filePath,
  onOpenLink,
  onScrollContainerChange,
  onScrollHandled,
  onSelectLine,
  scrollTarget,
}: PreviewPaneProps) => {
  const container = useRef<HTMLDivElement>(null);
  const linkHandler = useRef(onOpenLink);
  const scrollHandled = useRef(onScrollHandled);
  const selectLine = useRef(onSelectLine);

  const [viewing, setViewing] = useState<{ alt: string; src: string } | null>(
    null
  );

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

  useEffect(() => {
    selectLine.current = onSelectLine;
  }, [onSelectLine]);

  const dispatchOpenLink = useCallback((href: string) => {
    linkHandler.current?.(href);
  }, []);

  // A plain click on a rendered block puts the source cursor on its line, so
  // the preview can drive the editing side of a split view. An image is the
  // exception: it opens at full size instead of moving the caret.
  useEffect(() => {
    const element = container.current;

    const onClick = (event: MouseEvent) => {
      const { target } = event;

      if (
        !(target instanceof Element) ||
        (window.getSelection()?.toString() ?? "") !== ""
      ) {
        return;
      }

      const image = target.closest("img");

      if (image instanceof HTMLImageElement && image.closest("a") === null) {
        event.preventDefault();

        setViewing({
          alt: image.alt,
          src: image.currentSrc === "" ? image.src : image.currentSrc,
        });

        return;
      }

      if (target.closest("a, button, input, label, summary") !== null) {
        return;
      }

      const block = target.closest("[data-line]");

      const line =
        block instanceof HTMLElement ? Number(block.dataset.line) : Number.NaN;

      if (Number.isFinite(line)) {
        selectLine.current?.(line);
      }
    };

    element?.addEventListener("click", onClick);

    return () => {
      element?.removeEventListener("click", onClick);
    };
  }, []);

  useEffect(() => {
    if (scrollTarget === null) {
      return;
    }

    const element = container.current;

    if (element === null) {
      scrollHandled.current?.();

      return;
    }

    const target = element.querySelector(`#${CSS.escape(scrollTarget.id)}`);

    if (target instanceof HTMLElement) {
      // Scrolling the heading into view by hand keeps the movement inside the
      // preview: scrollIntoView also scrolls the window, which would push the
      // app frame up and leave a gap below it.
      const margin =
        // oxlint-disable-next-line unicorn/prefer-number-coercion
        Number.parseFloat(getComputedStyle(target).scrollMarginTop) || 0;

      const top =
        target.getBoundingClientRect().top -
        element.getBoundingClientRect().top +
        element.scrollTop -
        margin;

      element.scrollTo({ top: Math.max(0, top) });
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
                rehypePlugins={[
                  rehypeRaw,
                  rehypeHtmlBlocks,
                  rehypeSlug,
                  rehypeHighlight,
                  rehypeSourceLines,
                ]}
                remarkPlugins={[remarkGfm]}
              >
                {content}
              </Markdown>
            </article>
          )}
        </div>

        {viewing === null ? null : (
          <ImageLightbox
            alt={viewing.alt}
            onClose={() => {
              setViewing(null);
            }}
            src={viewing.src}
          />
        )}
      </AssetUrlContext.Provider>
    </LinkHandlerContext.Provider>
  );
};

/** Memoized: a cursor move in the source pane must not re-parse the document. */
export const PreviewPane = memo(PreviewPaneView);
