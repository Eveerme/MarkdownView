import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vite-plus/test";

import {
  imageExtensionFor,
  imageFileName,
  saveImageAsset,
} from "#src/main/assets.ts";

describe("stored note images", () => {
  const root = mkdtempSync(path.join(tmpdir(), "markdownview-assets-"));
  const from = path.join(root, "note.md");

  afterAll(() => {
    rmSync(root, { force: true, recursive: true });
  });

  it("maps the accepted image formats to a file extension", () => {
    expect(imageExtensionFor("image/png")).toBe("png");
    expect(imageExtensionFor("image/jpeg; charset=binary")).toBe("jpg");
    expect(imageExtensionFor("IMAGE/WEBP")).toBe("webp");
    expect(imageExtensionFor("image/svg+xml")).toBe("svg");
    expect(imageExtensionFor("image/tiff")).toBeNull();
  });

  it("names an image after the moment it was pasted", () => {
    expect(
      imageFileName(new Date("2026-10-22T03:04:05.000Z"), "abcd1234", "png")
    ).toBe("image-20261022030405-abcd1234.png");
  });

  it("writes the image into an assets folder beside the note", async () => {
    const data = new Uint8Array([1, 2, 3]);

    const saved = await saveImageAsset({
      data,
      from,
      mimeType: "image/png",
    });

    expect(saved.relativePath).toMatch(/^assets\/image-\d{14}-\w{8}\.png$/u);
    expect(
      readFileSync(path.join(root, saved.relativePath)).equals(
        Buffer.from(data)
      )
    ).toBeTruthy();

    const second = await saveImageAsset({
      data,
      from,
      mimeType: "image/png",
    });

    expect(second.relativePath).not.toBe(saved.relativePath);
  });

  it("rejects unsupported and empty data", async () => {
    await expect(
      saveImageAsset({
        data: new Uint8Array([1]),
        from,
        mimeType: "image/tiff",
      })
    ).rejects.toThrow("不支持的图片格式");

    await expect(
      saveImageAsset({ data: new Uint8Array(), from, mimeType: "image/png" })
    ).rejects.toThrow("图片内容为空");
  });
});
