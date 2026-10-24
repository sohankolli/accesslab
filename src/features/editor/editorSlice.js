// features/editor/editorSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  html: '',
  css: '',
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
