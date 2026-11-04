// The app's side of the model worker: one worker for the whole app, started on
// first use, with promises in place of messages.

let instance = null;

/**
 * @param {() => Worker} [createWorker]  for tests; the app uses the real worker
 * @returns {{ready: Promise<object>, score: (rows: Float32Array) => Promise<{p: Float32Array, ms: number}>}}
 *   ready resolves with the manifest, or rejects with a plain message when the
 *   model cannot be used (the app then carries on with rules only).
 */
export function modelClient(
  createWorker = () =>
    new Worker(new URL('./clickables.worker.js', import.meta.url), { type: 'module' }),
) {
  if (instance) return instance;
  let worker;
  try {
    worker = createWorker();
  } catch (err) {
    const failed = Promise.reject(new Error(`The model worker could not start: ${err.message}`));
    failed.catch(() => {}); // the caller reads the reason from `ready`
    instance = { ready: failed, score: () => failed };
    return instance;
  }

  const pending = new Map();
  let nextId = 1;
  let settleReady;
  const ready = new Promise((resolve, reject) => {
    settleReady = { resolve, reject };
  });

  worker.onmessage = ({ data }) => {
    if (data.type === 'ready') settleReady.resolve(data.manifest);
    else if (data.type === 'unavailable') settleReady.reject(new Error(data.message));
    else {
      const job = pending.get(data.id);
      if (!job) return;
      pending.delete(data.id);
      if (data.type === 'scores') job.resolve({ p: data.p, ms: data.ms });
      else job.reject(new Error(data.message));
    }
  };
  worker.onerror = (event) => {
    const err = new Error(`The model worker stopped: ${event.message || 'unknown error'}`);
    settleReady.reject(err);
    for (const job of pending.values()) job.reject(err);
    pending.clear();
  };
  worker.postMessage({ type: 'load' });

  instance = {
    ready,
    score(rows) {
      return ready.then(
        () =>
          new Promise((resolve, reject) => {
            const id = nextId++;
            pending.set(id, { resolve, reject });
            worker.postMessage({ type: 'score', id, rows }, [rows.buffer]);
          }),
      );
    },
  };
  return instance;
}

/** Forget the worker (tests only). */
export function resetModelClient() {
  instance = null;
}
