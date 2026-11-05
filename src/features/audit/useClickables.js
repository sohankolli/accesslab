import { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { extractRows, ROW_DIM } from '../../engine/ml/nodeFeatures';
import { occludedRows, topCues, CUE_GROUPS } from '../../engine/ml/explain';
import {
  MANIFEST_URL,
  suggestionThreshold,
  testResult,
  validateManifest,
} from '../../engine/ml/manifest';
import { modelClient } from '../../engine/ml/client';
import { cssPath } from '../../engine/dom/cssPath';
import { writePref } from '../../services/storage';
import {
  checkCompleted,
  checkLoading,
  checkStarted,
  manifestLoaded,
  modelUnavailable,
  selectModelOn,
} from './clickablesSlice';

/** Most suggestions shown for one page, highest confidence first. */
export const MAX_FINDINGS = 30;

const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Short, stable fingerprint of an element's start, so "Not an issue" survives small edits elsewhere. */
function fingerprint(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(36);
}

/** Where the element is among elements with its tag, as rule findings record it (for "Show in code"). */
const sourceRef = (el) => ({
  tag: el.localName,
  nth: Array.prototype.indexOf.call(el.ownerDocument.getElementsByTagName(el.localName), el),
});

/**
 * Score one document with the model. Pure enough to test: pass a client.
 * @param {Document} doc
 * @param {{score: (rows: Float32Array) => Promise<{p: Float32Array, ms: number}>}} client
 * @param {number|null} threshold  from the manifest; null when none reached the target
 *   precision, so nothing is suggested
 */
export async function findClickOnly(doc, client, threshold) {
  const t0 = performance.now();
  const { candidates, rows, truncated } = extractRows(doc);
  const featuresMs = performance.now() - t0;
  const flat = new Float32Array(rows.length * ROW_DIM);
  rows.forEach((row, i) => flat.set(row, i * ROW_DIM));
  const { p, ms } = await client.score(flat);

  const flagged = [...p.keys()]
    .filter((i) => typeof threshold === 'number' && p[i] >= threshold)
    .sort((a, b) => p[b] - p[a])
    .slice(0, MAX_FINDINGS);

  let cues = [];
  if (flagged.length) {
    const occluded = new Float32Array(flagged.length * CUE_GROUPS.length * ROW_DIM);
    flagged.forEach((i, k) => occluded.set(occludedRows(rows[i]), k * CUE_GROUPS.length * ROW_DIM));
    const scored = await client.score(occluded);
    cues = flagged.map((i, k) =>
      topCues(
        candidates[i],
        p[i],
        scored.p.subarray(k * CUE_GROUPS.length, (k + 1) * CUE_GROUPS.length),
      ),
    );
  }

  const findings = flagged.map((i, k) => {
    const el = candidates[i];
    const selector = cssPath(el);
    const snippet = el.outerHTML.slice(0, 120);
    return {
      id: `ml:${selector}`,
      key: `${selector}|${fingerprint(snippet)}`,
      ruleId: 'click-only',
      severity: 'advisory',
      selector,
      snippet,
      tag: el.localName,
      p: Math.round(p[i] * 1000) / 1000,
      cues: cues[k].map(({ id, text }) => ({ id, text })),
      source: sourceRef(el),
      x: Array.from(rows[i], (v) => Math.round(v * 1e4) / 1e4),
    };
  });
  return {
    findings,
    timing: { elements: rows.length, featuresMs, modelMs: ms, truncated },
  };
}

/**
 * Model suggestions for the workbench preview. Reads the manifest once (small),
 * and starts the model worker only while suggestions are switched on.
 * @returns {(doc: Document|null) => Promise<void>} check a newly loaded preview document
 */
export function useClickables(docRef) {
  const dispatch = useDispatch();
  const store = useStore();
  const on = useSelector(selectModelOn);
  const enabled = useSelector((s) => s.clickables.enabled);
  const dismissed = useSelector((s) => s.clickables.dismissed);
  const hasModel = useSelector((s) => Boolean(s.clickables.model));
  const runRef = useRef(0);

  // Remember the switch and the "Not an issue" records in this browser.
  useEffect(() => {
    writePref('clickables', { enabled, dismissed });
  }, [enabled, dismissed]);

  // The manifest says whether the model is on by default and where its threshold is.
  useEffect(() => {
    if (hasModel || store.getState().clickables.status === 'unavailable') return undefined;
    let live = true;
    fetch(MANIFEST_URL)
      .then((res) => {
        if (!res.ok)
          throw new Error(`The model manifest could not be loaded (HTTP ${res.status}).`);
        return res.json();
      })
      .then((m) => {
        const valid = validateManifest(m);
        if (live) {
          dispatch(
            manifestLoaded({
              version: valid.version,
              threshold: suggestionThreshold(valid),
              defaultOn: valid.defaultOn === true,
              testResult: testResult(valid),
            }),
          );
        }
      })
      .catch((err) => {
        if (live) dispatch(modelUnavailable(err.message));
      });
    return () => {
      live = false;
    };
  }, [dispatch, hasModel, store]);

  const check = useCallback(
    async (doc) => {
      const state = store.getState();
      if (!doc || !selectModelOn(state)) return;
      const run = ++runRef.current;
      const client = modelClient();
      dispatch(checkLoading());
      try {
        await client.ready;
      } catch (err) {
        dispatch(modelUnavailable(err.message));
        return;
      }
      await nextTask(); // let the rule audit and the browser go first
      if (run !== runRef.current || docRef.current !== doc) return;
      dispatch(checkStarted());
      try {
        const result = await findClickOnly(doc, client, state.clickables.model.threshold);
        if (run === runRef.current && docRef.current === doc) dispatch(checkCompleted(result));
      } catch (err) {
        if (run === runRef.current) dispatch(modelUnavailable(err.message));
      }
    },
    [dispatch, docRef, store],
  );

  // Switching suggestions on (or the manifest arriving) checks the page already shown.
  useEffect(() => {
    if (on && hasModel) check(docRef.current);
  }, [on, hasModel, check, docRef]);

  return check;
}
