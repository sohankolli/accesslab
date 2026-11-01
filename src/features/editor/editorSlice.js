import { createSlice } from '@reduxjs/toolkit';
import { SAMPLE_HTML, SAMPLE_CSS } from './samplePage';

/** The largest page (HTML plus CSS, in UTF-8 bytes) the workbench accepts. */
export const MAX_PAGE_BYTES = 500 * 1024;

const encoder = new TextEncoder();

/**
 * The page's size in bytes when it is over the cap, otherwise 0. Encoding is
 * skipped when the text is clearly small enough (a UTF-16 unit is at most 3
 * UTF-8 bytes), so typing in a normal page costs nothing.
 */
function oversize(html, css) {
  if ((html.length + css.length) * 3 <= MAX_PAGE_BYTES) return 0;
  const bytes = encoder.encode(html).length + encoder.encode(css).length;
  return bytes > MAX_PAGE_BYTES ? bytes : 0;
}

const initialState = {
  html: SAMPLE_HTML,
  css: SAMPLE_CSS,
  source: 'paste', // 'paste' | 'file' | 'github' | 'link'
  sourceUrl: null,
  rejected: null, // { lang: 'html'|'css', bytes } when the last edit was over the size cap
};

const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    /** An edit that would make the page bigger than MAX_PAGE_BYTES is not applied. */
    htmlChanged(state, action) {
      const bytes = oversize(action.payload, state.css);
      if (bytes) {
        state.rejected = { lang: 'html', bytes };
        return;
      }
      state.html = action.payload;
      state.rejected = null;
    },
    cssChanged(state, action) {
      const bytes = oversize(state.html, action.payload);
      if (bytes) {
        state.rejected = { lang: 'css', bytes };
        return;
      }
      state.css = action.payload;
      state.rejected = null;
    },
    /** Replace the editors' contents with the built-in sample page. */
    sampleLoaded(state) {
      state.html = SAMPLE_HTML;
      state.css = SAMPLE_CSS;
      state.source = 'paste';
      state.sourceUrl = null;
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

export const { htmlChanged, cssChanged, sampleLoaded, fixApplied } = editorSlice.actions;
export default editorSlice.reducer;
