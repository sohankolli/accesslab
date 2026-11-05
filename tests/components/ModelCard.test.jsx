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

  it('makes every scrolling table a named region a keyboard user can reach', async () => {
    await renderCard();
    const wraps = [...document.querySelectorAll('.table-wrap')];
    expect(wraps.length).toBeGreaterThanOrEqual(4);
    for (const wrap of wraps) {
      const caption = wrap.querySelector('caption').textContent;
      expect(wrap.tabIndex).toBe(0);
      expect(screen.getByRole('region', { name: caption })).toBe(wrap);
      wrap.focus();
      expect(document.activeElement).toBe(wrap);
    }
  });

  it('names the shipped model, why it was chosen, and every candidate from cross-validation', async () => {
    await renderCard();
    expect(screen.getByText(new RegExp(`^Model in use: ${shipped.selection.model}`))).toBeTruthy();
    const table = screen.getByRole('region', {
      name: 'Candidates in cross-validation, on the development sites',
    });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(shipped.crossValidation.candidates.length);
    expect(within(table).getByText(`${shipped.crossValidation.chosen} (chosen)`)).toBeTruthy();
    expect(
      screen.getByText(/0\.\d{3} for seed 0, 0\.\d{3} for seed 1, 0\.\d{3} for seed 2/),
    ).toBeTruthy();
  });

  it('shows the hand-check result, its method, and what it does not fix', async () => {
    await renderCard();
    const data = screen.getByRole('region', { name: 'What it was trained on' });
    expect(within(data).getByText(/188 judged, 0 wrong, 112 unsure/)).toBeTruthy();
    expect(within(data).getByText(/labels\/audit\.mjs/)).toBeTruthy();
    expect(within(data).getByText(/does not fix the small number of positives/)).toBeTruthy();
  });

  it('shows a threshold that was not reached as "not reached", not met, and no suggestions', async () => {
    await renderCard({
      ...shipped,
      threshold: 'not reached',
      operatingThreshold: { ...shipped.operatingThreshold, value: 'not reached' },
      gate: { precision: { target: '>= 0.9', value: 'not reached', pass: false } },
    });
    const row = screen.getByRole('row', { name: /Precision at the shipped threshold/ });
    expect(within(row).getByText('not reached')).toBeTruthy();
    expect(within(row).getByText('Not met')).toBeTruthy();
    expect(screen.getByText(/^Threshold: not reached\./)).toBeTruthy();
    expect(screen.getByText(/not accurate enough yet to make suggestions/)).toBeTruthy();
    expect(screen.getByText(/Precision and recall: not reached/)).toBeTruthy();
  });

  it('shows the operating threshold, its rule, and test precision and recall with intervals', async () => {
    await renderCard({
      ...shipped,
      threshold: 0.25,
      operatingThreshold: {
        rule: 'the lowest threshold whose out-of-fold precision is at least 50%',
        value: 0.25,
        outOfFold: { precision: 0.5, recall: 0.2, flagged: 20 },
        test: {
          precision: 0.4,
          precision_ci95: [0.1, 0.7],
          recall: 0.5,
          recall_ci95: [0.2, 0.9],
          tp: 2,
          fp: 3,
          fn: 2,
          flagged: 5,
        },
      },
    });
    expect(screen.getByText(/at least 0\.250, the operating threshold/)).toBeTruthy();
    expect(screen.getByText(/Rule: the lowest threshold whose out-of-fold precision/)).toBeTruthy();
    expect(
      screen.getByText(/out-of-fold predictions it gave precision 50\.0% and recall 20\.0%/),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /Precision at the operating threshold 40\.0% \(95% interval 10\.0% to 70\.0%\)/,
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /Recall at the operating threshold 50\.0% \(95% interval 20\.0% to 90\.0%\)/,
      ),
    ).toBeTruthy();
  });
});
