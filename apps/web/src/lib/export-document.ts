import { assetUrl } from "#src/lib/asset-url.ts";
import {
  buildExportDocument,
  renderMarkdownHtml,
} from "#src/lib/export-html.ts";

const themeVariables = [
  "--background",
  "--border",
  "--code-background",
  "--code-foreground",
  "--foreground",
  "--muted",
  "--muted-foreground",
  "--paper-line",
  "--primary",
  "--radius",
  "--syntax-function",
  "--syntax-keyword",
  "--syntax-number",
  "--syntax-string",
];

const readThemeVariables = () => {
  const styles = getComputedStyle(document.documentElement);

  return themeVariables
    .map((name) => `${name}: ${styles.getPropertyValue(name).trim()};`)
    .join(" ");
};

const bytesToDataUrl = (bytes: Uint8Array, contentType: string) => {
  const chunks: string[] = [];
  const chunkSize = 0x80_00;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    chunks.push(
      String.fromCodePoint(...bytes.subarray(index, index + chunkSize))
    );
  }

  return `data:${contentType};base64,${btoa(chunks.join(""))}`;
};

/** Local note images become data URLs, so an exported file still shows them elsewhere. */
const embedImages = async (html: string, filePath: string | null) => {
  if (filePath === null) {
    return html;
  }

  const parsed = new DOMParser().parseFromString(html, "text/html");
  const images = [...parsed.querySelectorAll("img")];

  await Promise.all(
    images.map(async (image) => {
      const src = image.getAttribute("src");

      if (src === null) {
        return;
      }

      const url = assetUrl({ from: filePath, src });

      if (url === null) {
        return;
      }

      try {
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`无法读取图片：${src}`);
        }

        const contentType =
          response.headers.get("content-type") ?? "application/octet-stream";

        image.setAttribute(
          "src",
          bytesToDataUrl(
            new Uint8Array(await response.arrayBuffer()),
            contentType
          )
        );
      } catch {
        image.removeAttribute("src");
      }
    })
  );

  return parsed.body.innerHTML;
};

export const createExportDocument = async ({
  content,
  filePath,
  title,
}: {
  content: string;
  filePath: string | null;
  title: string;
}) => {
  const body = await embedImages(await renderMarkdownHtml(content), filePath);

  return buildExportDocument({
    bodyHtml: body,
    title,
    variables: readThemeVariables(),
  });
};
