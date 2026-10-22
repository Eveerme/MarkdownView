import { describe, expect, it } from "vite-plus/test";

import {
  defaultWindowSize,
  minimumWindowSize,
  placeWindow,
} from "#src/main/window-state.ts";
import type { WindowState } from "#src/main/window-state.ts";

const display = { height: 1040, width: 1920, x: 0, y: 0 };

const saved = (state: Partial<WindowState> = {}): WindowState => ({
  height: 900,
  width: 1400,
  x: 120,
  y: 80,
  ...state,
});

describe("window placement", () => {
  it("opens at the default size without saved state", () => {
    expect(placeWindow(null, display)).toStrictEqual({
      ...defaultWindowSize,
      maximized: false,
    });
  });

  it("restores a window that is still on screen", () => {
    expect(placeWindow(saved(), display)).toStrictEqual({
      height: 900,
      maximized: false,
      width: 1400,
      x: 120,
      y: 80,
    });
  });

  it("keeps the maximized flag", () => {
    expect(
      placeWindow(saved({ maximized: true }), display).maximized
    ).toBeTruthy();
  });

  it("clamps a window larger than the display", () => {
    const placement = placeWindow(
      saved({ height: 4000, width: 5000 }),
      display
    );

    expect(placement.width).toBe(display.width);
    expect(placement.height).toBe(display.height);
  });

  it("grows a window smaller than the minimum", () => {
    const placement = placeWindow(saved({ height: 200, width: 300 }), display);

    expect(placement.width).toBe(minimumWindowSize.width);
    expect(placement.height).toBe(minimumWindowSize.height);
  });

  it("drops a position from a display that is gone", () => {
    const placement = placeWindow(saved({ x: 2600, y: 40 }), display);

    expect(placement.x).toBeUndefined();
    expect(placement.y).toBeUndefined();
  });

  it("keeps a window that is only partly off screen reachable", () => {
    const placement = placeWindow(saved({ x: 1700 }), display);

    expect(placement.x).toBe(1700);
  });

  it("drops the position when only a sliver would remain", () => {
    const placement = placeWindow(saved({ x: 1900 }), display);

    expect(placement.x).toBeUndefined();
  });
});
