const fs = require('node:fs');
const readline = require('node:readline');
const { once } = require('node:events');
const { finished } = require('node:stream/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

/**
 * Frameworks that bind click handlers on each element, where the labeller sees
 * them, even when the page also has document-level (delegated) listeners.
 */
const PER_ELEMENT_FRAMEWORKS = new Set(['react', 'vue', 'angular']);

/**
 * Whether rows from this page can be used for training. It looks only at facts
 * about the page (delegated listeners, framework), never at a row's label, so
 * the page type cannot become a stand-in for the label.
 */
function keepPage({ delegated, framework }) {
  return !delegated || PER_ELEMENT_FRAMEWORKS.has(framework);
}

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

async function main({
  sourceDir = 'data/crawl-tranco',
  targetDir = 'data/crawl-tranco-train',
} = {}) {
  const target = `${targetDir}/rows.jsonl`;

  fs.mkdirSync(targetDir, { recursive: true });
  // The crawl was labelled before landmarks (<main>, <nav>, role="region"…)
  // stopped being candidates; drop them so the data matches the app.
  const landmarks = await landmarkKeys(`${sourceDir}/snippets.jsonl`);
  fs.copyFileSync(`${sourceDir}/pages.jsonl`, `${targetDir}/pages.jsonl`);
  // The training cache is rebuilt from the new rows.
  fs.rmSync(`${targetDir}/rows.npz`, { force: true });

  const input = readline.createInterface({
    input: fs.createReadStream(`${sourceDir}/rows.jsonl`),
    crlfDelay: Infinity,
  });
  const output = fs.createWriteStream(target);
  const writeFinished = finished(output);

  let total = 0,
    droppedPageRows = 0,
    landmarkRows = 0,
    landmarkPositives = 0;
  // Kept sites, positives and negatives per page kind ("delegated react", "not delegated"…).
  const byKind = {};

  for await (const line of input) {
    if (!line.trim()) continue;
    const row = JSON.parse(line);
    total++;

    // Delegated pages built with other code are dropped whole, whatever their
    // labels: a handler on the document makes their 0 labels untrustworthy.
    if (!keepPage(row)) {
      droppedPageRows++;
      continue;
    }
    if (landmarks.has(`${row.site}|${row.page}|${row.id}`)) {
      landmarkRows++;
      if (Number(row.label) === 1) landmarkPositives++;
      continue;
    }
    if (!output.write(line + '\n')) await once(output, 'drain');

    const kind = row.delegated ? `delegated ${row.framework}` : 'not delegated';
    const k = (byKind[kind] ??= { sites: new Set(), positives: 0, negatives: 0 });
    k.sites.add(row.site);
    if (Number(row.label) === 1) k.positives++;
    else k.negatives++;
  }

  output.end();
  await writeFinished;

  const kinds = Object.fromEntries(
    Object.entries(byKind).map(([kind, k]) => [
      kind,
      { sites: k.sites.size, positives: k.positives, negatives: k.negatives },
    ]),
  );
  const summary = {
    totalRows: total,
    rowsDroppedDelegatedOtherCode: droppedPageRows,
    landmarkRowsDropped: landmarkRows,
    landmarkPositivesDropped: landmarkPositives,
    kept: kinds,
  };
  return summary;
}

module.exports = { keepPage, PER_ELEMENT_FRAMEWORKS, main };

if (require.main === module) {
  main()
    .then((summary) => console.log(JSON.stringify(summary, null, 2)))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
