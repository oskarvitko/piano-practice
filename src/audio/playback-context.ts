interface PlaybackNavigator {
  readonly audioSession?: { type: string };
}

/** Select the media category before resuming audio in the same user gesture. */
export function startPlaybackContext(
  resume: () => Promise<void>,
  browser: PlaybackNavigator = navigator as Navigator & PlaybackNavigator,
): Promise<void> {
  try {
    // iOS otherwise treats Web Audio as ambient audio, silenced by the Ring/Silent switch.
    // https://www.w3.org/TR/audio-session/#audio-session-types
    if (browser.audioSession) browser.audioSession.type = 'playback';
  } catch {
    // This optional API must not prevent playback in browsers that reject the category.
  }
  return resume();
}
