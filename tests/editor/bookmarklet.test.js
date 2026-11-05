import { describe, it, expect } from 'vitest';
import {
  makeBookmarkletUrl,
  isBookmarkletPageMessage,
} from '../../src/features/editor/bookmarklet';

describe('bookmarklet URL', () => {
  it('opens the AccessLab audit page with the bookmarklet parameter', () => {
    const url = makeBookmarkletUrl('https://accesslab.example/home');

    expect(url).toMatch(/^javascript:/);
    expect(url).toContain('/audit?from=bookmarklet');
    expect(url).toContain('https://accesslab.example');
  });

  it('uses only the origin, not the supplied path', () => {
    const url = makeBookmarkletUrl('https://accesslab.example/some/path');

    expect(url).toContain('https://accesslab.example');
    expect(url).not.toContain('/some/path');
  });

  it('includes the page data and ready-message handshake', () => {
    const url = makeBookmarkletUrl('https://accesslab.example');

    expect(url).toContain('accesslab:ready');
    expect(url).toContain('accesslab:page');
    expect(url).toContain('document.documentElement.outerHTML');
    expect(url).toContain('document.styleSheets');
    expect(url).toContain('skippedStylesheets');
  });

  it('sends the page only once', () => {
    const url = makeBookmarkletUrl('https://accesslab.example');

    expect(url).toContain('let sent = false');
    expect(url).toContain('sent = true');
  });
});

describe('bookmarklet page message validation', () => {
  const opener = {};
  const validEvent = {
    source: opener,
    data: {
      type: 'accesslab:page',
      html: '<html></html>',
      css: 'body { color: black; }',
    },
  };

  it('accepts a valid page message from the expected opener while waiting', () => {
    expect(isBookmarkletPageMessage(validEvent, opener, true)).toBe(true);
  });

  it('rejects a message from another window', () => {
    const foreignEvent = {
      ...validEvent,
      source: {},
    };

    expect(isBookmarkletPageMessage(foreignEvent, opener, true)).toBe(false);
  });

  it('rejects messages when the receiver is not waiting', () => {
    expect(isBookmarkletPageMessage(validEvent, opener, false)).toBe(false);
  });

  it('rejects an incorrect message type', () => {
    const invalidEvent = {
      ...validEvent,
      data: { ...validEvent.data, type: 'wrong:type' },
    };

    expect(isBookmarkletPageMessage(invalidEvent, opener, true)).toBe(false);
  });

  it('rejects non-string HTML', () => {
    const invalidEvent = {
      ...validEvent,
      data: { ...validEvent.data, html: 123 },
    };

    expect(isBookmarkletPageMessage(invalidEvent, opener, true)).toBe(false);
  });

  it('rejects non-string CSS', () => {
    const invalidEvent = {
      ...validEvent,
      data: { ...validEvent.data, css: null },
    };

    expect(isBookmarkletPageMessage(invalidEvent, opener, true)).toBe(false);
  });
});
