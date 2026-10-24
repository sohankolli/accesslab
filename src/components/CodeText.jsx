// components/CodeText.jsx

/**
 * Plain text in which `backticks` mark code: "Use `alt=""`" renders the code
 * part in a <code> element. Issue copy from the engine uses this convention,
 * so the engine never has to produce markup.
 * @param {{text: string}} props
 */
export default function CodeText({ text }) {
  return text
    .split('`')
    .map((part, i) => (i % 2 === 1 ? <code key={i}>{part}</code> : part || null));
}
