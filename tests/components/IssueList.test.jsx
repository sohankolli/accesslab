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
    message: '<html> has no lang attribute.',
    fix: { text: 'Add lang="en".' },
  },
  {
    id: 'color-contrast:body > p',
    ruleId: 'color-contrast',
    severity: 'serious',
    selector: 'body > p',
    snippet: '<p>',
    message: 'Contrast is 2.85:1; at least 4.5:1 is required.',
    fix: { text: 'Use #757575 (4.61:1).', css: 'body > p { color: #757575 !important; }' },
  },
  {
    id: 'img-alt:body > img',
    ruleId: 'img-alt',
    severity: 'critical',
    selector: 'body > img',
    snippet: '<img src="x.png">',
    message: 'Image has no alt attribute.',
    fix: { text: 'Add alt.' },
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

const card = (name) => screen.getByRole('heading', { name }).closest('li');

describe('IssueList', () => {
  it('lists issues most severe first, with rule, WCAG reference, selector and fix', () => {
    setup();
    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(titles[0]).toBe('Image has no alt attribute.');
    const img = within(card('Image has no alt attribute.'));
    expect(img.getByText('img-alt')).toBeTruthy();
    expect(img.getByText('1.1.1 Non-text Content')).toBeTruthy();
    expect(img.getByText('body > img')).toBeTruthy();
    expect(img.getByText('Add alt.')).toBeTruthy();
  });

  it('"Apply fix" appends the CSS fix to the editor and reports back for focus', () => {
    const onFixApplied = vi.fn();
    const store = setup({ props: { onFixApplied } });
    expect(screen.getAllByRole('button', { name: 'Apply fix' })).toHaveLength(1); // only fix.css issues
    fireEvent.click(screen.getByRole('button', { name: 'Apply fix' }));
    expect(store.getState().editor.css).toBe(
      'p { color: #999 }\nbody > p { color: #757575 !important; } /* AccessLab fix: color-contrast */\n',
    );
    expect(onFixApplied).toHaveBeenCalledOnce();
  });

  it('"Show in preview" selects an issue, and pressing it again clears the selection', () => {
    const onShowIssue = vi.fn();
    setup({ selected: 'img-alt:body > img', props: { onShowIssue } });
    const show = within(card('Image has no alt attribute.')).getByRole('button', {
      name: 'Show in preview',
    });
    expect(show.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(show);
    expect(onShowIssue).toHaveBeenLastCalledWith(null);

    const other = within(card('Contrast is 2.85:1; at least 4.5:1 is required.')).getByRole(
      'button',
      { name: 'Show in preview' },
    );
    expect(other.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(other);
    expect(onShowIssue).toHaveBeenLastCalledWith(ISSUES[1]);
  });

  it('offers no "Show in preview" for page-level issues', () => {
    setup();
    expect(
      within(card('<html> has no lang attribute.')).queryByRole('button', {
        name: 'Show in preview',
      }),
    ).toBeNull();
  });
});
