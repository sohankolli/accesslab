// "Not an issue" records leave the browser only when the user exports them.
import { FEATURE_VERSION } from '../../engine/ml/manifest';

/**
 * The export file: numbers only (the element's 552 features), its selector and
 * the model's probability. No page text, so it can be shared to improve the
 * next model.
 */
export function feedbackFile(dismissed, modelVersion) {
  return JSON.stringify(
    {
      kind: 'accesslab-clickables-feedback',
      featureVersion: FEATURE_VERSION,
      modelVersion: modelVersion ?? null,
      exportedAt: new Date().toISOString(),
      label: 0,
      cases: dismissed,
    },
    null,
    1,
  );
}

/** Save the records as a .json file through the browser's download. */
export function downloadFeedback(dismissed, modelVersion) {
  const blob = new Blob([feedbackFile(dismissed, modelVersion)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'accesslab-not-an-issue.json';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
