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
  // Per-type last-seen timestamp so that nav packets keep nav selected as
  // the active stream even while music packets continue to flow.
  lastSeen: Record<StreamType, number>
  osd: OsdState | null
  _seq: number

  setGainInternal: (t: StreamType, v: number) => void
  loadGains: (g: Partial<Record<StreamType, number>>) => void
  bumpActive: (t: StreamType) => void
  adjustActive: (delta: number) => void
  toggleMuteActive: () => void
  showOsd: (t: StreamType) => void
  videoReady: boolean
  setVideoReady: (v: boolean) => void
  hideOsd: () => void
}

const PRIORITY: Record<StreamType, number> = {
  call: 3,
  navigation: 2,
  media: 1,
  other: 0,
}

const computeActive = (lastSeen: Record<StreamType, number>): StreamType => {
  const now = Date.now()
  let best: StreamType = 'media'
  let bestP = -1
  for (const t of Object.keys(PRIORITY) as StreamType[]) {
    const recent = now - lastSeen[t] < ACTIVE_STALE_MS
    if (recent && PRIORITY[t] > bestP) {
      best = t
      bestP = PRIORITY[t]
    }
  }
  return best
}

const clamp = (v: number) => Math.max(MIN_GAIN, Math.min(MAX_GAIN, v))

export const useVolumeStore = create<VolumeStore>()((set, get) => ({
  gains: { ...DEFAULT_GAINS },
  muted: { media: false, navigation: false, call: false, other: false },
  activeStream: 'media',
  lastSeen: { media: 0, navigation: 0, call: 0, other: 0 },
  osd: null,
  videoReady: false,
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
    // Update last-seen for the type that produced the packet, then
    // recompute which stream currently wins (highest-priority type with
    // a packet in the last ACTIVE_STALE_MS). This is the right model:
    // music and nav can flow at the same time, but nav should persist as
    // the "current" stream until it actually stops speaking.
    const now = Date.now()
    const s = get()
    const nextLastSeen = { ...s.lastSeen, [t]: now }
    const nextActive = computeActive(nextLastSeen)
    if (nextActive !== s.activeStream) {
      set({ lastSeen: nextLastSeen, activeStream: nextActive })
    } else {
      set({ lastSeen: nextLastSeen })
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

  setVideoReady: (v) => set({ videoReady: v }),
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
