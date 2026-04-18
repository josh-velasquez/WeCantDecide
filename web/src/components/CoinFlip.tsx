import { useCallback, useState } from 'react'
import { COIN_FLIP_MS } from '../audio/sfx'
import { useSound } from '../context/SoundContext'

type Face = 'heads' | 'tails'

const HEADS = `${import.meta.env.BASE_URL}heads.png`
const TAILS = `${import.meta.env.BASE_URL}tails.png`

/** Turn each face on the coin (CSS degrees: positive = clockwise). Tweak if a PNG is sideways. */
const HEADS_ROTATE_DEG = 90
const TAILS_ROTATE_DEG = 0

export function CoinFlip() {
  const { playCoinFlip } = useSound()
  const [face, setFace] = useState<Face>('heads')
  const [flipping, setFlipping] = useState(false)
  const [rotation, setRotation] = useState(0)

  const flip = useCallback(() => {
    if (flipping) return
    setFlipping(true)
    playCoinFlip()
    const next: Face = Math.random() < 0.5 ? 'heads' : 'tails'
    const extraTurns = 4 + Math.floor(Math.random() * 3)
    const base = extraTurns * 360
    const norm = ((rotation % 360) + 360) % 360
    const target = next === 'heads' ? 0 : 180
    let delta = target - norm
    if (delta <= 0) delta += 360
    setRotation((r) => r + base + delta)
    window.setTimeout(() => {
      setFace(next)
      setFlipping(false)
    }, COIN_FLIP_MS)
  }, [flipping, playCoinFlip, rotation])

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6 sm:gap-8">
      <p className="max-w-sm px-1 text-center text-sm leading-relaxed text-zinc-400 sm:text-base">
        Stick to the result.
      </p>

      <button
        type="button"
        onClick={flip}
        disabled={flipping}
        className="touch-manipulation group relative cursor-pointer border-0 bg-transparent p-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-[0.98] disabled:cursor-wait disabled:active:scale-100"
        aria-label="Flip coin"
      >
        <div className="mx-auto aspect-square w-[min(72vw,12rem)] [perspective:800px] sm:h-56 sm:w-56 sm:max-w-none">
          <div
            className="relative h-full w-full [transform-style:preserve-3d]"
            style={{
              transform: `rotateX(${rotation}deg)`,
              transition: `transform ${COIN_FLIP_MS}ms cubic-bezier(0.2,0.8,0.2,1)`,
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

      <p className="text-base font-medium text-zinc-200 sm:text-lg" aria-live="polite">
        {flipping ? (
          <span className="text-zinc-500">Flipping…</span>
        ) : (
          <>
            Result:{' '}
            <span className="text-violet-400 capitalize">{face}</span>
          </>
        )}
      </p>
    </div>
  )
}
