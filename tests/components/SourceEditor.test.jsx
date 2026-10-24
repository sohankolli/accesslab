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
});
