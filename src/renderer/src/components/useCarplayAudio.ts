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
// PcmPlayer.volume() passes this to WebAudio AudioParam.setTargetAtTime
// which takes the ramp duration in **seconds**, not milliseconds.
const RAMP_SEC = 0.2

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
      let applied = 0
      audioPlayers.forEach((p, key) => {
        if (keyToType.get(key) === t) {
          p.volume(gain, RAMP_SEC)
          applied++
        }
      })
      console.log(
        `[volume] applyGainToType type=${t} gain=${gain.toFixed(2)} applied=${applied} players=${audioPlayers.size}`,
      )
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
      const initialGain = effectiveGain(type)
      player.volume(initialGain)
      console.log(
        `[volume] new player key=${audioKey} type=${type} initialGain=${initialGain.toFixed(2)} command=${audio.command}`,
      )
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
      const audioKey = createAudioPlayerKey(audio.decodeType, audio.audioType)

      // Lifecycle commands (re)tag the player with its logical stream
      // type. This MUST run even if audio.volumeDuration is also set,
      // because CarPlay often sends AudioNaviStart together with a
      // fade-in volume ramp — previously our branch order (volumeDuration
      // first) silently swallowed the command and the player stayed
      // tagged as media.
      //
      // AudioNaviStart and AudioMediaStart are unambiguous lifecycle
      // events and are allowed to OVERWRITE any existing tag.
      // AudioOutputStart just means "start playback on this stream" and
      // can fire on a nav stream when it resumes after a pause — so
      // we only use it as a default tag for streams that haven't been
      // tagged at all (otherwise it would clobber navigation).
      if (audio.command === AudioCommand.AudioNaviStart) {
        keyToType.set(audioKey, 'navigation')
      } else if (audio.command === AudioCommand.AudioMediaStart) {
        keyToType.set(audioKey, 'media')
      } else if (
        audio.command === AudioCommand.AudioOutputStart &&
        !keyToType.has(audioKey)
      ) {
        keyToType.set(audioKey, 'media')
      }

      // Determine the logical type for this packet now (possibly just
      // updated above).
      const type =
        keyToType.get(audioKey) ?? streamTypeFromCommand(audio.command)

      // Keep the "currently active stream" signal fresh so the OSD can
      // label correctly when the user turns the knob.
      useVolumeStore.getState().bumpActive(type)

      if (audio.volumeDuration) {
        // Protocol-level volume ramp (e.g., nav-start fade-in). Scale by
        // the user's current gain for this stream so the ramp respects
        // user preferences.
        const player = getAudioPlayer(audio)
        const scale = effectiveGain(type)
        // audio.volumeDuration arrives in ms from the CarPlay protocol;
        // PcmPlayer.volume takes seconds for its Web Audio ramp.
        player.volume(audio.volume * scale, audio.volumeDuration / 1000)
      } else if (audio.command) {
        switch (audio.command) {
          case AudioCommand.AudioNaviStart:
          case AudioCommand.AudioMediaStart:
          case AudioCommand.AudioOutputStart: {
            const p = getAudioPlayer(audio)
            p.volume(effectiveGain(type), RAMP_SEC)
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
