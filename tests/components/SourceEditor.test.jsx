import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import SourceEditor from '../../src/features/editor/SourceEditor';

afterEach(cleanup);

const setup = (props = {}) =>
  render(
    <SourceEditor
      html={'<h1>A</h1>\n<img src="x.png">\n<p>B</p>'}
      css={'p { color: red }'}
      onHtmlChange={vi.fn()}
      onCssChange={vi.fn()}
      {...props}
    />,
  );

describe('SourceEditor', () => {
  it('shows HTML and CSS as tabs, switched with the arrow keys', () => {
    setup();
    const html = screen.getByRole('tab', { name: 'HTML' });
    const css = screen.getByRole('tab', { name: 'CSS' });
    expect(html.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel', { name: 'HTML' })).toBeTruthy();
    expect(screen.getByText('3 lines')).toBeTruthy();

    fireEvent.keyDown(html, { key: 'ArrowRight' });
    expect(css.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(css);
    expect(screen.getByText('1 line')).toBeTruthy();
    expect(screen.getByLabelText('CSS source').value).toBe('p { color: red }');
  });

  it('keeps both editors labelled and mounted, so their content survives a tab switch', () => {
    setup();
    expect(screen.getByLabelText('HTML source').id).toBe('html-input');
    expect(document.getElementById('css-input')).toBeTruthy();
  });

  it('numbers the lines in the gutter', () => {
    const { container } = setup();
    expect(container.querySelector('#panel-html .code__gutter').textContent).toBe('1\n2\n3');
  });

  it('highlights the selected line with a copy of its text', () => {
    const { container } = setup({ highlight: { line: 2 } });
    const band = container.querySelector('.code__band');
    expect(band.getAttribute('aria-hidden')).toBe('true');
    expect(band.textContent).toBe('2<img src="x.png">');
  });

  it('passes edits up', () => {
    const onHtmlChange = vi.fn();
    setup({ onHtmlChange });
    fireEvent.change(screen.getByLabelText('HTML source'), { target: { value: '<p>x</p>' } });
    expect(onHtmlChange).toHaveBeenCalledWith('<p>x</p>');
  });

  // jsdom does not scroll, so scrollLeft/scrollTop are plain values on the element here.
  const fakeScroll = (ta) => {
    let left = 0;
    let top = 0;
    Object.defineProperty(ta, 'scrollLeft', {
      get: () => left,
      set: (v) => {
        left = v;
      },
    });
    Object.defineProperty(ta, 'scrollTop', {
      get: () => top,
      set: (v) => {
        top = v;
      },
    });
  };

  it('puts the scroll position and caret back after an edit is refused', async () => {
    const html = '<h1>A</h1>\n<img src="x.png">\n<p>B</p>';
    // The parent refuses the edit (as the store does over 500 KB): the value prop stays the same.
    setup({ html, onHtmlChange: vi.fn() });
    const ta = screen.getByLabelText('HTML source');
    fakeScroll(ta);
    ta.scrollTop = 24;
    ta.setSelectionRange(5, 5);

    fireEvent(ta, new InputEvent('beforeinput', { inputType: 'insertFromPaste', bubbles: true }));
    // The browser scrolls to the end of the long pasted line...
    ta.scrollLeft = 90000;
    fireEvent.change(ta, { target: { value: html + 'x'.repeat(600 * 1024) } });
    await Promise.resolve();

    // ...React puts the old text back, and the editor returns to where it was.
    expect(ta.value).toBe(html);
    expect(ta.scrollLeft).toBe(0);
    expect(ta.scrollTop).toBe(24);
    expect([ta.selectionStart, ta.selectionEnd]).toEqual([5, 5]);
  });

  it('leaves the scroll position alone when an edit is accepted', async () => {
    const onHtmlChange = vi.fn();
    const { rerender } = setup({ onHtmlChange });
    const ta = screen.getByLabelText('HTML source');
    fakeScroll(ta);
    fireEvent(ta, new InputEvent('beforeinput', { inputType: 'insertText', bubbles: true }));
    ta.scrollLeft = 300;
    fireEvent.change(ta, { target: { value: 'a much longer line of code' } });
    rerender(
      <SourceEditor
        html="a much longer line of code"
        css=""
        onHtmlChange={onHtmlChange}
        onCssChange={vi.fn()}
      />,
    );
    await Promise.resolve();
    expect(ta.scrollLeft).toBe(300);
  });
});
