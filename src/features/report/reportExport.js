import { acuityFor } from '../audit/acuity';

function reportData(run) {
  return {
    generatedAt: new Date().toISOString(),
    run: {
      id: run.id,
      ranAt: run.ranAt,
      score: run.score,
      acuity: acuityFor(run.score),
      counts: run.counts,
      issues: run.issues ?? [],
    },
  };
}

export function exportRunJSON(run) {
  return JSON.stringify(reportData(run), null, 2);
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function exportRunCSV(run) {
  const rows = [
    ['Run date', new Date(run.ranAt).toISOString()],
    ['Score', run.score],
    ['Eye chart reading', acuityFor(run.score)],
    [],
    [
      'Finding ID',
      'Rule',
      'Severity',
      'Element',
      'Finding',
      'Impact',
      'Suggested fix',
      'Needs manual review',
    ],
  ];

  for (const issue of run.issues ?? []) {
    rows.push([
      issue.id,
      issue.ruleId,
      issue.severity,
      issue.selector,
      issue.message,
      issue.impact,
      issue.fix?.text,
      issue.needsReview ? 'Yes' : 'No',
    ]);
  }

  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

export function downloadRunJSON(run) {
  downloadFile(exportRunJSON(run), `accesslab-report-${run.id}.json`, 'application/json');
}

export function downloadRunCSV(run) {
  downloadFile(exportRunCSV(run), `accesslab-report-${run.id}.csv`, 'text/csv;charset=utf-8');
}
