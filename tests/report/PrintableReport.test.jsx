
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PrintableReport from '../../src/features/report/PrintableReport';

const firstRun = {
  id: '1000',
  ranAt: 1793610000000,
  score: 70,
  counts: { critical: 1, serious: 1 },
  issues: [
    {
      id: 'image-alt',
      ruleId: 'img-alt',
      severity: 'critical',
      selector: 'img',
      message: 'The image has no alternative text',
      impact: 'Screen reader users cannot understand the image.',
      fix: { text: 'Add descriptive alternative text.' },
    },
    {
      id: 'email-label',
      ruleId: 'form-label',
      severity: 'serious',
      selector: 'input',
      message: 'The email field has no label',
      fix: { text: 'Add a label to the field.' },
    },
  ],
};

const secondRun = {
  id: '2000',
  ranAt: 1793613600000,
  score: 90,
  counts: { serious: 1 },
  issues: [
    {
      id: 'email-label',
      ruleId: 'form-label',
      severity: 'serious',
      selector: 'input',
      message: 'The email field has no label',
      fix: { text: 'Add a label to the field.' },
    },
  ],
};

describe('PrintableReport', () => {
  it('renders the report heading and accessibility score', () => {
    render(<PrintableReport run={firstRun} />);

    expect(screen.getByText('Accessibility Audit Report')).toBeTruthy();
    expect(screen.getByText('70')).toBeTruthy();
    expect(screen.getByText(/Eye-chart reading:/)).toBeTruthy();
  });

  it('renders findings with their elements and suggested fixes', () => {
  const { container } = render(<PrintableReport run={firstRun} />);

  expect(
    container.querySelectorAll('h3').length,
  ).toBe(2);

  expect(
    screen.getAllByText(/The image has no alternative text/).length,
  ).toBe(2);

  expect(screen.getAllByText('img').length).toBe(2);

  expect(
    screen.getAllByText('Add descriptive alternative text.').length,
  ).toBe(2);
});

  it('shows before-and-after improvement counts', () => {
    render(<PrintableReport run={secondRun} beforeRun={firstRun} />);

    expect(screen.getByText('Before and after improvement')).toBeTruthy();
    expect(screen.getByText('Fixed findings: 1')).toBeTruthy();
    expect(screen.getByText('New findings: 0')).toBeTruthy();
    expect(screen.getByText('Unchanged findings: 1')).toBeTruthy();
    expect(screen.getByText('+20')).toBeTruthy();
  });

  it('renders an empty report when there are no findings', () => {
    render(
      <PrintableReport
        run={{ ...firstRun, issues: [], score: 100 }}
      />,
    );

    expect(screen.getByText('No findings were recorded in this audit.')).toBeTruthy();
  });

  it('renders nothing when no run is provided', () => {
    const { container } = render(<PrintableReport run={null} />);

    expect(container.firstChild).toBeNull();
  });
});
