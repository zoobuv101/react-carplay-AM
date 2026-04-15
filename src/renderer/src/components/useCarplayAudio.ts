import { useCallback, useEffect, useState } from 'react'
import {
  AudioCommand,
  AudioData,
  WebMicrophone,
  decodeTypeMap,
} from 'node-carplay/web'
import { PcmPlayer } from 'pcm-ringbuf-player'
import { AudioPlayerKey, CarPlayWorker } from './worker/types'
import { createAudioPlayerKey } from './worker/utils'
import {
  StreamType,
  useVolumeStore,
  effectiveGain,
} from '../store/volumeStore'

// Reasonable short ramp so volume changes never click/pop.
const RAMP_MS = 200

/**
 * Infer logical stream type from the AudioCommand that provisioned this
 * player. Unknown commands fall through to 'other' so they still get
 * user-gain control via the OSD.
 */
const streamTypeFromCommand = (
  command: AudioCommand | undefined,
): StreamType => {
  switch (command) {
    case AudioCommand.AudioNaviStart:
      return 'navigation'
    case AudioCommand.AudioMediaStart:
    case AudioCommand.AudioOutputStart:
      return 'media'
    // node-carplay doesn't today surface a distinct call/alert command,
    // so such streams land in 'other' until we add a heuristic.
    default:
      return 'other'
  }
}

const useCarplayAudio = (
  worker: CarPlayWorker,
  microphonePort: MessagePort,
) => {
  const [mic, setMic] = useState<WebMicrophone | null>(null)
  const [audioPlayers] = useState(new Map<AudioPlayerKey, PcmPlayer>())
  // Per-player logical stream type so the volume store can address the
  // right set of players when the user turns the knob.
  const [keyToType] = useState(new Map<AudioPlayerKey, StreamType>())

  const applyGainToType = useCallback(
    (t: StreamType) => {
      const gain = effectiveGain(t)
      audioPlayers.forEach((p, key) => {
        if (keyToType.get(key) === t) p.volume(gain, RAMP_MS)
      })
    },
    [audioPlayers, keyToType],
  )

  const getAudioPlayer = useCallback(
    (audio: AudioData): PcmPlayer => {
      const { decodeType, audioType } = audio
      const format = decodeTypeMap[decodeType]
      const audioKey = createAudioPlayerKey(decodeType, audioType)
      let player = audioPlayers.get(audioKey)
      if (player) return player
      player = new PcmPlayer(format.frequency, format.channel)
      audioPlayers.set(audioKey, player)
      const type = streamTypeFromCommand(audio.command)
      keyToType.set(audioKey, type)
      player.volume(effectiveGain(type))
      player.start()
      worker.postMessage({
        type: 'audioPlayer',
        payload: {
          sab: player.sab,
          decodeType,
          audioType,
        },
      })
      return player
    },
    [audioPlayers, keyToType, worker],
  )

  const processAudio = useCallback(
    (audio: AudioData) => {
      // Determine the logical type for this packet. For first-packet
      // (before getAudioPlayer has tagged it) fall back to the command.
      const audioKey = createAudioPlayerKey(audio.decodeType, audio.audioType)
      const type =
        keyToType.get(audioKey) ?? streamTypeFromCommand(audio.command)

      // Keep the "currently active stream" signal fresh so the OSD can
      // label correctly when the user turns the knob.
      useVolumeStore.getState().bumpActive(type)

      if (audio.volumeDuration) {
        // Protocol-level volume ramp (e.g., nav-start fade-in). Respect it
        // by scaling against the user's current gain so ducking still
        // tracks user preferences.
        const player = getAudioPlayer(audio)
        const scale = effectiveGain(type)
        player.volume(audio.volume * scale, audio.volumeDuration)
      } else if (audio.command) {
        switch (audio.command) {
          case AudioCommand.AudioNaviStart:
          case AudioCommand.AudioMediaStart:
          case AudioCommand.AudioOutputStart: {
            // Force the tag to match the current command and apply the
            // user's stored gain for that type.
            keyToType.set(audioKey, streamTypeFromCommand(audio.command))
            const p = getAudioPlayer(audio)
            p.volume(effectiveGain(keyToType.get(audioKey)!), RAMP_MS)
            break
          }
        }
      }
    },
    [getAudioPlayer, keyToType],
  )

  // React to user-driven gain changes from the volume store: whenever the
  // per-type gains map changes, reapply gain to every active player of
  // that type.
  useEffect(() => {
    let prev = useVolumeStore.getState().gains
    let prevMuted = useVolumeStore.getState().muted
    const unsub = useVolumeStore.subscribe((s) => {
      ;(Object.keys(s.gains) as StreamType[]).forEach((t) => {
        if (s.gains[t] !== prev[t] || s.muted[t] !== prevMuted[t]) {
          applyGainToType(t)
        }
      })
      prev = s.gains
      prevMuted = s.muted
    })
    return unsub
  }, [applyGainToType])

  // audio init
  useEffect(() => {
    const initMic = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        })
        const mic = new WebMicrophone(mediaStream, microphonePort)
        setMic(mic)
      } catch (err) {
        console.error('Failed to init microphone', err)
      }
    }

    initMic()

    return () => {
      audioPlayers.forEach(p => p.stop())
    }
  }, [audioPlayers, worker, microphonePort])

  const startRecording = useCallback(() => {
    mic?.start()
  }, [mic])

  const stopRecording = useCallback(() => {
    mic?.stop()
  }, [mic])

  return { processAudio, getAudioPlayer, startRecording, stopRecording }
}

export default useCarplayAudio
