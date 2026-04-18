import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { playCoinFlip, playWheelSpin } from '../audio/sfx'

const STORAGE_KEY = 'wcd-sound-muted'

type SoundContextValue = {
  muted: boolean
  toggleMuted: () => void
  playCoinFlip: () => void
  playWheelSpin: () => void
}

const SoundContext = createContext<SoundContextValue | null>(null)

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

  const getCtx = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (Ctx) ctxRef.current = new Ctx()
    }
    return ctxRef.current
  }, [])

  const toggleMuted = useCallback(() => {
    setMuted((m) => {
      const next = !m
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
    void getCtx()?.resume()
  }, [getCtx])

  const doCoin = useCallback(() => {
    void playCoinFlip(getCtx(), muted)
  }, [getCtx, muted])

  const doWheel = useCallback(() => {
    void playWheelSpin(getCtx(), muted)
  }, [getCtx, muted])

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
