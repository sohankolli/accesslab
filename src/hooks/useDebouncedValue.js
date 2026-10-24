// hooks/useDebouncedValue.js
import { useEffect, useState } from 'react';

/** Returns `value`, but only after it has stopped changing for `delay` ms. */
export function useDebouncedValue(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer); // a new keystroke cancels the pending update
  }, [value, delay]);
  return debounced;
}
