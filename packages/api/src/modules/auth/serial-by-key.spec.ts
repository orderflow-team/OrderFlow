import { serialByKey } from './serial-by-key';

describe('serialByKey', () => {
  it('runs tasks with the same key one at a time, in order', async () => {
    const events: string[] = [];
    const slow = serialByKey('a', async () => {
      events.push('slow:start');
      await new Promise((r) => setTimeout(r, 20));
      events.push('slow:end');
    });
    const fast = serialByKey('a', async () => {
      events.push('fast');
    });
    await Promise.all([slow, fast]);
    expect(events).toEqual(['slow:start', 'slow:end', 'fast']);
  });

  it('does not block other keys', async () => {
    const events: string[] = [];
    const slow = serialByKey('a', async () => {
      await new Promise((r) => setTimeout(r, 20));
      events.push('a');
    });
    const other = serialByKey('b', async () => {
      events.push('b');
    });
    await Promise.all([slow, other]);
    expect(events).toEqual(['b', 'a']);
  });

  it('keeps running later tasks after one rejects', async () => {
    const failing = serialByKey('a', async () => {
      throw new Error('boom');
    });
    await expect(failing).rejects.toThrow('boom');
    await expect(serialByKey('a', async () => 'ok')).resolves.toBe('ok');
  });
});
