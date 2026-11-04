// A small robots.txt reader: the rules for "*" (and for our own agent name),
// longest matching rule wins, Allow beats Disallow on a tie (RFC 9309).
export const AGENT = 'AccessLabResearch';

export function parseRobots(text) {
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const [, key, value] = m;
    if (key.toLowerCase() === 'user-agent') {
      if (!lastWasAgent) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (current && /^(allow|disallow)$/i.test(key) && value) {
        current.rules.push({ allow: key.toLowerCase() === 'allow', path: value });
      }
    }
  }
  const ours = groups.filter((g) =>
    g.agents.some((a) => AGENT.toLowerCase().includes(a) && a !== '*'),
  );
  const chosen = ours.length ? ours : groups.filter((g) => g.agents.includes('*'));
  return chosen.flatMap((g) => g.rules);
}

const toRegex = (p) =>
  new RegExp(
    '^' +
      p
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\\\$$/, '$'),
  );

/** Whether robots rules allow fetching this path. */
export function allowed(rules, pathname) {
  let best = null;
  for (const rule of rules) {
    if (!toRegex(rule.path).test(pathname)) continue;
    if (
      !best ||
      rule.path.length > best.path.length ||
      (rule.path.length === best.path.length && rule.allow)
    )
      best = rule;
  }
  return !best || best.allow;
}

/** Fetch and parse a site's robots.txt. No file, or an error, means no rules. */
export async function robotsFor(origin) {
  try {
    const res = await fetch(new URL('/robots.txt', origin), { signal: AbortSignal.timeout(10000) });
    if (res.status >= 400) return [];
    return parseRobots(await res.text());
  } catch {
    return [];
  }
}
