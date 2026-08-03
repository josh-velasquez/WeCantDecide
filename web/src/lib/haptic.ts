/** Light haptic tap when supported (no-ops on desktop / denied). */
export function haptic(ms = 12): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms)
    }
  } catch {
    /* ignore */
  }
}
