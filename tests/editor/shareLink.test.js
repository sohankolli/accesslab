import { describe, it, expect } from 'vitest';
import {
  decodeShare,
  encodeShare,
  makeShareLink,
  shareDataFromHash,
  MAX_LINK_LENGTH,
} from '../../src/features/editor/shareLink';
import { MAX_PAGE_BYTES } from '../../src/features/editor/editorSlice';

const BASE = 'https://accesslab.example/audit';

/** Pack any value the way encodeShare does, to build links with wrong contents. */
async function pack(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const out = new Uint8Array(
    await new Response(stream.pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer(),
  );
  return btoa(String.fromCharCode(...out))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Text that does not compress well, so links get long. */
function noise(length) {
  let seed = 7;
  let out = '';
  while (out.length < length) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    out += seed.toString(36);
  }
  return out.slice(0, length);
}

describe('share link round trip', () => {
  it('brings back Unicode and emoji exactly', async () => {
    const page = {
      html: '<p lang="hi">नमस्ते, café, 日本語 👩🏽‍💻 🎉</p>\n<p>"quotes" & <tags></p>',
      css: 'p::before { content: "→ ✓"; }',
    };
    expect(await decodeShare(await encodeShare(page))).toEqual({ ok: true, ...page });
  });

  it('uses only URL-safe characters', async () => {
    const data = await encodeShare({ html: noise(3000), css: '' });
    expect(data).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('brings back a page just under the size cap', async () => {
    const css = 'p { color: #333 }\n';
    const html = '<p>é</p>'.repeat(Math.floor((MAX_PAGE_BYTES - css.length) / 9));
    expect(new TextEncoder().encode(html + css).length).toBeLessThanOrEqual(MAX_PAGE_BYTES);
    expect(new TextEncoder().encode(html + css).length).toBeGreaterThan(MAX_PAGE_BYTES - 9);
    expect(await decodeShare(await encodeShare({ html, css }))).toEqual({ ok: true, html, css });
  });

  it('makes a link to the Workbench with the data in the fragment', async () => {
    const link = await makeShareLink({ html: '<p>Hi</p>', css: '' }, BASE);
    expect(link.ok).toBe(true);
    expect(link.url.startsWith(`${BASE}#s=`)).toBe(true);
    const data = shareDataFromHash(new URL(link.url).hash);
    expect(await decodeShare(data)).toEqual({ ok: true, html: '<p>Hi</p>', css: '' });
  });
});

describe('a link that cannot be opened', () => {
  it('reports a truncated link as damaged', async () => {
    const data = await encodeShare({ html: noise(2000), css: 'p {}' });
    expect(await decodeShare(data.slice(0, data.length / 2))).toMatchObject({
      ok: false,
      reason: 'damaged',
    });
  });

  it('reports characters outside base64url as damaged', async () => {
    expect(await decodeShare('abc$%^')).toMatchObject({ ok: false, reason: 'damaged' });
    expect(await decodeShare('')).toMatchObject({ ok: false, reason: 'damaged' });
  });

  it('reports data that is not compressed JSON as damaged', async () => {
    expect(await decodeShare('aGVsbG8gd29ybGQ')).toMatchObject({ ok: false, reason: 'damaged' });
    expect(await decodeShare(await pack('just a string'))).toMatchObject({
      ok: false,
      reason: 'damaged',
    });
  });

  it('reports a wrong version as damaged', async () => {
    expect(await decodeShare(await pack({ v: 2, html: '<p>x</p>', css: '' }))).toMatchObject({
      ok: false,
      reason: 'damaged',
    });
    expect(await decodeShare(await pack({ html: '<p>x</p>', css: '' }))).toMatchObject({
      ok: false,
      reason: 'damaged',
    });
  });

  it('reports html or css that is not a string as damaged', async () => {
    expect(await decodeShare(await pack({ v: 1, html: 5, css: '' }))).toMatchObject({
      ok: false,
      reason: 'damaged',
    });
    expect(await decodeShare(await pack({ v: 1, html: '' }))).toMatchObject({
      ok: false,
      reason: 'damaged',
    });
  });

  it('refuses a page over the size cap, and says how big it is', async () => {
    const html = 'a'.repeat(MAX_PAGE_BYTES + 1);
    expect(await decodeShare(await pack({ v: 1, html, css: '' }))).toEqual({
      ok: false,
      reason: 'too-big',
      bytes: MAX_PAGE_BYTES + 1,
    });
  });

  it('stops unpacking a link that would unpack far past the cap', async () => {
    const html = 'a'.repeat(MAX_PAGE_BYTES * 8); // compresses to a few KB
    expect(await decodeShare(await pack({ v: 1, html, css: '' }))).toMatchObject({
      ok: false,
      reason: 'damaged',
    });
  });
});

describe('link length limit', () => {
  it(`does not make a link longer than ${MAX_LINK_LENGTH} characters`, async () => {
    const html = noise(60000);
    const link = await makeShareLink({ html, css: 'p {}' }, BASE);
    expect(link).toMatchObject({ ok: false, reason: 'too-long', bytes: 60004 });
    expect(link.length).toBeGreaterThan(MAX_LINK_LENGTH);
  });

  it('makes a link for a large page that compresses well', async () => {
    const html = '<p>Same paragraph again.</p>\n'.repeat(5000); // 140 KB
    const link = await makeShareLink({ html, css: '' }, BASE);
    expect(link.ok).toBe(true);
    expect(link.url.length).toBeLessThanOrEqual(MAX_LINK_LENGTH);
  });
});

describe('shareDataFromHash', () => {
  it('finds the share data, and ignores other fragments', () => {
    expect(shareDataFromHash('#s=abc_-')).toBe('abc_-');
    expect(shareDataFromHash('#s=')).toBe('');
    expect(shareDataFromHash('#main')).toBeNull();
    expect(shareDataFromHash('')).toBeNull();
  });
});
