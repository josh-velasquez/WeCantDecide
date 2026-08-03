import { useEffect, useState } from 'react'

type Particle = {
  id: number
  color: string
  dx: number
  dy: number
  rot: number
  size: number
}

const COLORS = ['#f472b6', '#a78bfa', '#38bdf8', '#fbbf24', '#4ade80', '#fb7185', '#e879f9']

type Props = {
  /** Bump this to fire a burst (e.g. Date.now()). */
  burstKey: number
  reducedMotion?: boolean
}

/** Lightweight CSS confetti — no canvas dependency. */
export function ConfettiBurst({ burstKey, reducedMotion = false }: Props) {
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    if (!burstKey || reducedMotion) {
      setParticles([])
      return
    }
    const next: Particle[] = Array.from({ length: 48 }, (_, i) => {
      const angle = (Math.PI * 2 * i) / 48 + Math.random() * 0.4
      const speed = 40 + Math.random() * 90
      return {
        id: burstKey + i,
        color: COLORS[i % COLORS.length]!,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed - 30,
        rot: 180 + Math.random() * 220,
        size: 4 + Math.random() * 5,
      }
    })
    setParticles(next)
    const t = window.setTimeout(() => setParticles([]), 1400)
    return () => window.clearTimeout(t)
  }, [burstKey, reducedMotion])

  if (particles.length === 0) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden" aria-hidden>
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute left-1/2 top-[35%] rounded-sm"
          style={{
            width: p.size,
            height: p.size * 0.65,
            backgroundColor: p.color,
            ['--dx' as string]: `${p.dx}px`,
            ['--dy' as string]: `${p.dy}px`,
            ['--rot' as string]: `${p.rot}deg`,
            animation: 'wcd-confetti 1.25s ease-out forwards',
          }}
        />
      ))}
    </div>
  )
}
