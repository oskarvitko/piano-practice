import { expect, it, vi } from 'vitest';
import { startPlaybackContext } from './playback-context';

it('selects playback before resuming synchronously in the user gesture', async () => {
  const audioSession = { type: 'auto' };
  const resume = vi.fn(() => {
    expect(audioSession.type).toBe('playback');
    return Promise.resolve();
  });
  const pending = startPlaybackContext(resume, { audioSession });
  expect(resume).toHaveBeenCalledOnce();
  await pending;
});

it('still resumes audio when the Audio Session API is unavailable', async () => {
  const resume = vi.fn(() => Promise.resolve());
  await startPlaybackContext(resume, {});
  expect(resume).toHaveBeenCalledOnce();
});

it('still resumes when Safari rejects changing the session category', async () => {
  const audioSession = {
    get type() {
      return 'auto';
    },
    set type(_value: string) {
      throw new Error('Not supported');
    },
  };
  const resume = vi.fn(() => Promise.resolve());
  await startPlaybackContext(resume, { audioSession });
  expect(resume).toHaveBeenCalledOnce();
});

it('preserves resume failures for the player error message', async () => {
  const error = new Error('AudioContext is interrupted');
  await expect(startPlaybackContext(() => Promise.reject(error), {})).rejects.toBe(error);
});
