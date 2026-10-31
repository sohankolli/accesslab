// services/storage.js
// localStorage can be full, blocked or unavailable: every access is guarded, and
// writes report whether they worked so the UI can tell the user.
const KEY = 'accesslab:v1';

/** Everything saved, or {} when nothing usable is stored or storage is blocked. */
function read() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

/** @returns {boolean} false when the browser refused to store the data */
function write(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** A saved run the Report page can show: anything else is dropped on load. */
const isRun = (run) =>
  Boolean(run) &&
  typeof run.id === 'string' &&
  typeof run.ranAt === 'number' &&
  typeof run.score === 'number' &&
  Boolean(run.counts) &&
  typeof run.counts === 'object';

export const readPref = (key) => read().prefs?.[key];

/** @returns {boolean} whether the preference was saved */
export const writePref = (key, value) => {
  const data = read();
  return write({ ...data, prefs: { ...data.prefs, [key]: value } });
};

/** The saved history, checked: only well-formed runs are kept. */
export const loadHistory = () => {
  const runs = read().history?.runs;
  return { runs: Array.isArray(runs) ? runs.filter(isRun) : [] };
};

/**
 * @param {{runs: object[]}} history
 * @returns {boolean} whether the history was saved
 */
export const saveHistory = ({ runs }) => write({ ...read(), history: { runs } });
