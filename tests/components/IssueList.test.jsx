import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import IssueList from '../../src/features/audit/IssueList';
import auditReducer, { auditCompleted, issueSelected } from '../../src/features/audit/auditSlice';
import { makeStore } from '../helpers/store';

afterEach(cleanup);
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn(); // jsdom has no layout or scrolling
});

const ISSUES = [
  {
    id: 'html-lang:html',
    ruleId: 'html-lang',
    severity: 'serious',
    selector: 'html',
    snippet: '<html>',
    message: 'The page language is not set',
    impact: 'Screen readers may read the text with the wrong pronunciation.',
    fix: { text: 'Add `lang="en"` to `<html>`.' },
  },
  {
    id: 'color-contrast:body > p',
    ruleId: 'color-contrast',
    severity: 'serious',
    selector: 'body > p',
    snippet: '<p>',
    message: 'Text is too faint to read',
    impact: '#999 on white is 2.85:1. It needs 4.5:1.',
    contrast: { fg: '#999999', bg: '#ffffff', ratio: 2.85, needed: 4.5 },
    fix: {
      text: 'Change the text colour to `#757575`.',
      css: 'body > p { color: #757575 !important; }',
      color: '#757575',
    },
  },
  {
    id: 'img-alt:body > img',
    ruleId: 'img-alt',
    severity: 'critical',
    selector: 'body > img',
    snippet: '<img src="x.png">',
    message: 'The image has no text alternative',
    impact: 'Screen reader users hear "image" and nothing else.',
    fix: { text: 'Describe the image in `alt`.' },
  },
  {
    id: 'color-contrast:body > div',
    ruleId: 'color-contrast',
    severity: 'minor',
    needsReview: true,
    selector: 'body > div',
    snippet: '<div>',
    message: 'Text sits on an image or gradient',
    impact: 'AccessLab cannot measure this contrast, so check it by eye.',
    fix: { text: 'Check it.' },
  },
];

function setup({ selected = null, props = {} } = {}) {
  let audit = auditReducer(
    undefined,
    auditCompleted({ ranAt: 1, score: 70, issues: ISSUES, timings: {}, errors: [] }),
  );
  if (selected) audit = auditReducer(audit, issueSelected(selected));
  const store = makeStore({
    editor: { html: '', css: 'p { color: #999 }', source: 'paste', sourceUrl: null },
    audit,
  });
  render(
    <Provider store={store}>
      <IssueList {...props} />
    </Provider>,
  );
  return store;
}

const toggle = (title) => screen.getByRole('button', { name: new RegExp(`^\\d+\\. ${title}$`) });
const row = (title) => toggle(title).closest('li');

describe('IssueList', () => {
  it('groups findings by severity, most severe first, with items to check by hand last', () => {
    setup();
    const groups = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(groups).toEqual(['Critical 1 issue', 'Serious 2 issues', 'Check by hand 1 issue']);
  });

  it('numbers the rows in one sequence across the groups', () => {
    setup();
    const titles = screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent);
    expect(titles).toEqual([
      '1. The image has no text alternative',
      '2. The page language is not set',
      '3. Text is too faint to read',
      '4. Text sits on an image or gradient',
    ]);
  });

  it('shows a plain title and who it affects; details only in the open row', () => {
    setup({ selected: 'img-alt:body > img' });
    const img = within(row('The image has no text alternative'));
    expect(img.getByText('Screen reader users hear "image" and nothing else.')).toBeTruthy();
    expect(toggle('The image has no text alternative').getAttribute('aria-expanded')).toBe('true');
    expect(img.getByText('body > img')).toBeTruthy();
    expect(img.getByRole('link', { name: 'WCAG 1.1.1 (opens in a new tab)' }).href).toBe(
      'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content',
    );
    expect(img.getByText('alt').tagName).toBe('CODE'); // `alt` in the fix advice
    // A closed row shows no details.
    expect(toggle('The page language is not set').getAttribute('aria-expanded')).toBe('false');
    expect(within(row('The page language is not set')).queryByText('html')).toBeNull();
  });

  it('marks whole-page findings instead of pointing at an element', () => {
    setup();
    expect(within(row('The page language is not set')).getByText('Whole page')).toBeTruthy();
    expect(within(row('The image has no text alternative')).queryByText('Whole page')).toBeNull();
  });

  it('a contrast fix shows the colour in its button and appends the CSS fix', () => {
    const onFixApplied = vi.fn();
    const store = setup({ props: { onFixApplied } });
    const use = screen.getByRole('button', { name: 'Use #757575' });
    expect(use.querySelector('.swatch').style.background).toBe('rgb(117, 117, 117)');
    fireEvent.click(use);
    expect(store.getState().editor.css).toBe(
      'p { color: #999 }\nbody > p { color: #757575 !important; } /* AccessLab fix: color-contrast */\n',
    );
    expect(onFixApplied).toHaveBeenCalledOnce();
  });

  it('opening a row selects its issue, and closing it clears the selection', () => {
    const onShowIssue = vi.fn();
    setup({ selected: 'img-alt:body > img', props: { onShowIssue } });
    fireEvent.click(toggle('The image has no text alternative'));
    expect(onShowIssue).toHaveBeenLastCalledWith(null);
    fireEvent.click(toggle('Text is too faint to read'));
    expect(onShowIssue).toHaveBeenLastCalledWith(ISSUES[1]);
  });

  it('"Show in code" in the open row reports the issue', () => {
    const onShowInCode = vi.fn();
    setup({ selected: 'img-alt:body > img', props: { onShowInCode } });
    fireEvent.click(screen.getByRole('button', { name: 'Show in code' }));
    expect(onShowInCode).toHaveBeenCalledWith(ISSUES[2]);
  });
});
