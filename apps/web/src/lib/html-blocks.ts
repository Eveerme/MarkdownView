import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { Options } from "rehype-sanitize";

/**
 * GitHub's allowlist extended for README-style HTML blocks: video playback
 * (`video`/`source` and its attributes) is not part of it. `data:` is allowed
 * on `src` because images in Markdown carry image data URLs and `src` on
 * `img`/`video`/`source` is a media-resource context that cannot execute a
 * document; link protocols keep their stricter schemes. `style` is stripped
 * with its content, not unwrapped into visible text.
 */
const htmlBlocksSchema: Options = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    source: [...(defaultSchema.attributes?.source ?? []), "src", "type"],
    video: [
      "autoplay",
      "controls",
      "loop",
      "muted",
      "playsInline",
      "poster",
      "preload",
      "src",
    ],
  },
  protocols: {
    ...defaultSchema.protocols,
    poster: ["http", "https"],
    src: ["data", "http", "https"],
  },
  strip: [...(defaultSchema.strip ?? []), "style"],
  tagNames: [...(defaultSchema.tagNames ?? []), "video"],
};

export const rehypeHtmlBlocks = () => rehypeSanitize(htmlBlocksSchema);
