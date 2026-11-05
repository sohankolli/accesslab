import { createSlice } from '@reduxjs/toolkit';
import { SAMPLE_HTML, SAMPLE_CSS } from './samplePage';

/** The largest page (HTML plus CSS, in UTF-8 bytes) the workbench accepts. */
export const MAX_PAGE_BYTES = 500 * 1024;

const encoder = new TextEncoder();

/** The page's size: its HTML and CSS in UTF-8 bytes. */
export const pageBytes = (html, css) => encoder.encode(html).length + encoder.encode(css).length;

/**
 * The page's size in bytes when it is over the cap, otherwise 0. Encoding is
 * skipped when the text is clearly small enough (a UTF-16 unit is at most 3
 * UTF-8 bytes), so typing in a normal page costs nothing.
 */
function oversize(html, css) {
  if ((html.length + css.length) * 3 <= MAX_PAGE_BYTES) return 0;
  const bytes = pageBytes(html, css);
  return bytes > MAX_PAGE_BYTES ? bytes : 0;
}

export const initialState = {
  html: SAMPLE_HTML,
  css: SAMPLE_CSS,
  /** Where the code came from: 'sample' | 'paste' | 'file' | 'link'. */
  source: 'sample',
  /** The name of the file last opened, when source is 'file'; otherwise null. */
  fileName: null,
  rejected: null, // { lang: 'html'|'css', bytes } when the last edit was over the size cap
  /** True when the browser refused to save the code (storage full or blocked). */
  saveFailed: false,
};

/**
 * Record where accepted code came from. An opened file sets the source and the
 * file's name. Typing in the sample makes it the user's own code; typing in an
 * opened file or a shared page keeps its source, so the header still names
 * what was loaded.
 * @param {{source: 'file', fileName: string}} [origin]
 */
function edited(state, origin) {
  if (origin) {
    state.source = origin.source;
    state.fileName = origin.fileName;
  } else if (state.source === 'sample') {
    state.source = 'paste';
  }
}

/** prepare() for the edit actions: the text, and for a file, where it came from. */
const withOrigin = (text, origin) => (origin ? { payload: text, meta: origin } : { payload: text });

const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    /**
     * The HTML tab's new text, from typing or from an opened file. An edit that
     * would make the page bigger than MAX_PAGE_BYTES is not applied.
     * Typing: htmlChanged(text). A file: htmlChanged(text, {source: 'file', fileName}).
     */
    htmlChanged: {
      reducer(state, action) {
        const bytes = oversize(action.payload, state.css);
        if (bytes) {
          state.rejected = { lang: 'html', bytes };
          return;
        }
        state.html = action.payload;
        state.rejected = null;
        edited(state, action.meta);
      },
      prepare: withOrigin,
    },
    cssChanged: {
      reducer(state, action) {
        const bytes = oversize(state.html, action.payload);
        if (bytes) {
          state.rejected = { lang: 'css', bytes };
          return;
        }
        state.css = action.payload;
        state.rejected = null;
        edited(state, action.meta);
      },
      prepare: withOrigin,
    },
    /**
     * A file too big to read at all (over the cap on its own): refused with the
     * same message as an oversized paste, counting the other tab as well.
     */
    oversizeFileRefused(state, action) {
      const { lang, fileBytes } = action.payload;
      const other = lang === 'html' ? pageBytes('', state.css) : pageBytes(state.html, '');
      state.rejected = { lang, bytes: fileBytes + other };
    },
    /** Forget a refused edit, when a new file is opened and the old notice no longer applies. */
    rejectionCleared(state) {
      state.rejected = null;
    },
    /** editorSaveResult(saved): whether the code was saved in localStorage. */
    editorSaveResult(state, action) {
      state.saveFailed = !action.payload;
    },
    /** Replace the editors' contents with the built-in sample page. */
    sampleLoaded(state) {
      state.html = SAMPLE_HTML;
      state.css = SAMPLE_CSS;
      state.source = 'sample';
      state.fileName = null;
      state.rejected = null;
    },
    /**
     * Open a page from a share link: both tabs at once, under the same size cap
     * as typing (the link was already checked; this is the last guard).
     */
    sharedPageOpened(state, action) {
      const { html, css } = action.payload;
      const bytes = oversize(html, css);
      if (bytes) {
        state.rejected = { lang: 'html', bytes };
        return;
      }
      state.html = html;
      state.css = css;
      state.source = 'link';
      state.fileName = null;
      state.rejected = null;
    },
    /**
     * Append an issue's one-click CSS fix to the stylesheet as one commented
     * line, so undoing it is just deleting that line. Applying the same fix
     * twice changes nothing.
     */
    fixApplied(state, action) {
      const { ruleId, css } = action.payload;
      if (state.css.includes(css)) return;
      const line = `${css} /* AccessLab fix: ${ruleId} */`;
      const existing = state.css.trimEnd();
      state.css = existing ? `${existing}\n${line}\n` : `${line}\n`;
    },
  },
});

export const {
  htmlChanged,
  cssChanged,
  oversizeFileRefused,
  rejectionCleared,
  sampleLoaded,
  sharedPageOpened,
  fixApplied,
  editorSaveResult,
} = editorSlice.actions;
export default editorSlice.reducer;
