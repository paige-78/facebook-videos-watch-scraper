js/**
 * Parser utilities to extract Facebook Watch data from DOM.
 * These selectors aim at public Watch/search surfaces and may evolve with Facebook UI changes.
 */

function textOrNull(el, sel) {
  const node = el.querySelector(sel);
  return node ? (node.textContent || '').trim() : null;
}

function hrefOrNull(el, sel) {
  const node = el.querySelector(sel);
  if (!node) return null;
  const href = node.getAttribute('href') || node.getAttribute('data-hovercard') || '';
  return href ? new URL(href, 'https://www.facebook.com').toString() : null;
}

function imgSrcOrNull(el, sel) {
  const node = el.querySelector(sel);
  if (!node) return null;
  const src = node.getAttribute('src') || node.getAttribute('data-src') || '';
  return src || null;
}

/**
 * Attempt to extract number-like strings (e.g., "11K", "497K", "1.2M", "185")
 */
function guessEngagementFromText(str) {
  if (!str) return null;
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Parse search result grid/list on Watch search page.
 */
export async function parseSearchResults(page, logger) {
  // Heuristics: find video cards by role or known attributes.
  const records = await page.evaluate(() => {
    const items = [];
    // Cards can be nested; try common containers:
    const candidates = document.querySelectorAll('[role="article"], [data-pagelet^="FeedUnit_"], div[data-ad-preview]'); // broad
    const seen = new Set();

    function pushIfValid(obj) {
      const key = obj.url || obj.title || JSON.stringify(obj).slice(0, 100);
      if (!seen.has(key)) {
        items.push(obj);
        seen.add(key);
      }
    }

    // Fallback: general video anchors containing "/watch/"
    const anchors = Array.from(document.querySelectorAll('a[href*="/watch/"]'));
    anchors.forEach((a) => {
      const card = a.closest('[role="article"]') || a.closest('[data-pagelet]') || a.closest('div');
      if (!card) return;

      const url = new URL(a.getAttribute('href'), 'https://www.facebook.com').toString();
      const titleNode =
        card.querySelector('strong, h2, h3, span[dir="auto"]') || a.querySelector('strong, h2, h3, span[dir="auto"]');
      const title = titleNode ? titleNode.textContent.trim() : null;

      // Thumbnail usually via <img> near the anchor
      const thumbImg =
        card.querySelector('img[src*="scontent"], image, img') || a.querySelector('img[src*="scontent"], image, img');
      const thumbnail = thumbImg ? (thumbImg.getAttribute('src') || thumbImg.getAttribute('xlink:href')) : null;

      // Creator name: a link to a page/profile not containing /watch/
      const channelAnchor =
        card.querySelector('a[href*="facebook.com/"]:not([href*="/watch/"])') ||
        a.closest('div')?.querySelector('a[href*="facebook.com/"]:not([href*="/watch/"])');
      const channelName = channelAnchor ? (channelAnchor.textContent || '').trim() : null;
      const channelUrl = channelAnchor
        ? new URL(channelAnchor.getAttribute('href'), 'https://www.facebook.com').toString()
        : null;

      // Engagement hints
      const text = (card.textContent || '').replace(/\s+/g, ' ').trim();
      // Simple regexes to pick common patterns
      const viewsMatch = text.match(/([\d.,]+[KM]?)\s+views?/i);
      const commentsMatch = text.match(/([\d.,]+[KM]?)\s+comments?/i);
      const reactionsMatch = text.match(/([\d.,]+[KM]?)\s+(likes?|reactions?)/i);
      const dateMatch = text.match(/(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[^\d]*(\d{1,2})(?:,?\s*(\d{4}))?/i);

      const views = viewsMatch ? viewsMatch[1] : null;
      const comments = commentsMatch ? commentsMatch[1] : null;
      const reactions = reactionsMatch ? reactionsMatch[1] : null;
      const date = dateMatch ? dateMatch[0] : null;

      if (url) {
        pushIfValid({
          title,
          url,
          thumbnail,
          date,
          views: views ? views : null,
          comments: comments ? comments : null,
          reactions: reactions ? reactions : null,
          channelName,
          channelUrl
        });
      }
    });

    return items;
  });

  logger.info(`Parsed ${records.length} search records from DOM.`);
  return records;
}

/**
 * Parse a single video page.
 */
export async function parseVideoPage(page, currentUrl, logger) {
  const record = await page.evaluate((url) => {
    // Try to locate the main video container
    const root =
      document.querySelector('[role="main"]') ||
      document.querySelector('[data-pagelet^="Video"]') ||
      document.body;

    const titleNode = root.querySelector('h1, h2, h3, [data-ad-comet-preview="message"] span, span[dir="auto"]');
    const title = titleNode ? titleNode.textContent.trim() : null;

    // Creator link (page/profile)
    const channelAnchor = root.querySelector('a[href*="facebook.com/"]:not([href*="/watch/"])');
    const channelName = channelAnchor ? channelAnchor.textContent.trim() : null;
    const channelUrl = channelAnchor ? new URL(channelAnchor.getAttribute('href'), 'https://www.facebook.com').toString() : null;

    // Thumbnail may be in meta tags when video not playing
    const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || null;

    const text = (root.textContent || '').replace(/\s+/g, ' ').trim();
    const viewsMatch = text.match(/([\d.,]+[KM]?)\s+views?/i);
    const commentsMatch = text.match(/([\d.,]+[KM]?)\s+comments?/i);
    const reactionsMatch = text.match(/([\d.,]+[KM]?)\s+(likes?|reactions?)/i);
    const dateMatch = text.match(/(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[^\d]*(\d{1,2})(?:,?\s*(\d{4}))?/i);

    return {
      title,
      url,
      thumbnail: ogImage,
      date: dateMatch ? dateMatch[0] : null,
      views: viewsMatch ? viewsMatch[1] : null,
      comments: commentsMatch ? commentsMatch[1] : null,
      reactions: reactionsMatch ? reactionsMatch[1] : null,
      channelName,
      channelUrl
    };
  }, currentUrl);

  if (!record?.url) {
    logger.warn('Failed to parse a valid video record from page.');
    return null;
  }
  return record;
}