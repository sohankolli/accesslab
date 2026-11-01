// Colour-vision deficiency matrices (Machado, Oliveira & Fernandes, 2009,
// severity 1.0). They operate on linear RGB, which is SVG's default
// color-interpolation-filters, so they can be used in feColorMatrix directly.
export const CVD = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

/** feColorMatrix needs 20 values: four rows of [r g b a offset]. */
export function toFeValues(m) {
  return [...m.map((row) => [...row, 0, 0]), [0, 0, 0, 1, 0]].flat().join(' ');
}

/**
 * Inject the filter into the sandboxed document and apply it to <html>.
 * AccessLab calls this only on the Simulate page's own preview copy, never on
 * the audited document, so a lens can never change the audit.
 * @param {Document} doc
 * @param {string} mode  'none' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'low-vision' | 'zoom-200'
 */
export function applySimulation(doc, mode) {
  doc.getElementById('al-sim')?.remove();
  const root = doc.documentElement;
  root.style.filter = '';
  root.style.fontSize = '';
  if (mode === 'none') return;

  if (CVD[mode]) {
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'al-sim';
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;width:0;height:0';
    svg.innerHTML = `<filter id="al-cvd"><feColorMatrix type="matrix" values="${toFeValues(CVD[mode])}"/></filter>`;
    doc.body.append(svg);
    root.style.filter = 'url(#al-cvd)';
  } else if (mode === 'low-vision') {
    root.style.filter = 'blur(2px) contrast(0.8)';
  } else if (mode === 'zoom-200') {
    root.style.fontSize = '200%'; // text sized in px will NOT grow: that is the finding
  }
}
