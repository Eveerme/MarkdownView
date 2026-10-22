import { imageAssetHost, imageAssetScheme } from "@markdownview/electron";

const externalPattern = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu;

const decode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

/**
 * The URL the desktop protocol reads an image from, or null when the source is
 * external, a heading anchor, or has no document to resolve against.
 */
export const assetUrl = ({
  from,
  src,
}: {
  from: string | null;
  src: string | null | undefined;
}): string | null => {
  if (from === null || src === null || src === undefined) {
    return null;
  }

  const value = src.trim();

  if (value === "" || value.startsWith("#") || externalPattern.test(value)) {
    return null;
  }

  return `${imageAssetScheme}://${imageAssetHost}/?from=${encodeURIComponent(from)}&src=${encodeURIComponent(decode(value))}`;
};
