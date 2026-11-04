import { acuityFor } from '../audit/acuity';

function reportData(run) {
  return {
    generatedAt: new Date().toISOString(),
    run: {
      ...(run.id != null ? { id: run.id } : {}),
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

export function reportFilename(run, extension) {
  const date = new Date(run.ranAt);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `accesslab-report-${year}-${month}-${day}-${hours}${minutes}.${extension}`;
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
  downloadFile(exportRunJSON(run), reportFilename(run, 'json'), 'application/json');
}

export function downloadRunCSV(run) {
  downloadFile(exportRunCSV(run), reportFilename(run, 'csv'), 'text/csv;charset=utf-8');
}
