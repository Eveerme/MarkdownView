import { readFileSync, writeFileSync } from "node:fs";

import { z } from "zod";

const stateSchema = z.object({
  height: z.number().int().positive(),
  maximized: z.boolean().optional(),
  width: z.number().int().positive(),
  x: z.number().int().optional(),
  y: z.number().int().optional(),
});

export type WindowState = z.infer<typeof stateSchema>;

export interface WorkArea {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface WindowPlacement {
  height: number;
  maximized: boolean;
  width: number;
  x?: number;
  y?: number;
}

export const defaultWindowSize = { height: 800, width: 1280 };

export const minimumWindowSize = { height: 520, width: 720 };

// A window restored onto a display that no longer exists must still leave this
// much of itself (and its title bar) reachable.
const reachableWidth = 160;
const reachableHeight = 80;

export const readWindowState = (file: string): WindowState | null => {
  try {
    const value: unknown = JSON.parse(readFileSync(file, "utf-8"));
    const parsed = stateSchema.safeParse(value);

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

export const writeWindowState = (file: string, state: WindowState): void => {
  try {
    writeFileSync(file, JSON.stringify(state));
  } catch {
    // Reopening at the default size is a smaller loss than failing to close.
  }
};

/**
 * The bounds a new window opens with: the saved size clamped to the display it
 * will appear on, and the saved position only when enough of it is still
 * visible there.
 */
export const placeWindow = (
  state: WindowState | null,
  workArea: WorkArea
): WindowPlacement => {
  if (state === null) {
    return { ...defaultWindowSize, maximized: false };
  }

  const width = Math.min(
    Math.max(state.width, minimumWindowSize.width),
    workArea.width
  );

  const height = Math.min(
    Math.max(state.height, minimumWindowSize.height),
    workArea.height
  );

  const maximized = state.maximized ?? false;

  if (state.x === undefined || state.y === undefined) {
    return { height, maximized, width };
  }

  const reachable =
    state.x + width > workArea.x + reachableWidth &&
    state.x < workArea.x + workArea.width - reachableWidth &&
    state.y + height > workArea.y + reachableHeight &&
    state.y < workArea.y + workArea.height - reachableHeight;

  return reachable
    ? { height, maximized, width, x: state.x, y: state.y }
    : { height, maximized, width };
};
