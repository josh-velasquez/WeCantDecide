import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { WHEEL_SPIN_MS } from '../audio/sfx'
import { useSound } from '../context/SoundContext'

/** Evenly spaced hues so every slice is a different color; no repeats when n ≥ 1. */
function sliceColors(n: number): string[] {
  if (n === 0) return []
  return Array.from({ length: n }, (_, i) => {
    const hue = (i * 360) / n
    return `oklch(0.7 0.2 ${hue})`
  })
}

function conicStops(n: number, colors: string[]): string {
  if (n === 0 || colors.length !== n) return 'transparent'
  const seg = 360 / n
  const parts: string[] = []
  for (let i = 0; i < n; i++) {
    const c = colors[i]!
    const a0 = i * seg
    const a1 = (i + 1) * seg
    parts.push(`${c} ${a0}deg ${a1}deg`)
  }
  /* 0deg = top, clockwise — must match label rotate((i + 0.5) * seg) */
  return `conic-gradient(from 0deg, ${parts.join(', ')})`
}

/**
 * Vertical labels run along the slice bisector (hub → rim). Flip 180° on the left/bottom
 * arc so the string still reads top-to-bottom from the hub outward.
 */
function verticalLabelFlipDegrees(mid: number): 0 | 180 {
  const m = ((mid % 360) + 360) % 360
  return m >= 90 && m <= 270 ? 180 : 0
}

/** Hub outer ≈ 9.5cqw, rim ≈ 50cqw from center — label sits at mid-radius between them. */
const HUB_R_CQW = 9.5
const RIM_R_CQW = 50
const MID_R_CQW = (HUB_R_CQW + RIM_R_CQW) / 2

/** Max tangential width (cqw) so glyphs stay inside slice wedge at mid-radius. */
function maxLabelTangentialCqw(seg: number): number {
  if (seg <= 0) return 6
  const halfSliceRad = (seg * Math.PI) / 360
  const chord = 2 * MID_R_CQW * Math.sin(halfSliceRad)
  return Math.max(1.1, chord * 0.85)
}

/** Max vertical stack (cqw) so text stays between hub and rim along radial. */
function maxLabelRadialCqw(): number {
  return Math.max(12, RIM_R_CQW - HUB_R_CQW - 2)
}

function norm360(x: number): number {
  return ((x % 360) + 360) % 360
}

export function SpinWheel() {
  const { playWheelSpin } = useSound()
  const pointerGradId = useId().replace(/:/g, '')
  const [options, setOptions] = useState<string[]>(['Pizza', 'Tacos', 'Sushi', 'Burger'])
  const [draft, setDraft] = useState('')
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState<string | null>(null)

  const n = options.length
  const seg = n > 0 ? 360 / n : 0
  const colors = useMemo(() => sliceColors(n), [n])
  const gradient = useMemo(() => conicStops(n, colors), [n, colors])

  const maxTangentialCqw = useMemo(() => maxLabelTangentialCqw(seg), [seg])
  const maxRadialCqw = useMemo(() => maxLabelRadialCqw(), [])

  /** Adding/removing slices changes geometry; keeping old rotation misaligns labels vs colors. */
  useEffect(() => {
    setRotation(0)
    setWinner(null)
  }, [n])

  const addOption = useCallback(() => {
    const t = draft.trim()
    if (!t) return
    setOptions((o) => [...o, t])
    setDraft('')
    setWinner(null)
  }, [draft])

  const removeAt = useCallback((index: number) => {
    setOptions((o) => o.filter((_, i) => i !== index))
    setWinner(null)
  }, [])

  const spin = useCallback(() => {
    if (spinning || n < 2) return
    setSpinning(true)
    setWinner(null)
    playWheelSpin()
    const idx = Math.floor(Math.random() * n)
    const norm = norm360(rotation)
    const targetMod = norm360(-(idx + 0.5) * seg)
    let delta = targetMod - norm
    if (delta <= 0) delta += 360
    const fullSpins = 5 + Math.floor(Math.random() * 3)
    const next = rotation + fullSpins * 360 + delta
    setRotation(next)
    window.setTimeout(() => {
      setWinner(options[idx] ?? null)
      setSpinning(false)
    }, WHEEL_SPIN_MS)
  }, [spinning, n, rotation, seg, options, playWheelSpin])

  const labelTextClass =
    n > 12
      ? 'text-[9px] leading-none sm:text-[10px]'
      : n > 8
        ? 'text-[10px] leading-none sm:text-xs'
        : 'text-[11px] leading-none sm:text-xs'

  return (
    <div className="flex w-full max-w-lg flex-col items-center gap-4 sm:gap-6">
      {winner && !spinning && (
        <p
          className="w-full max-w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-fuchsia-500/35 bg-gradient-to-br from-fuchsia-950/55 to-violet-950/45 px-4 py-3 text-center text-base font-semibold text-fuchsia-100 shadow-inner shadow-black/25 sm:px-6 sm:text-lg"
          role="status"
        >
          {winner}
        </p>
      )}

      <div className="relative flex w-full flex-col items-center">
        <div className="pointer-events-none absolute -top-1 left-1/2 z-20 -translate-x-1/2 drop-shadow-[0_3px_8px_rgba(0,0,0,0.9)]">
          <svg width="36" height="24" viewBox="0 0 36 24" aria-hidden className="text-fuchsia-400">
            <polygon points="18,24 0,0 36,0" fill="currentColor" />
            <polygon points="18,19 5,2 31,2" fill={`url(#${pointerGradId})`} opacity="0.4" />
            <defs>
              <linearGradient id={pointerGradId} x1="18" y1="0" x2="18" y2="24" gradientUnits="userSpaceOnUse">
                <stop stopColor="#fff" stopOpacity="0.55" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Outer chrome */}
        <div className="relative mt-2 w-full max-w-[min(360px,calc(100vw-2rem))] rounded-full bg-gradient-to-b from-zinc-600 via-zinc-800 to-zinc-950 p-[5px] shadow-[0_0_0_1px_rgba(255,255,255,0.07),0_28px_56px_-16px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-black/40 sm:p-[7px]">
          <div
            className="pointer-events-none absolute inset-[7px] rounded-full shadow-[inset_0_10px_28px_rgba(0,0,0,0.45),inset_0_-4px_12px_rgba(255,255,255,0.05)]"
            aria-hidden
          />
          {/* Colored rim accent */}
          <div
            className="pointer-events-none absolute inset-[4px] rounded-full opacity-80"
            style={{
              background:
                'conic-gradient(from -90deg, rgba(244,114,182,0.35), rgba(167,139,250,0.25), rgba(56,189,248,0.3), rgba(244,114,182,0.35))',
              maskImage: 'radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 5px))',
              WebkitMaskImage:
                'radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 5px))',
            }}
          />

          <div className="relative aspect-square w-full overflow-hidden rounded-full bg-zinc-950 ring-2 ring-zinc-700/90 [container-type:inline-size]">
            {/* Specular highlight */}
            <div
              className="pointer-events-none absolute inset-0 z-[3] rounded-full opacity-[0.22]"
              style={{
                background:
                  'linear-gradient(165deg, rgba(255,255,255,0.55) 0%, transparent 38%, transparent 62%, rgba(255,255,255,0.08) 100%)',
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: `transform ${WHEEL_SPIN_MS}ms cubic-bezier(0.1,0.7,0.1,1)`,
              }}
            >
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    n > 0
                      ? gradient
                      : 'linear-gradient(145deg, #3f3f46 0%, #18181b 100%)',
                }}
              />
              {n > 0 && (
                <div
                  className="pointer-events-none absolute inset-0 rounded-full opacity-[0.16]"
                  style={{
                    background: `repeating-conic-gradient(from 0deg, transparent 0deg calc(${seg}deg - 0.35deg), rgba(0,0,0,0.55) calc(${seg}deg - 0.35deg) ${seg}deg)`,
                  }}
                />
              )}
              {/* Inner dark vignette */}
              <div
                className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_48px_rgba(0,0,0,0.35)]"
                aria-hidden
              />

              {options.map((label, i) => {
                const mid = (i + 0.5) * seg
                const flip = verticalLabelFlipDegrees(mid)
                return (
                  <div
                    key={`slice-label-${i}`}
                    className="absolute left-1/2 top-1/2 z-[1]"
                    style={{
                      transform: `translate(-50%, -50%) rotate(${mid}deg)`,
                      transformOrigin: 'center',
                    }}
                  >
                    {/* Mid-radius; tangential size capped by chord so text stays inside the slice */}
                    <div
                      className="flex items-center justify-center"
                      style={{
                        transform: `translateY(calc(-1 * ${MID_R_CQW}cqw)) rotate(${flip}deg)`,
                        transformOrigin: 'center center',
                      }}
                    >
                      <div
                        className={`${labelTextClass} min-h-0 min-w-0 overflow-hidden text-center font-semibold tracking-tight text-white [text-orientation:mixed] [text-shadow:0_1px_3px_rgba(0,0,0,1),0_0_14px_rgba(0,0,0,0.45)] [writing-mode:vertical-rl]`}
                        style={{
                          maxWidth: `min(${maxTangentialCqw.toFixed(3)}cqw, 3rem)`,
                          maxHeight: `min(${maxRadialCqw.toFixed(3)}cqw, 7rem)`,
                        }}
                        title={label}
                      >
                        {label}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Hub */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-[4] h-[19%] min-h-[46px] w-[19%] min-w-[46px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-b from-zinc-500 via-zinc-800 to-zinc-950 shadow-[0_6px_16px_rgba(0,0,0,0.55),inset_0_2px_0_rgba(255,255,255,0.15),inset_0_-6px_12px_rgba(0,0,0,0.45)] ring-[3px] ring-zinc-500/70 ring-offset-2 ring-offset-zinc-950/0" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-[5] h-[7%] min-h-[18px] w-[7%] min-w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-white/25 to-transparent opacity-70" />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={spin}
        disabled={spinning || n < 2}
        className="touch-manipulation w-full max-w-xs min-h-12 rounded-2xl bg-gradient-to-b from-violet-500 to-violet-700 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-950/50 ring-1 ring-violet-400/30 transition hover:from-violet-400 hover:to-violet-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 sm:w-auto sm:min-h-0 sm:min-w-[200px] sm:px-8"
      >
        {spinning ? 'Spinning…' : 'Spin'}
      </button>

      <div className="flex w-full max-w-md flex-row items-stretch gap-2 sm:gap-3">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addOption()}
          placeholder="What you want"
          enterKeyHint="done"
          autoComplete="off"
          className="min-h-12 min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-900/80 px-4 py-3 text-base text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/35"
        />
        <button
          type="button"
          onClick={addOption}
          className="touch-manipulation min-h-12 min-w-[5.25rem] shrink-0 rounded-xl bg-zinc-800 px-4 py-3 text-base font-medium text-zinc-100 transition hover:bg-zinc-700 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 sm:min-w-[5.5rem] sm:px-5"
        >
          Add
        </button>
      </div>

      <ul className="w-full max-w-md space-y-2 text-left [overflow-wrap:anywhere]">
        {options.map((opt, i) => (
          <li
            key={`opt-row-${i}`}
            className="flex min-h-[2.75rem] items-stretch gap-0 overflow-hidden rounded-xl border border-zinc-800/90 bg-zinc-900/50 text-sm backdrop-blur-sm"
          >
            <div
              className="w-1.5 shrink-0 self-stretch"
              style={{ backgroundColor: colors[i] ?? 'transparent' }}
              aria-hidden
            />
            <div className="flex min-w-0 flex-1 items-center justify-center px-2 py-2">
              <span className="line-clamp-2 w-full text-center text-zinc-200">{opt}</span>
            </div>
            <div className="flex shrink-0 items-stretch pr-1 sm:pr-2">
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="touch-manipulation flex min-h-11 min-w-[3.25rem] items-center justify-center rounded-lg px-2 py-2 text-xs font-medium text-red-400/90 hover:bg-red-950/60 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 sm:min-h-0 sm:min-w-0 sm:px-3"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
