import { recentFilesCapacity } from "@markdownview/desktop-contract";

export interface AppSettings {
  autoCheckUpdate: boolean;
  autoSave: boolean;
  editorFontSize: number;
  focusMode: boolean;
  lineNumbers: boolean;
  previewFontSize: number;
  readingWidth: number;
  recentFilesLimit: number;
  showFrontMatter: boolean;
  splitRatio: number;
  syncScroll: boolean;
  typewriterMode: boolean;
  wordWrap: boolean;
}

interface NumericRange {
  max: number;
  min: number;
}

export type SettingsStorage = Pick<Storage, "getItem" | "setItem">;

const prefix = "markdownview:";

const settingKeys = {
  autoCheckUpdate: `${prefix}auto-check-update`,
  autoSave: `${prefix}auto-save`,
  editorFontSize: `${prefix}editor-font-size`,
  focusMode: `${prefix}focus-mode`,
  lineNumbers: `${prefix}line-numbers`,
  previewFontSize: `${prefix}preview-font-size`,
  // The width now sizes both panes; the key keeps its 0.3.2 name so stored preferences survive.
  readingWidth: `${prefix}preview-width`,
  recentFilesLimit: `${prefix}recent-files-limit`,
  showFrontMatter: `${prefix}show-front-matter`,
  splitRatio: `${prefix}split-ratio`,
  syncScroll: `${prefix}sync-scroll`,
  typewriterMode: `${prefix}typewriter-mode`,
  wordWrap: `${prefix}word-wrap`,
} as const satisfies Record<keyof AppSettings, string>;

export const settingsRanges = {
  editorFontSize: { max: 20, min: 12 },
  previewFontSize: { max: 24, min: 14 },
  readingWidth: { max: 96, min: 56 },
  recentFilesLimit: { max: recentFilesCapacity, min: 5 },
  splitRatio: { max: 0.72, min: 0.28 },
} as const satisfies Record<string, NumericRange>;

export const defaultSettings: AppSettings = {
  autoCheckUpdate: true,
  autoSave: true,
  editorFontSize: 14,
  focusMode: false,
  lineNumbers: false,
  previewFontSize: 17,
  readingWidth: 76,
  recentFilesLimit: 10,
  showFrontMatter: true,
  splitRatio: 0.5,
  syncScroll: true,
  typewriterMode: false,
  wordWrap: true,
};

const browserStorage = (): SettingsStorage | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

const readBoolean = (
  storage: SettingsStorage,
  key: string,
  fallback: boolean
): boolean => {
  const value = storage.getItem(key);

  if (value === "true") {
    return true;
  }

  return value === "false" ? false : fallback;
};

const readNumber = (
  storage: SettingsStorage,
  key: string,
  fallback: number,
  range: NumericRange
): number => {
  const raw = storage.getItem(key);
  const value = raw === null || raw.trim() === "" ? Number.NaN : Number(raw);

  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(range.max, Math.max(range.min, value));
};

export const readSettings = (
  storage: SettingsStorage | null = browserStorage()
): AppSettings => {
  if (storage === null) {
    return defaultSettings;
  }

  try {
    return {
      autoCheckUpdate: readBoolean(
        storage,
        settingKeys.autoCheckUpdate,
        defaultSettings.autoCheckUpdate
      ),
      autoSave: readBoolean(
        storage,
        settingKeys.autoSave,
        defaultSettings.autoSave
      ),
      editorFontSize: readNumber(
        storage,
        settingKeys.editorFontSize,
        defaultSettings.editorFontSize,
        settingsRanges.editorFontSize
      ),
      focusMode: readBoolean(
        storage,
        settingKeys.focusMode,
        defaultSettings.focusMode
      ),
      lineNumbers: readBoolean(
        storage,
        settingKeys.lineNumbers,
        defaultSettings.lineNumbers
      ),
      previewFontSize: readNumber(
        storage,
        settingKeys.previewFontSize,
        defaultSettings.previewFontSize,
        settingsRanges.previewFontSize
      ),
      readingWidth: readNumber(
        storage,
        settingKeys.readingWidth,
        defaultSettings.readingWidth,
        settingsRanges.readingWidth
      ),
      recentFilesLimit: readNumber(
        storage,
        settingKeys.recentFilesLimit,
        defaultSettings.recentFilesLimit,
        settingsRanges.recentFilesLimit
      ),
      showFrontMatter: readBoolean(
        storage,
        settingKeys.showFrontMatter,
        defaultSettings.showFrontMatter
      ),
      splitRatio: readNumber(
        storage,
        settingKeys.splitRatio,
        defaultSettings.splitRatio,
        settingsRanges.splitRatio
      ),
      syncScroll: readBoolean(
        storage,
        settingKeys.syncScroll,
        defaultSettings.syncScroll
      ),
      typewriterMode: readBoolean(
        storage,
        settingKeys.typewriterMode,
        defaultSettings.typewriterMode
      ),
      wordWrap: readBoolean(
        storage,
        settingKeys.wordWrap,
        defaultSettings.wordWrap
      ),
    };
  } catch {
    return defaultSettings;
  }
};

export const writeSettings = (
  settings: AppSettings,
  storage: SettingsStorage | null = browserStorage()
): void => {
  if (storage === null) {
    return;
  }

  try {
    storage.setItem(
      settingKeys.autoCheckUpdate,
      String(settings.autoCheckUpdate)
    );
    storage.setItem(settingKeys.autoSave, String(settings.autoSave));
    storage.setItem(
      settingKeys.editorFontSize,
      String(settings.editorFontSize)
    );
    storage.setItem(settingKeys.focusMode, String(settings.focusMode));
    storage.setItem(settingKeys.lineNumbers, String(settings.lineNumbers));
    storage.setItem(
      settingKeys.previewFontSize,
      String(settings.previewFontSize)
    );
    storage.setItem(settingKeys.readingWidth, String(settings.readingWidth));
    storage.setItem(
      settingKeys.recentFilesLimit,
      String(settings.recentFilesLimit)
    );
    storage.setItem(
      settingKeys.showFrontMatter,
      String(settings.showFrontMatter)
    );
    storage.setItem(settingKeys.splitRatio, String(settings.splitRatio));
    storage.setItem(settingKeys.syncScroll, String(settings.syncScroll));
    storage.setItem(
      settingKeys.typewriterMode,
      String(settings.typewriterMode)
    );
    storage.setItem(settingKeys.wordWrap, String(settings.wordWrap));
  } catch {
    // A blocked store keeps the settings in memory for this session.
  }
};

/**
 * The settings dialog edits values the store still has to agree with: a range
 * the slider offers, or a ratio the split handle allows.
 */
export const normalizeSettings = (settings: AppSettings): AppSettings => ({
  autoCheckUpdate: settings.autoCheckUpdate,
  autoSave: settings.autoSave,
  editorFontSize: Math.min(
    settingsRanges.editorFontSize.max,
    Math.max(settingsRanges.editorFontSize.min, settings.editorFontSize)
  ),
  focusMode: settings.focusMode,
  lineNumbers: settings.lineNumbers,
  previewFontSize: Math.min(
    settingsRanges.previewFontSize.max,
    Math.max(settingsRanges.previewFontSize.min, settings.previewFontSize)
  ),
  readingWidth: Math.min(
    settingsRanges.readingWidth.max,
    Math.max(settingsRanges.readingWidth.min, settings.readingWidth)
  ),
  recentFilesLimit: Math.min(
    settingsRanges.recentFilesLimit.max,
    Math.max(settingsRanges.recentFilesLimit.min, settings.recentFilesLimit)
  ),
  showFrontMatter: settings.showFrontMatter,
  splitRatio: Math.min(
    settingsRanges.splitRatio.max,
    Math.max(settingsRanges.splitRatio.min, settings.splitRatio)
  ),
  syncScroll: settings.syncScroll,
  typewriterMode: settings.typewriterMode,
  wordWrap: settings.wordWrap,
});
