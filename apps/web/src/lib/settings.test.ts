import { describe, expect, it } from "vite-plus/test";

import {
  defaultSettings,
  normalizeSettings,
  readSettings,
  writeSettings,
} from "#src/lib/settings.ts";
import type { AppSettings, SettingsStorage } from "#src/lib/settings.ts";

const memoryStorage = (initial: Record<string, string> = {}) => {
  const values = new Map(Object.entries(initial));

  const storage: SettingsStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };

  return { storage, values };
};

describe("settings", () => {
  it("uses the defaults when nothing is stored", () => {
    const { storage } = memoryStorage();

    expect(readSettings(storage)).toStrictEqual(defaultSettings);
  });

  it("uses the defaults without a storage at all", () => {
    expect(readSettings(null)).toStrictEqual(defaultSettings);
  });

  it("round-trips every preference", () => {
    const { storage, values } = memoryStorage();

    const settings: AppSettings = {
      autoSave: false,
      editorFontSize: 18,
      lineNumbers: true,
      previewFontSize: 21,
      readingWidth: 64,
      splitRatio: 0.4,
      syncScroll: false,
      wordWrap: false,
    };

    writeSettings(settings, storage);

    expect(values.size).toBe(Object.keys(settings).length);
    expect(readSettings(storage)).toStrictEqual(settings);
  });

  it("clamps stored numbers to the range the dialog offers", () => {
    const { storage } = memoryStorage({
      "markdownview:editor-font-size": "96",
      "markdownview:preview-width": "12",
      "markdownview:split-ratio": "0.9",
    });

    expect(readSettings(storage).editorFontSize).toBe(20);
    expect(readSettings(storage).readingWidth).toBe(56);
    expect(readSettings(storage).splitRatio).toBe(0.72);
  });

  it("falls back for values that are not a number or a boolean", () => {
    const { storage } = memoryStorage({
      "markdownview:auto-save": "yes",
      "markdownview:line-numbers": "",
      "markdownview:preview-font-size": "abc",
    });

    expect(readSettings(storage)).toStrictEqual(defaultSettings);
  });

  it("normalizes a number that slips past the dialog", () => {
    expect(
      normalizeSettings({ ...defaultSettings, editorFontSize: 48 })
        .editorFontSize
    ).toBe(20);
  });
});
