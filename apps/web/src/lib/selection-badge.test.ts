import { describe, expect, it } from "vite-plus/test";

import { placeSelectionBadge } from "#src/lib/selection-badge.ts";

const viewport = { height: 800, width: 1200 };

describe("selection count placement", () => {
  it("sits below the end of the selection", () => {
    expect(
      placeSelectionBadge({ bottom: 300, right: 400, top: 280 }, viewport)
    ).toStrictEqual({ left: 406, top: 306 });
  });

  it("flips above the selection near the bottom edge", () => {
    expect(
      placeSelectionBadge({ bottom: 790, right: 400, top: 770 }, viewport)
    ).toStrictEqual({ left: 406, top: 740 });
  });

  it("pulls the badge inside the right edge", () => {
    expect(
      placeSelectionBadge({ bottom: 300, right: 1195, top: 280 }, viewport)
    ).toStrictEqual({ left: 1116, top: 306 });
  });

  it("keeps the badge inside a viewport narrower than the reserve", () => {
    expect(
      placeSelectionBadge(
        { bottom: 300, right: 10, top: 280 },
        {
          height: 800,
          width: 60,
        }
      )
    ).toStrictEqual({ left: 8, top: 306 });
  });
});
