import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { WHEEL_SPIN_MS } from '../audio/sfx'
import { useSound } from '../context/SoundContext'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { haptic } from '../lib/haptic'
import { loadJson, saveJson } from '../lib/storage'
import { ConfettiBurst } from './ConfettiBurst'

export type WheelOption = {
  id: string
  label: string
  /** Relative slice size / pick chance (1–10). */
  weight: number
  color: string
}

type SliceGeom = { start: number; end: number; mid: number; seg: number }

const STORAGE_OPTIONS = 'wheel-options'
const WEIGHT_MIN = 1
const WEIGHT_MAX = 10

const PRESET_COLORS = [
  'oklch(0.72 0.19 280)',
  'oklch(0.75 0.15 200)',
  'oklch(0.8 0.16 145)',
  'oklch(0.85 0.18 85)',
  'oklch(0.75 0.2 35)',
  'oklch(0.7 0.2 330)',
  'oklch(0.72 0.12 250)',
  'oklch(0.78 0.14 60)',
  'oklch(0.7 0.18 15)',
  'oklch(0.74 0.16 310)',
]

const DEFAULT_OPTIONS: WheelOption[] = [
  { id: '1', label: 'Pizza', weight: 1, color: PRESET_COLORS[0]! },
  { id: '2', label: 'Tacos', weight: 1, color: PRESET_COLORS[1]! },
  { id: '3', label: 'Sushi', weight: 1, color: PRESET_COLORS[2]! },
  { id: '4', label: 'Burger', weight: 1, color: PRESET_COLORS[3]! },
]

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function nextPresetColor(used: string[]): string {
  const unused = PRESET_COLORS.find((c) => !used.includes(c))
  return unused ?? PRESET_COLORS[used.length % PRESET_COLORS.length]!
}

function normalizeOptions(raw: unknown): WheelOption[] {
  if (!Array.isArray(raw)) return DEFAULT_OPTIONS
  const out: WheelOption[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Partial<WheelOption>
    if (typeof o.label !== 'string' || !o.label.trim()) continue
    out.push({
      id: typeof o.id === 'string' ? o.id : newId(),
      label: o.label.trim(),
      weight: Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, Number(o.weight) || 1)),
      color:
        typeof o.color === 'string' && o.color
          ? o.color
          : nextPresetColor(out.map((x) => x.color)),
    })
  }
  return out
}

function sliceGeometry(options: WheelOption[]): SliceGeom[] {
  const total = options.reduce((s, o) => s + o.weight, 0) || 1
  let acc = 0
  return options.map((o) => {
    const start = (acc / total) * 360
    acc += o.weight
    const end = (acc / total) * 360
    return { start, end, mid: (start + end) / 2, seg: end - start }
  })
}

function conicFromOptions(options: WheelOption[], geom: SliceGeom[]): string {
  if (options.length === 0) return 'transparent'
  const parts: string[] = []
  for (let i = 0; i < options.length; i++) {
    const o = options[i]!
    const g = geom[i]!
    const seam = Math.min(0.4, g.seg * 0.08)
    const bodyEnd = Math.max(g.start, g.end - seam)
    parts.push(`${o.color} ${g.start}deg ${bodyEnd}deg`)
    if (seam > 0) parts.push(`rgba(0,0,0,0.4) ${bodyEnd}deg ${g.end}deg`)
  }
  return `conic-gradient(from 0deg, ${parts.join(', ')})`
}

function pickWeightedIndex(options: WheelOption[]): number {
  const total = options.reduce((s, o) => s + o.weight, 0)
  let r = Math.random() * total
  for (let i = 0; i < options.length; i++) {
    r -= options[i]!.weight
    if (r <= 0) return i
  }
  return options.length - 1
}

function verticalLabelFlipDegrees(mid: number): 0 | 180 {
  const m = ((mid % 360) + 360) % 360
  return m >= 90 && m <= 270 ? 180 : 0
}

const HUB_R_CQW = 9.5
const RIM_R_CQW = 50
const MID_R_CQW = (HUB_R_CQW + RIM_R_CQW) / 2

function labelRadialHeightCqw(): number {
  return Math.max(14, RIM_R_CQW - HUB_R_CQW - 4)
}

function norm360(x: number): number {
  return ((x % 360) + 360) % 360
}

export function SpinWheel() {
  const { playWheelSpin } = useSound()
  const reducedMotion = usePrefersReducedMotion()
  const pointerGradId = useId().replace(/:/g, '')
  const spinMs = reducedMotion ? 0 : WHEEL_SPIN_MS

  const [options, setOptions] = useState<WheelOption[]>(() =>
    normalizeOptions(loadJson(STORAGE_OPTIONS, DEFAULT_OPTIONS)),
  )
  const [draft, setDraft] = useState('')
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState<string | null>(null)
  const [animateSpin, setAnimateSpin] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [confettiKey, setConfettiKey] = useState(0)

  const n = options.length
  const geom = useMemo(() => sliceGeometry(options), [options])
  const gradient = useMemo(() => conicFromOptions(options, geom), [options, geom])
  const labelHeightCqw = useMemo(() => labelRadialHeightCqw(), [])
  const optionSignature = useMemo(
    () => options.map((o) => `${o.id}:${o.weight}:${o.color}`).join('|'),
    [options],
  )

  useEffect(() => {
    saveJson(STORAGE_OPTIONS, options)
  }, [options])

  useEffect(() => {
    setAnimateSpin(false)
    setRotation(0)
    setWinner(null)
  }, [optionSignature])

  useEffect(() => {
    if (animateSpin) return
    const id = window.requestAnimationFrame(() => setAnimateSpin(true))
    return () => window.cancelAnimationFrame(id)
  }, [animateSpin])

  const draftTrimmed = draft.trim()
  const isDuplicate =
    draftTrimmed.length > 0 &&
    options.some((opt) => opt.label.toLowerCase() === draftTrimmed.toLowerCase())
  const canAdd = draftTrimmed.length > 0 && !isDuplicate

  const addOption = useCallback(() => {
    const t = draft.trim()
    if (!t) return
    const key = t.toLowerCase()
    if (options.some((opt) => opt.label.toLowerCase() === key)) return
    setOptions((o) => [
      ...o,
      {
        id: newId(),
        label: t,
        weight: 1,
        color: nextPresetColor(o.map((x) => x.color)),
      },
    ])
    setDraft('')
    setWinner(null)
  }, [draft, options])

  const removeAt = useCallback((id: string) => {
    setOptions((o) => o.filter((x) => x.id !== id))
    setWinner(null)
    setEditingId(null)
  }, [])

  const clearAll = useCallback(() => {
    if (spinning || n === 0) return
    setOptions([])
    setWinner(null)
    setEditingId(null)
  }, [spinning, n])

  const setWeight = useCallback((id: string, weight: number) => {
    setOptions((o) =>
      o.map((x) =>
        x.id === id
          ? { ...x, weight: Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, weight)) }
          : x,
      ),
    )
  }, [])

  const cycleColor = useCallback((id: string) => {
    setOptions((o) =>
      o.map((x) => {
        if (x.id !== id) return x
        const idx = PRESET_COLORS.indexOf(x.color)
        const next = PRESET_COLORS[(idx + 1) % PRESET_COLORS.length]!
        return { ...x, color: next }
      }),
    )
  }, [])

  const startEdit = useCallback((opt: WheelOption) => {
    setEditingId(opt.id)
    setEditDraft(opt.label)
  }, [])

  const commitEdit = useCallback(() => {
    if (!editingId) return
    const t = editDraft.trim()
    if (!t) {
      setEditingId(null)
      return
    }
    const key = t.toLowerCase()
    const clash = options.some(
      (o) => o.id !== editingId && o.label.toLowerCase() === key,
    )
    if (clash) return
    setOptions((o) => o.map((x) => (x.id === editingId ? { ...x, label: t } : x)))
    setEditingId(null)
  }, [editingId, editDraft, options])

  const editIsDuplicate =
    editingId != null &&
    editDraft.trim().length > 0 &&
    options.some(
      (o) => o.id !== editingId && o.label.toLowerCase() === editDraft.trim().toLowerCase(),
    )

  const spin = useCallback(() => {
    if (spinning || n < 2) return
    setSpinning(true)
    setWinner(null)
    if (!reducedMotion) playWheelSpin()
    const idx = pickWeightedIndex(options)
    const g = geom[idx]!
    const norm = norm360(rotation)
    const pointsPerSlice = Math.max(16, Math.round(g.seg / 2))
    const edgePad = Math.min(g.seg * 0.04, 1)
    const usable = Math.max(g.seg - 2 * edgePad, 0)
    const point = Math.floor(Math.random() * pointsPerSlice)
    const within = edgePad + ((point + 0.5) / pointsPerSlice) * usable
    const targetMod = norm360(-(g.start + within))
    let delta = targetMod - norm
    if (delta <= 0) delta += 360
    const fullSpins = reducedMotion ? 0 : 4 + Math.floor(Math.random() * 5)
    const next = rotation + fullSpins * 360 + delta
    setRotation(next)
    const delay = spinMs
    window.setTimeout(() => {
      const label = options[idx]?.label ?? null
      setWinner(label)
      setSpinning(false)
      haptic(18)
      if (label) {
        setConfettiKey(Date.now())
      }
    }, delay)
  }, [spinning, n, options, geom, rotation, playWheelSpin, reducedMotion, spinMs])

  const labelTextClass =
    n > 12
      ? 'text-[9px] leading-none sm:text-[10px]'
      : n > 8
        ? 'text-[10px] leading-none sm:text-xs'
        : 'text-[11px] leading-none sm:text-xs'

  const emptyHint =
    n === 0
      ? 'Add some options below to build your wheel.'
      : n === 1
        ? 'Add at least one more option to spin.'
        : null

  return (
    <div className="relative flex w-full max-w-lg flex-col items-center gap-4 sm:gap-6">
      <ConfettiBurst burstKey={confettiKey} reducedMotion={reducedMotion} />

      {n > 0 && (
        <div className="flex w-full max-w-md justify-end">
          <button
            type="button"
            onClick={clearAll}
            disabled={spinning}
            className="touch-manipulation rounded-lg border border-red-500/50 bg-red-950/25 px-3 py-2 text-sm font-medium text-red-300 transition hover:border-red-400/70 hover:bg-red-950/50 hover:text-red-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
          >
            Clear all
          </button>
        </div>
      )}

      {emptyHint && (
        <p className="w-full max-w-md rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-3 text-center text-sm text-zinc-400">
          {emptyHint}
        </p>
      )}

      {winner && !spinning && (
        <p
          className="w-full max-w-[min(360px,calc(100vw-2rem))] break-words rounded-2xl border border-fuchsia-500/35 bg-gradient-to-br from-fuchsia-950/55 to-violet-950/45 px-4 py-3 text-center text-base font-semibold text-fuchsia-100 shadow-inner shadow-black/25 [overflow-wrap:anywhere] sm:px-6 sm:text-lg"
          role="status"
          aria-live="polite"
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

        <div className="relative mt-2 w-full max-w-[min(360px,calc(100vw-2rem))] rounded-full bg-gradient-to-b from-zinc-600 via-zinc-800 to-zinc-950 p-[5px] shadow-[0_0_0_1px_rgba(255,255,255,0.07),0_28px_56px_-16px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-black/40 sm:p-[7px]">
          <div
            className="pointer-events-none absolute inset-[7px] rounded-full shadow-[inset_0_10px_28px_rgba(0,0,0,0.45),inset_0_-4px_12px_rgba(255,255,255,0.05)]"
            aria-hidden
          />
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
            <div
              className="pointer-events-none absolute inset-0 z-[1] rounded-full opacity-[0.18]"
              style={{
                background:
                  'linear-gradient(165deg, rgba(255,255,255,0.55) 0%, transparent 38%, transparent 62%, rgba(255,255,255,0.08) 100%)',
              }}
            />
            <div
              className={`absolute inset-0 z-[2] ${reducedMotion ? 'wcd-motion-safe' : ''}`}
              style={{
                transform: `rotate(${rotation}deg)`,
                transition:
                  animateSpin && !reducedMotion
                    ? `transform ${spinMs}ms cubic-bezier(0.1,0.7,0.1,1)`
                    : 'none',
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
              <div
                className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_48px_rgba(0,0,0,0.35)]"
                aria-hidden
              />

              {options.map((opt, i) => {
                const g = geom[i]!
                const flip = verticalLabelFlipDegrees(g.mid)
                return (
                  <div
                    key={`slice-label-${opt.id}`}
                    className="absolute left-1/2 top-1/2 z-[1]"
                    style={{
                      transform: `translate(-50%, -50%) rotate(${g.mid}deg)`,
                      transformOrigin: 'center',
                    }}
                  >
                    <div
                      className="flex items-center justify-center"
                      style={{
                        transform: `translateY(calc(-1 * ${MID_R_CQW}cqw)) rotate(${flip}deg)`,
                        transformOrigin: 'center center',
                      }}
                    >
                      <div
                        className={`${labelTextClass} max-w-[2.4em] text-center font-semibold leading-tight tracking-tight text-white [overflow-wrap:anywhere] [text-orientation:sideways] [text-shadow:0_1px_3px_rgba(0,0,0,1),0_0_14px_rgba(0,0,0,0.45)] [word-break:break-word] [writing-mode:vertical-rl]`}
                        style={{
                          height: `min(${labelHeightCqw.toFixed(3)}cqw, 6.5rem)`,
                        }}
                        title={opt.weight > 1 ? `${opt.label} (×${opt.weight})` : opt.label}
                      >
                        {opt.label}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

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

      <div className="flex w-full max-w-md flex-col gap-2">
        <div className="flex flex-row items-stretch gap-2 sm:gap-3">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canAdd) addOption()
            }}
            placeholder="Add an option"
            enterKeyHint="done"
            autoComplete="off"
            aria-invalid={isDuplicate}
            className={`min-h-12 min-w-0 flex-1 rounded-xl border bg-zinc-900/80 px-4 py-3 text-base text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 ${
              isDuplicate
                ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/35'
                : 'border-zinc-700 focus:border-violet-500 focus:ring-violet-500/35'
            }`}
          />
          <button
            type="button"
            onClick={addOption}
            disabled={!canAdd}
            className="touch-manipulation min-h-12 min-w-[5.25rem] shrink-0 rounded-xl bg-zinc-800 px-4 py-3 text-base font-medium text-zinc-100 transition hover:bg-zinc-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 sm:min-w-[5.5rem] sm:px-5"
          >
            Add
          </button>
        </div>
        {isDuplicate && (
          <p className="text-center text-sm text-red-400/90" role="status">
            That option is already on the wheel
          </p>
        )}
      </div>

      <ul className="w-full max-w-md space-y-2 text-left [overflow-wrap:anywhere]">
        {options.map((opt) => (
          <li
            key={`opt-row-${opt.id}`}
            className="relative flex min-h-[2.75rem] overflow-hidden rounded-xl border border-zinc-800/90 bg-zinc-900/50 text-sm backdrop-blur-sm"
          >
            <button
              type="button"
              onClick={() => cycleColor(opt.id)}
              className="w-2 shrink-0 self-stretch transition hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500"
              style={{ backgroundColor: opt.color }}
              title="Change color"
              aria-label={`Change color for ${opt.label}`}
            />
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-2 pl-2 pr-9 sm:pl-3">
              {editingId === opt.id ? (
                <input
                  type="text"
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit()
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  onBlur={commitEdit}
                  autoFocus
                  aria-invalid={editIsDuplicate}
                  className={`w-full rounded-lg border bg-zinc-950 px-2 py-1.5 text-center text-zinc-100 focus:outline-none focus:ring-2 ${
                    editIsDuplicate
                      ? 'border-red-500/60 focus:ring-red-500/35'
                      : 'border-zinc-600 focus:ring-violet-500/35'
                  }`}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => startEdit(opt)}
                  className="line-clamp-2 w-full text-center text-zinc-200 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                  title="Edit name"
                >
                  {opt.label}
                  {opt.weight > 1 ? (
                    <span className="ml-1 text-zinc-500">×{opt.weight}</span>
                  ) : null}
                </button>
              )}
              <div className="flex items-center justify-center gap-2">
                <span className="text-[11px] text-zinc-500">Weight</span>
                <button
                  type="button"
                  disabled={spinning || opt.weight <= WEIGHT_MIN}
                  onClick={() => setWeight(opt.id, opt.weight - 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-700 text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
                  aria-label={`Decrease weight for ${opt.label}`}
                >
                  −
                </button>
                <span className="min-w-[1.25rem] text-center tabular-nums text-zinc-300">
                  {opt.weight}
                </span>
                <button
                  type="button"
                  disabled={spinning || opt.weight >= WEIGHT_MAX}
                  onClick={() => setWeight(opt.id, opt.weight + 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-700 text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
                  aria-label={`Increase weight for ${opt.label}`}
                >
                  +
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeAt(opt.id)}
              className="absolute right-1 top-1 flex h-7 w-7 touch-manipulation items-center justify-center rounded-md text-zinc-500 transition hover:bg-red-950/70 hover:text-red-300 active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
              aria-label={`Remove ${opt.label}`}
              title="Remove"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path
                  d="M3.5 3.5l7 7M10.5 3.5l-7 7"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
