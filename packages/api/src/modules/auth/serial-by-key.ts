/**
 * Runs `task` after every earlier task with the same key has finished. OTP checks read the attempt
 * counter, compare the code and write the counter back; without this, parallel guesses for one email
 * all read the same counter and the 5-attempt limit can be exceeded many times over. In-process only,
 * like login-attempts.ts: the API runs as a single process.
 */
const tails = new Map<string, Promise<unknown>>();

export async function serialByKey<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = tails.get(key) ?? Promise.resolve();
  const run = previous.then(task, task);
  const tail = run.catch(() => undefined);
  tails.set(key, tail);
  try {
    return await run;
  } finally {
    if (tails.get(key) === tail) tails.delete(key);
  }
}
