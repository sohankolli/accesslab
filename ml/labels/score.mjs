// Scores the owner's hand-check of labels (labels/review/handcheck.csv, verdict
// column filled with correct / wrong / unsure) and writes the measured label
// error rate, with a 95% Wilson interval, to reports/label-handcheck.json.
//   node labels/score.mjs
import fs from 'node:fs';

const text = fs.readFileSync('labels/review/handcheck.csv', 'utf8');
const rows = [];
let field = '';
let row = [];
let quoted = false;
for (let i = 0; i < text.length; i++) {
  const c = text[i];
  if (quoted) {
    if (c === '"' && text[i + 1] === '"') ((field += '"'), i++);
    else if (c === '"') quoted = false;
    else field += c;
  } else if (c === '"') quoted = true;
  else if (c === ',') (row.push(field), (field = ''));
  else if (c === '\n') (row.push(field), rows.push(row), (row = []), (field = ''));
  else if (c !== '\r') field += c;
}
const [header, ...data] = rows;
const col = (name) => header.indexOf(name);
const verdicts = data.map((r) => ({
  label: Number(r[col('label')]),
  verdict: r[col('verdict')].trim().toLowerCase(),
}));
const judged = verdicts.filter((v) => v.verdict === 'correct' || v.verdict === 'wrong');
if (!judged.length) {
  console.error('No verdicts yet: fill the verdict column with correct, wrong or unsure.');
  process.exit(1);
}
const wrong = judged.filter((v) => v.verdict === 'wrong').length;
const wilson = (k, n, z = 1.96) => {
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
};
const byLabel = (l) => {
  const j = judged.filter((v) => v.label === l);
  return { judged: j.length, wrong: j.filter((v) => v.verdict === 'wrong').length };
};
const summary = {
  sampled: verdicts.length,
  judged: judged.length,
  unsure: verdicts.filter((v) => v.verdict === 'unsure').length,
  wrong,
  errorRate: wrong / judged.length,
  errorRateCi95: wilson(wrong, judged.length),
  label1: byLabel(1),
  label0: byLabel(0),
};
fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync('reports/label-handcheck.json', JSON.stringify(summary, null, 1) + '\n');
console.log(summary);
