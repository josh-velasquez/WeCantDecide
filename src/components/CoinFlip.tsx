import { useCallback, useState } from 'react'
import { COIN_FLIP_MS } from '../audio/sfx'
import { useSound } from '../context/SoundContext'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { haptic } from '../lib/haptic'

type Face = 'heads' | 'tails'

const HEADS = `${import.meta.env.BASE_URL}heads.png`
const TAILS = `${import.meta.env.BASE_URL}tails.png`

const HEADS_ROTATE_DEG = 90
const TAILS_ROTATE_DEG = 0

/** Wins needed to take the series (best of 3 → first to 2). */
const SERIES_WINS = 2

type Mode = 'single' | 'series'

export function CoinFlip() {
  const { playCoinFlip } = useSound()
  const reducedMotion = usePrefersReducedMotion()
  const flipMs = reducedMotion ? 0 : COIN_FLIP_MS

  const [face, setFace] = useState<Face>('heads')
  const [flipping, setFlipping] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [mode, setMode] = useState<Mode>('single')
  const [series, setSeries] = useState({ heads: 0, tails: 0 })
  const [seriesOver, setSeriesOver] = useState<Face | null>(null)

  const resetSeries = useCallback(() => {
    setSeries({ heads: 0, tails: 0 })
    setSeriesOver(null)
  }, [])

  const flip = useCallback(() => {
    if (flipping) return
    if (mode === 'series' && seriesOver) return
    setFlipping(true)
    if (!reducedMotion) playCoinFlip()
    const next: Face = Math.random() < 0.5 ? 'heads' : 'tails'
    const extraTurns = reducedMotion ? 0 : 4 + Math.floor(Math.random() * 3)
    const base = extraTurns * 360
    const norm = ((rotation % 360) + 360) % 360
    const target = next === 'heads' ? 0 : 180
    let delta = target - norm
    if (delta <= 0) delta += 360
    setRotation((r) => r + base + delta)
    window.setTimeout(() => {
      setFace(next)
      setFlipping(false)
      haptic(14)
      if (mode === 'series') {
        setSeries((prev) => {
          const updated = {
            heads: prev.heads + (next === 'heads' ? 1 : 0),
            tails: prev.tails + (next === 'tails' ? 1 : 0),
          }
          if (updated.heads >= SERIES_WINS) setSeriesOver('heads')
          else if (updated.tails >= SERIES_WINS) setSeriesOver('tails')
          return updated
        })
      }
    }, flipMs)
  }, [flipping, mode, seriesOver, reducedMotion, playCoinFlip, rotation, flipMs])

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-5 sm:gap-6">
      <div
        role="group"
        aria-label="Flip mode"
        className="grid w-full max-w-xs grid-cols-2 gap-1 rounded-xl border border-zinc-800 bg-zinc-900/50 p-1"
      >
        <button
          type="button"
          onClick={() => {
            setMode('single')
            resetSeries()
          }}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
            mode === 'single' ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Single flip
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('series')
            resetSeries()
          }}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
            mode === 'series' ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Best of 3
        </button>
      </div>

      {mode === 'series' && (
        <div className="w-full max-w-xs rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-center text-sm text-zinc-300">
          <p className="tabular-nums">
            <span className="text-zinc-400">Heads</span> {series.heads}
            <span className="mx-2 text-zinc-600">·</span>
            <span className="text-zinc-400">Tails</span> {series.tails}
          </p>
          {seriesOver ? (
            <p className="mt-2 font-semibold capitalize text-violet-300" role="status" aria-live="polite">
              {seriesOver} wins the series
            </p>
          ) : (
            <p className="mt-1 text-xs text-zinc-500">First to {SERIES_WINS} wins</p>
          )}
          {seriesOver && (
            <button
              type="button"
              onClick={resetSeries}
              className="mt-2 text-xs font-medium text-violet-400 hover:text-violet-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              New series
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={flip}
        disabled={flipping || (mode === 'series' && seriesOver != null)}
        className="touch-manipulation group relative cursor-pointer border-0 bg-transparent p-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100"
        aria-label="Flip coin"
      >
        <div className="mx-auto aspect-square w-[min(72vw,12rem)] [perspective:800px] sm:h-56 sm:w-56 sm:max-w-none">
          <div
            className={`relative h-full w-full [transform-style:preserve-3d] ${reducedMotion ? 'wcd-motion-safe' : ''}`}
            style={{
              transform: `rotateX(${rotation}deg)`,
              transition: reducedMotion ? 'none' : `transform ${flipMs}ms cubic-bezier(0.2,0.8,0.2,1)`,
            }}
          >
            <div className="absolute inset-0 overflow-hidden rounded-full border-4 border-amber-400/80 bg-gradient-to-br from-amber-200 to-amber-500 shadow-lg [backface-visibility:hidden]">
              <img
                src={HEADS}
                alt=""
                draggable={false}
                className="h-full w-full rounded-full object-cover object-center p-0.5"
                style={{
                  transform: `rotate(${HEADS_ROTATE_DEG}deg) scale(1.12)`,
                  transformOrigin: 'center center',
                }}
              />
            </div>
            <div
              className="absolute inset-0 overflow-hidden rounded-full border-4 border-slate-400/80 bg-gradient-to-br from-slate-300 to-slate-500 shadow-lg [backface-visibility:hidden]"
              style={{ transform: 'rotateX(180deg)' }}
            >
              <img
                src={TAILS}
                alt=""
                draggable={false}
                className="h-full w-full rounded-full object-cover object-center p-0.5"
                style={{
                  transform: `rotate(${TAILS_ROTATE_DEG}deg) scale(1.12)`,
                  transformOrigin: 'center center',
                }}
              />
            </div>
          </div>
        </div>
      </button>

      <div className="text-center" aria-live="polite">
        <p className="text-base font-medium text-zinc-200 sm:text-lg">
          {flipping ? (
            <span className="text-zinc-500">Flipping…</span>
          ) : (
            <>
              Result: <span className="capitalize text-violet-400">{face}</span>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
