/** Durations must match CSS animation timings in CoinFlip / SpinWheel. */
export const COIN_FLIP_MS = 900
export const WHEEL_SPIN_MS = 4500

function ensureCtx(ctx: AudioContext): Promise<void> {
  if (ctx.state === 'suspended') return ctx.resume().then(() => undefined)
  return Promise.resolve()
}

/** Metallic spin + landing clink, ~COIN_FLIP_MS. */
export function playCoinFlipSound(ctx: AudioContext): void {
  const t0 = ctx.currentTime
  const dur = COIN_FLIP_MS / 1000

  // Noise "tumble" (filtered)
  const noiseLen = Math.floor(ctx.sampleRate * dur)
  const buf = ctx.createBuffer(1, noiseLen, ctx.sampleRate)
  const ch = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < noiseLen; i++) {
    const w = Math.random() * 2 - 1
    last = (last + 0.03 * w) * 0.98
    const env = 1 - i / noiseLen
    ch[i] = last * 0.35 * (0.4 + 0.6 * env)
  }
  const noise = ctx.createBufferSource()
  noise.buffer = buf
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(2400, t0)
  bp.frequency.exponentialRampToValueAtTime(900, t0 + dur * 0.6)
  bp.Q.value = 0.9
  const nGain = ctx.createGain()
  nGain.gain.setValueAtTime(0, t0)
  nGain.gain.linearRampToValueAtTime(0.22, t0 + 0.04)
  nGain.gain.exponentialRampToValueAtTime(0.01, t0 + dur)
  noise.connect(bp).connect(nGain).connect(ctx.destination)
  noise.start(t0)
  noise.stop(t0 + dur)

  // High "zing" layer while spinning
  const osc = ctx.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(520, t0)
  osc.frequency.exponentialRampToValueAtTime(1800, t0 + dur * 0.35)
  osc.frequency.exponentialRampToValueAtTime(400, t0 + dur)
  const oGain = ctx.createGain()
  oGain.gain.setValueAtTime(0, t0)
  oGain.gain.linearRampToValueAtTime(0.045, t0 + 0.02)
  oGain.gain.exponentialRampToValueAtTime(0.001, t0 + dur * 0.85)
  osc.connect(oGain).connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + dur)

  // Landing clink (matches animation end)
  const clink = ctx.createOscillator()
  clink.type = 'sine'
  clink.frequency.setValueAtTime(2200, t0 + dur * 0.92)
  clink.frequency.exponentialRampToValueAtTime(880, t0 + dur)
  const cGain = ctx.createGain()
  cGain.gain.setValueAtTime(0, t0 + dur * 0.88)
  cGain.gain.linearRampToValueAtTime(0.12, t0 + dur * 0.9)
  cGain.gain.exponentialRampToValueAtTime(0.001, t0 + dur + 0.08)
  clink.connect(cGain).connect(ctx.destination)
  clink.start(t0 + dur * 0.88)
  clink.stop(t0 + dur + 0.1)
}

function playTickAt(ctx: AudioContext, when: number, freq: number): void {
  const osc = ctx.createOscillator()
  osc.type = 'square'
  osc.frequency.value = freq
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, when)
  g.gain.linearRampToValueAtTime(0.06, when + 0.003)
  g.gain.exponentialRampToValueAtTime(0.001, when + 0.045)
  const f = ctx.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = 1200
  osc.connect(f).connect(g).connect(ctx.destination)
  osc.start(when)
  osc.stop(when + 0.05)
}

/** Rumble + slowing ticks for ~WHEEL_SPIN_MS (ease-out spacing like wheel deceleration). */
export function playWheelSpinSound(ctx: AudioContext): void {
  const t0 = ctx.currentTime
  const totalMs = WHEEL_SPIN_MS
  const dur = totalMs / 1000

  // Low rumble
  const len = Math.floor(ctx.sampleRate * dur)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1
    last = (last + 0.015 * w) * 0.995
    const p = i / len
    data[i] = last * 0.4 * (1 - p * 0.3)
  }
  const src = ctx.createBufferSource()
  src.buffer = buf
  const low = ctx.createBiquadFilter()
  low.type = 'lowpass'
  low.frequency.value = 420
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 180
  bp.Q.value = 2
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(0.28, t0 + 0.08)
  g.gain.setValueAtTime(0.22, t0 + dur * 0.5)
  g.gain.exponentialRampToValueAtTime(0.02, t0 + dur)
  src.connect(low).connect(bp).connect(g).connect(ctx.destination)
  src.start(t0)
  src.stop(t0 + dur)

  // Ticks: spacing increases (wheel slows) — match cubic ease-out feel
  let tMs = 0
  let i = 0
  while (tMs < totalMs - 30 && i < 180) {
    const p = tMs / totalMs
    const spacing = 28 + p * p * p * 220
    const when = t0 + tMs / 1000
    const freq = 180 + (i % 5) * 35
    playTickAt(ctx, when, freq)
    tMs += spacing
    i++
  }
}

export async function playCoinFlip(ctx: AudioContext | null, muted: boolean): Promise<void> {
  if (muted || !ctx) return
  await ensureCtx(ctx)
  playCoinFlipSound(ctx)
}

export async function playWheelSpin(ctx: AudioContext | null, muted: boolean): Promise<void> {
  if (muted || !ctx) return
  await ensureCtx(ctx)
  playWheelSpinSound(ctx)
}
