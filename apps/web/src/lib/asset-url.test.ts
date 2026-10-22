import { describe, expect, it } from "vite-plus/test";

import { assetUrl } from "#src/lib/asset-url.ts";

const from = "C:\\notes\\daily\\note.md";
const prefix = "mdview://asset/";

describe("note image URLs", () => {
  it("routes a relative image through the desktop protocol", () => {
    expect(assetUrl({ from, src: "img.png" })).toBe(
      `${prefix}?from=${encodeURIComponent(from)}&src=img.png`
    );
    expect(assetUrl({ from, src: "assets/我的 图.png" })).toBe(
      `${prefix}?from=${encodeURIComponent(from)}&src=${encodeURIComponent(
        "assets/我的 图.png"
      )}`
    );
  });

  it("decodes a source the author already wrote percent-encoded", () => {
    expect(assetUrl({ from, src: "assets/%E5%9B%BE.png" })).toBe(
      `${prefix}?from=${encodeURIComponent(from)}&src=${encodeURIComponent(
        "assets/图.png"
      )}`
    );
  });

  it("leaves external, anchor, and empty sources alone", () => {
    for (const src of [
      "https://example.com/a.png",
      "http://example.com/a.png",
      "//example.com/a.png",
      "data:image/png;base64,AAAA",
      "blob:https://app.localhost/123",
      "file:///C:/a.png",
      "#heading",
      "",
      "   ",
      null,
      undefined,
    ]) {
      expect(assetUrl({ from, src })).toBeNull();
    }

    expect(assetUrl({ from: null, src: "img.png" })).toBeNull();
  });
});
