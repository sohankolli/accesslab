import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import ScoreReading from '../../src/features/audit/ScoreReading';

afterEach(cleanup);
const text = (props) => render(<ScoreReading {...props} />).container.textContent;
const issue = (severity, needsReview) => ({ id: Math.random(), severity, needsReview });

describe('ScoreReading', () => {
  it('keeps its place before the first check, so nothing shifts later', () => {
    expect(text({})).toContain('Not checked yet');
    cleanup();
    expect(text({ auditing: true })).toContain('Checking the page…');
  });

  it('names the score "Score 77 out of 100" for screen readers', () => {
    render(<ScoreReading score={77} />);
    expect(screen.getByText('Score 77 out of 100')).toBeTruthy();
  });

  it('reads the score as acuity and counts what gets in the way', () => {
    const issues = [issue('critical'), issue('critical'), issue('serious'), issue('moderate')];
    expect(text({ score: 77, issues })).toContain('Reads at 20/30. Four things get in the way.');
    expect(text({ score: 77, issues })).toContain('First check of this page');
    cleanup();
    expect(text({ score: 82, previousScore: 77 })).toContain('Up 5 since the last check');
  });

  it('underlines and labels the reached line of the decorative chart', () => {
    const { container } = render(<ScoreReading score={77} />);
    const chart = container.querySelector('.snellen');
    expect(chart.getAttribute('aria-hidden')).toBe('true');
    const here = chart.querySelector('.is-here');
    expect(here.dataset.letters).toBe('E D F C Z P');
    expect(chart.textContent).toBe(''); // letters are drawn by CSS, so they are not text
    expect(here.dataset.acuity).toBe('20/30');
    expect(chart.querySelectorAll('.is-dim')).toHaveLength(2); // 20/25 and 20/20
  });

  it('tallies scored findings by severity, with review items apart', () => {
    render(
      <ScoreReading
        score={70}
        issues={[issue('critical'), issue('critical'), issue('minor'), issue('minor', true)]}
      />,
    );
    const items = screen.getByRole('list', { name: 'Findings by severity' }).querySelectorAll('li');
    expect([...items].map((li) => li.textContent)).toEqual([
      '2 critical',
      '0 serious',
      '0 moderate',
      '1 minor',
      '1 to check by hand',
    ]);
  });
});
