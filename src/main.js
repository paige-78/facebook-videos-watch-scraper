import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import puppeteer from 'puppeteer';
import { createLogger } from './utils/logger.js';
import { scrollUntil } from './modules/scroll_handler.js';
import { parseSearchResults, parseVideoPage } from './modules/video_parser.js';
import { normalizeVideoRecords } from './modules/data_cleaner.js';
import { exportResults } from './outputs/exporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = createLogger('main');

function loadSettings() {
const cfgDir = path.join(__dirname, 'config');
const explicit = path.join(cfgDir, 'settings.json');
const sample = path.join(cfgDir, 'settings.example.json');
let cfgPath = explicit;
if (!fs.existsSync(explicit)) {
cfgPath = sample;
}
const raw = fs.readFileSync(cfgPath, 'utf-8');
const cfg = JSON.parse(raw);
return cfg;
}

function resolveOutputDir() {
const outDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
return outDir;
}

async function buildBrowser(launchOptions) {
const browser = await puppeteer.launch({
headless: 'new',
args: [
'--no-sandbox',
'--disable-setuid-sandbox',
'--disable-dev-shm-usage',
'--disable-gpu',
'--window-size=1366,768',
'--lang=en-US,en'
],
defaultViewport: { width: 1366, height: 768 },
...launchOptions
});
return browser;
}

async function withPage(browser, fn) {
const page = await browser.newPage();
// Set a realistic UA and accept-language to get public pages
await page.setUserAgent(
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
);
await page.setExtraHTTPHeaders({
'Accept-Language': 'en-US,en;q=0.9'
});
// Reduce detection surface
await page.evaluateOnNewDocument(() => {
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
});
try {
return await fn(page);
} finally {
await page.close().catch(() => {});
}
}

async function scrapeByQuery(browser, query, cfg) {
const searchUrl = `https://www.facebook.com/watch/search/?q=${encodeURIComponent(query)}`;
logger.info(`Navigating to search: ${searchUrl}`);
return await withPage(browser, async (page) => {
await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: cfg.timeouts.navigationMs });
await scrollUntil(page, {
maxScrolls: cfg.scrollsAmount,
waitBetweenMs: cfg.timeouts.scrollWaitMs,
logger
});
const records = await parseSearchResults(page, logger);
return records;
});
}

async function scrapeByUrl(browser, url, cfg) {
logger.info(`Navigating to video: ${url}`);
return await withPage(browser, async (page) => {
await page.goto(url, { waitUntil: 'networkidle2', timeout: cfg.timeouts.navigationMs });
await scrollUntil(page, {
maxScrolls: 2,
waitBetweenMs: cfg.timeouts.scrollWaitMs,
logger
});
const record = await parseVideoPage(page, url, logger);
return record ? [record] : [];
});
}

async function run() {
const cfg = loadSettings();

const argv = yargs(hideBin(process.argv))
.option('query', { type: 'string', describe: 'Facebook Watch search query' })
.option('url', { type: 'string', describe: 'Direct Facebook video URL' })
.option('format', { type: 'string', choices: ['json', 'csv', 'both'], default: 'json' })
.option('out', { type: 'string', describe: 'Output filename without extension' })
.demandOption(['query'], 'Provide --query or --url')
.conflicts('query', 'url')
.help()
.parse();

const browser = await buildBrowser(cfg.launchOptions);
let rawRecords = [];
try {
if (argv.query) {
rawRecords = await scrapeByQuery(browser, argv.query, cfg);
} else if (argv.url) {
rawRecords = await scrapeByUrl(browser, argv.url, cfg);
}

const cleaned = normalizeVideoRecords(rawRecords, logger);

if (!cleaned.length) {
logger.warn('No results extracted.');
}

const outDir = resolveOutputDir();
const base = argv.out || `facebook_watch_${Date.now()}`;
const outputs = await exportResults(cleaned, outDir, argv.format);
logger.info(`Exported ${cleaned.length} records: ${outputs.join(', ')}`);
} catch (err) {
logger.error(`Fatal error: ${err.stack || err.message}`);
process.exitCode = 1;
} finally {
await browser.close().catch(() => {});
}
}

if (import.meta.url === `file://${process.argv[1]}`) {
run();
}