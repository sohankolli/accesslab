import { describe, it, expect } from 'vitest';
import { CUE_GROUPS, occludedRows, topCues } from '../../src/engine/ml/explain';
import { ROW_DIM, OFFSETS, DENSE } from '../../src/engine/ml/nodeFeatures';

describe('why we think so', () => {
  it('makes one copy of the row per cue group, with that group zeroed', () => {
    const row = new Float32Array(ROW_DIM).fill(1);
    const out = occludedRows(row);
    expect(out).toHaveLength(CUE_GROUPS.length * ROW_DIM);
    const pointer = CUE_GROUPS.findIndex((g) => g.id === 'pointer');
    const col = OFFSETS.dense + DENSE.indexOf('pointer cursor');
    expect(out[pointer * ROW_DIM + col]).toBe(0);
    expect(out[pointer * ROW_DIM + col + 1]).toBe(1); // the rest is untouched
    expect(row[col]).toBe(1); // and the original row too
  });

  it('reports the cues whose removal lowers the probability most, in plain words', () => {
    document.body.innerHTML = '<ul class="nav"><li class="nav-btn">Home</li></ul>';
    const el = document.querySelector('li');
    const p = 0.9;
    const occluded = CUE_GROUPS.map((g) =>
      g.id === 'pointer' ? 0.3 : g.id === 'words' ? 0.5 : g.id === 'parent' ? 0.7 : 0.95,
    );
    const cues = topCues(el, p, occluded);
    expect(cues.map((c) => c.id)).toEqual(['pointer', 'words', 'parent']);
    expect(cues[0].text).toBe('pointer cursor');
    expect(cues[1].text).toBe('class or id contains "nav-btn"');
    expect(cues[2].text).toBe('sits inside <ul class="nav">');
  });

  it('reports nothing when no cue mattered', () => {
    document.body.innerHTML = '<div>x</div>';
    expect(
      topCues(
        document.querySelector('div'),
        0.5,
        CUE_GROUPS.map(() => 0.5),
      ),
    ).toEqual([]);
  });
});
