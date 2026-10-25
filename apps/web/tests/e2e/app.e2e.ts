import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import type {
  MarkdownDocument,
  MarkdownFolder,
  MarkdownOpenRequest,
  RecentFile,
} from "@markdownview/electron";

const visit = async (page: Page, path: string) => {
  await page.goto(path, { waitUntil: "networkidle" });
};

interface DesktopScenario {
  documents?: Record<string, MarkdownDocument>;
  folders?: MarkdownFolder[];
  openRequest?: MarkdownOpenRequest | null;
  recent?: RecentFile[];
}

/**
 * The sidebar only exists in the desktop app, whose Electron main process is
 * not part of this run. These answers stand in for the IPC bridge so the
 * desktop-only panels can be exercised in Chromium. They return plain values
 * on purpose: the renderer awaits them either way.
 */
const stubDesktopBridge = (scenario: DesktopScenario = {}) => {
  let pendingOpen = scenario.openRequest ?? null;

  Object.defineProperty(window, "desktop", {
    configurable: true,
    value: {
      versions: () => ({ chrome: "1", electron: "1", node: "1" }),
      openFile: () => null,
      takeOpenRequest: () => {
        const request = pendingOpen;

        pendingOpen = null;

        return request;
      },
      onOpenRequest: () => () => {
        // Nothing subscribes to open requests in this test.
      },
      openFolder: () => null,
      listFolders: () => scenario.folders ?? [],
      closeFolder: () => {
        // No folder is open in this test.
      },
      refreshFolder: () => {
        throw new Error("no folder is open");
      },
      readFile: (path: string) => {
        const document = scenario.documents?.[path];

        if (document === undefined) {
          throw new Error("no file is open");
        }

        return document;
      },
      revealFile: (path: string) => {
        localStorage.setItem("markdownview:test:revealed-file", path);
      },
      revealFolder: (path: string) => {
        localStorage.setItem("markdownview:test:revealed-folder", path);
      },
      resolveLink: () => null,
      saveFile: () => ({ name: "note.md", path: "note.md" }),
      saveFileAs: () => null,
      recentFiles: () => scenario.recent ?? [],
      clearRecentFiles: () => {
        // The recent list starts empty.
      },
      saveImage: () => ({ relativePath: "image.png" }),
      exportDocument: () => null,
    },
  });
};

test("opens with a sample document beside its source", async ({ page }) => {
  await visit(page, "/");

  await expect(page.locator(".cm-content")).toContainText(
    "欢迎使用 MarkdownView"
  );
  await expect(page.locator(".markdown-body h1")).toHaveText(
    "欢迎使用 MarkdownView"
  );
});

test("typing Markdown renders in the preview", async ({ page }) => {
  await visit(page, "/");

  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("# 你好");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("一段 **粗体** 文字");

  await expect(page.locator(".markdown-body h1")).toHaveText("你好");
  await expect(page.locator(".markdown-body strong")).toHaveText("粗体");
});

test("raw HTML blocks render in the preview", async ({ page }) => {
  await visit(page, "/");

  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText(
    [
      '<p align="center">',
      '  <a href="https://example.com/releases"><img src="https://example.com/badge.svg" alt="版本" width="80"/></a>',
      "</p>",
      "",
      '<p align="center"><video src="https://example.com/demo.mp4" width="360" controls></video></p>',
    ].join("\n")
  );

  const centered = page.locator('.markdown-body p[align="center"]');
  await expect(centered).toHaveCount(2);
  // Chromium reports the legacy align attribute as a -webkit-center computed
  // value, not the standard center keyword.
  await expect
    .poll(
      async () =>
        await centered.first().evaluate((el) => getComputedStyle(el).textAlign)
    )
    .toMatch(/center/u);
  await expect(centered.first().locator("a img")).toHaveCount(1);
  await expect(centered.last().locator("video")).toHaveCount(1);
  await expect(centered.last().locator("video")).toHaveAttribute("controls");
});

test("preview mode hides the source pane", async ({ page }) => {
  await visit(page, "/");

  await page.getByRole("button", { name: "预览" }).click();

  await expect(page.locator(".cm-editor")).toHaveCount(0);
  await expect(page.locator(".markdown-body h1")).toBeVisible();
});

test("a heading link scrolls to its section", async ({ page }) => {
  await visit(page, "/");

  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText(
    [
      "# 开头",
      "",
      "[跳到第二节](#第二节)",
      "",
      ...Array.from({ length: 60 }, () => "占位段落。"),
      "",
      "## 第二节",
      "",
      "目标内容。",
    ].join("\n\n")
  );

  await page.getByRole("link", { name: "跳到第二节" }).click();

  await expect(page.locator("#第二节")).toBeInViewport();
});

test("a relative file link explains it needs the desktop app", async ({
  page,
}) => {
  await visit(page, "/");

  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText("[另一个文件](note.md)");

  await page.getByRole("link", { name: "另一个文件" }).click();

  await expect(page.getByText("文件跳转需在桌面版使用。")).toBeVisible();
  await expect(page).toHaveURL(/\/$/u);
});

test("the about dialog shows the version and repository", async ({ page }) => {
  await visit(page, "/");

  await page.getByRole("button", { name: "关于 MarkdownView" }).click();

  const dialog = page.getByRole("dialog");

  await expect(dialog).toContainText(/版本\s*\d+\.\d+\.\d+/u);
  await expect(
    dialog.getByRole("link", { name: /github\.com\/Eveerme\/MarkdownView/u })
  ).toHaveAttribute("href", "https://github.com/Eveerme/MarkdownView");
});

test("the dark theme chosen in settings survives a reload", async ({
  page,
}) => {
  await visit(page, "/");

  await page.getByRole("button", { name: "设置" }).click();

  const dialog = page.getByRole("dialog");

  await dialog.getByRole("button", { name: "墨夜" }).click();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/u);

  await page.keyboard.press("Escape");
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveClass(/\bdark\b/u);
});

test("the split panes scroll together", async ({ page }) => {
  await visit(page, "/");

  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText(
    Array.from(
      { length: 120 },
      (_, index) => `## 第 ${index} 节\n\n第 ${index} 段占位文字。`
    ).join("\n\n")
  );

  const editor = page.locator(".cm-scroller");
  const preview = page.locator(".preview-scroll");

  await editor.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event("scroll"));
  });

  await expect
    .poll(async () => {
      const top = await preview.evaluate((element) => element.scrollTop);

      return top;
    })
    .toBeGreaterThan(0);

  // The pane that moved last owns the sync; wait out its echo guard first.
  await page.waitForTimeout(200);

  await preview.evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event("scroll"));
  });

  await expect
    .poll(async () => {
      const top = await editor.evaluate((element) => element.scrollTop);

      return top;
    })
    .toBeLessThan(1);
});

test("settings turn on line numbers and keep the choice", async ({ page }) => {
  await visit(page, "/");

  await expect(page.locator(".cm-lineNumbers")).toHaveCount(0);

  await page.getByRole("button", { name: "设置" }).click();

  const dialog = page.getByRole("dialog");

  await expect(dialog).toBeVisible();
  await dialog.getByRole("switch", { name: "显示行号" }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await expect(page.locator(".cm-lineNumbers")).toBeVisible();

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".cm-lineNumbers")).toBeVisible();
});

test("the width setting sizes both the editor and the preview", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1600 });
  await visit(page, "/");

  const widthOf = async (selector: string) => {
    const width = await page
      .locator(selector)
      .evaluate((element) => element.getBoundingClientRect().width);

    return width;
  };

  await page.evaluate(() => {
    localStorage.setItem("markdownview:preview-width", "56");
  });
  await page.reload({ waitUntil: "networkidle" });

  const narrowEditor = await widthOf(".cm-content");
  const narrowPreview = await widthOf(".markdown-page");

  await page.evaluate(() => {
    localStorage.setItem("markdownview:preview-width", "96");
  });
  await page.reload({ waitUntil: "networkidle" });

  expect(await widthOf(".cm-content")).toBeGreaterThan(narrowEditor + 80);
  expect(await widthOf(".markdown-page")).toBeGreaterThan(narrowPreview + 80);
});

test("a narrow window keeps every pane inside the frame", async ({ page }) => {
  await page.setViewportSize({ height: 700, width: 720 });
  await visit(page, "/");

  await page.evaluate(() => {
    localStorage.setItem("markdownview:split-ratio", "0.72");
  });
  await page.reload({ waitUntil: "networkidle" });

  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText(
    [
      "| 事实 | 来源 | 意义 |",
      "| --- | --- | --- |",
      "| 液态玻璃 Web 实现 = backdrop-filter 底 + SVG feDisplacementMap 折射 + inset 高光描边 | kube.io / LogRobot / nikdelvin 等 | 分层栈方案确定；折射仅渐进增强 |",
      "| `@supports` 降级与滚动区伪影是已知坑 | MDN / StackOverflow | 性能红线与降级策略写入 ADR-0008 |",
      "| `swagger-parser:2.1.47` 支持 3.0/3.1、自动解 $ref | Maven/官方仓库 | OpenAPI 解析零自研 |",
    ].join("\n")
  );

  const layout = await page.evaluate(() => {
    const header = document.querySelector("header");
    const root = document.querySelector("#root > div");
    const preview = document.querySelector(".preview-scroll");

    if (
      !(header instanceof HTMLElement) ||
      !(root instanceof HTMLElement) ||
      !(preview instanceof HTMLElement)
    ) {
      return null;
    }

    return {
      headerFits: header.scrollWidth <= header.clientWidth,
      previewRight: preview.getBoundingClientRect().right,
      rootScrollWidth: root.scrollWidth,
      windowWidth: window.innerWidth,
    };
  });

  expect(layout).not.toBeNull();
  expect(layout?.rootScrollWidth).toBeLessThanOrEqual(layout?.windowWidth ?? 0);
  expect(layout?.previewRight).toBeLessThanOrEqual(layout?.windowWidth ?? 0);
  expect(layout?.headerFits).toBeTruthy();
});

test("the pure white theme clears the paper tint", async ({ page }) => {
  await visit(page, "/");

  await page.getByRole("button", { name: "设置" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "纯白" }).click();

  await expect(page.locator("html")).toHaveClass(/\bwhite\b/u);

  // Paint the computed color and read the pixel, so the palette's syntax stays free.
  const background = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (context === null) {
      return "";
    }

    context.fillStyle = getComputedStyle(document.body).backgroundColor;
    context.fillRect(0, 0, 1, 1);

    const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;

    return `${red},${green},${blue}`;
  });

  expect(background).toBe("255,255,255");
});

test("clicking a preview block moves the caret to its source line", async ({
  page,
}) => {
  await visit(page, "/");

  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText(
    ["# 开头", "正文一段。", "## 目标", "目标段落。"].join("\n\n")
  );

  await page.getByRole("heading", { name: "目标", level: 2 }).click();

  await expect(page.locator("footer").first()).toContainText("5:1");
});

test("the status bar counts selected characters in both panes", async ({
  page,
}) => {
  await visit(page, "/");

  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText("Hello, 世界!");

  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+A");

  const footer = page.locator("footer").first();

  await expect(footer).toContainText("选中 10 字符");

  await expect(page.locator(".markdown-body p")).toHaveText("Hello, 世界!");
  await page.locator(".markdown-body p").selectText();
  await expect(footer).toContainText("选中 10 字符");

  await page.locator(".cm-content").click();
  await expect(footer).not.toContainText("选中");
});

test("double-clicking the divider resets the split", async ({ page }) => {
  await visit(page, "/");

  const panes = page.locator(".split-panes");

  const splitRatio = async () => {
    const value = await panes.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--split-ratio").trim()
    );

    return value;
  };

  await page.evaluate(() => {
    localStorage.setItem("markdownview:split-ratio", "0.7");
  });
  await page.reload({ waitUntil: "networkidle" });

  await expect.poll(splitRatio).toBe("70%");

  await page.getByRole("button", { name: "调整分栏宽度" }).dblclick();

  await expect.poll(splitRatio).toBe("50%");
});

test("jumping to a heading scrolls the preview, not the window", async ({
  page,
}) => {
  await visit(page, "/");

  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText(
    [
      "# 开头",
      "",
      "[跳到第二节](#第二节)",
      "",
      ...Array.from({ length: 60 }, () => "占位段落。"),
      "",
      "## 第二节",
      "",
      "目标内容。",
    ].join("\n\n")
  );

  await page.getByRole("link", { name: "跳到第二节" }).click();
  await expect(page.locator("#第二节")).toBeInViewport();

  const frame = await page.evaluate(() => ({
    headerTop: document.querySelector("header")?.getBoundingClientRect().top,
    windowScroll: document.documentElement.scrollTop,
  }));

  // Scrolling the window would hide the toolbar and leave a gap at the bottom.
  expect(frame.windowScroll).toBe(0);
  expect(frame.headerTop).toBe(0);
});

test("clicking a preview image opens it at full size", async ({ page }) => {
  await visit(page, "/");

  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText(
    '<img src="https://example.com/demo.png" alt="示例图" width="200" height="120" />'
  );

  await page.locator(".markdown-body img").click();

  const lightbox = page.getByRole("dialog");

  await expect(lightbox).toBeVisible();
  await expect(lightbox.locator("img")).toHaveAttribute(
    "src",
    "https://example.com/demo.png"
  );

  await page.keyboard.press("Escape");
  await expect(lightbox).toBeHidden();
});

test("the outline follows the section being read", async ({ page }) => {
  await page.addInitScript(stubDesktopBridge, {});
  await visit(page, "/");

  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText(
    Array.from(
      { length: 40 },
      (_, index) => `## 第 ${index} 节\n\n${"正文。".repeat(30)}`
    ).join("\n\n")
  );

  await page.getByRole("button", { name: "大纲" }).click();

  const current = page.locator('aside nav [aria-current="location"]');

  await page.locator(".preview-scroll").evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect(current).toHaveText("第 0 节");

  await page.locator(".preview-scroll").evaluate((element) => {
    const heading = element.querySelector("#第-30-节");

    if (heading instanceof HTMLElement) {
      element.scrollTop = heading.offsetTop;
    }
  });

  await expect(current).toHaveText("第 30 节");
  await expect
    .poll(
      async () =>
        await page.locator("aside nav").evaluate((element) => element.scrollTop)
    )
    .toBeGreaterThan(0);
});

test("the recent list shows the configured number of files", async ({
  page,
}) => {
  const recent = Array.from({ length: 12 }, (_, index) => ({
    directory: "C:\\notes",
    name: `note-${index}.md`,
    openedAt: index,
    path: `C:\\notes\\note-${index}.md`,
  }));

  await page.addInitScript(stubDesktopBridge, { recent });
  await page.addInitScript(() => {
    localStorage.setItem("markdownview:recent-files-limit", "5");
  });
  await visit(page, "/");

  await expect(page.locator("aside nav li")).toHaveCount(5);
});

test("a file opened from the desktop switches the sidebar to the outline", async ({
  page,
}) => {
  const path = "C:\\notes\\external.md";

  await page.addInitScript(stubDesktopBridge, {
    documents: {
      [path]: { content: "# 外部文件\n\n正文。", name: "external.md", path },
    },
    openRequest: { name: "external.md", path },
  });
  await visit(page, "/");

  await expect(page.locator(".markdown-body h1")).toHaveText("外部文件");
  await expect(
    page.locator("aside").getByRole("button", { name: "大纲" })
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("aside nav")).toContainText("外部文件");
});

test("a file opened from the recent list keeps the recent view", async ({
  page,
}) => {
  const path = "C:\\notes\\recent.md";

  await page.addInitScript(stubDesktopBridge, {
    documents: {
      [path]: { content: "# 最近文件", name: "recent.md", path },
    },
    recent: [
      {
        directory: "C:\\notes",
        name: "recent.md",
        openedAt: 1,
        path,
      },
    ],
  });
  await visit(page, "/");

  await page.getByRole("button", { name: /recent\.md/u }).click();

  await expect(page.locator(".markdown-body h1")).toHaveText("最近文件");
  await expect(
    page.locator("aside").getByRole("button", { name: "最近" })
  ).toHaveAttribute("aria-pressed", "true");
});

test("a file opened from the file tree keeps the files view", async ({
  page,
}) => {
  const root = "C:\\notes";
  const path = "C:\\notes\\tree.md";

  await page.addInitScript(stubDesktopBridge, {
    documents: {
      [path]: { content: "# 文件树", name: "tree.md", path },
    },
    folders: [
      {
        files: [{ name: "tree.md", path, relativePath: "tree.md" }],
        name: "notes",
        path: root,
        truncated: false,
      },
    ],
  });
  await visit(page, "/");

  await page.getByRole("button", { name: "tree.md" }).click();

  await expect(page.locator(".markdown-body h1")).toHaveText("文件树");
  await expect(
    page.locator("aside").getByRole("button", { name: "文件", exact: true })
  ).toHaveAttribute("aria-pressed", "true");
});

test("a recent file can be revealed in the file manager", async ({ page }) => {
  const path = "C:\\notes\\recent.md";

  await page.addInitScript(stubDesktopBridge, {
    recent: [
      {
        directory: "C:\\notes",
        name: "recent.md",
        openedAt: 1,
        path,
      },
    ],
  });
  await visit(page, "/");

  await page
    .getByRole("button", { name: /recent\.md/u })
    .click({ button: "right" });

  const item = page.getByRole("menuitem", {
    name: "打开文件所在的位置",
  });

  await expect(item).toBeVisible();
  await item.click();

  await expect
    .poll(
      async () =>
        await page.evaluate(() =>
          localStorage.getItem("markdownview:test:revealed-file")
        )
    )
    .toBe(path);
});
