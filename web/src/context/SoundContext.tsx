import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { playCoinFlip, playWheelSpin, unlockAudio } from '../audio/sfx'

const STORAGE_KEY = 'wcd-sound-muted'

type SoundContextValue = {
  muted: boolean
  toggleMuted: () => void
  playCoinFlip: () => void
  playWheelSpin: () => void
}

const SoundContext = createContext<SoundContextValue | null>(null)

function createAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  return new AC()
}

export function SoundProvider({ children }: { children: ReactNode }) {
  /** Default off; only `localStorage === '0'` means the user enabled sound. */
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== '0'
    } catch {
      return true
    }
  })
  const ctxRef = useRef<AudioContext | null>(null)
  const mutedRef = useRef(muted)
  mutedRef.current = muted

  const getCtx = useCallback((): AudioContext | null => {
    if (!ctxRef.current) ctxRef.current = createAudioContext()
    return ctxRef.current
  }, [])

  /**
   * Kick resume in the same synchronous turn as the tap (required on iOS).
   * Full unlock (silent buffer) may finish async right after.
   */
  const primeFromGesture = useCallback((): AudioContext | null => {
    const ctx = getCtx()
    if (!ctx) return null
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }
    void unlockAudio(ctx)
    return ctx
  }, [getCtx])

  const toggleMuted = useCallback(() => {
    setMuted((m) => {
      const next = !m
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      // Unlock while we still have the unmute tap gesture.
      if (!next) primeFromGesture()
      return next
    })
  }, [primeFromGesture])

  // Keep context alive after backgrounding / silent switch quirks on mobile.
  useEffect(() => {
    const onVisible = () => {
      if (mutedRef.current) return
      const ctx = ctxRef.current
      if (ctx?.state === 'suspended') void unlockAudio(ctx)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // One-shot unlock on first pointer/touch after sound is enabled.
  useEffect(() => {
    if (muted) return
    const unlock = () => {
      primeFromGesture()
    }
    document.addEventListener('pointerdown', unlock, { once: true, capture: true })
    document.addEventListener('touchstart', unlock, { once: true, capture: true })
    return () => {
      document.removeEventListener('pointerdown', unlock, true)
      document.removeEventListener('touchstart', unlock, true)
    }
  }, [muted, primeFromGesture])

  const doCoin = useCallback(() => {
    if (mutedRef.current) return
    const ctx = primeFromGesture()
    void playCoinFlip(ctx, false)
  }, [primeFromGesture])

  const doWheel = useCallback(() => {
    if (mutedRef.current) return
    const ctx = primeFromGesture()
    void playWheelSpin(ctx, false)
  }, [primeFromGesture])

  const value = useMemo(
    () => ({
      muted,
      toggleMuted,
      playCoinFlip: doCoin,
      playWheelSpin: doWheel,
    }),
    [muted, toggleMuted, doCoin, doWheel],
  )

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>
}

export function useSound(): SoundContextValue {
  const v = useContext(SoundContext)
  if (!v) throw new Error('useSound must be used within SoundProvider')
  return v
}
