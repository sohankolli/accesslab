import { useRef } from 'react';
import { ACCEPT } from './fileImport';

/**
 * "Open file": a real button that opens the browser's file picker. The file
 * input itself stays hidden, so Tab reaches one control, not two.
 * @param {{onFiles: (files: File[]) => void}} props
 */
export default function OpenFileButton({ onFiles }) {
  const inputRef = useRef(null);
  return (
    <>
      <button type="button" className="btn btn--sm" onClick={() => inputRef.current?.click()}>
        Open file
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        aria-label="Open an .html, .htm or .css file"
        onChange={(event) => {
          const input = event.currentTarget;
          const files = [...(input.files ?? [])]; // copied: clearing the input empties its list
          input.value = ''; // so choosing the same file again opens it again
          if (files.length) onFiles(files);
        }}
      />
    </>
  );
}
