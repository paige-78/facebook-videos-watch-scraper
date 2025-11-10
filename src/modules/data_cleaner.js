js/**
 * Utilities to normalize fields for consistent exports.
 */

function parseCount(token) {
  if (token == null) return null;
  const t = String(token).trim().replace(/,/g, '').toUpperCase();
  const m = t.match(/^([\d.]+)\s*([KM])?$/);
  if (!m) {
    const num = Number(t);
    return Number.isFinite(num) ? num : t; // return raw when not numeric
  }
  const value = parseFloat(m[1]);
  const unit = m[2] || '';
  if (unit === 'K') return Math.round(value * 1_000);
  if (unit === 'M') return Math.round(value * 1_000_000);
  return Math.round(value);
}

function normalizeDate(str) {
  if (!str) return null;
  // Let Date parse common English formats (e.g., "June 16, 2023")
  const d = new Date(str);
  if (isNaN(d.getTime())) return str; // keep raw if unknown
  return d.toISOString();
}

export function normalizeVideoRecords(records, logger) {
  const cleaned = records
    .map((r) => {
      if (!r) return null;
      const title = r.title?.trim() || null;
      const url = r.url?.split('?')[0]; // strip tracking params
      const thumbnail = r.thumbnail || null;
      const views = parseCount(r.views);
      const comments = parseCount(r.comments);
      const reactions = parseCount(r.reactions);
      const date = normalizeDate(r.date);
      const channelName = r.channelName?.trim() || null;
      const channelUrl = r.channelUrl || null;

      return { title, url, thumbnail, date, views, comments, reactions, channelName, channelUrl };
    })
    .filter(Boolean);

  // Deduplicate by URL
  const seen = new Set();
  const unique = [];
  for (const rec of cleaned) {
    const key = rec.url || rec.title;
    if (key && !seen.has(key)) {
      unique.push(rec);
      seen.add(key);
    }
  }

  if (logger) logger.info?.(`Cleaned ${unique.length} unique records (from ${records.length}).`);
  return unique;
}