js/**
 * Simple incremental scroll helper for dynamic pages.
 * Scrolls the page bottom multiple times with delays.
 */
export async function scrollUntil(page, { maxScrolls = 20, waitBetweenMs = 800, logger }) {
  let lastHeight = await page.evaluate('document.body.scrollHeight');
  for (let i = 0; i < maxScrolls; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(waitBetweenMs);

    const newHeight = await page.evaluate('document.body.scrollHeight');
    if (logger) logger.debug?.(`Scroll ${i + 1}/${maxScrolls} - height=${newHeight}`);
    if (newHeight === lastHeight) {
      if (logger) logger.info?.('No more content to load; stopping scroll.');
      break;
    }
    lastHeight = newHeight;
  }
}