import { useState } from 'react'
import { CoinFlip } from './components/CoinFlip'
import { SpinWheel } from './components/SpinWheel'
import { useSound } from './context/SoundContext'

type Tab = 'coin' | 'wheel'

export default function App() {
  const [tab, setTab] = useState<Tab>('coin')
  const { muted, toggleMuted } = useSound()

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-6 sm:gap-8">
      <button
        type="button"
        onClick={toggleMuted}
        className="fixed right-[max(0.75rem,env(safe-area-inset-right,0px))] top-[max(0.75rem,env(safe-area-inset-top,0px))] z-50 flex h-11 w-11 touch-manipulation items-center justify-center rounded-xl border border-zinc-700/90 bg-zinc-900/90 text-zinc-200 shadow-lg backdrop-blur-sm transition hover:bg-zinc-800 hover:text-zinc-50 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        aria-label={muted ? 'Unmute sound' : 'Mute sound'}
        aria-pressed={muted}
      >
        {muted ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M11 5 6 9H3v6h3l5 4V5Z" />
            <path d="m22 9-6 6" />
            <path d="m16 9 6 6" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M11 5 6 9H3v6h3l5 4V5Z" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        )}
      </button>

      <header className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl md:text-4xl">
          We Can't Decide
        </h1>
      </header>

      <div
        role="tablist"
        aria-label="Decision tools"
        className="grid w-full grid-cols-2 gap-1 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-1 sm:flex sm:w-auto sm:justify-center sm:self-center"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'coin'}
          onClick={() => setTab('coin')}
          className={`touch-manipulation rounded-xl px-3 py-3 text-sm font-medium transition active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 sm:min-h-0 sm:px-5 sm:py-2.5 ${
            tab === 'coin'
              ? 'bg-violet-600 text-white shadow-md'
              : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
          }`}
        >
          Flip a coin
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'wheel'}
          onClick={() => setTab('wheel')}
          className={`touch-manipulation rounded-xl px-3 py-3 text-sm font-medium transition active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 sm:min-h-0 sm:px-5 sm:py-2.5 ${
            tab === 'wheel'
              ? 'bg-violet-600 text-white shadow-md'
              : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
          }`}
        >
          Spinning wheel
        </button>
      </div>

      <main
        role="tabpanel"
        className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/30 px-3 py-8 sm:px-8 sm:py-10"
      >
        {tab === 'coin' ? <CoinFlip /> : <SpinWheel />}
      </main>
    </div>
  )
}
