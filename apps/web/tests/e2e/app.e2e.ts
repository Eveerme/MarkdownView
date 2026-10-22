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
