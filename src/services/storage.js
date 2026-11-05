import { MAX_PAGE_BYTES, pageBytes } from '../features/editor/editorSlice';

// localStorage can be full, blocked or unavailable: every access is guarded.
const KEY = 'accesslab:v1';

function read() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

function write(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

// Runs saved before pages were recorded have no page: they are kept, and the
// Report shows them as "Earlier checks". A page, when present, must be well formed.
const isPage = (page) =>
  page === undefined ||
  (Boolean(page) &&
    typeof page === 'object' &&
    typeof page.key === 'string' &&
    page.key.startsWith('page:') &&
    typeof page.name === 'string' &&
    page.name.length > 0);

const isRun = (run) =>
  Boolean(run) &&
  typeof run.id === 'string' &&
  typeof run.ranAt === 'number' &&
  typeof run.score === 'number' &&
  Boolean(run.counts) &&
  typeof run.counts === 'object' &&
  !Array.isArray(run.counts) &&
  isPage(run.page) &&
  // Older saved runs do not have issues, so keep them compatible.
  (run.issues === undefined ||
    (Array.isArray(run.issues) &&
      run.issues.every(
        (issue) =>
          issue &&
          typeof issue === 'object' &&
          typeof issue.id === 'string' &&
          typeof issue.message === 'string',
      )));

export const readPref = (key) => read().prefs?.[key];

export const writePref = (key, value) => {
  const data = read();
  return write({ ...data, prefs: { ...data.prefs, [key]: value } });
};

export const loadHistory = () => {
  const runs = read().history?.runs;
  return { runs: Array.isArray(runs) ? runs.filter(isRun) : [] };
};

export const saveHistory = ({ runs }) => write({ ...read(), history: { runs } });

const SOURCES = ['sample', 'paste', 'file', 'link'];

/**
 * The editor's code saved by saveEditor, or null when there is none or it is not
 * usable: the HTML and CSS must be strings, the source one of the known ones, and
 * the page within MAX_PAGE_BYTES (the same cap as typing). Then the sample is shown.
 * @returns {{html: string, css: string, source: string, fileName: string|null}|null}
 */
export const loadEditor = () => {
  const saved = read().editor;
  if (!saved || typeof saved !== 'object') return null;
  const { html, css, source, fileName = null } = saved;
  if (typeof html !== 'string' || typeof css !== 'string') return null;
  if (!SOURCES.includes(source)) return null;
  if (fileName !== null && typeof fileName !== 'string') return null;
  if (pageBytes(html, css) > MAX_PAGE_BYTES) return null;
  return { html, css, source, fileName: source === 'file' ? fileName : null };
};

/**
 * Save the editor's code, so a refresh shows the same page.
 * @param {{html: string, css: string, source: string, fileName: string|null}} editor
 * @returns {boolean} false when the browser refused (storage full or blocked)
 */
export const saveEditor = ({ html, css, source, fileName }) =>
  write({ ...read(), editor: { html, css, source, fileName } });
