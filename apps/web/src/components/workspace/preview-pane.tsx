import "katex/dist/katex.min.css";
import { isString } from "es-toolkit";
import { FeatherIcon } from "lucide-react";
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ComponentProps } from "react";
import Markdown from "react-markdown";
import type { Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { ImageLightbox } from "#src/components/workspace/image-lightbox.tsx";
import { MermaidBlock } from "#src/components/workspace/mermaid-block.tsx";
import { assetUrl, alternateAssetUrl } from "#src/lib/asset-url.ts";
import { frontMatterEntries, parseFrontMatter } from "#src/lib/front-matter.ts";
import { rehypeHtmlBlocks } from "#src/lib/html-blocks.ts";
import { countLines } from "#src/lib/markdown-stats.ts";
import { previewTopForLine, readAnchors } from "#src/lib/reading-line.ts";
import { rehypeSourceLines } from "#src/lib/source-lines.ts";
import type { PreviewTarget } from "#src/lib/use-workspace.ts";

interface PreviewPaneProps {
  content: string;
  filePath: string | null;
  onOpenLink?: (href: string) => void;
  onScrollContainerChange?: (element: HTMLDivElement | null) => void;
  onScrollHandled?: () => void;
  onSelectLine?: (line: number) => void;
  scrollTarget: PreviewTarget | null;
  showFrontMatter?: boolean;
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
      onError={(event) => {
        const image = event.currentTarget;
        const next = alternateAssetUrl(image.src);

        if (next === null || image.dataset.assetFallback === image.src) {
          return;
        }

        image.dataset.assetFallback = image.src;
        image.src = next;
      }}
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

const MarkdownCode = ({ children, className }: ComponentProps<"code">) => {
  if ((className ?? "").split(/\s+/u).includes("language-mermaid")) {
    const chart = isString(children) ? children : "";

    return <MermaidBlock chart={chart.replace(/\n$/u, "")} />;
  }

  return <code className={className}>{children}</code>;
};

const components: Components = {
  a: MarkdownLink,
  code: MarkdownCode,
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
  showFrontMatter = true,
}: PreviewPaneProps) => {
  const container = useRef<HTMLDivElement>(null);
  const linkHandler = useRef(onOpenLink);
  const scrollHandled = useRef(onScrollHandled);
  const selectLine = useRef(onSelectLine);

  const [viewing, setViewing] = useState<{ alt: string; src: string } | null>(
    null
  );

  const frontMatter = useMemo(() => parseFrontMatter(content), [content]);

  const meta = useMemo(
    () => frontMatterEntries(frontMatter.data),
    [frontMatter]
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
      return () => {
        // Nothing to show, so there is nothing to clean up.
      };
    }

    const element = container.current;

    if (element === null) {
      scrollHandled.current?.();

      return () => {
        // The pane is not mounted yet, so there is nothing to clean up.
      };
    }

    const settle = () => {
      if (scrollTarget.kind === "line") {
        const top = previewTopForLine(
          element,
          readAnchors(element),
          scrollTarget.line
        );

        if (top !== null) {
          element.scrollTo({ top: Math.max(0, top) });
        }

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
    };

    settle();

    // Images and fonts arrive after this render and move the blocks below them,
    // so the same line lands at a different offset once they are in place. The
    // correction ends as soon as the reader takes over.
    let frame: number | null = null;
    let done = false;

    const correct = () => {
      frame = null;

      if (done) {
        return;
      }

      settle();
    };

    const schedule = () => {
      if (frame === null && !done) {
        frame = requestAnimationFrame(correct);
      }
    };

    const stop = () => {
      done = true;

      if (frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      }

      // The target has served its purpose. Dropping it keeps a later remount of
      // the pane — a save under a new name, say — from jumping back to it.
      if (scrollTarget.kind === "line") {
        scrollHandled.current?.();
      }
    };

    const page = element.querySelector(".markdown-page") ?? element;
    const observer = new ResizeObserver(schedule);

    observer.observe(page);
    element.addEventListener("wheel", stop, { passive: true, once: true });
    element.addEventListener("touchend", stop, { passive: true, once: true });
    element.addEventListener("pointerdown", stop, {
      passive: true,
      once: true,
    });
    window.addEventListener("keydown", stop, { once: true });

    const timer = setTimeout(stop, 1200);

    // A heading jump is one-shot; a remembered line keeps its target so the
    // correction can run until the reader takes over or the pane unmounts.
    if (scrollTarget.kind === "id") {
      scrollHandled.current?.();
    }

    return () => {
      observer.disconnect();
      element.removeEventListener("wheel", stop);
      element.removeEventListener("touchend", stop);
      element.removeEventListener("pointerdown", stop);
      window.removeEventListener("keydown", stop);
      clearTimeout(timer);
      cancelAnimationFrame(frame ?? 0);
    };
  }, [scrollTarget]);

  return (
    <LinkHandlerContext.Provider value={dispatchOpenLink}>
      <AssetUrlContext.Provider value={resolveAsset}>
        <div
          className="preview-scroll h-full min-h-0"
          data-doc-lines={countLines(content)}
          ref={attachContainer}
        >
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
            <article className="markdown-body markdown-page mx-auto w-full px-5 pt-6 pb-16 sm:px-6">
              {showFrontMatter && meta.length > 0 ? (
                <header className="border-border bg-muted/40 mb-8 rounded-lg border px-4 py-3 text-sm">
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                    {meta.map(({ key, value }, index) => (
                      <div
                        className="col-span-2 grid grid-cols-subgrid"
                        key={key}
                      >
                        <dt className="text-muted-foreground font-medium">
                          {key}
                        </dt>
                        <dd className="min-w-0 break-words">
                          {index === 0 ? (
                            <button
                              className="text-left underline-offset-4 hover:underline"
                              onClick={() => {
                                onSelectLine?.(2);
                              }}
                              type="button"
                            >
                              {value}
                            </button>
                          ) : (
                            value
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </header>
              ) : null}
              <Markdown
                components={components}
                rehypePlugins={[
                  rehypeRaw,
                  rehypeHtmlBlocks,
                  rehypeSlug,
                  rehypeKatex,
                  rehypeHighlight,
                  [rehypeSourceLines, { offset: frontMatter.lineOffset }],
                ]}
                remarkPlugins={[remarkBreaks, remarkGfm, remarkMath]}
              >
                {frontMatter.body}
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
