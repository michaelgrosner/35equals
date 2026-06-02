import { test, expect } from '@playwright/test';

// Lines 1 and 3 are 35=D (NewOrderSingle), line 2 is 35=8 (ExecutionReport).
const LOG = `8=FIX.4.2|9=50|35=D|49=SENDER|56=TARGET|34=1|55=AAPL|54=1|44=150.0|38=100|10=111|
8=FIX.4.2|9=50|35=8|49=TARGET|56=SENDER|34=2|55=AAPL|54=2|44=151.0|38=100|10=222|
8=FIX.4.2|9=50|35=D|49=SENDER|56=TARGET|34=3|55=MSFT|54=1|44=200.0|38=500|10=333|`.replace(/\|/g, '\x01');

test.describe('Advanced Filter', () => {
  test('filters messages using advanced popover', async ({ page }) => {
    await page.goto('/');

    // Paste fixture
    const log = LOG;

    await page.fill('textarea', log);
    await page.click('button:has-text("Parse")');

    // Wait for grid to render
    await expect(page.getByRole('row')).toHaveCount(4); // 3 rows + 1 header

    // Open advanced filter panel
    await page.click('button:has-text("Advanced")');
    
    // Add rule
    await page.click('button:has-text("Add rule")');
    
    // Set tag to 55 (Symbol)
    await page.fill('input[placeholder="Tag / Name"]', '55');
    
    // Set value to AAPL
    await page.fill('input[placeholder="Value"]', 'AAPL');
    
    // Verify grid has 2 rows + 1 header (filtered to AAPL)
    await expect(page.getByRole('row')).toHaveCount(3);
  });

  test('tree filter still applies when "Combine with search" is unchecked', async ({ page }) => {
    await page.goto('/');
    await page.fill('textarea', LOG);
    await page.click('button:has-text("Parse")');
    await expect(page.getByRole('row')).toHaveCount(4); // 3 data + 1 header

    // Open advanced panel and add rule: tag 35 equals D.
    await page.click('button:has-text("Advanced")');
    await page.click('button:has-text("Add rule")');
    // Default rule is tag=35, op=equals. Just fill the value.
    await page.fill('input[placeholder="Value"]', 'D');
    // Tree alone: lines 1 and 3 (35=D) → 2 data rows + 1 header.
    await expect(page.getByRole('row')).toHaveCount(3);

    // Put a search-box term that matches only line 2 (35=8).
    // With combine=true (default), tree AND regex → 0 matches.
    await page.fill('input[placeholder*="Search raw FIX"]', '35=8');
    await expect(page.getByRole('row')).toHaveCount(1); // header only

    // Uncheck "Combine with search box" — tree must still apply, regex ignored.
    await page.click('label[for="combine"]');
    // Only tree (35=D) should run → lines 1 and 3 → 2 data rows + 1 header.
    await expect(page.getByRole('row')).toHaveCount(3);
  });
});
