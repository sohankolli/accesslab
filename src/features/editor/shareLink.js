// Share links: the page's code packed into the link itself.
//
// The code goes in the URL fragment (/audit#s=<data>). Browsers never send the
// fragment to the server, not even in the request for the page, so a shared
// page stays between the two people who have the link: nothing is uploaded.
//
// Packing: {v: 1, html, css} as JSON, UTF-8, compressed with the browser's
// CompressionStream('deflate-raw'), then base64url (base64 with - and _ and no
// padding, so it needs no escaping in a URL).
import { MAX_PAGE_BYTES, pageBytes } from './editorSlice';

export const SHARE_VERSION = 1;
/** Longer links are not made: some browsers, chat apps and mail clients cut them. */
export const MAX_LINK_LENGTH = 32000;
/** The fragment key: /audit#s=<data>. */
export const SHARE_PARAM = 's';

// The JSON of a page within the cap can be larger than the page: JSON.stringify
// writes a control character as \u0000, six bytes for one. Decompression stops
// past this, so a small link cannot unpack into gigabytes.
const MAX_JSON_BYTES = MAX_PAGE_BYTES * 6 + 1024;

/** @param {Uint8Array} bytes */
function toBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** @param {string} text  throws on characters outside the base64url alphabet */
function fromBase64Url(text) {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error('not base64url');
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Run bytes through a CompressionStream or DecompressionStream.
 * @param {Uint8Array} bytes
 * @param {TransformStream} transform
 * @param {number} [limit]  throws once the output passes this many bytes
 */
async function pipe(bytes, transform, limit = Infinity) {
  const input = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const reader = input.pipeThrough(transform).getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new Error('too large');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/**
 * Pack a page into the text that goes after #s=.
 * @param {{html: string, css: string}} page
 * @returns {Promise<string>}
 */
export async function encodeShare({ html, css }) {
  const json = JSON.stringify({ v: SHARE_VERSION, html, css });
  const packed = await pipe(new TextEncoder().encode(json), new CompressionStream('deflate-raw'));
  return toBase64Url(packed);
}

/**
 * The full share link for a page, or why it cannot be made.
 * @param {{html: string, css: string}} page
 * @param {string} base  the Workbench's address without a fragment, e.g. https://host/audit
 * @returns {Promise<
 *   {ok: true, url: string} |
 *   {ok: false, reason: 'too-long', length: number, bytes: number}
 * >}
 */
export async function makeShareLink(page, base) {
  const url = `${base}#${SHARE_PARAM}=${await encodeShare(page)}`;
  if (url.length > MAX_LINK_LENGTH) {
    return {
      ok: false,
      reason: 'too-long',
      length: url.length,
      bytes: pageBytes(page.html, page.css),
    };
  }
  return { ok: true, url };
}

/**
 * The share data in a location hash ("#s=..."), or null when the hash is not a share link.
 * @param {string} hash
 */
export function shareDataFromHash(hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return params.has(SHARE_PARAM) ? (params.get(SHARE_PARAM) ?? '') : null;
}

/**
 * Unpack the text after #s=. Never throws: anything wrong with the link is a result.
 * @param {string} data
 * @returns {Promise<
 *   {ok: true, html: string, css: string} |
 *   {ok: false, reason: 'damaged', error?: unknown} |
 *   {ok: false, reason: 'too-big', bytes: number}
 * >}
 */
export async function decodeShare(data) {
  let parsed;
  try {
    const packed = fromBase64Url(data);
    const json = await pipe(packed, new DecompressionStream('deflate-raw'), MAX_JSON_BYTES);
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(json));
  } catch (error) {
    // Not base64url, cut short, not deflate, unpacks too large, or not JSON:
    // all mean the link was damaged on the way, and the user is told so.
    return { ok: false, reason: 'damaged', error };
  }
  if (
    !parsed ||
    parsed.v !== SHARE_VERSION ||
    typeof parsed.html !== 'string' ||
    typeof parsed.css !== 'string'
  ) {
    return { ok: false, reason: 'damaged' };
  }
  const bytes = pageBytes(parsed.html, parsed.css);
  if (bytes > MAX_PAGE_BYTES) return { ok: false, reason: 'too-big', bytes };
  return { ok: true, html: parsed.html, css: parsed.css };
}
