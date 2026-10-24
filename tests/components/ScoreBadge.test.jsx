import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import ScoreBadge from '../../src/components/ScoreBadge';

afterEach(cleanup);
const text = (props) => render(<ScoreBadge {...props} />).container.textContent;
const issue = (severity, needsReview) => ({ id: Math.random(), severity, needsReview });

describe('ScoreBadge', () => {
  it('keeps its place before the first audit, so nothing shifts later', () => {
    expect(text({})).toContain('Not audited yet');
    cleanup();
    expect(text({ auditing: true })).toContain('Auditing…');
  });

  it('shows the score in text and the change since the last run in words', () => {
    expect(text({ score: 80 })).toContain('Score 80 / 100');
    expect(text({ score: 80 })).toContain('First run');
    cleanup();
    expect(text({ score: 86, previousScore: 67 })).toContain('Up 19 since last run');
    cleanup();
    expect(text({ score: 60, previousScore: 67 })).toContain('Down 7 since last run');
    cleanup();
    expect(text({ score: 67, previousScore: 67 })).toContain('No change since last run');
  });

  it('counts scored issues per severity as labelled chips, and review items apart', () => {
    render(
      <ScoreBadge
        score={70}
        issues={[issue('critical'), issue('critical'), issue('minor'), issue('minor', true)]}
      />,
    );
    const chips = screen.getByRole('list', { name: 'Issues by severity' }).querySelectorAll('li');
    expect([...chips].map((li) => li.textContent)).toEqual([
      'Critical 2',
      'Serious 0',
      'Moderate 0',
      'Minor 1',
      'To review 1',
    ]);
  });
});
