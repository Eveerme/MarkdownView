import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const visit = async (page: Page, path: string) => {
  await page.goto(path, { waitUntil: "networkidle" });
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

test("the dark theme survives a reload", async ({ page }) => {
  await visit(page, "/");

  await page.getByRole("button", { name: "Toggle theme" }).click();
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/u);

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

  await page.getByRole("button", { name: "Toggle theme" }).click();
  await page.getByRole("menuitemradio", { name: "Pure white" }).click();

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

test("the status bar counts the selected words", async ({ page }) => {
  await visit(page, "/");

  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+A");

  await expect(page.locator("footer").first()).toContainText(/选中 \d+ 字/u);
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
