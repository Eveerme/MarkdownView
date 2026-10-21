import type { DesktopApi } from "@markdownview/electron";

/** The desktop bridge, or null when the same app runs in a browser tab. */
export const desktop = (): DesktopApi | null =>
  typeof window === "undefined" ? null : (window.desktop ?? null);
