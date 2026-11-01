/**
 * Keep a preview frame on the page it shows. The page's own scripts never run
 * (the sandbox has no allow-scripts), but a plain link or form could still
 * navigate the frame away. These capturing listeners stop both.
 * Used by the workbench preview and the Simulate preview.
 * @param {Document} doc  the preview's document
 * @param {(event: MouseEvent) => void} [onClick]  runs after a click is stopped,
 *   e.g. to select the issue under the pointer
 */
export function guardPreview(doc, onClick) {
  doc.addEventListener(
    'click',
    (event) => {
      event.preventDefault();
      onClick?.(event);
    },
    true,
  );
  doc.addEventListener('submit', (event) => event.preventDefault(), true);
}
