import { expect, test } from "@playwright/test";
import { showHud } from "./e2eUtils";

test("倒计时文字颜色设置与显示", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("immersive-clock:has-seen-tour", "true");
  });
  await page.goto("/");

  await showHud(page);
  const tablist = page.getByRole("tablist", { name: "选择时钟模式" });
  await tablist.getByRole("tab", { name: /自习/ }).click();

  // 1. 验证默认状态下的颜色
  const carouselItem = page.locator("[class*='carouselItem']").first();
  await expect(carouselItem).toBeVisible();
  const defaultTextCol = await carouselItem.evaluate((el) => window.getComputedStyle(el).color);
  console.log("Default text color:", defaultTextCol);

  const daysSpan = carouselItem.locator("[class*='days']");
  const defaultDigitCol = await daysSpan.evaluate((el) => window.getComputedStyle(el).color);
  console.log("Default digit color (should be cyan #03dac6):", defaultDigitCol);
  expect(defaultDigitCol).toBe("rgb(3, 218, 198)");

  // 截图默认状态
  await page.screenshot({ path: "C:/Users/Changhong/.gemini/antigravity/brain/07bf8f95-b537-45c0-b2e9-e0eda9054492/countdown_default.png" });

  // 2. 打开设置修改文字颜色为自定义
  await page.getByRole("button", { name: "打开设置" }).click();

  const dialog = page.getByRole("dialog", { name: "设置" });
  await expect(dialog).toBeVisible();

  // 确保处于高考倒计时模式
  await dialog.getByRole("button", { name: "高考" }).click();

  // 选择“自定义”样式
  const styleSegment = dialog.getByLabel("样式").getByRole("button", { name: "自定义" });
  await styleSegment.click();

  // 找到文字色 input 并修改为红色 (#ff0000)
  const textColorInput = dialog.locator("div").filter({ hasText: /^文字色$/ }).locator("input[type='color']");
  await textColorInput.fill("#ff0000");

  // 点击保存
  await dialog.getByRole("button", { name: "保存" }).click();

  // 验证 localStorage 是否正确保存了默认值与所选值
  const storedItems = await page.evaluate(() => {
    const raw = localStorage.getItem("AppSettings");
    if (!raw) return null;
    try {
      return JSON.parse(raw)?.study?.countdownItems ?? null;
    } catch {
      return null;
    }
  });

  console.log("Stored items in localStorage:", JSON.stringify(storedItems));
  expect(storedItems).not.toBeNull();
  expect(storedItems[0]?.textColor).toBe("#ff0000");
  expect(storedItems[0]?.digitColor).toBe("#03DAC6"); // 自动保存了面板上的默认青色

  // 3. 验证页面上应用后的样式颜色
  await expect(carouselItem).toBeVisible();
  const customTextCol = await carouselItem.evaluate((el) => window.getComputedStyle(el).color);
  console.log("Custom text color:", customTextCol);
  expect(customTextCol).toBe("rgb(255, 0, 0)");

  const customDigitCol = await daysSpan.evaluate((el) => window.getComputedStyle(el).color);
  console.log("Custom digit color:", customDigitCol);
  expect(customDigitCol).toBe("rgb(3, 218, 198)"); // 青色

  // 截图自定义状态
  await page.screenshot({ path: "C:/Users/Changhong/.gemini/antigravity/brain/07bf8f95-b537-45c0-b2e9-e0eda9054492/countdown_screenshot.png" });
});
