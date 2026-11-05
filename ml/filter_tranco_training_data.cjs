const fs = require('node:fs');
const readline = require('node:readline');
const { once } = require('node:events');
const { finished } = require('node:stream/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

/** Keys (site|page|id) of rows whose element is a landmark, by the app's own candidate rule. */
async function landmarkKeys(snippetsPath) {
  const featuresUrl = pathToFileURL(path.join(__dirname, '../src/engine/ml/nodeFeatures.js'));
  const { isLandmarkMarkup } = await import(featuresUrl.href);
  const keys = new Set();
  const input = readline.createInterface({
    input: fs.createReadStream(snippetsPath),
    crlfDelay: Infinity,
  });
  for await (const line of input) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    if (isLandmarkMarkup(r.snippet)) keys.add(`${r.site}|${r.page}|${r.id}`);
  }
  return keys;
}

(async () => {
  const source = 'data/crawl-tranco/rows.jsonl';
  const targetDir = 'data/crawl-tranco-train';
  const target = `${targetDir}/rows.jsonl`;

  fs.mkdirSync(targetDir, { recursive: true });
  // The crawl was labelled before landmarks (<main>, <nav>, role="region"…)
  // stopped being candidates; drop them so the data matches the app.
  const landmarks = await landmarkKeys('data/crawl-tranco/snippets.jsonl');
  fs.copyFileSync('data/crawl-tranco/pages.jsonl', `${targetDir}/pages.jsonl`);
  // The training cache is rebuilt from the new rows.
  fs.rmSync(`${targetDir}/rows.npz`, { force: true });

  const input = readline.createInterface({
    input: fs.createReadStream(source),
    crlfDelay: Infinity,
  });

  const output = fs.createWriteStream(target);
  const writeFinished = finished(output);

  let total = 0,
    kept = 0,
    positive = 0,
    negative = 0,
    landmarkRows = 0,
    landmarkPositives = 0;
  const sites = new Set();

  for await (const line of input) {
    if (!line.trim()) continue;

    const row = JSON.parse(line);
    total++;

    // Drop every row from delegated pages, whatever its label. Labels on those
    // pages cannot be trusted, and dropping only their negatives would make
    // "page uses delegation" a stand-in for the label.
    if (!row.delegated && landmarks.has(`${row.site}|${row.page}|${row.id}`)) {
      landmarkRows++;
      if (Number(row.label) === 1) landmarkPositives++;
      continue;
    }
    if (!row.delegated) {
      if (!output.write(line + '\n')) await once(output, 'drain');

      kept++;
      if (Number(row.label) === 1) positive++;
      else negative++;

      sites.add(row.site);
    }
  }

  output.end();
  await writeFinished;

  console.log({
    totalRows: total,
    keptRows: kept,
    positiveRows: positive,
    landmarkRowsDropped: landmarkRows,
    landmarkPositivesDropped: landmarkPositives,
    negativeRows: negative,
    uniqueSites: sites.size,
  });
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
