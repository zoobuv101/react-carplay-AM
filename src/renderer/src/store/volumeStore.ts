import { create } from 'zustand'

export type StreamType = 'media' | 'navigation' | 'call' | 'other'

export const STREAM_LABEL: Record<StreamType, string> = {
  media: 'Music',
  navigation: 'Navigation',
  call: 'Call',
  other: 'Audio',
}

// Base multiplier applied on top of the user gain, per stream type.
// Keeps the existing upstream behaviour (nav slightly ducked relative to
// media) unless the user overrides. User gain sits on top of these.
export const BASE_GAIN: Record<StreamType, number> = {
  media: 1.0,
  navigation: 1.0,
  call: 1.0,
  other: 1.0,
}

export const DEFAULT_GAINS: Record<StreamType, number> = {
  media: 1.0,
  navigation: 1.2, // nav slightly boosted by default so it cuts through
  call: 1.0,
  other: 1.0,
}

export const MIN_GAIN = 0.0
export const MAX_GAIN = 1.5
export const STEP = 0.05

const ACTIVE_STALE_MS = 500 // stream "active" if packet in last N ms

interface OsdState {
  type: StreamType
  value: number // 0..1 relative to MAX_GAIN — used for bar width
  rawValue: number // current user gain (0..MAX_GAIN)
  muted: boolean
  // timestamp at which the osd should fade out
  hideAt: number
  // monotonically increasing counter so the OSD component can re-trigger
  // its fade-in animation even when the same stream is adjusted twice
  seq: number
}

interface VolumeStore {
  gains: Record<StreamType, number>
  muted: Record<StreamType, boolean>
  activeStream: StreamType
  activeSince: number
  osd: OsdState | null
  _seq: number

  setGainInternal: (t: StreamType, v: number) => void
  loadGains: (g: Partial<Record<StreamType, number>>) => void
  bumpActive: (t: StreamType) => void
  adjustActive: (delta: number) => void
  toggleMuteActive: () => void
  showOsd: (t: StreamType) => void
  hideOsd: () => void
}

const clamp = (v: number) => Math.max(MIN_GAIN, Math.min(MAX_GAIN, v))

export const useVolumeStore = create<VolumeStore>()((set, get) => ({
  gains: { ...DEFAULT_GAINS },
  muted: { media: false, navigation: false, call: false, other: false },
  activeStream: 'media',
  activeSince: 0,
  osd: null,
  _seq: 0,

  setGainInternal: (t, v) => {
    set((s) => ({ gains: { ...s.gains, [t]: clamp(v) } }))
  },

  loadGains: (g) => {
    set((s) => ({
      gains: {
        media: clamp(g.media ?? s.gains.media),
        navigation: clamp(g.navigation ?? s.gains.navigation),
        call: clamp(g.call ?? s.gains.call),
        other: clamp(g.other ?? s.gains.other),
      },
    }))
  },

  bumpActive: (t) => {
    const now = Date.now()
    const s = get()
    // Only change activeStream if the current one has gone stale, OR if
    // priority dictates (call > navigation > media > other).
    const stale = now - s.activeSince > ACTIVE_STALE_MS
    const priority: Record<StreamType, number> = {
      call: 3, navigation: 2, media: 1, other: 0,
    }
    if (stale || priority[t] >= priority[s.activeStream]) {
      set({ activeStream: t, activeSince: now })
    } else {
      set({ activeSince: now })
    }
  },

  adjustActive: (delta) => {
    const s = get()
    const t = s.activeStream
    const next = clamp(s.gains[t] + delta)
    set((prev) => ({
      gains: { ...prev.gains, [t]: next },
      muted: { ...prev.muted, [t]: false },
      _seq: prev._seq + 1,
    }))
    const { _seq } = get()
    set({
      osd: {
        type: t,
        value: next / MAX_GAIN,
        rawValue: next,
        muted: false,
        hideAt: Date.now() + 3000,
        seq: _seq,
      },
    })
  },

  toggleMuteActive: () => {
    const s = get()
    const t = s.activeStream
    const nowMuted = !s.muted[t]
    set((prev) => ({
      muted: { ...prev.muted, [t]: nowMuted },
      _seq: prev._seq + 1,
    }))
    const { _seq } = get()
    set({
      osd: {
        type: t,
        value: nowMuted ? 0 : s.gains[t] / MAX_GAIN,
        rawValue: s.gains[t],
        muted: nowMuted,
        hideAt: Date.now() + 3000,
        seq: _seq,
      },
    })
  },

  showOsd: (t) => {
    const s = get()
    set((prev) => ({ _seq: prev._seq + 1 }))
    const { _seq } = get()
    set({
      osd: {
        type: t,
        value: s.muted[t] ? 0 : s.gains[t] / MAX_GAIN,
        rawValue: s.gains[t],
        muted: s.muted[t],
        hideAt: Date.now() + 3000,
        seq: _seq,
      },
    })
  },

  hideOsd: () => set({ osd: null }),
}))

/**
 * Compute the effective gain for a given stream type, factoring in base
 * multiplier, user gain, and mute state. Callers pass this to
 * PcmPlayer.volume().
 */
export const effectiveGain = (t: StreamType): number => {
  const s = useVolumeStore.getState()
  if (s.muted[t]) return 0
  return BASE_GAIN[t] * s.gains[t]
}
