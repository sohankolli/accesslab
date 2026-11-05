import { describe, it, expect } from 'vitest';
import editorReducer, {
  learnExampleOpened,
  htmlChanged,
  MAX_PAGE_BYTES,
} from '../../src/features/editor/editorSlice';

describe('learnExampleOpened', () => {
  it('loads the Learn example HTML and CSS', () => {
    const initialState = editorReducer(undefined, { type: 'init' });

    const nextState = editorReducer(
      initialState,
      learnExampleOpened({
        html: '<h1>Example</h1>',
        css: 'h1 { color: red; }',
      }),
    );

    expect(nextState.html).toBe('<h1>Example</h1>');
    expect(nextState.css).toBe('h1 { color: red; }');
    expect(nextState.source).toBe('learn');
    expect(nextState.fileName).toBeNull();
    expect(nextState.rejected).toBeNull();
  });

  it('uses an empty stylesheet when CSS is omitted', () => {
    const nextState = editorReducer(undefined, learnExampleOpened({ html: '<h1>Example</h1>' }));

    expect(nextState.html).toBe('<h1>Example</h1>');
    expect(nextState.css).toBe('');
    expect(nextState.source).toBe('learn');
  });

  it('clears previous file metadata when loading a Learn example', () => {
    const fileState = editorReducer(
      undefined,
      htmlChanged('<h1>Uploaded file</h1>', {
        source: 'file',
        fileName: 'example.html',
      }),
    );

    const nextState = editorReducer(
      fileState,
      learnExampleOpened({ html: '<h1>Learn example</h1>' }),
    );

    expect(nextState.source).toBe('learn');
    expect(nextState.fileName).toBeNull();
  });

  it('rejects oversized examples without replacing existing content', () => {
    const initialState = editorReducer(
      undefined,
      learnExampleOpened({
        html: '<h1>Existing content</h1>',
        css: 'h1 { color: blue; }',
      }),
    );

    const oversizedHtml = 'x'.repeat(MAX_PAGE_BYTES + 1);

    const nextState = editorReducer(initialState, learnExampleOpened({ html: oversizedHtml }));

    expect(nextState.html).toBe(initialState.html);
    expect(nextState.css).toBe(initialState.css);
    expect(nextState.source).toBe('learn');
    expect(nextState.rejected).not.toBeNull();
    expect(nextState.rejected.lang).toBe('html');
  });
});
