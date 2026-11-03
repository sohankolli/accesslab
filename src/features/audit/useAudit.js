import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { toAuditResult } from '../../engine/runAudit';
import { runRulesSliced } from '../../engine/scheduler';
import { rulesFor } from '../../engine/rules';
import { useSettings } from '../../context/SettingsContext';
import { auditStarted, auditCompleted, auditFailed } from './auditSlice';
import { runAdded } from '../report/historySlice';

/**
 * Runs the audit of the preview's document. Starting a new audit aborts the old
 * one, so a stale result never reaches Redux or the history.
 * @param {{
 *   docRef: {current: Document|null},  the live preview document (kept out of Redux)
 *   html: string, css: string,  the code the preview is showing (debounced)
 * }} options
 * @returns {{rules: import('../../engine/types.js').Rule[], auditDocument: (doc: Document) => Promise<void>}}
 */
export function useAudit({ docRef, html, css }) {
  const dispatch = useDispatch();

  // Only the rule packs switched on in settings take part in the audit.
  const { enabledPacks } = useSettings();
  const rules = useMemo(() => rulesFor(enabledPacks), [enabledPacks]);

  const controllerRef = useRef(null);
  // The code the preview was built from. A change aborts the running audit (below),
  // so when an audit finishes this is the code it checked.
  const codeRef = useRef({ html, css });
  useEffect(() => {
    codeRef.current = { html, css };
  }, [html, css]);

  const auditDocument = useCallback(
    async (doc) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      dispatch(auditStarted());
      try {
        // Runs in ~12 ms slices, yielding to the browser in between so typing stays smooth.
        const results = await runRulesSliced(doc, rules, { signal: controller.signal });
        if (controller.signal.aborted) return; // superseded while the last rule ran
        const audit = toAuditResult(results);
        dispatch(auditCompleted(audit, codeRef.current));
        dispatch(runAdded(audit));
      } catch (err) {
        if (err?.name === 'AbortError') return; // a newer audit took over: not a failure
        // Anything else would leave the pane "checking" forever: record the failure instead.
        console.error('Audit failed', err);
        if (!controller.signal.aborted) dispatch(auditFailed(err?.message || String(err)));
      }
    },
    [dispatch, rules],
  );

  // New code is about to replace the preview's document: stop auditing the old
  // one now rather than when the new one has loaded. Also stops on unmount.
  useEffect(() => () => controllerRef.current?.abort(), [html, css]);

  // Switching a pack on or off re-audits the page already in the preview.
  useEffect(() => {
    if (docRef.current) auditDocument(docRef.current);
  }, [auditDocument, docRef]);

  return { rules, auditDocument };
}
