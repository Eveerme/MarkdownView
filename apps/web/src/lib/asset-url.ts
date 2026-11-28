import {
  imageAssetHost,
  imageAssetPath,
  imageAssetScheme,
} from "@markdownview/desktop-contract";

const externalPattern = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu;

const decode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const detectsWindows = () =>
  typeof navigator !== "undefined" && /Windows/iu.test(navigator.userAgent);

/**
 * The URL the desktop protocol reads an image from, or null when the source is
 * external, a heading anchor, or has no document to resolve against.
 */
export const assetUrl = ({
  from,
  src,
  windows = detectsWindows(),
}: {
  from: string | null;
  src: string | null | undefined;
  windows?: boolean;
}): string | null => {
  if (from === null || src === null || src === undefined) {
    return null;
  }

  const value = src.trim();

  if (value === "" || value.startsWith("#") || externalPattern.test(value)) {
    return null;
  }

  // WebView2 does not fetch a custom scheme from an <img>; Windows reaches the
  // same handler through the scheme's http.localhost mapping.
  const base = windows
    ? `http://${imageAssetScheme}.localhost${imageAssetPath}/`
    : `${imageAssetScheme}://${imageAssetHost}${imageAssetPath}/`;

  return `${base}?from=${encodeURIComponent(from)}&src=${encodeURIComponent(decode(value))}`;
};

const nativePrefix = `${imageAssetScheme}://${imageAssetHost}${imageAssetPath}/`;
const windowsPrefix = `http://${imageAssetScheme}.localhost${imageAssetPath}/`;

/** The same handler through the other scheme form, for one retry on failure. */
export const alternateAssetUrl = (url: string): string | null => {
  if (url.startsWith(windowsPrefix)) {
    return `${nativePrefix}${url.slice(windowsPrefix.length)}`;
  }

  if (url.startsWith(nativePrefix)) {
    return `${windowsPrefix}${url.slice(nativePrefix.length)}`;
  }

  return null;
};
