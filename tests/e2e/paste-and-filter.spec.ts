import { test, expect } from "@playwright/test";

const SAMPLE_MESSAGES =
  "8=FIX.4.2|9=100|35=D|49=CLIENT1|56=BROKER1|34=1|52=20240115-09:30:00|11=ORD001|55=AAPL|54=1|38=100|44=150.25|40=2|59=0|10=100|\n" +
  "8=FIX.4.2|9=200|35=8|49=BROKER1|56=CLIENT1|34=2|52=20240115-09:30:01|11=ORD001|37=EXEC001|17=E001|55=AAPL|54=1|38=100|44=150.25|14=0|151=100|39=0|150=0|6=0|10=101|\n" +
  "8=FIX.4.2|9=80|35=0|49=CLIENT1|56=BROKER1|34=3|52=20240115-09:31:00|10=102|";

test("paste messages → click Parse → grid renders rows", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.locator("header span").filter({ hasText: "35equals" })
  ).toBeVisible();

  await page.locator("textarea").fill(SAMPLE_MESSAGES);
  await page.locator('button[aria-label="Parse FIX messages"]').click();

  await expect(page.locator("text=3 messages loaded")).toBeVisible({
    timeout: 10000,
  });

  await expect(page.locator('[role="grid"]')).toBeVisible({ timeout: 5000 });

  await expect(
    page.locator('[role="grid"] th').filter({ hasText: "MsgType" })
  ).toBeVisible({ timeout: 3000 });
});

test("line-number column shows source line after filtering, not filtered-view position", async ({
  page,
}) => {
  // Three messages on lines 1-3. Filter to keep only lines 2 and 3.
  // The index column must show "2" and "3", not "1" and "2".
  await page.goto("/");

  await page.locator("textarea").fill(SAMPLE_MESSAGES);
  await page.locator('button[aria-label="Parse FIX messages"]').click();
  await expect(page.locator("text=3 messages loaded")).toBeVisible({ timeout: 10000 });
  await expect(page.locator('[role="grid"]')).toBeVisible({ timeout: 5000 });

  // Regex "34=2|34=3" matches messages on lines 2 and 3 only.
  const searchInput = page.locator('input[placeholder*="Search raw FIX"]');
  await searchInput.fill("34=2|34=3");

  // Wait for filter to settle.
  await expect(page.locator("text=2 / 3 matches")).toBeVisible({ timeout: 3000 });

  // Collect text of the first td (index column) in each data row.
  const lineNumbers = await page
    .locator('[role="grid"] tbody tr td:first-child')
    .allInnerTexts();

  const trimmed = lineNumbers.map((t) => t.trim()).filter((t) => t !== '');
  expect(trimmed).toEqual(["2", "3"]);
});

test("single-message paste → click Parse → detail panel visible", async ({
  page,
}) => {
  await page.goto("/");

  await page.locator("textarea").fill(
    "8=FIX.4.2|9=100|35=D|49=CLIENT1|56=BROKER1|34=1|52=20240115-09:30:00|11=ORD001|55=AAPL|54=1|38=100|44=150.25|40=2|59=0|10=100|"
  );
  await page.locator('button[aria-label="Parse FIX messages"]').click();

  await expect(
    page.locator("table th").filter({ hasText: "Name" })
  ).toBeVisible({ timeout: 10000 });

  await expect(page.locator("text=BeginString")).toBeVisible({
    timeout: 3000,
  });

  await expect(page.locator("text=New Order Single")).toBeVisible({
    timeout: 3000,
  });
});
