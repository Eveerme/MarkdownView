import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import type {
  DownloadProgress,
  MarkdownDocument,
  MarkdownFolder,
  MarkdownOpenRequest,
  RecentFile,
  UpdateInfo,
} from "@markdownview/desktop-contract";

const visit = async (page: Page, path: string) => {
  await page.goto(path, { waitUntil: "networkidle" });
};

interface DesktopScenario {
  checkError?: string;
  checkPending?: boolean;
  documents?: Record<string, MarkdownDocument>;
  folders?: MarkdownFolder[];
  openRequest?: MarkdownOpenRequest | null;
  recent?: RecentFile[];
  update?: UpdateInfo | null;
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
      versions: () => ({ platform: "test", tauri: "2", webview: "test" }),
      openFile: () => null,
      takeOpenRequest: () => {
        const request = pendingOpen;

        pendingOpen = null;

        return request;
      },
      onOpenRequest: () => () => {
        // Nothing subscribes to open requests in this test.
      },
      onAppSave: () => () => {
        // Nothing subscribes to update saves in this test.
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
      checkUpdate: async () => {
        if (scenario.checkError !== undefined) {
          throw new Error(scenario.checkError);
        }

        if (scenario.checkPending === true) {
          const deferred = Promise.withResolvers<UpdateInfo | null>();

          const timer = setInterval(() => {
            if (
              localStorage.getItem("markdownview:test:finish-check") === "true"
            ) {
              clearInterval(timer);
              deferred.resolve(scenario.update ?? null);
            }
          }, 10);

          return await deferred.promise;
        }

        return scenario.update ?? null;
      },
      downloadUpdate: async (
        _request: UpdateInfo,
        onProgress?: (progress: DownloadProgress) => void
      ) => {
        onProgress?.({ downloaded: 512, total: 1024 });

        const deferred = Promise.withResolvers<{ path: string }>();

        const timer = setInterval(() => {
          if (
            localStorage.getItem("markdownview:test:allow-install") === "true"
          ) {
            clearInterval(timer);
            deferred.resolve({ path: "update.exe" });
          }
        }, 10);

        return await deferred.promise;
      },
      installUpdate: () => {
        localStorage.setItem("markdownview:test:installed", "true");
      },
      exportDocument: () => null,
      minimizeWindow: () => {
        // The browser preview has no native window.
      },
      toggleMaximizeWindow: () => false,
      closeWindow: () => {
        // The browser preview has no native window.
      },
      isWindowMaximized: () => false,
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

test("a single editor newline becomes a line break in the preview", async ({
  page,
}) => {
  await visit(page, "/");

  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("第一行");
  await page.keyboard.press("Enter");
  await page.keyboard.type("第二行");

  const paragraph = page.locator(".markdown-body p").first();
  await expect(paragraph).toContainText("第一行");
  await expect(paragraph).toContainText("第二行");
  expect(await paragraph.locator("br").count()).toBe(1);
});

test("the floating find and replace panel searches and replaces", async ({
  page,
}) => {
  await visit(page, "/");

  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+F");

  const panel = page.getByRole("dialog", { name: "查找与替换" });

  await expect(panel).toBeVisible();
  await expect(page.locator(".cm-search")).toHaveCount(0);

  await panel.getByRole("textbox", { name: "查找" }).fill("欢迎");
  await expect(panel).toContainText(/[1-9]\d* \/ \d+/u);

  await page.keyboard.press("Control+H");
  await expect(panel.getByRole("textbox", { name: "替换为" })).toBeVisible();

  await panel.getByRole("textbox", { name: "替换为" }).fill("你好");
  await panel.getByRole("button", { name: "全部替换" }).click();
  await expect(page.locator(".cm-content")).toContainText("你好使用");
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

test("shows download progress and installs an available update", async ({
  page,
}) => {
  await page.addInitScript(stubDesktopBridge, {
    update: {
      version: "9.9.9",
      notes: "测试更新",
      date: "2026-01-01",
      sha256: "0".repeat(64),
      size: 1024,
      url: "https://example.invalid/update.exe",
    },
  });
  await visit(page, "/");

  await page.getByRole("button", { name: "关于 MarkdownView" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("发现新版本 9.9.9");

  await dialog.getByRole("button", { name: "下载并安装" }).click();

  await expect(dialog.getByRole("progressbar")).toHaveAttribute("value", "50");
  await expect(
    dialog.getByRole("button", { name: "下载中 50%" })
  ).toBeVisible();

  await page.evaluate(() => {
    localStorage.setItem("markdownview:test:allow-install", "true");
  });

  await expect(
    page.getByText("安装程序已启动，应用即将关闭并自动重新打开")
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("markdownview:test:installed")
    )
  ).toBe("true");
});

test("checking updates reports progress and success", async ({ page }) => {
  await page.addInitScript(stubDesktopBridge, { checkPending: true });
  await visit(page, "/");

  await page.getByRole("button", { name: "关于 MarkdownView" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "检查中…" })).toBeVisible();
  await expect(page.getByText("正在检查更新…")).toBeVisible();

  await page.evaluate(() => {
    localStorage.setItem("markdownview:test:finish-check", "true");
  });

  await expect(
    page.locator("[data-sonner-toast]").getByText("已是最新版本")
  ).toBeVisible();
});

test("checking updates reports failures", async ({ page }) => {
  await page.addInitScript(stubDesktopBridge, {
    checkError: "网络不可用",
  });
  await visit(page, "/");

  await page.getByRole("button", { name: "关于 MarkdownView" }).click();

  await expect(page.getByText("检查更新失败")).toBeVisible();
  await expect(page.getByText("网络不可用")).toBeVisible();
});

test("new documents open in edit mode and keep the tab bar visible", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("markdownview:mode", "preview");
  });
  await visit(page, "/");

  await expect(page.getByRole("tablist", { name: "打开的文档" })).toBeVisible();
  await expect(page.locator(".app-titlebar")).toHaveCount(1);
  await expect(page.locator(".app-topbar")).toHaveCount(1);
  await page.getByRole("button", { name: "新建文档" }).click();

  await expect(page.locator(".cm-content")).toBeVisible();
  await expect(page.locator(".markdown-body")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "编辑", exact: true })
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(() => localStorage.getItem("markdownview:mode"))
  ).toBe("edit");
});

test("the pure white theme is the default", async ({ page }) => {
  await visit(page, "/");

  await expect(page.locator("html")).toHaveClass(/\bwhite\b/u);

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

test("switching views keeps the reading position", async ({ page }) => {
  await visit(page, "/");

  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText(
    Array.from(
      { length: 40 },
      (_, index) => `## 第 ${index} 节\n\n${"正文。".repeat(20)}`
    ).join("\n\n")
  );

  await page.getByRole("button", { name: "预览" }).click();

  await page.locator(".preview-scroll").evaluate((element) => {
    const heading = element.querySelector("#第-30-节");

    if (heading instanceof HTMLElement) {
      element.scrollTop = heading.offsetTop;
    }
  });

  await expect(page.locator("#第-30-节")).toBeInViewport();

  await page.getByRole("button", { name: "编辑" }).click();

  // The pane that replaced the preview opens at the heading the reader was at,
  // not at the top of the document.
  await expect(
    page.locator(".cm-line").filter({ hasText: "第 30 节" })
  ).toBeVisible();

  await page.getByRole("button", { name: "预览" }).click();

  await expect(page.locator("#第-30-节")).toBeInViewport();
});

test("switching tabs keeps each document's reading position", async ({
  page,
}) => {
  const first = "C:\\notes\\long-one.md";
  const second = "C:\\notes\\long-two.md";

  const sections = Array.from(
    { length: 40 },
    (_, index) => `## 第 ${index} 节\n\n${"正文。".repeat(20)}`
  ).join("\n\n");

  await page.addInitScript(stubDesktopBridge, {
    documents: {
      [first]: { content: sections, name: "long-one.md", path: first },
      [second]: { content: sections, name: "long-two.md", path: second },
    },
    folders: [
      {
        files: [
          { name: "long-one.md", path: first, relativePath: "long-one.md" },
          { name: "long-two.md", path: second, relativePath: "long-two.md" },
        ],
        name: "notes",
        path: "C:\\notes",
        truncated: false,
      },
    ],
  });
  await visit(page, "/");

  await page.getByRole("button", { name: "long-one.md" }).click();

  await page.locator(".preview-scroll").evaluate((element) => {
    const heading = element.querySelector("#第-30-节");

    if (heading instanceof HTMLElement) {
      element.scrollTop = heading.offsetTop;
    }
  });

  await expect(page.locator("#第-30-节")).toBeInViewport();

  await page.getByRole("button", { name: "long-two.md" }).click();

  const secondPane = page.locator(".preview-scroll");

  await expect
    .poll(async () => await secondPane.evaluate((element) => element.scrollTop))
    .toBeLessThan(1);

  await page.getByRole("tab", { name: /long-one\.md/u }).click();

  await expect(page.locator("#第-30-节")).toBeInViewport();
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

test("the sidebar can be resized and remembers its width", async ({ page }) => {
  await page.addInitScript(stubDesktopBridge, {});
  await visit(page, "/");

  const sidebar = page.locator("aside");
  const handle = page.getByRole("button", { name: "调整侧边栏宽度" });

  const geometry = await page.evaluate(() => {
    const sidebarElement = document.querySelector("aside");
    const contentElement = document.querySelector(".workspace-content");
    const statusElement = document.querySelector(".workspace-status");
    const editorElement = document.querySelector(".cm-content");
    const previewElement = document.querySelector(".markdown-page");

    if (
      !(sidebarElement instanceof HTMLElement) ||
      !(contentElement instanceof HTMLElement) ||
      !(statusElement instanceof HTMLElement) ||
      !(editorElement instanceof HTMLElement) ||
      !(previewElement instanceof HTMLElement)
    ) {
      return null;
    }

    return {
      contentLeft: contentElement.getBoundingClientRect().left,
      contentRight: contentElement.getBoundingClientRect().right,
      editorPaddingTop: Number(getComputedStyle(editorElement).paddingTop),
      previewPaddingTop: Number(getComputedStyle(previewElement).paddingTop),
      sidebarRight: sidebarElement.getBoundingClientRect().right,
      statusRight: statusElement.getBoundingClientRect().right,
      windowWidth: window.innerWidth,
    };
  });

  expect(geometry).not.toBeNull();
  expect(geometry?.contentLeft).toBeCloseTo(geometry?.sidebarRight ?? 0, 0);
  expect(geometry?.contentRight).toBe(geometry?.windowWidth);
  expect(geometry?.statusRight).toBe(geometry?.windowWidth);
  expect(geometry?.previewPaddingTop).toBe(geometry?.editorPaddingTop);

  const before = await sidebar.evaluate(
    (element) => element.getBoundingClientRect().width
  );

  expect(before).toBe(248);

  const bounds = await handle.boundingBox();

  if (bounds === null) {
    throw new Error("Sidebar resize handle is missing");
  }

  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(bounds.x + 64, bounds.y + bounds.height / 2);
  await page.mouse.up();

  await expect
    .poll(
      async () =>
        await sidebar.evaluate(
          (element) => element.getBoundingClientRect().width
        )
    )
    .toBeGreaterThan(before + 50);

  const stored = await page.evaluate(() =>
    Number(localStorage.getItem("markdownview:sidebar-width"))
  );

  expect(stored).toBeGreaterThan(before + 50);

  await page.reload({ waitUntil: "networkidle" });
  await expect
    .poll(
      async () =>
        await sidebar.evaluate(
          (element) => element.getBoundingClientRect().width
        )
    )
    .toBeCloseTo(stored, 0);
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
    page.locator("aside").getByRole("button", {
      name: "大纲",
    })
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
    page.locator("aside").getByRole("button", {
      name: "最近",
    })
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
    page.locator("aside").getByRole("button", {
      name: "文件",
      exact: true,
    })
  ).toHaveAttribute("aria-pressed", "true");
});

test("opened documents stay in tabs and can be switched", async ({ page }) => {
  const first = "C:\\notes\\one.md";
  const second = "C:\\notes\\two.md";

  await page.addInitScript(stubDesktopBridge, {
    documents: {
      [first]: { content: "# 第一章\n\n第一篇。", name: "one.md", path: first },
      [second]: {
        content: "# 第二章\n\n第二篇。",
        name: "two.md",
        path: second,
      },
    },
    folders: [
      {
        files: [
          { name: "one.md", path: first, relativePath: "one.md" },
          { name: "two.md", path: second, relativePath: "two.md" },
        ],
        name: "notes",
        path: "C:\\notes",
        truncated: false,
      },
    ],
  });
  await visit(page, "/");

  await page.getByRole("button", { name: "one.md" }).click();
  await expect(page.locator(".markdown-body h1")).toHaveText("第一章");

  await page.getByRole("button", { name: "two.md" }).click();
  await expect(page.locator(".markdown-body h1")).toHaveText("第二章");

  await expect(page.getByRole("tab")).toHaveCount(3);

  await page.getByRole("tab", { name: /one\.md/u }).click();
  await expect(page.locator(".markdown-body h1")).toHaveText("第一章");
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
