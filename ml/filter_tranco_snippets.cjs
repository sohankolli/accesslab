const fs = require("node:fs");
const readline = require("node:readline");
const { once } = require("node:events");
const { finished } = require("node:stream/promises");

(async () => {
  const keys = new Set();
  const rows = readline.createInterface({
    input: fs.createReadStream("data/crawl-tranco-train/rows.jsonl"),
    crlfDelay: Infinity
  });

  for await (const line of rows) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    keys.add(`${r.site}|${r.page}|${r.id}`);
  }

  const input = readline.createInterface({
    input: fs.createReadStream("data/crawl-tranco/snippets.jsonl"),
    crlfDelay: Infinity
  });

  const output = fs.createWriteStream("data/crawl-tranco-train/snippets.jsonl");
  const done = finished(output);
  let total = 0, kept = 0;

  for await (const line of input) {
    if (!line.trim()) continue;
    total++;
    const r = JSON.parse(line);
    if (keys.has(`${r.site}|${r.page}|${r.id}`)) {
      if (!output.write(line + "\n")) await once(output, "drain");
      kept++;
    }
  }

  output.end();
  await done;
  console.log({ sourceSnippets: total, retainedSnippets: kept });
})().catch(e => {
  console.error(e);
  process.exit(1);
});
