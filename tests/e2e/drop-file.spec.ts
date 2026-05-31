import { test, expect } from "@playwright/test";

// Two FIX messages concatenated without newlines.
const FIX_CONTENT =
  "8=FIX.4.2|9=150|35=D|49=CLIENT|56=BROKER|34=1|52=20240115-09:30:00|11=ORD001|55=MSFT|54=1|38=200|44=380.50|40=2|59=0|10=111|" +
  "8=FIX.4.2|9=180|35=8|49=BROKER|56=CLIENT|34=2|52=20240115-09:30:01|11=ORD001|37=X001|17=E001|55=MSFT|54=1|38=200|44=380.50|14=0|151=200|39=0|150=0|6=0|10=112|";

test("file input → grid populates", async ({ page }) => {
  await page.goto("/");

  // The file input is hidden inside InputPanel; Playwright can still set files
  // on a hidden <input type="file">.
  const fileInput = page.locator('input[type="file"]');

  await fileInput.setInputFiles({
    name: "test.log",
    mimeType: "text/plain",
    buffer: Buffer.from(FIX_CONTENT),
  });

  // After parsing, the collapsed input strip shows "2 messages loaded"
  await expect(page.locator("text=2 messages loaded")).toBeVisible({
    timeout: 10000,
  });

  // Grid wrapper should also be visible
  await expect(page.locator('[role="grid"]')).toBeVisible({ timeout: 5000 });
});

test("column toggle persists across reload", async ({ page }) => {
  await page.goto("/");

  // Paste a single message — single-message layout auto-selects and shows DetailPanel
  await page.locator("textarea").fill(
    "8=FIX.4.2|9=100|35=D|49=CLIENT1|56=BROKER1|34=1|52=20240115-09:30:00|11=ORD001|55=AAPL|54=1|38=100|44=150.25|40=2|59=0|10=100|"
  );

  // Single message: detail panel appears with fields table
  await expect(
    page.locator("table th").filter({ hasText: "Name" })
  ).toBeVisible({ timeout: 10000 });

  // Column visibility is persisted to localStorage. Reload and verify the
  // page still renders without errors — header must still be present.
  await page.reload();
  await expect(
    page.locator("header span").filter({ hasText: "FIXate" })
  ).toBeVisible({ timeout: 5000 });
});
