import { test, expect } from "@playwright/test";

const SAMPLE_MESSAGES =
  "8=FIX.4.2|9=100|35=D|49=CLIENT1|56=BROKER1|34=1|52=20240115-09:30:00|11=ORD001|55=AAPL|54=1|38=100|44=150.25|40=2|59=0|10=100|\n" +
  "8=FIX.4.2|9=200|35=8|49=BROKER1|56=CLIENT1|34=2|52=20240115-09:30:01|11=ORD001|37=EXEC001|17=E001|55=AAPL|54=1|38=100|44=150.25|14=0|151=100|39=0|150=0|6=0|10=101|\n" +
  "8=FIX.4.2|9=80|35=0|49=CLIENT1|56=BROKER1|34=3|52=20240115-09:31:00|10=102|";

test("paste messages → click Parse → grid renders rows", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.locator("header span").filter({ hasText: "FIXate" })
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
