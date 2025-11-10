import fs from 'node:fs';
import path from 'node:path';
import { createObjectCsvWriter as createCsvWriter } from 'csv-writer';

function ts() {
return new Date().toISOString().replace(/[:.]/g, '-');
}

export async function exportResults(records, outDir, format = 'json') {
const outputs = [];
const baseName = `results_${ts()}`;

if (format === 'json' || format === 'both') {
const jsonPath = path.join(outDir, `${baseName}.json`);
fs.writeFileSync(jsonPath, JSON.stringify(records, null, 2), 'utf-8');
outputs.push(jsonPath);
}

if (format === 'csv' || format === 'both') {
const csvPath = path.join(outDir, `${baseName}.csv`);
const csvWriter = createCsvWriter({
path: csvPath,
header: [
{ id: 'title', title: 'title' },
{ id: 'url', title: 'url' },
{ id: 'thumbnail', title: 'thumbnail' },
{ id: 'date', title: 'date' },
{ id: 'views', title: 'views' },
{ id: 'comments', title: 'comments' },
{ id: 'reactions', title: 'reactions' },
{ id: 'channelName', title: 'channelName' },
{ id: 'channelUrl', title: 'channelUrl' }
]
});
await csvWriter.writeRecords(records);
outputs.push(csvPath);
}

return outputs;
}