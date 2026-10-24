import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import ScoreBadge from '../../src/components/ScoreBadge';

afterEach(cleanup);
const text = (props) => render(<ScoreBadge {...props} />).container.textContent;

describe('ScoreBadge', () => {
  it('renders nothing before the first audit', () => {
    expect(text({})).toBe('');
  });
  it('shows the score, and the change since the last run in words', () => {
    expect(text({ score: 80 })).toBe('Score 80');
    expect(text({ score: 86, previousScore: 67 })).toContain('up 19 since last run');
    expect(text({ score: 60, previousScore: 67 })).toContain('down 7 since last run');
    expect(text({ score: 67, previousScore: 67 })).toContain('no change since last run');
  });
});
