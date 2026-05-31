import { test, expect } from '@playwright/test';

test.describe('Advanced Filter', () => {
  test('filters messages using advanced popover', async ({ page }) => {
    await page.goto('/');
    
    // Paste fixture
    const log = `8=FIX.4.2|9=50|35=D|49=SENDER|56=TARGET|34=1|55=AAPL|54=1|44=150.0|38=100|10=111|
8=FIX.4.2|9=50|35=8|49=TARGET|56=SENDER|34=2|55=AAPL|54=2|44=151.0|38=100|10=222|
8=FIX.4.2|9=50|35=D|49=SENDER|56=TARGET|34=3|55=MSFT|54=1|44=200.0|38=500|10=333|`.replace(/\|/g, '\x01');

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
});
