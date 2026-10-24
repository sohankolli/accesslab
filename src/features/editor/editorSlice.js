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
  },
});

export const { htmlChanged, cssChanged } = editorSlice.actions;
export default editorSlice.reducer;
