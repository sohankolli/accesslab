import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Routes, Route } from 'react-router';
import RuleDetail from '../../src/features/learn/RuleDetail';
import { RULE_GUIDES } from '../../src/features/learn/ruleguides';
import { makeStore } from '../helpers/store';

afterEach(cleanup);

describe('Learn guide Workbench examples', () => {
  it.each(Object.entries(RULE_GUIDES))(
    'loads the %s example into the Workbench',
    (ruleId, guide) => {
      const store = makeStore();

      render(
        <Provider store={store}>
          <MemoryRouter initialEntries={[`/learn/${ruleId}`]}>
            <Routes>
              <Route path="/learn/:ruleId" element={<RuleDetail />} />
              <Route path="/audit" element={<h1>Workbench route</h1>} />
            </Routes>
          </MemoryRouter>
        </Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Try it in the Workbench' }));

      expect(screen.getByRole('heading', { name: 'Workbench route' })).toBeTruthy();

      const editor = store.getState().editor;
      expect(editor.source).toBe('learn');
      expect(editor.css).toBe('');
      expect(editor.fileName).toBeNull();

      if (ruleId === 'html-lang') {
        expect(editor.html).toContain('<html>');
        expect(editor.html).not.toContain('<html lang=');
      } else if (ruleId === 'page-title') {
        expect(editor.html).toContain('<head></head>');
      } else if (ruleId === 'landmark-main') {
        expect(editor.html).toContain(guide.bad);
        expect(editor.html).toContain('<body>');
      } else if (ruleId === 'link-name') {
        expect(editor.html).toBe('<a href="/report"></a>');
      } else if (ruleId === 'duplicate-id') {
        expect(editor.html).toContain('aria-label="Work email"');
        expect(editor.html.match(/id="email"/g)).toHaveLength(2);
      } else {
        expect(editor.html).toBe(guide.bad);
      }
    },
  );
});
