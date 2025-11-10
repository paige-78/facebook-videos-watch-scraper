js/**
* Lightweight fetch helper with retries and timeouts.
*/
import fetch from 'node-fetch';

export async function fetchWithRetry(url, { retries = 2, timeoutMs = 15000, headers = {} } = {}) {
let lastErr;
for (let i = 0; i <= retries; i++) {
try {
const ctrl = new AbortController();
const to = setTimeout(() => ctrl.abort(), timeoutMs);
const res = await fetch(url, { headers, signal: ctrl.signal });
clearTimeout(to);
if (!res.ok) throw new Error(`HTTP ${res.status}`);
return await res.text();
} catch (e) {
lastErr = e;
await new Promise((r) => setTimeout(r, 300 * (i + 1)));
}
}
throw lastErr;
}