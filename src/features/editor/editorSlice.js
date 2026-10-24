// features/editor/editorSlice.js
import { createSlice } from '@reduxjs/toolkit';
import { SAMPLE_HTML, SAMPLE_CSS } from './samplePage';

const initialState = {
  html: SAMPLE_HTML,
  css: SAMPLE_CSS,
  source: 'paste', // 'paste' | 'file' | 'github' | 'link'
  sourceUrl: null,
};

const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    htmlChanged(state, action) {
      state.html = action.payload;
    },
    cssChanged(state, action) {
      state.css = action.payload;
    },
    /** Replace the editors' contents with the built-in sample page. */
    sampleLoaded(state) {
      state.html = SAMPLE_HTML;
      state.css = SAMPLE_CSS;
      state.source = 'paste';
      state.sourceUrl = null;
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
