export function validateAtlasSeedanceDurations(videos = [], audios = []) {
  for (const [kind, durations] of [['video', videos], ['audio', audios]]) {
    if (durations.some(seconds => !Number.isFinite(seconds) || seconds < 2 || seconds > 30) || durations.reduce((sum, seconds) => sum + seconds, 0) > 30.01) {
      throw Object.assign(new Error('Atlas Seedance 2.5 reference ' + kind + ' must be readable, 2–30 seconds per clip, and no more than 30 seconds combined. No generation was submitted.'), { status: 400 });
    }
  }
}
