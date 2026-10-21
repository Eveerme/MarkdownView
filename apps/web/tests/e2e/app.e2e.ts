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

test("the dark theme survives a reload", async ({ page }) => {
  await visit(page, "/");

  await page.getByRole("button", { name: "Toggle theme" }).click();
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/u);

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveClass(/\bdark\b/u);
});
