// services/storage.js
// localStorage can be full, blocked or unavailable: every access is guarded.
const KEY = 'accesslab:v1';

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {};
  } catch {
    return {};
  }
}

function write(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable: the app keeps working without persistence */
  }
}

export const readPref = (key) => read().prefs?.[key];
export const writePref = (key, value) => {
  const data = read();
  write({ ...data, prefs: { ...data.prefs, [key]: value } });
};
export const loadHistory = () => read().history ?? { runs: [] };
export const saveHistory = (history) => write({ ...read(), history });
