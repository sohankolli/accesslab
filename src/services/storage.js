
// localStorage can be full, blocked or unavailable: every access is guarded.
const KEY = 'accesslab:v1';

function read() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    return data && typeof data === 'object' && !Array.isArray(data)
      ? data
      : {};
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

const isRun = (run) =>
  Boolean(run) &&
  typeof run.id === 'string' &&
  typeof run.ranAt === 'number' &&
  typeof run.score === 'number' &&
  Boolean(run.counts) &&
  typeof run.counts === 'object' &&
  !Array.isArray(run.counts) &&
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

export const saveHistory = ({ runs }) =>
  write({ ...read(), history: { runs } });
