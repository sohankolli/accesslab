import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { guardPreview } from '../../src/features/audit/previewGuard';

const page = () =>
  new JSDOM('<a href="/away">Away</a><form action="/send"><button>Send</button></form>').window
    .document;

describe('guardPreview', () => {
  it('stops link clicks and form submits, and passes the click on', () => {
    const doc = page();
    const onClick = vi.fn();
    guardPreview(doc, onClick);
    const link = doc.querySelector('a');
    const click = new doc.defaultView.MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(onClick).toHaveBeenCalledWith(click);
    const submit = new doc.defaultView.Event('submit', { bubbles: true, cancelable: true });
    doc.querySelector('form').dispatchEvent(submit);
    expect(submit.defaultPrevented).toBe(true);
  });

  it('works without a click callback', () => {
    const doc = page();
    guardPreview(doc);
    const click = new doc.defaultView.MouseEvent('click', { bubbles: true, cancelable: true });
    expect(() => doc.querySelector('a').dispatchEvent(click)).not.toThrow();
    expect(click.defaultPrevented).toBe(true);
  });
});
