import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vite-plus/test";

import {
  createImageProtocolHandler,
  isImagePath,
  resolveImageRequest,
} from "#src/main/image-protocol.ts";

const asUrl = (from: string, src: string) =>
  `https://asset/?from=${encodeURIComponent(from)}&src=${encodeURIComponent(src)}`;

describe("local note images", () => {
  const root = mkdtempSync(path.join(tmpdir(), "markdownview-images-"));

  mkdirSync(path.join(root, "notes", "assets"), { recursive: true });
  mkdirSync(path.join(root, "outside"), { recursive: true });

  const document = path.join(root, "notes", "a.md");
  const image = path.join(root, "notes", "img.png");
  const nestedImage = path.join(root, "notes", "assets", "pic.jpg");
  const chineseImage = path.join(root, "notes", "图.png");
  const secret = path.join(root, "outside", "secret.png");

  for (const file of [document, image, nestedImage, chineseImage, secret]) {
    writeFileSync(file, file.endsWith(".md") ? "# note" : "png");
  }

  afterAll(() => {
    rmSync(root, { force: true, recursive: true });
  });

  const context = {
    isAllowedDocument: (filePath: string) => filePath === document,
    roots: [path.join(root, "notes")],
  };

  it("recognises the image extensions the preview can show", () => {
    expect(isImagePath(image)).toBeTruthy();
    expect(isImagePath(path.join(root, "photo.WEBP"))).toBeTruthy();
    expect(isImagePath(document)).toBeFalsy();
  });

  it("resolves an image beside the note and in a subfolder", async () => {
    await expect(
      resolveImageRequest({ ...context, from: document, src: "img.png" })
    ).resolves.toBe(image);
    await expect(
      resolveImageRequest({ ...context, from: document, src: "assets/pic.jpg" })
    ).resolves.toBe(nestedImage);
  });

  it("keeps files outside the opened roots out of reach", async () => {
    await expect(
      resolveImageRequest({
        ...context,
        from: document,
        roots: [],
        src: "../outside/secret.png",
      })
    ).resolves.toBeNull();

    await expect(
      resolveImageRequest({
        ...context,
        from: document,
        src: "../../outside/secret.png",
      })
    ).resolves.toBeNull();
  });

  it("rejects external sources, non-images, and unopened documents", async () => {
    const sources = [
      "https://example.com/a.png",
      "http://example.com/a.png",
      "data:image/png;base64,AAAA",
      "file:///C:/a.png",
      "/absolute.png",
      "C:\\absolute.png",
      "#heading",
      "note.md",
      "",
    ];

    const results = await Promise.all(
      sources.map(async (src) => {
        const target = await resolveImageRequest({
          ...context,
          from: document,
          src,
        });

        return target;
      })
    );

    expect(results).toStrictEqual(sources.map(() => null));

    await expect(
      resolveImageRequest({
        ...context,
        from: path.join(root, "outside", "other.md"),
        src: "../notes/img.png",
      })
    ).resolves.toBeNull();
  });

  it("serves an allowed image and answers everything else with 404", async () => {
    const serve = createImageProtocolHandler(() => context);

    const response = await serve(new Request(asUrl(document, "图.png")));

    await expect(response.text()).resolves.toBe("png");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");

    const requests = [
      asUrl(document, "../outside/secret.png"),
      asUrl(document, "note.md"),
      asUrl(path.join(root, "outside", "other.md"), "img.png"),
      "https://elsewhere/?from=a&src=b",
      "https://asset/?from=only",
    ];

    const statuses = await Promise.all(
      requests.map(async (request) => {
        const denied = await serve(new Request(request));

        return denied.status;
      })
    );

    expect(statuses).toStrictEqual(requests.map(() => 404));
  });
});
