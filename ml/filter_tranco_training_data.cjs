const fs = require('node:fs');
const readline = require('node:readline');
const { once } = require('node:events');
const { finished } = require('node:stream/promises');

(async () => {
  const source = 'data/crawl-tranco/rows.jsonl';
  const targetDir = 'data/crawl-tranco-train';
  const target = `${targetDir}/rows.jsonl`;

  fs.mkdirSync(targetDir, { recursive: true });
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
    negative = 0;
  const sites = new Set();

  for await (const line of input) {
    if (!line.trim()) continue;

    const row = JSON.parse(line);
    total++;

    // Drop every row from delegated pages, whatever its label. Labels on those
    // pages cannot be trusted, and dropping only their negatives would make
    // "page uses delegation" a stand-in for the label.
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
    negativeRows: negative,
    uniqueSites: sites.size,
  });
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
