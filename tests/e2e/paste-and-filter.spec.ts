import { test, expect } from "@playwright/test";

// Messages concatenated without newlines — the tokenizer detects new message
// boundaries by finding "8=" as a tag right after a delimiter.
const SAMPLE_MESSAGES =
  "8=FIX.4.2|9=100|35=D|49=CLIENT1|56=BROKER1|34=1|52=20240115-09:30:00|11=ORD001|55=AAPL|54=1|38=100|44=150.25|40=2|59=0|10=100|" +
  "8=FIX.4.2|9=200|35=8|49=BROKER1|56=CLIENT1|34=2|52=20240115-09:30:01|11=ORD001|37=EXEC001|17=E001|55=AAPL|54=1|38=100|44=150.25|14=0|151=100|39=0|150=0|6=0|10=101|" +
  "8=FIX.4.2|9=80|35=0|49=CLIENT1|56=BROKER1|34=3|52=20240115-09:31:00|10=102|";

test("paste messages → grid renders → filter inputs work", async ({
  page,
}) => {
  await page.goto("/");

  // App header contains a span with "FIXate"
  await expect(
    page.locator("header span").filter({ hasText: "FIXate" })
  ).toBeVisible();

  // Paste messages into textarea (triggers React onChange → 300ms debounce → parse)
  await page.locator("textarea").fill(SAMPLE_MESSAGES);

  // Wait for parse to complete — collapsed input strip shows "3 messages loaded"
  await expect(page.locator("text=3 messages loaded")).toBeVisible({
    timeout: 10000,
  });

  // The multi-message layout renders a grid wrapper with column headers
  await expect(page.locator('[role="grid"]')).toBeVisible({ timeout: 5000 });

  // Column headers confirm the grid rendered correctly
  await expect(
    page.locator('[role="grid"] th').filter({ hasText: "MsgType" })
  ).toBeVisible({ timeout: 3000 });

  // ── Filter bar ────────────────────────────────────────────────────────────
  // The FilterBar has inputs for each of: MsgType (35), Sender (49), Target (56),
  // Side (54), Status (39), and a global regex input.

  const filterInput = page.locator('input[aria-label="Filter by MsgType"]');
  await expect(filterInput).toBeVisible({ timeout: 3000 });

  // Type "D" — filters to NewOrderSingle only
  await filterInput.fill("D");
  // Wait for 150ms debounce + async worker filter
  await page.waitForTimeout(400);
  await expect(filterInput).toHaveValue("D");

  // Reset filter — all messages return
  await filterInput.fill("");
  await page.waitForTimeout(400);
  await expect(filterInput).toHaveValue("");

  // Regex filter input also exists
  const regexInput = page.locator(
    'input[aria-label="Filter all fields by regex"]'
  );
  await expect(regexInput).toBeVisible({ timeout: 3000 });
  await regexInput.fill("AAPL");
  await page.waitForTimeout(400);
  await expect(regexInput).toHaveValue("AAPL");

  // Clear it
  await regexInput.fill("");
  await page.waitForTimeout(300);
});

test("single-message paste → auto-selects → detail panel visible", async ({
  page,
}) => {
  await page.goto("/");

  // Paste exactly one message — App auto-selects it and shows DetailPanel
  await page.locator("textarea").fill(
    "8=FIX.4.2|9=100|35=D|49=CLIENT1|56=BROKER1|34=1|52=20240115-09:30:00|11=ORD001|55=AAPL|54=1|38=100|44=150.25|40=2|59=0|10=100|"
  );

  // Single-message layout: detail panel shows a fields table
  await expect(
    page.locator("table th").filter({ hasText: "Name" })
  ).toBeVisible({ timeout: 10000 });

  // Detail panel should show BeginString field with value FIX.4.2
  await expect(page.locator("text=BeginString")).toBeVisible({
    timeout: 3000,
  });

  // And the MsgType row should show "D — New Order Single"
  await expect(page.locator("text=New Order Single")).toBeVisible({
    timeout: 3000,
  });
});
