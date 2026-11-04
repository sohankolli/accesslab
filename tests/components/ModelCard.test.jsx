import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, screen, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import fs from 'node:fs';
import path from 'node:path';
import ModelCard from '../../src/features/learn/ModelCard';
import { makeStore } from '../helpers/store';

const shipped = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, '../../public/models/clickables-v1.json')),
);

/** Render the card from a manifest, served by a fake fetch. */
async function renderCard(manifest = shipped) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(manifest));
  render(
    <Provider store={makeStore()}>
      <MemoryRouter>
        <ModelCard />
      </MemoryRouter>
    </Provider>,
  );
  await screen.findByRole('heading', { level: 1, name: 'Click-only controls model' });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('model card', () => {
  it('shows the shipped manifest with no null, NaN or undefined anywhere', async () => {
    await renderCard();
    expect(document.body.textContent).not.toMatch(/\bnull\b|\bNaN\b|\bundefined\b/);
  });

  it('says first that the model is experimental, off by default and never changes the score', async () => {
    await renderCard();
    const status = screen.getByRole('region', { name: 'Status' });
    expect(within(status).getByText(/experimental and switched off by default/)).toBeTruthy();
    expect(within(status).getAllByText(/never change the score/).length).toBeGreaterThan(0);
  });

  it('shows the hand-check result, its method, and what it does not fix', async () => {
    await renderCard();
    const data = screen.getByRole('region', { name: 'What it was trained on' });
    expect(within(data).getByText(/188 judged, 0 wrong, 112 unsure/)).toBeTruthy();
    expect(within(data).getByText(/labels\/audit\.mjs/)).toBeTruthy();
    expect(within(data).getByText(/does not fix the small number of positives/)).toBeTruthy();
  });

  it('shows a precision gate with no threshold as "not reached" and not met', async () => {
    await renderCard({
      ...shipped,
      threshold: 'not reached',
      gate: { precision: { target: '>= 0.9', value: 'not reached', pass: false } },
    });
    const row = screen.getByRole('row', { name: /Precision at the shipped threshold/ });
    expect(within(row).getByText('not reached')).toBeTruthy();
    expect(within(row).getByText('Not met')).toBeTruthy();
    expect(screen.getByText(/Threshold: not reached/)).toBeTruthy();
    expect(screen.getByText(/Precision and recall: not reached/)).toBeTruthy();
  });

  it('shows the threshold, precision and recall when one was reached', async () => {
    await renderCard({
      ...shipped,
      threshold: 0.42,
      metrics: {
        ...shipped.metrics,
        test: { ...shipped.metrics.test, precision: 0.91, recall: 0.5, tp: 3, fn: 3, flagged: 3 },
      },
    });
    expect(screen.getByText(/at least 0\.420/)).toBeTruthy();
    expect(screen.getByText(/Precision 91\.0%/)).toBeTruthy();
  });
});
