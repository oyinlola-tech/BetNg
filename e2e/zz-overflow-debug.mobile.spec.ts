import { APP, test } from "./support/fixtures";

test("overflow debug", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (let i = 0; i < 12; i += 1) {
    await page.goto(APP.web);
    await page.waitForTimeout(3000);
    const report = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      const over = [...document.querySelectorAll("body *")]
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.right > width + 0.5 && r.width > 0)
        .map(({ el, r }) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 120)} right=${r.right.toFixed(1)} w=${r.width.toFixed(1)}`);
      return { scroll: document.documentElement.scrollWidth - width, live: document.querySelectorAll('[data-live],[aria-label*="live" i]').length, over: over.slice(0, 12) };
    });
    console.log(JSON.stringify(report));
    if (report.scroll > 0) break;
    await page.waitForTimeout(15000);
  }
});
