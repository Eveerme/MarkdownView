import { describe, expect, it } from "vite-plus/test";

import {
  formatRecentTime,
  formatRecentTimestamp,
} from "#src/lib/recent-time.ts";

const now = new Date(2026, 9, 22, 14, 30, 0).getTime();

describe("recent file times", () => {
  it("describes the last hour relative to now", () => {
    expect(formatRecentTime(now - 30_000, now)).toBe("刚刚");
    expect(formatRecentTime(now - 5 * 60_000, now)).toBe("5 分钟前");
    expect(formatRecentTime(now + 60_000, now)).toBe("刚刚");
  });

  it("uses the day for older files", () => {
    expect(formatRecentTime(new Date(2026, 9, 22, 8, 5).getTime(), now)).toBe(
      "今天 08:05"
    );
    expect(formatRecentTime(new Date(2026, 9, 21, 23, 59).getTime(), now)).toBe(
      "昨天 23:59"
    );
    expect(formatRecentTime(new Date(2026, 9, 18, 12, 0).getTime(), now)).toBe(
      "10月18日"
    );
    expect(formatRecentTime(new Date(2025, 11, 31, 12, 0).getTime(), now)).toBe(
      "2025年12月31日"
    );
  });

  it("has no time for entries saved before timestamps existed", () => {
    expect(formatRecentTime(0, now)).toBeNull();
    expect(formatRecentTimestamp(0)).toBeNull();
  });

  it("shows the full local timestamp in the tooltip", () => {
    expect(
      formatRecentTimestamp(new Date(2026, 9, 22, 14, 5, 9).getTime())
    ).toBe("2026-10-22 14:05");
  });
});
