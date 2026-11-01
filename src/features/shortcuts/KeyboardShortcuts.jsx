import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

const SHORTCUTS = [
  { keys: 'Alt + Shift + H', label: 'Go to Home', path: '/' },
  { keys: 'Alt + Shift + W', label: 'Go to Workbench', path: '/audit' },
  { keys: 'Alt + Shift + S', label: 'Go to Simulate (vision lenses)', path: '/simulate' },
  { keys: 'Alt + Shift + R', label: 'Go to Report', path: '/report' },
  { keys: 'Alt + Shift + L', label: 'Go to Learn', path: '/learn' },
  { keys: '?', label: 'Open keyboard shortcut help' },
  { keys: 'Escape', label: 'Close keyboard shortcut help' },
];

function isTypingTarget(target) {
  if (!(target instanceof Element)) return false;

  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'),
  );
}

export default function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && open) {
        event.preventDefault();
        setOpen(false);
        return;
      }

      if (event.altKey || event.ctrlKey || event.metaKey) {
        if (
          event.altKey &&
          event.shiftKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          !isTypingTarget(event.target)
        ) {
          const routes = {
            h: '/',
            w: '/audit',
            s: '/simulate',
            r: '/report',
            l: '/learn',
          };
          const path = routes[event.key.toLowerCase()];

          if (path) {
            event.preventDefault();
            setOpen(false);
            navigate(path);
          }
        }

        return;
      }

      if (event.key === '?' && !isTypingTarget(event.target)) {
        event.preventDefault();
        setOpen(true);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector('button')?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="shortcut-dialog"
      aria-labelledby="shortcut-dialog-title"
      onClose={() => setOpen(false)}
    >
      <div className="shortcut-dialog__header">
        <h2 id="shortcut-dialog-title">Keyboard shortcuts</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close keyboard shortcut help"
        >
          Close
        </button>
      </div>

      <p>Use these shortcuts to navigate AccessLab.</p>

      <ul className="shortcut-dialog__list">
        {SHORTCUTS.map(({ keys, label }) => (
          <li key={keys}>
            <span>{label}</span>
            <kbd>{keys}</kbd>
          </li>
        ))}
      </ul>
    </dialog>
  );
}
