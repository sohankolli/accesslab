import { useCallback } from 'react';
import { useDispatch, useStore } from 'react-redux';
import { cssChanged, htmlChanged, oversizeFileRefused, rejectionCleared } from './editorSlice';
import { readPageFile, relativeStylesheets } from './fileImport';

const TYPES = 'AccessLab opens .html, .htm and .css files';

const list = (names) =>
  names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

/**
 * Open files picked with "Open file" or dropped on the editor. An .html or .htm
 * file replaces the HTML tab, a .css file the CSS tab, through the same actions
 * as typing. What happened is reported as one notice.
 * @param {{
 *   onNotice: (notice: import('./SourceNotice').Notice|null) => void,
 *   onShowTab: (lang: 'html'|'css') => void,
 * }} options
 * @returns {(files: FileList|File[]) => Promise<void>}
 */
export function useFileImport({ onNotice, onShowTab }) {
  const dispatch = useDispatch();
  const store = useStore();

  return useCallback(
    async (fileList) => {
      onNotice(null);
      dispatch(rejectionCleared()); // an earlier refusal is not about these files
      // HTML first, so when a page and its stylesheet arrive together the tip
      // about linked stylesheets knows the CSS came too.
      const files = [...fileList].sort(
        (a, b) => Number(/\.css$/i.test(a.name)) - Number(/\.css$/i.test(b.name)),
      );
      const opened = [];
      const problems = [];
      let linked = [];
      let cssOpened = false;
      let lastLang = null;

      for (const file of files) {
        const result = await readPageFile(file);
        if (!result.ok) {
          if (result.reason === 'too-big') {
            dispatch(oversizeFileRefused({ lang: result.lang, fileBytes: result.bytes }));
          } else if (result.reason === 'type') {
            problems.push(`${file.name} was not opened. ${TYPES}.`);
          } else if (result.reason === 'not-text') {
            problems.push(`${file.name} was not opened: it is not a UTF-8 text file. ${TYPES}.`);
          } else {
            problems.push(`${file.name} could not be read (${result.message}). Try again.`);
          }
          continue;
        }
        const origin = { source: 'file', fileName: file.name };
        const change = result.lang === 'html' ? htmlChanged : cssChanged;
        dispatch(change(result.text, origin));
        if (store.getState().editor.rejected) continue; // over the cap: the size notice says so
        opened.push(file.name);
        lastLang = result.lang;
        if (result.lang === 'css') cssOpened = true;
        else linked = relativeStylesheets(result.text);
      }

      if (lastLang) onShowTab(lastLang);
      const parts = [...problems];
      if (opened.length) parts.push(`Opened ${list(opened)}.`);
      if (linked.length && !cssOpened) {
        parts.push(
          `Tip: this page links ${list(linked)}, and linked files are not loaded. ` +
            'Open the .css file too, or paste it in the CSS tab.',
        );
      }
      if (parts.length)
        onNotice({ tone: problems.length ? 'error' : 'info', body: parts.join(' ') });
    },
    [dispatch, store, onNotice, onShowTab],
  );
}
